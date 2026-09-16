-- Retain the exact index and source chunks used for each RAG answer.
-- Columns are nullable so historical responses can be migrated without invented provenance.

ALTER TABLE rag_responses ADD COLUMN IF NOT EXISTS index_version TEXT;
ALTER TABLE rag_citations ADD COLUMN IF NOT EXISTS chunk_id TEXT;
ALTER TABLE rag_citations ADD COLUMN IF NOT EXISTS chunk_sha256 TEXT;
ALTER TABLE rag_citations ADD COLUMN IF NOT EXISTS section TEXT;

ALTER TABLE rag_citations DROP CONSTRAINT IF EXISTS rag_citations_chunk_sha256_check;
ALTER TABLE rag_citations
  ADD CONSTRAINT rag_citations_chunk_sha256_check
  CHECK (chunk_sha256 IS NULL OR chunk_sha256 ~ '^[a-f0-9]{64}$');
