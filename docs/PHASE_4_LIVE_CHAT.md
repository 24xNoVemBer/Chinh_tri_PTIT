# Phase 4 — Live chat wiring

`POST /api/student/chat` now selects the live RAG path whenever the server starts with `RAG_ENABLED=true` and a configured `RAG_SERVICE_TOKEN`. When RAG is disabled, the existing SQLite demo path remains unchanged.

## Live request lifecycle

1. Authenticate the student and verify subject enrollment.
2. Build the contract request with class scope and approved material-version allow-list.
3. Persist the question and `rag_requests` row as `processing`.
4. Call RAG through `server/rag/client.js` with timeout, retry and idempotency.
5. Validate the terminal answer and resolve every citation against approved SQLite sources.
6. Persist `rag_responses` and `rag_citations`, then return the existing ChatPage response shape.
7. On provider failure, mark the request `failed` and return the stable contract error.

The live path intentionally rejects a citation whose `materialId` does not match the approved `materialVersionId`; this prevents a syntactically valid but wrong source from reaching the UI.
