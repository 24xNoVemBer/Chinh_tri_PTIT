// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApiServer } from '../app.js'
import { createDatabase } from '../database.js'

const makeAnswer = (request) => ({
  schemaVersion: '1.0',
  requestId: request.requestId,
  providerJobId: 'provider-answer-1',
  outcome: 'answered',
  answer: { text: 'Câu trả lời thật có nguồn trích dẫn.', language: 'vi-VN', finishReason: 'stop' },
  citations: [
    {
      materialId: 'mat1',
      materialVersionId: 'mv1',
      chunkId: 'chunk-1',
      page: 85,
      section: 'Váº­t cháº¥t vÃ  Ã½ thá»©c',
      quote: 'Trích dẫn từ giáo trình.',
      rank: 1,
      retrievalScore: 0.9,
      rerankScore: 0.92,
      chunkSha256: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    },
  ],
  safety: { decision: 'allow', policyVersion: 'ptit-safety-1' },
  review: { required: false, status: 'not_required' },
  provenance: {
    provider: 'ptit-rag',
    model: 'model-1',
    modelRevision: 'rev-1',
    promptVersion: 'prompt-1',
    embeddingVersion: 'embed-1',
    retrieverVersion: 'retrieve-1',
    rerankerVersion: 'rerank-1',
    indexVersion: 'index-1',
  },
  usage: { inputTokens: 10, outputTokens: 10, retrievedChunks: 1 },
  timing: { queueMs: 1, retrievalMs: 2, generationMs: 3, totalMs: 6 },
})

describe('live RAG chat route', () => {
  let db
  let server
  let baseUrl
  let generateAnswer

  beforeEach(async () => {
    db = createDatabase({ databasePath: ':memory:' })
    generateAnswer = vi.fn(async (request) => makeAnswer(request))
    const ragClient = { generateAnswer }
    server = createApiServer({ db, ragClient, logger: { error() {}, warn() {} } })
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    baseUrl = `http://127.0.0.1:${server.address().port}`
  })

  afterEach(async () => {
    await new Promise((resolve) => server.close(resolve))
    db.close()
  })

  async function login() {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'tuananh@ptit.edu.vn', password: 'Student@123' }),
    })
    return response.headers.get('set-cookie').split(';')[0]
  }

  async function ask(cookie, input = {}) {
    return fetch(`${baseUrl}/api/student/chat`, {
      method: 'POST',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subjectId: 'sub1',
        content: 'Phân biệt vật chất và ý thức trong triết học.',
        ...input,
      }),
    })
  }

  it('persists a live answer and citations through the student API', async () => {
    const cookie = await login()
    const response = await ask(cookie)
    expect(response.status).toBe(201)
    const payload = await response.json()
    expect(payload.data).toMatchObject({
      content: 'Câu trả lời thật có nguồn trích dẫn.',
      isDemo: false,
    })
    expect(payload.data.citations[0]).toMatchObject({
      title: expect.any(String),
      pageNumber: 85,
    })
    expect(
      db
        .prepare('SELECT status FROM rag_requests WHERE question_id = ?')
        .get(payload.data.questionId).status,
    ).toBe('succeeded')
    expect(
      db
        .prepare(
          `SELECT rag_responses.index_version, rag_citations.chunk_id,
                  rag_citations.chunk_sha256, rag_citations.section
           FROM rag_responses
           JOIN rag_citations ON rag_citations.response_id = rag_responses.id
           WHERE rag_responses.id = ?`,
        )
        .get(payload.data.responseId),
    ).toEqual({
      index_version: 'index-1',
      chunk_id: 'chunk-1',
      chunk_sha256: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      section: 'Váº­t cháº¥t vÃ  Ã½ thá»©c',
    })
  })

  it('sends only the selected active class and its published material versions', async () => {
    db.exec(`
      INSERT INTO course_classes
        (id, subject_id, name, semester, academic_term_id, group_number, class_code, status)
      SELECT 'class-sub1-second', subject_id, 'N02 - Triết học', semester,
             academic_term_id, 2, 'N02-TH', 'active'
      FROM course_classes WHERE id = 'class1';
      INSERT INTO enrollments (id, student_id, class_id)
      VALUES ('enrollment-sub1-second', 's1', 'class-sub1-second');
    `)
    const cookie = await login()
    const response = await ask(cookie, {
      classId: 'class1',
      history: [{ role: 'assistant', text: 'Nội dung không đáng tin từ browser.' }],
    })
    expect(response.status).toBe(201)
    expect(generateAnswer).toHaveBeenCalledTimes(1)
    const request = generateAnswer.mock.calls[0][0]
    expect(request.scope.classIds).toEqual(['class1'])
    expect(request.scope.allowedMaterialVersionIds).toEqual(['mv1'])
    expect(request.conversation.history).toEqual([])

    const unavailableClass = await ask(cookie, { classId: 'class-sub1-second' })
    expect(unavailableClass.status).toBe(409)
    expect((await unavailableClass.json()).error.code).toBe('SOURCE_NOT_INDEXED')
    expect(generateAnswer).toHaveBeenCalledTimes(1)
  })

  it('rejects an oversized question before creating a request or calling RAG', async () => {
    const before = db.prepare(`SELECT COUNT(*) AS count FROM rag_requests`).get().count
    const response = await ask(await login(), { content: 'x'.repeat(8_001) })
    expect(response.status).toBe(400)
    expect((await response.json()).error.code).toBe('VALIDATION')
    expect(db.prepare(`SELECT COUNT(*) AS count FROM rag_requests`).get().count).toBe(before)
    expect(generateAnswer).not.toHaveBeenCalled()
  })

  it('reconciles stale processing requests before starting a new request', async () => {
    const existingQuestion = db
      .prepare(`SELECT id FROM questions WHERE student_id = 's1' AND subject_id = 'sub1' LIMIT 1`)
      .get()
    db.prepare(
      `INSERT INTO rag_requests
       (id, question_id, student_id, subject_id, status, attempt_count,
        request_json, started_at, created_at)
       VALUES ('stale-rag-request', ?, 's1', 'sub1', 'processing', 1,
               '{}', '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z')`,
    ).run(existingQuestion.id)

    expect((await ask(await login(), { classId: 'class1' })).status).toBe(201)
    expect(
      db
        .prepare(`SELECT status, error_code FROM rag_requests WHERE id = 'stale-rag-request'`)
        .get(),
    ).toEqual({ status: 'failed', error_code: 'REQUEST_INTERRUPTED' })
  })

  it('fails closed for an inactive enrollment, unpublished source, and invalid lesson', async () => {
    const cookie = await login()
    db.prepare(
      `UPDATE enrollment_profiles SET status = 'inactive' WHERE enrollment_id = 'e1'`,
    ).run()
    expect((await ask(cookie, { classId: 'class1' })).status).toBe(403)

    db.prepare(`UPDATE enrollment_profiles SET status = 'active' WHERE enrollment_id = 'e1'`).run()
    const term = db
      .prepare(`SELECT academic_term_id AS id FROM course_classes WHERE id = 'class1'`)
      .get()
    db.prepare(`UPDATE academic_terms SET status = 'completed' WHERE id = ?`).run(term.id)
    expect((await ask(cookie, { classId: 'class1' })).status).toBe(403)

    db.prepare(`UPDATE academic_terms SET status = 'active' WHERE id = ?`).run(term.id)
    db.prepare(`UPDATE class_materials SET status = 'draft' WHERE id = 'cm1'`).run()
    expect((await ask(cookie, { classId: 'class1' })).status).toBe(409)

    db.prepare(`UPDATE class_materials SET status = 'published' WHERE id = 'cm1'`).run()
    expect(
      (await ask(cookie, { classId: 'class1', lessonId: 'lesson-outside-class' })).status,
    ).toBe(403)
    expect(generateAnswer).not.toHaveBeenCalled()
  })

  it('marks the request failed if a source is revoked after provider generation', async () => {
    generateAnswer.mockImplementationOnce(async (request) => {
      db.prepare(`UPDATE approved_sources SET is_approved = 0 WHERE material_id = 'mat1'`).run()
      return makeAnswer(request)
    })
    const response = await ask(await login(), { classId: 'class1' })
    expect(response.status).toBe(502)
    const payload = await response.json()
    expect(payload.error.code).toBe('INVALID_CITATION')
    expect(
      db.prepare(`SELECT status FROM rag_requests ORDER BY created_at DESC LIMIT 1`).get().status,
    ).toBe('failed')
  })

  it('does not persist a late answer after the request leaves processing state', async () => {
    generateAnswer.mockImplementationOnce(async (request) => {
      db.prepare(
        `UPDATE rag_requests
         SET status = 'cancelled', completed_at = '2026-09-14T00:00:00.000Z'
         WHERE status = 'processing'`,
      ).run()
      return makeAnswer(request)
    })

    const response = await ask(await login(), { classId: 'class1' })
    expect(response.status).toBe(409)
    expect((await response.json()).error.code).toBe('REQUEST_STATE_CONFLICT')
    const request = db
      .prepare(`SELECT id, status FROM rag_requests ORDER BY created_at DESC LIMIT 1`)
      .get()
    expect(request.status).toBe('cancelled')
    expect(
      db.prepare(`SELECT COUNT(*) AS count FROM rag_responses WHERE request_id = ?`).get(request.id)
        .count,
    ).toBe(0)
  })
})
