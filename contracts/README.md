# Phase 0 — Contract-first integration

This directory is the executable boundary between the PTIT browser/backend and the PTIT-hosted RAG service.

## Source of truth

- `openapi/` contains the public browser API, internal RAG API and ingestion API contracts.
- `schemas/` contains JSON Schema 2020-12 payload definitions used by the validator and contract tests.
- `examples/` contains deterministic fixtures for happy paths and failure modes.
- `DECISIONS.md` records decisions that must remain stable while the other team implements the chatbot.

## Local commands

```bash
npm run contract:validate
npm run contract:test
npm run mock:rag
```

The mock is intentionally local-only. It emulates the RAG boundary and failure scenarios without changing the existing demo API.

## Compatibility rule

Payloads use an explicit `schemaVersion` (`1.0`). Additive fields are allowed only when optional. A breaking change requires a new versioned endpoint/schema and an entry in `DECISIONS.md`.
