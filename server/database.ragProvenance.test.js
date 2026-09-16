// @vitest-environment node
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, it } from 'vitest'
import { createDatabase } from './database.js'

describe('SQLite RAG provenance migration', () => {
  let directory

  afterEach(async () => {
    if (directory) await rm(directory, { recursive: true, force: true })
  })

  it('adds provenance columns without deleting historical RAG rows', async () => {
    directory = await mkdtemp(join(tmpdir(), 'ptit-rag-provenance-'))
    const databasePath = join(directory, 'legacy.sqlite')
    const legacy = new DatabaseSync(databasePath)
    legacy.exec(`
      CREATE TABLE rag_responses (
        id TEXT PRIMARY KEY,
        request_id TEXT NOT NULL UNIQUE,
        provider_answer_id TEXT,
        content TEXT NOT NULL,
        original_content TEXT NOT NULL,
        confidence REAL,
        review_status TEXT NOT NULL,
        model_version TEXT,
        raw_response_json TEXT,
        reviewed_by TEXT,
        reviewed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE rag_citations (
        id TEXT PRIMARY KEY,
        response_id TEXT NOT NULL,
        material_id TEXT NOT NULL,
        material_version_id TEXT NOT NULL,
        page_number INTEGER,
        quote TEXT NOT NULL,
        citation_order INTEGER NOT NULL DEFAULT 0,
        retrieval_score REAL,
        UNIQUE (response_id, citation_order)
      );
      INSERT INTO rag_responses
        (id, request_id, content, original_content, review_status, created_at, updated_at)
      VALUES
        ('legacy-response', 'legacy-request', 'legacy answer', 'legacy answer',
         'pending_review', '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z');
      INSERT INTO rag_citations
        (id, response_id, material_id, material_version_id, quote, citation_order)
      VALUES
        ('legacy-citation', 'legacy-response', 'legacy-material', 'legacy-version',
         'legacy quote', 0);
    `)
    legacy.close()

    const migrated = createDatabase({ databasePath, seed: false })
    try {
      expect(
        migrated
          .prepare(`SELECT content, index_version FROM rag_responses WHERE id = ?`)
          .get('legacy-response'),
      ).toEqual({ content: 'legacy answer', index_version: null })
      expect(
        migrated
          .prepare(
            `SELECT quote, chunk_id, chunk_sha256, section
             FROM rag_citations WHERE id = ?`,
          )
          .get('legacy-citation'),
      ).toEqual({
        quote: 'legacy quote',
        chunk_id: null,
        chunk_sha256: null,
        section: null,
      })
      expect(
        migrated.prepare(`SELECT value FROM schema_meta WHERE key = 'schema_version'`).get().value,
      ).toBe('7')
    } finally {
      migrated.close()
    }
  })
})
