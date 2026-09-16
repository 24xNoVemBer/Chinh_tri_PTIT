"""Bounded provider probe: at most one embedding and one chat completion, no retries."""
import argparse
import json
import os
from pathlib import Path
import sys
import time

from dotenv import load_dotenv
from openai import OpenAI

ROOT = Path(__file__).resolve().parents[2]
MBA_PATH = Path(os.environ.get("MBA_API_PATH", ROOT.parent / "ChatBot" / "MBA_API"))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from adapter import classify_provider_error  # noqa: E402

parser = argparse.ArgumentParser()
parser.add_argument("--confirm-api-call", action="store_true")
args = parser.parse_args()
if not args.confirm_api_call:
    print(json.dumps({"result": "BLOCKED", "reason": "confirmation_flag_required"}))
    raise SystemExit(2)

load_dotenv(MBA_PATH / ".env", override=False)
model = os.environ.get("OPENAI_MODEL", "gpt-4o-mini").strip()
embedding_model = "text-embedding-3-large"  # Matches current MBA_API query/ingestion code.
key = os.environ.get("OPENAI_API_KEY", "").strip()
if not key:
    print(json.dumps({"result": "FAIL", "stage": "config", "code": "PROVIDER_AUTH_MISSING",
                      "model": model, "embeddingModel": embedding_model}))
    raise SystemExit(1)

client = OpenAI(api_key=key, base_url="https://api.openai.com/v1", max_retries=0, timeout=15)
report = {"result": "FAIL", "limits": {"embeddingCalls": 1, "completionCalls": 1, "retries": 0},
          "configuredModel": model, "embeddingModel": embedding_model}
try:
    started = time.monotonic()
    embedding = client.embeddings.create(model=embedding_model, input=["Kiểm tra kết nối RAG local."])
    report["embedding"] = {"model": embedding.model, "dimensions": len(embedding.data[0].embedding),
                           "inputTokens": embedding.usage.prompt_tokens,
                           "totalMs": round((time.monotonic() - started) * 1000)}
except Exception as error:
    report.update({"stage": "embedding", "code": classify_provider_error(error),
                   "httpStatus": getattr(error, "status_code", None)})
    print(json.dumps(report, ensure_ascii=False, indent=2))
    raise SystemExit(1)

try:
    started = time.monotonic()
    completion = client.chat.completions.create(
        model=model, temperature=0, max_tokens=8,
        messages=[{"role": "user", "content": "Trả lời đúng một từ: OK"}],
    )
    if completion.usage is None:
        raise RuntimeError("usage_missing")
    report["completion"] = {"model": completion.model,
                            "inputTokens": completion.usage.prompt_tokens,
                            "outputTokens": completion.usage.completion_tokens,
                            "finishReason": completion.choices[0].finish_reason,
                            "totalMs": round((time.monotonic() - started) * 1000)}
    report["result"] = "PASS"
except Exception as error:
    report.update({"stage": "completion", "code": classify_provider_error(error),
                   "httpStatus": getattr(error, "status_code", None)})
finally:
    client.close()

print(json.dumps(report, ensure_ascii=False, indent=2))
raise SystemExit(0 if report["result"] == "PASS" else 1)
