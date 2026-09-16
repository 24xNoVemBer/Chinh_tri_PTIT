import copy
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock
from uuid import uuid4
from types import SimpleNamespace

from fastapi.testclient import TestClient
from adapter import PilotEngine, classify_provider_error, create_app
from corpus import sha256_bytes


def request_body():
    return {
        "schemaVersion": "1.0", "requestId": str(uuid4()), "tenantId": "ptit",
        "query": {"text": "Phân biệt vật chất và ý thức.", "language": "vi-VN"},
        "conversation": {"conversationId": "test", "messageId": "message-1", "history": []},
        "scope": {"subjectId": "sub1", "classIds": ["class1"], "lessonId": "subject-overview",
                  "allowedMaterialVersionIds": ["mv-local-rag-sample-v1"]},
        "policy": {"publicationMode": "provisional", "citationRequired": True,
                   "maxOutputTokens": 800, "safetyPolicyVersion": "ptit-safety-1"},
        "limits": {"deadlineMs": 30000, "maxRetrievedChunks": 3, "maxContextTokens": 6000},
        "client": {"name": "ptit-backend", "version": "1.0.0"},
    }


class AdapterTests(unittest.TestCase):
    def setUp(self):
        self.engine = PilotEngine()
        self.client = TestClient(create_app(self.engine, "t" * 32))
        self.client.__enter__()
        self.body = request_body()

    def tearDown(self):
        self.client.__exit__(None, None, None)

    def post(self, body=None, key="test-key"):
        body = body or self.body
        return self.client.post("/internal/v1/answers", json=body, headers={
            "Authorization": "Bearer " + "t" * 32,
            "Idempotency-Key": key, "X-Request-ID": body["requestId"],
        })

    def test_auth_required(self):
        self.assertEqual(self.client.get("/internal/v1/health").status_code, 200)
        self.assertEqual(self.client.get("/internal/v1/capabilities").status_code, 401)
        response = self.client.get("/internal/v1/capabilities", headers={
            "Authorization": "Bearer " + "x" * 32,
        })
        self.assertEqual(response.status_code, 401)

    def test_capabilities_match_the_internal_api_contract(self):
        response = self.client.get("/internal/v1/capabilities", headers={
            "Authorization": "Bearer " + "t" * 32,
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["schemaVersion"], "1.0")
        self.assertEqual(response.json()["service"], "rag")
        self.assertEqual(response.json()["supportedSchemaVersions"], ["1.0"])
        self.assertEqual(response.json()["maxContextTokens"], 6000)

    def test_readiness_does_not_claim_provider_success(self):
        response = self.client.get("/internal/v1/readiness", headers={"Authorization": "Bearer " + "t" * 32})
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["indexReady"])
        self.assertFalse(response.json()["providerConfigured"])
        self.assertIsNone(response.json()["providerLastSuccessAt"])

    def test_extractive_citation_is_exact_with_real_hash(self):
        response = self.post()
        self.assertEqual(response.status_code, 200, response.text)
        answer = response.json()
        self.assertEqual(answer["provenance"]["model"], "none-extractive")
        self.assertEqual(answer["usage"]["inputTokens"], 0)
        for c in answer["citations"]:
            self.assertEqual(c["chunkSha256"], hashlib.sha256(c["quote"].encode()).hexdigest())

    def test_scope_rejected_before_generation(self):
        for target, key, value in [("scope", "subjectId", "sub2"),
                                   ("scope", "allowedMaterialVersionIds", ["other-version"])]:
            body = copy.deepcopy(self.body)
            body[target][key] = value
            self.assertEqual(self.post(body).status_code, 409)
        self.body["tenantId"] = "other-tenant"
        self.assertEqual(self.post().status_code, 409)

    def test_no_source_abstains(self):
        self.body["query"]["text"] = "zzqxwwvvuu zzzqqqppp"
        answer = self.post().json()
        self.assertEqual(answer["outcome"], "abstained")
        self.assertEqual(answer["citations"], [])

    def test_limit_and_history_validation(self):
        self.body["limits"]["maxRetrievedChunks"] = 0
        self.assertEqual(self.post().status_code, 422)
        self.body = request_body()
        self.body["conversation"]["history"] = [{"role": "user", "text": "previous"}]
        self.assertEqual(self.post().status_code, 422)
        self.body = request_body()
        self.body["scope"]["allowedMaterialVersionIds"] *= 2
        self.assertEqual(self.post().status_code, 422)

    def test_published_only_not_silently_downgraded(self):
        self.body["policy"]["publicationMode"] = "published_only"
        self.assertEqual(self.post().status_code, 409)

    def test_idempotency_replay_and_conflict(self):
        first = self.post().json()
        self.body["requestId"] = str(uuid4())
        replay = self.post().json()
        self.assertEqual(first["providerJobId"], replay["providerJobId"])
        self.assertEqual(replay["requestId"], self.body["requestId"])
        self.body["query"]["text"] = "Thực tiễn là gì?"
        self.assertEqual(self.post().status_code, 409)

    def test_model_branch_has_one_call_and_actual_usage(self):
        self.engine.mode = "openai"
        self.engine.model = "configured-test-model"
        self.engine.client = Mock()
        result = SimpleNamespace(
            choices=[SimpleNamespace(finish_reason="stop", message=SimpleNamespace(content=
                '{"text":"Tài liệu mẫu chưa thẩm định.","citationIds":["sample-v1-vat-chat"]}'))],
            usage=SimpleNamespace(prompt_tokens=123, completion_tokens=25), model="test-revision",
        )
        call = self.engine.client.with_options.return_value.chat.completions.create
        call.return_value = result
        answer = self.post().json()
        self.assertEqual(answer["usage"]["inputTokens"], 123)
        self.assertEqual(answer["provenance"]["modelRevision"], "test-revision")
        call.assert_called_once()

    def test_model_failure_never_falls_back_to_sample_answer(self):
        self.engine.mode = "openai"
        self.engine.client = Mock()
        self.engine.client.with_options.return_value.chat.completions.create.side_effect = RuntimeError("private detail")
        response = self.post()
        self.assertEqual(response.status_code, 502)
        self.assertNotIn("private detail", response.text)

    def test_provider_error_classification(self):
        cases = [
            (SimpleNamespace(status_code=401, code="invalid_api_key"), "PROVIDER_AUTH_FAILED"),
            (SimpleNamespace(status_code=429, code="insufficient_quota"), "PROVIDER_QUOTA_EXCEEDED"),
            (SimpleNamespace(status_code=429, code="rate_limit_exceeded"), "PROVIDER_RATE_LIMITED"),
            (type("APITimeoutError", (Exception,), {})(), "PROVIDER_TIMEOUT"),
            (type("APIConnectionError", (Exception,), {})(), "PROVIDER_UNAVAILABLE"),
        ]
        for error, expected in cases:
            self.assertEqual(classify_provider_error(error), expected)

    def test_model_unknown_citation_rejected(self):
        self.engine.mode = "openai"
        self.engine.client = Mock()
        self.engine.client.with_options.return_value.chat.completions.create.return_value = SimpleNamespace(
            choices=[SimpleNamespace(finish_reason="stop", message=SimpleNamespace(content=
                '{"text":"Wrong source","citationIds":["not-allowed"]}'))],
            usage=SimpleNamespace(prompt_tokens=1, completion_tokens=1), model="test",
        )
        self.assertEqual(self.post().status_code, 502)


class PrivateCorpusAdapterTests(unittest.TestCase):
    def test_private_corpus_reports_real_mode_and_pdf_page(self):
        chunk = {
            "id": "private-v1-vat-chat",
            "section": "Vật chất và ý thức",
            "text": "Vật chất là thực tại khách quan tồn tại độc lập với ý thức.",
            "pdfPageStart": 42,
            "pdfPageEnd": 42,
            "printedPageStart": 40,
            "printedPageEnd": 40,
            "tokenCount": 16,
            "chunkSha256": hashlib.sha256(
                "Vật chất là thực tại khách quan tồn tại độc lập với ý thức.".encode()
            ).hexdigest(),
        }
        raw = (json.dumps(chunk, ensure_ascii=False) + "\n").encode()
        manifest = {
            "schemaVersion": "private-corpus-1", "datasetId": "private-test",
            "sampleData": False, "tenantId": "ptit", "subjectId": "sub1",
            "materialId": "mat-private-test", "materialVersionId": "mv-private-test-v1",
            "title": "Giáo trình riêng", "author": "PTIT", "notice": "Chưa thẩm định",
            "source": {"fileName": "test.pdf", "sha256": "a" * 64, "byteSize": 1, "pageCount": 50},
            "parser": {}, "chunker": {}, "indexVersion": "idx-private-test-v1",
            "chunksFile": "chunks.jsonl", "chunksSha256": sha256_bytes(raw),
            "chunkCount": 1, "status": "ready",
        }
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "chunks.jsonl").write_bytes(raw)
            path = root / "manifest.json"
            path.write_text(json.dumps(manifest), encoding="utf-8")
            engine = PilotEngine(dataset="private", manifest_path=path)
            body = request_body()
            body["scope"]["allowedMaterialVersionIds"] = ["mv-private-test-v1"]
            client = TestClient(create_app(engine, "t" * 32))
            with client:
                capabilities = client.get(
                    "/internal/v1/capabilities",
                    headers={"Authorization": "Bearer " + "t" * 32},
                ).json()
                self.assertFalse(capabilities["sampleData"])
                self.assertEqual(capabilities["dataset"], "private")
                response = client.post(
                    "/internal/v1/answers",
                    json=body,
                    headers={
                        "Authorization": "Bearer " + "t" * 32,
                        "Idempotency-Key": "private-test",
                        "X-Request-ID": body["requestId"],
                    },
                )
                self.assertEqual(response.status_code, 200, response.text)
                answer = response.json()
                self.assertEqual(answer["provenance"]["provider"], "local-rag-private-extractive")
                self.assertEqual(answer["citations"][0]["page"], 42)
                self.assertIn("private_corpus_unreviewed", answer["review"]["reasonCodes"])


if __name__ == "__main__":
    unittest.main()
