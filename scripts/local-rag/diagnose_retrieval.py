"""Diagnose private-corpus BM25 ranking without calling a model provider."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import sys
import unicodedata

from corpus import load_private_corpus
from query_gate import evaluate_query


ROOT = Path(__file__).resolve().parents[2]
MBA_PATH = Path(os.environ.get("MBA_API_PATH", ROOT.parent / "ChatBot" / "MBA_API"))
sys.path.insert(0, str(MBA_PATH))
from course_rag import bm25_scores, tokenize  # noqa: E402


STOP_WORDS = set(
    "là gì và của trong một những các có được như nào về cho với hãy tôi bạn mình này đó ở theo".split()
)


def normalize(value: str) -> str:
    return unicodedata.normalize("NFC", value).casefold()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--query", required=True, action="append")
    parser.add_argument("--term", action="append", default=[])
    parser.add_argument("--top-k", type=int, default=8)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--include-excerpts", action="store_true")
    args = parser.parse_args()
    if not 1 <= args.top_k <= 50:
        parser.error("--top-k must be between 1 and 50")
    return args


def diagnose(chunks: list[dict], query: str, terms: list[str], top_k: int, excerpts: bool) -> dict:
    gate = evaluate_query(query)
    normalized_terms = [(term, normalize(term)) for term in terms]
    prepared = " ".join(token for token in tokenize(query) if token not in STOP_WORDS)
    scores = bm25_scores(prepared, [chunk["text"] for chunk in chunks]) if gate["allowed"] else []
    ranked = sorted(enumerate(scores), key=lambda item: item[1], reverse=True)
    positive = [(index, score) for index, score in ranked if score > 0][:top_k]
    results = []
    for rank, (index, score) in enumerate(positive, 1):
        chunk = chunks[index]
        normalized_text = normalize(chunk["text"])
        item = {
            "rank": rank,
            "score": round(score, 6),
            "chunkId": chunk["id"],
            "section": chunk["section"],
            "pdfPages": [chunk["pdfPageStart"], chunk["pdfPageEnd"]],
            "tokenCount": chunk["tokenCount"],
            "matchedTerms": [term for term, normalized in normalized_terms if normalized in normalized_text],
            "previousChunkId": chunks[index - 1]["id"] if index else None,
            "nextChunkId": chunks[index + 1]["id"] if index + 1 < len(chunks) else None,
        }
        if excerpts:
            item["excerpt"] = chunk["text"][:600]
        results.append(item)
    return {"query": query, "gate": gate, "positiveMatches": len(positive), "ranking": results}


def main() -> None:
    args = parse_args()
    manifest, chunks = load_private_corpus(args.manifest)
    report = {
        "schemaVersion": "retrieval-diagnostic-1",
        "datasetId": manifest["datasetId"],
        "indexVersion": manifest["indexVersion"],
        "providerCalls": 0,
        "topK": args.top_k,
        "terms": args.term,
        "queries": [
            diagnose(chunks, query, args.term, args.top_k, args.include_excerpts)
            for query in args.query
        ],
    }
    rendered = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    if args.output:
        output = args.output.resolve()
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(rendered, encoding="utf-8")
        try:
            output.chmod(0o600)
        except OSError:
            pass
        print(json.dumps({"result": "PASS", "output": str(output), "providerCalls": 0}))
    else:
        print(rendered, end="")


if __name__ == "__main__":
    main()
