# Phase 0 delivery checklist

## Done in this branch

- [x] Versioned browser, RAG and ingestion OpenAPI documents.
- [x] JSON Schema 2020-12 payloads for request, answer, citation, event, feedback and ingestion.
- [x] Fixtures for grounded answer, abstention, safety block and ingestion.
- [x] Offline schema/OpenAPI validation commands.
- [x] Local RAG mock with health/readiness/capabilities endpoints.
- [x] Mock failure scenarios for rate limit, provider outage/timeout, malformed output, invalid citation, duplicate request and SSE disconnect/order.
- [x] Citation allow-list and event ordering validators.
- [x] Vitest contract tests and CI workflow.

## Acceptance gate before Phase 1

1. Backend team reviews the request/answer examples and confirms field ownership.
2. Chatbot team confirms provider/model, retrieval, index and prompt version fields.
3. Both teams agree on the `schemaVersion`, error codes and idempotency behavior.
4. One real redacted request and one real redacted terminal answer pass the validators.
5. Backend selects the production transport (SSE first, polling fallback) and records the decision in `DECISIONS.md`.

## Explicitly deferred

- PostgreSQL/Redis migrations and production queue workers.
- Microsoft Entra production configuration.
- Real provider credentials and model-specific prompt tuning.
- Load testing at the 1,000–3,000 concurrent-user target.
