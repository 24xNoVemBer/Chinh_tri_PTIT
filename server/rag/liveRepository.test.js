// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
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

  beforeEach(async () => {
    db = createDatabase({ databasePath: ':memory:' })
    const ragClient = { generateAnswer: async (request) => makeAnswer(request) }
    server = createApiServer({ db, ragClient, logger: { error() {}, warn() {} } })
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    baseUrl = `http://127.0.0.1:${server.address().port}`
  })

  afterEach(async () => {
    await new Promise((resolve) => server.close(resolve))
    db.close()
  })

  it('persists a live answer and citations through the student API', async () => {
    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'tuananh@ptit.edu.vn', password: 'Student@123' }),
    })
    const cookie = login.headers.get('set-cookie').split(';')[0]
    const response = await fetch(`${baseUrl}/api/student/chat`, {
      method: 'POST',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subjectId: 'sub1',
        content: 'Phân biệt vật chất và ý thức trong triết học.',
      }),
    })
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
  })
})
