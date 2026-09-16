"""Ingest a text-layer PDF into the private, local-only RAG pilot corpus."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile

from corpus import clean_pages, chunk_segments, load_private_corpus, page_segments, sha256_bytes


def run(command: list[str]) -> str:
    result = subprocess.run(command, check=False, capture_output=True)
    if result.returncode:
        raise RuntimeError(f"{command[0]} failed with exit code {result.returncode}")
    return result.stdout.decode("utf-8", errors="replace")


def pdf_page_count(source: Path) -> int:
    info = run(["pdfinfo", str(source)])
    match = re.search(r"^Pages:\s+(\d+)\s*$", info, re.M)
    if not match:
        raise RuntimeError("pdfinfo did not return a page count")
    return int(match.group(1))


def extract_pages(source: Path, page_count: int) -> list[str]:
    text = run(["pdftotext", "-layout", "-enc", "UTF-8", str(source), "-"])
    pages = text.split("\f")
    while pages and not pages[-1].strip():
        pages.pop()
    if len(pages) != page_count:
        raise RuntimeError(f"Expected {page_count} extracted pages, got {len(pages)}")
    return pages


def atomic_write(path: Path, value: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as handle:
        handle.write(value)
        temporary = Path(handle.name)
    os.replace(temporary, path)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--expected-sha256")
    parser.add_argument("--expected-pages", type=int)
    parser.add_argument("--dataset-id", default="private-triet-hoc-ptit-2021")
    parser.add_argument("--tenant-id", default="ptit")
    parser.add_argument("--subject-id", default="sub1")
    parser.add_argument("--material-id", default="mat-triet-hoc-ptit-2021")
    parser.add_argument("--material-version-id", default="mv-triet-hoc-ptit-2021-9bc31657")
    parser.add_argument("--title", default="Bài giảng môn Triết học Mác - Lênin")
    parser.add_argument("--author", default="Tài liệu PTIT dùng trong pilot kỹ thuật")
    parser.add_argument("--index-version", default="idx-triet-hoc-bm25-v1")
    parser.add_argument("--max-tokens", type=int, default=700)
    parser.add_argument("--overlap-tokens", type=int, default=100)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    source = args.source.resolve()
    if not source.is_file() or source.read_bytes()[:5] != b"%PDF-":
        raise ValueError("Source is not a readable PDF")
    source_raw = source.read_bytes()
    source_sha = sha256_bytes(source_raw)
    if args.expected_sha256 and source_sha != args.expected_sha256:
        raise ValueError("Source SHA-256 does not match expected value")
    page_count = pdf_page_count(source)
    if args.expected_pages and page_count != args.expected_pages:
        raise ValueError("Source page count does not match expected value")

    try:
        import tiktoken
    except ImportError as error:
        raise RuntimeError("tiktoken is required by the deterministic pilot chunker") from error
    encoding = tiktoken.get_encoding("cl100k_base")
    raw_pages = extract_pages(source, page_count)
    cleaned_pages, margin_report = clean_pages(raw_pages)
    segments = page_segments(cleaned_pages, args.title)
    chunks = chunk_segments(
        segments,
        encoding.encode,
        encoding.decode,
        max_tokens=args.max_tokens,
        overlap_tokens=args.overlap_tokens,
    )
    if not chunks:
        raise RuntimeError("No text chunks were produced; OCR may be required")

    chunks_raw = b"".join(
        (json.dumps(chunk, ensure_ascii=False, sort_keys=True) + "\n").encode("utf-8")
        for chunk in chunks
    )
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    try:
        output.chmod(0o700)
    except OSError:
        pass
    chunks_path = output / "chunks.jsonl"
    atomic_write(chunks_path, chunks_raw)
    manifest = {
        "schemaVersion": "private-corpus-1",
        "datasetId": args.dataset_id,
        "sampleData": False,
        "tenantId": args.tenant_id,
        "subjectId": args.subject_id,
        "materialId": args.material_id,
        "materialVersionId": args.material_version_id,
        "title": args.title,
        "author": args.author,
        "notice": "Pilot kỹ thuật riêng tư; nội dung và câu trả lời chưa được giảng viên thẩm định.",
        "source": {
            "fileName": source.name,
            "sha256": source_sha,
            "byteSize": len(source_raw),
            "pageCount": page_count,
        },
        "parser": {
            "name": "poppler-pdftotext-layout",
            "unicodeNormalization": "NFC",
            "marginDetection": margin_report,
        },
        "chunker": {
            "name": "page-paragraph-token-window-v1",
            "tokenizer": "cl100k_base",
            "maxTokens": args.max_tokens,
            "overlapTokens": args.overlap_tokens,
        },
        "indexVersion": args.index_version,
        "chunksFile": "chunks.jsonl",
        "chunksSha256": sha256_bytes(chunks_raw),
        "chunkCount": len(chunks),
        "status": "ready",
    }
    manifest_path = output / "manifest.json"
    atomic_write(
        manifest_path,
        (json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode("utf-8"),
    )
    load_private_corpus(manifest_path)
    print(
        json.dumps(
            {
                "result": "PASS",
                "manifest": str(manifest_path),
                "sourceSha256": source_sha,
                "pages": page_count,
                "chunks": len(chunks),
                "chunksSha256": manifest["chunksSha256"],
                "removedMarginLines": margin_report["removedLineCount"],
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
