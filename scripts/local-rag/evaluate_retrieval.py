"""Run a content-redacted BM25 baseline against a private pilot corpus."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
from statistics import median
import sys
import tempfile
import time
import unicodedata

from corpus import load_private_corpus
from query_gate import GATE_VERSION, evaluate_query
from retrieval import LEGACY_PROFILE, prepare_retrieval_query, retriever_version


ROOT = Path(__file__).resolve().parents[2]
MBA_PATH = Path(os.environ.get("MBA_API_PATH", ROOT.parent / "ChatBot" / "MBA_API"))
sys.path.insert(0, str(MBA_PATH))
from course_rag import bm25_scores, tokenize  # noqa: E402


ALLOWED_CATEGORIES = {"direct", "paraphrase", "multi_part", "out_of_scope", "prompt_injection"}
ALLOWED_BEHAVIORS = {"retrieve", "abstain"}


def normalize(value: str) -> str:
    return unicodedata.normalize("NFC", value).casefold()


def validate_eval(payload: dict, dataset_id: str) -> list[dict]:
    if set(payload) != {
        "schemaVersion",
        "datasetId",
        "status",
        "language",
        "description",
        "cases",
    }:
        raise ValueError("Eval set fields do not match retrieval-eval-1")
    if payload["schemaVersion"] != "retrieval-eval-1" or payload["datasetId"] != dataset_id:
        raise ValueError("Eval set targets a different dataset")
    if payload["status"] != "draft_unreviewed" or payload["language"] != "vi-VN":
        raise ValueError("Eval set status or language is invalid")
    cases = payload["cases"]
    if not isinstance(cases, list) or not cases:
        raise ValueError("Eval set must contain cases")
    ids = set()
    for case in cases:
        if set(case) != {
            "id",
            "category",
            "question",
            "expectedBehavior",
            "expectedTermGroups",
        }:
            raise ValueError("Eval case fields are invalid")
        if case["id"] in ids or not case["id"]:
            raise ValueError("Eval case IDs must be non-empty and unique")
        ids.add(case["id"])
        if case["category"] not in ALLOWED_CATEGORIES:
            raise ValueError("Eval category is invalid")
        if case["expectedBehavior"] not in ALLOWED_BEHAVIORS:
            raise ValueError("Eval behavior is invalid")
        groups = case["expectedTermGroups"]
        if case["expectedBehavior"] == "retrieve" and not groups:
            raise ValueError("Retrieval cases require expected term groups")
        if case["expectedBehavior"] == "abstain" and groups:
            raise ValueError("Abstention cases cannot contain expected term groups")
        if not all(isinstance(group, list) and group and all(term for term in group) for group in groups):
            raise ValueError("Expected term groups are invalid")
    return cases


def evaluate_cases(
    chunks: list[dict],
    cases: list[dict],
    score_fn=bm25_scores,
    gate_fn=None,
    retrieval_profile=LEGACY_PROFILE,
) -> dict:
    chunk_texts = [chunk["text"] for chunk in chunks]
    results = []
    started = time.monotonic()
    for case in cases:
        gate = gate_fn(case["question"]) if gate_fn else {
            "allowed": True,
            "reason": "not_configured",
            "version": "none",
        }
        query, expansion_terms = prepare_retrieval_query(
            case["question"], tokenize, retrieval_profile
        )
        scores = score_fn(query, chunk_texts) if gate["allowed"] else [0.0] * len(chunks)
        ranked = sorted(enumerate(scores), key=lambda item: item[1], reverse=True)
        positive = [(index, score) for index, score in ranked if score > 0]
        max_score = positive[0][1] if positive else 0
        detail = {
            "id": case["id"],
            "category": case["category"],
            "expectedBehavior": case["expectedBehavior"],
            "maxScore": round(max_score, 6),
            "topPages": [chunks[index]["pdfPageStart"] for index, _score in positive[:5]],
            "gate": gate,
            "expansionTerms": expansion_terms,
        }
        if case["expectedBehavior"] == "abstain":
            detail["abstained"] = not positive
            detail["passed"] = detail["abstained"]
        else:
            coverage = {}
            group_count = len(case["expectedTermGroups"])
            for top_k in (1, 3, 5):
                combined = normalize("\n".join(chunks[index]["text"] for index, _ in positive[:top_k]))
                matched = sum(
                    any(normalize(term) in combined for term in group)
                    for group in case["expectedTermGroups"]
                )
                coverage[str(top_k)] = {
                    "matchedGroups": matched,
                    "totalGroups": group_count,
                    "passed": matched == group_count,
                }
            detail["coverage"] = coverage
            detail["passed"] = coverage["5"]["passed"]
        results.append(detail)

    categories = {}
    for category in sorted(ALLOWED_CATEGORIES):
        selected = [result for result in results if result["category"] == category]
        if not selected:
            continue
        categories[category] = {
            "cases": len(selected),
            "passed": sum(result["passed"] for result in selected),
            "passRate": round(sum(result["passed"] for result in selected) / len(selected), 4),
            "failedCaseIds": [result["id"] for result in selected if not result["passed"]],
        }
        if selected[0]["expectedBehavior"] == "retrieve":
            for top_k in (1, 3, 5):
                categories[category][f"coverageAt{top_k}"] = round(
                    sum(result["coverage"][str(top_k)]["passed"] for result in selected)
                    / len(selected),
                    4,
                )
    passed = sum(result["passed"] for result in results)
    score_distributions = {}
    for behavior in sorted(ALLOWED_BEHAVIORS):
        values = [result["maxScore"] for result in results if result["expectedBehavior"] == behavior]
        score_distributions[behavior] = {
            "minimum": min(values),
            "median": round(median(values), 6),
            "maximum": max(values),
        }

    retrieve_results = [result for result in results if result["expectedBehavior"] == "retrieve"]
    abstain_results = [result for result in results if result["expectedBehavior"] == "abstain"]

    def threshold_metrics(threshold: float) -> dict:
        retrieval_passed = sum(
            result["coverage"]["5"]["passed"] and result["maxScore"] > threshold
            for result in retrieve_results
        )
        abstention_passed = sum(
            result["maxScore"] <= threshold for result in abstain_results
        )
        retrieval_rate = retrieval_passed / len(retrieve_results)
        abstention_rate = abstention_passed / len(abstain_results)
        return {
            "threshold": round(threshold, 6),
            "retrievalPassRate": round(retrieval_rate, 4),
            "abstentionRate": round(abstention_rate, 4),
            "balancedScore": round((retrieval_rate + abstention_rate) / 2, 4),
        }

    candidates = sorted({0.0, *(result["maxScore"] for result in results)})
    sweeps = [threshold_metrics(threshold) for threshold in candidates]
    best_threshold = max(
        sweeps,
        key=lambda item: (
            item["balancedScore"],
            item["abstentionRate"],
            item["retrievalPassRate"],
            -item["threshold"],
        ),
    )
    operating_points = [threshold_metrics(threshold) for threshold in (0, 5, 10, 15, 20)]
    return {
        "summary": {
            "cases": len(results),
            "passed": passed,
            "passRate": round(passed / len(results), 4),
            "durationMs": round((time.monotonic() - started) * 1000),
            "categories": categories,
            "maxScoreDistributions": score_distributions,
            "thresholdAnalysis": {
                "rule": "retrieve when maxScore > threshold",
                "bestBalancedObserved": best_threshold,
                "operatingPoints": operating_points,
                "warning": "Exploratory only; selecting a threshold on this draft set would overfit.",
            },
            "gateAnalysis": {
                "version": results[0]["gate"]["version"],
                "retrieveAccepted": sum(result["gate"]["allowed"] for result in retrieve_results),
                "retrieveTotal": len(retrieve_results),
                "abstainRejected": sum(not result["gate"]["allowed"] for result in abstain_results),
                "abstainTotal": len(abstain_results),
            },
        },
        "cases": results,
    }


def atomic_write(path: Path, payload: dict) -> None:
    raw = (json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode()
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as handle:
        handle.write(raw)
        temporary = Path(handle.name)
    os.replace(temporary, path)
    try:
        path.chmod(0o600)
    except OSError:
        pass


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--eval-set", required=True, type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--summary-only", action="store_true")
    parser.add_argument("--query-gate", choices=["none", "domain-v1"], default="none")
    parser.add_argument(
        "--retrieval-profile",
        choices=["legacy-v1", "top5-v2", "expanded-v3"],
        default="legacy-v1",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    manifest, chunks = load_private_corpus(args.manifest)
    eval_raw = args.eval_set.read_bytes()
    eval_payload = json.loads(eval_raw)
    cases = validate_eval(eval_payload, manifest["datasetId"])
    gate_fn = evaluate_query if args.query_gate == "domain-v1" else None
    evaluation = evaluate_cases(
        chunks, cases, gate_fn=gate_fn, retrieval_profile=args.retrieval_profile
    )
    report = {
        "schemaVersion": "retrieval-baseline-1",
        "status": "draft_unreviewed",
        "contentRedacted": True,
        "datasetId": manifest["datasetId"],
        "materialVersionId": manifest["materialVersionId"],
        "sourceSha256": manifest["source"]["sha256"],
        "chunksSha256": manifest["chunksSha256"],
        "indexVersion": manifest["indexVersion"],
        "evalSetSha256": hashlib.sha256(eval_raw).hexdigest(),
        "retrieverVersion": retriever_version(args.retrieval_profile),
        "queryGateVersion": GATE_VERSION if gate_fn else "none",
        "decisionThreshold": "score > 0",
        "notice": "Keyword-proxy baseline only; not an academic correctness score.",
        **evaluation,
    }
    if args.output:
        atomic_write(args.output.resolve(), report)
    printed = report["summary"] if args.summary_only else report
    print(json.dumps(printed, ensure_ascii=False, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
