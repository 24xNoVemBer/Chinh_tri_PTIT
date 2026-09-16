"""Private pilot corpus parsing, validation, and deterministic chunking utilities."""

from __future__ import annotations

import hashlib
import json
import re
import unicodedata
from collections import Counter
from pathlib import Path


ID_PATTERN = re.compile(r"^[A-Za-z0-9._:-]{1,160}$")
SHA256_PATTERN = re.compile(r"^[a-f0-9]{64}$")
PRINTED_PAGE_PATTERN = re.compile(r"^(?:page|trang)?\s*[-–—]?\s*(\d{1,4})\s*[-–—]?$", re.I)
HEADING_PREFIX = re.compile(
    r"^(?:PHẦN|CHƯƠNG|BÀI|MỤC|TIỂU MỤC)\s+(?:[IVXLCDM]+|\d+)", re.I
)
NUMBERED_HEADING = re.compile(r"^\d+(?:\.\d+){0,3}[.)]?\s+\S+")


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_text(value: str) -> str:
    return sha256_bytes(value.encode("utf-8"))


def normalize_line(value: str) -> str:
    value = unicodedata.normalize("NFC", value.replace("\u00a0", " "))
    return re.sub(r"[ \t]+", " ", value).strip()


def normalize_pages(raw_pages: list[str]) -> list[list[str]]:
    return [[normalize_line(line) for line in page.splitlines()] for page in raw_pages]


def detect_repeated_margins(
    pages: list[list[str]], margin_depth: int = 4, frequency: float = 0.55
) -> tuple[set[str], set[str]]:
    """Find exact normalized lines repeated in page headers/footers."""
    nonempty = [page for page in pages if any(page)]
    threshold = max(3, round(len(nonempty) * frequency))
    top: Counter[str] = Counter()
    bottom: Counter[str] = Counter()
    for page in nonempty:
        lines = [line for line in page if line]
        top.update(set(lines[:margin_depth]))
        bottom.update(set(lines[-margin_depth:]))
    top_lines = {line for line, count in top.items() if count >= threshold and len(line) > 2}
    bottom_lines = {
        line for line, count in bottom.items() if count >= threshold and len(line) > 2
    }
    return top_lines, bottom_lines


def extract_printed_page(lines: list[str], pdf_page: int) -> int | None:
    for line in reversed([line for line in lines[-6:] if line]):
        match = PRINTED_PAGE_PATTERN.fullmatch(line)
        if not match:
            continue
        number = int(match.group(1))
        if 1 <= number <= pdf_page + 50:
            return number
    return None


def clean_pages(raw_pages: list[str]) -> tuple[list[dict], dict]:
    normalized = normalize_pages(raw_pages)
    headers, footers = detect_repeated_margins(normalized)
    cleaned = []
    removed = 0
    for pdf_page, lines in enumerate(normalized, 1):
        printed_page = extract_printed_page(lines, pdf_page)
        nonempty_positions = [index for index, line in enumerate(lines) if line]
        top_positions = set(nonempty_positions[:4])
        bottom_positions = set(nonempty_positions[-4:])
        kept = []
        for index, line in enumerate(lines):
            is_margin = (index in top_positions and line in headers) or (
                index in bottom_positions and line in footers
            )
            is_page_number = index in bottom_positions and PRINTED_PAGE_PATTERN.fullmatch(line)
            if line and (is_margin or is_page_number):
                removed += 1
                continue
            kept.append(line)
        cleaned.append(
            {
                "pdfPage": pdf_page,
                "printedPage": printed_page,
                "lines": kept,
            }
        )
    return cleaned, {
        "headerLines": sorted(headers),
        "footerLines": sorted(footers),
        "removedLineCount": removed,
    }


def is_heading(line: str) -> bool:
    if not line or len(line) > 180:
        return False
    if HEADING_PREFIX.match(line) or NUMBERED_HEADING.match(line):
        return True
    letters = [char for char in line if char.isalpha()]
    return len(letters) >= 6 and sum(char.isupper() for char in letters) / len(letters) >= 0.9


def page_segments(cleaned_pages: list[dict], default_section: str) -> list[dict]:
    """Convert cleaned lines to paragraph-like segments with page provenance."""
    segments = []
    section = default_section
    for page in cleaned_pages:
        paragraph: list[str] = []

        def flush() -> None:
            if not paragraph:
                return
            text = " ".join(paragraph)
            text = re.sub(r"\s+", " ", text).strip()
            if text:
                segments.append(
                    {
                        "text": text,
                        "section": section,
                        "pdfPage": page["pdfPage"],
                        "printedPage": page["printedPage"],
                    }
                )
            paragraph.clear()

        for line in page["lines"]:
            if not line:
                flush()
                continue
            if is_heading(line):
                flush()
                section = line[:200]
                continue
            if paragraph and paragraph[-1].endswith("-") and line[:1].islower():
                paragraph[-1] = paragraph[-1][:-1] + line
            else:
                paragraph.append(line)
        flush()
    return segments


def chunk_segments(
    segments: list[dict], encode, decode, *, max_tokens: int = 700, overlap_tokens: int = 100
) -> list[dict]:
    if max_tokens < 100 or overlap_tokens < 0 or overlap_tokens >= max_tokens:
        raise ValueError("Invalid chunk token limits")
    units = []
    for segment in segments:
        token_ids = encode(segment["text"])
        if not token_ids:
            continue
        step = max_tokens - overlap_tokens
        for start in range(0, len(token_ids), step):
            piece = token_ids[start : start + max_tokens]
            units.append({**segment, "text": normalize_line(decode(piece)), "tokens": len(piece)})
            if start + max_tokens >= len(token_ids):
                break

    chunks = []
    current: list[dict] = []
    current_tokens = 0

    def emit() -> None:
        nonlocal current, current_tokens
        if not current:
            return
        text = "\n\n".join(item["text"] for item in current).strip()
        digest = sha256_text(text)
        ordinal = len(chunks) + 1
        chunks.append(
            {
                "id": f"triet-ptit-{ordinal:04d}-{digest[:12]}",
                "section": current[0]["section"][:200],
                "text": text,
                "pdfPageStart": min(item["pdfPage"] for item in current),
                "pdfPageEnd": max(item["pdfPage"] for item in current),
                "printedPageStart": next(
                    (item["printedPage"] for item in current if item["printedPage"] is not None),
                    None,
                ),
                "printedPageEnd": next(
                    (
                        item["printedPage"]
                        for item in reversed(current)
                        if item["printedPage"] is not None
                    ),
                    None,
                ),
                "tokenCount": len(encode(text)),
                "chunkSha256": digest,
            }
        )
        overlap: list[dict] = []
        overlap_size = 0
        for item in reversed(current):
            if overlap_size + item["tokens"] > overlap_tokens:
                break
            overlap.insert(0, item)
            overlap_size += item["tokens"]
        current = overlap
        current_tokens = overlap_size

    for unit in units:
        section_changed = current and unit["section"] != current[-1]["section"]
        if current and (current_tokens + unit["tokens"] > max_tokens or section_changed):
            emit()
            if section_changed:
                current = []
                current_tokens = 0
        current.append(unit)
        current_tokens += unit["tokens"]
    emit()
    return chunks


def load_private_corpus(manifest_path: Path) -> tuple[dict, list[dict]]:
    manifest_path = manifest_path.resolve()
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    required = {
        "schemaVersion",
        "datasetId",
        "sampleData",
        "tenantId",
        "subjectId",
        "materialId",
        "materialVersionId",
        "title",
        "author",
        "notice",
        "source",
        "parser",
        "chunker",
        "indexVersion",
        "chunksFile",
        "chunksSha256",
        "chunkCount",
        "status",
    }
    if set(manifest) != required:
        raise ValueError("Private corpus manifest fields do not match schema")
    if manifest["schemaVersion"] != "private-corpus-1" or manifest["sampleData"] is not False:
        raise ValueError("Private corpus manifest identity is invalid")
    if manifest["status"] != "ready":
        raise ValueError("Private corpus is not ready")
    for key in ("datasetId", "tenantId", "subjectId", "materialId", "materialVersionId"):
        if not ID_PATTERN.fullmatch(manifest[key]):
            raise ValueError(f"Invalid {key}")
    if not ID_PATTERN.fullmatch(manifest["indexVersion"]):
        raise ValueError("Invalid indexVersion")
    if not SHA256_PATTERN.fullmatch(manifest["source"].get("sha256", "")):
        raise ValueError("Invalid source SHA-256")
    if not SHA256_PATTERN.fullmatch(manifest["chunksSha256"]):
        raise ValueError("Invalid chunks SHA-256")

    chunks_file = Path(manifest["chunksFile"])
    if chunks_file.is_absolute() or len(chunks_file.parts) != 1:
        raise ValueError("chunksFile must be a file beside the manifest")
    chunks_path = (manifest_path.parent / chunks_file).resolve()
    if chunks_path.parent != manifest_path.parent:
        raise ValueError("chunksFile escapes the corpus directory")
    raw = chunks_path.read_bytes()
    if sha256_bytes(raw) != manifest["chunksSha256"]:
        raise ValueError("Chunks file SHA-256 mismatch")
    chunks = [json.loads(line) for line in raw.decode("utf-8").splitlines() if line.strip()]
    if len(chunks) != manifest["chunkCount"] or not chunks:
        raise ValueError("Chunk count mismatch or empty corpus")
    ids = set()
    for chunk in chunks:
        required_chunk = {
            "id",
            "section",
            "text",
            "pdfPageStart",
            "pdfPageEnd",
            "printedPageStart",
            "printedPageEnd",
            "tokenCount",
            "chunkSha256",
        }
        if set(chunk) != required_chunk or not ID_PATTERN.fullmatch(chunk["id"]):
            raise ValueError("Invalid private chunk fields")
        if chunk["id"] in ids:
            raise ValueError("Duplicate chunk ID")
        ids.add(chunk["id"])
        if not chunk["text"] or unicodedata.normalize("NFC", chunk["text"]) != chunk["text"]:
            raise ValueError("Chunk text must be non-empty NFC Unicode")
        if sha256_text(chunk["text"]) != chunk["chunkSha256"]:
            raise ValueError("Chunk text SHA-256 mismatch")
        if not (1 <= chunk["pdfPageStart"] <= chunk["pdfPageEnd"] <= manifest["source"]["pageCount"]):
            raise ValueError("Chunk PDF page range is invalid")
    return manifest, chunks
