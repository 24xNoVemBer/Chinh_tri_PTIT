import json
from pathlib import Path
import tempfile
import unittest
import unicodedata

from corpus import clean_pages, chunk_segments, load_private_corpus, page_segments, sha256_bytes


def encode(text):
    return [ord(char) for char in text]


def decode(tokens):
    return "".join(chr(token) for token in tokens)


class CorpusTests(unittest.TestCase):
    def test_normalizes_unicode_removes_repeated_margins_and_keeps_pages(self):
        raw_pages = [
            "BÀI GIẢNG TRIẾT HỌC\nCHƯƠNG 1\nKha\u0301i niê\u0323m thứ nhất.\nPage 1",
            "BÀI GIẢNG TRIẾT HỌC\nNội dung thứ hai.\nPage 2",
            "BÀI GIẢNG TRIẾT HỌC\nNội dung thứ ba.\nPage 3",
            "BÀI GIẢNG TRIẾT HỌC\nNội dung thứ tư.\nPage 4",
            "BÀI GIẢNG TRIẾT HỌC\nNội dung thứ năm.\nPage 5",
        ]
        pages, report = clean_pages(raw_pages)
        self.assertNotIn("BÀI GIẢNG TRIẾT HỌC", pages[0]["lines"])
        self.assertEqual(pages[0]["printedPage"], 1)
        self.assertGreaterEqual(report["removedLineCount"], 10)
        chunks = chunk_segments(
            page_segments(pages, "Giáo trình"), encode, decode, max_tokens=100, overlap_tokens=10
        )
        self.assertTrue(chunks)
        self.assertEqual(chunks[0]["text"], unicodedata.normalize("NFC", chunks[0]["text"]))
        self.assertEqual(chunks[0]["pdfPageStart"], 1)

    def test_chunking_is_deterministic(self):
        segments = [
            {"text": "vật chất " * 20, "section": "Mục 1", "pdfPage": 2, "printedPage": 1},
            {"text": "ý thức " * 20, "section": "Mục 1", "pdfPage": 3, "printedPage": 2},
        ]
        first = chunk_segments(segments, encode, decode, max_tokens=120, overlap_tokens=20)
        second = chunk_segments(segments, encode, decode, max_tokens=120, overlap_tokens=20)
        self.assertEqual(first, second)
        self.assertEqual(len({chunk["id"] for chunk in first}), len(first))

    def test_loader_detects_tampering(self):
        chunk = {
            "id": "chunk-1",
            "section": "Mục 1",
            "text": "Nội dung kiểm thử.",
            "pdfPageStart": 1,
            "pdfPageEnd": 1,
            "printedPageStart": None,
            "printedPageEnd": None,
            "tokenCount": 5,
            "chunkSha256": "4e3eca16b9f4ff004e954e8d2aac2c1a7c75ae9ee565179e36bc58c3fdb047f9",
        }
        chunk["chunkSha256"] = __import__("hashlib").sha256(chunk["text"].encode()).hexdigest()
        raw = (json.dumps(chunk, ensure_ascii=False) + "\n").encode()
        manifest = {
            "schemaVersion": "private-corpus-1",
            "datasetId": "private-test",
            "sampleData": False,
            "tenantId": "ptit",
            "subjectId": "sub1",
            "materialId": "mat-private-test",
            "materialVersionId": "mv-private-test-v1",
            "title": "Private test",
            "author": "Test",
            "notice": "Unreviewed",
            "source": {"fileName": "test.pdf", "sha256": "a" * 64, "byteSize": 1, "pageCount": 1},
            "parser": {},
            "chunker": {},
            "indexVersion": "idx-private-test-v1",
            "chunksFile": "chunks.jsonl",
            "chunksSha256": sha256_bytes(raw),
            "chunkCount": 1,
            "status": "ready",
        }
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "chunks.jsonl").write_bytes(raw)
            path = root / "manifest.json"
            path.write_text(json.dumps(manifest), encoding="utf-8")
            loaded, chunks = load_private_corpus(path)
            self.assertEqual(loaded["materialId"], "mat-private-test")
            self.assertEqual(len(chunks), 1)
            (root / "chunks.jsonl").write_text("tampered", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "SHA-256"):
                load_private_corpus(path)


if __name__ == "__main__":
    unittest.main()
