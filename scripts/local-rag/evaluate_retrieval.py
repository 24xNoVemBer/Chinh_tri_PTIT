"""Run a content-redacted BM25 baseline against a private pilot corpus."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import sys
import tempfile
import time
import unicodedata

from corpus import load_private_corpus


ROOT = Path(__file__).resolve().parents[2]
MBA_PATH = Path(os.environ.get("MBA_API_PATH", ROOT.parent / "ChatBot" / "MBA_API"))
sys.path.insert(0, str(MBA_PATH))
from course_rag import bm25_scores, tokenize  # noqa: E402


STOP_WORDS = set(
    "là gì và của trong một những các có được như nào về cho với hãy tôi bạn mình này đó ở theo".split()
)
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


def evaluate_cases(chunks: list[dict], cases: list[dict], score_fn=bm25_scores) -> dict:
    chunk_texts = [chunk["text"] for chunk in chunks]
    results = []
    started = time.monotonic()
    for case in cases:
        query = " ".join(token for token in tokenize(case["question"]) if token not in STOP_WORDS)
        scores = score_fn(query, chunk_texts)
        ranked = sorted(enumerate(scores), key=lambda item: item[1], reverse=True)
        positive = [(index, score) for index, score in ranked if score > 0]
        max_score = positive[0][1] if positive else 0
        detail = {
            "id": case["id"],
            "category": case["category"],
            "expectedBehavior": case["expectedBehavior"],
            "maxScore": round(max_score, 6),
            "topPages": [chunks[index]["pdfPageStart"] for index, _score in positive[:5]],
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
        }
        if selected[0]["expectedBehavior"] == "retrieve":
            for top_k in (1, 3, 5):
                categories[category][f"coverageAt{top_k}"] = round(
                    sum(result["coverage"][str(top_k)]["passed"] for result in selected)
                    / len(selected),
                    4,
                )
    passed = sum(result["passed"] for result in results)
    return {
        "summary": {
            "cases": len(results),
            "passed": passed,
            "passRate": round(passed / len(results), 4),
            "durationMs": round((time.monotonic() - started) * 1000),
            "categories": categories,
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
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    manifest, chunks = load_private_corpus(args.manifest)
    eval_raw = args.eval_set.read_bytes()
    eval_payload = json.loads(eval_raw)
    cases = validate_eval(eval_payload, manifest["datasetId"])
    evaluation = evaluate_cases(chunks, cases)
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
        "retrieverVersion": "mba-course-rag-bm25-pilot-v1",
        "decisionThreshold": "score > 0",
        "notice": "Keyword-proxy baseline only; not an academic correctness score.",
        **evaluation,
    }
    if args.output:
        atomic_write(args.output.resolve(), report)
    print(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
