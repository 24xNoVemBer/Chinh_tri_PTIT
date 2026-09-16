import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { assertSchema, schemaIds } from '../../server/contracts/schemaRegistry.js'

const baseUrl = 'http://127.0.0.1:3101'
const fixture = JSON.parse(
  readFileSync(new URL('../../public/local-rag-sample.json', import.meta.url), 'utf8'),
)
let cookie
async function request(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(40000),
  })
  return { response, payload: await response.json() }
}
const anonymous = await request('/api/student/chat/status')
assert.equal(anonymous.response.status, 401)
const login = await request('/api/auth/login', {
  email: 'tuananh@ptit.edu.vn',
  password: 'Student@123',
})
assert.equal(login.response.status, 200)
cookie = login.response.headers.get('set-cookie').split(';')[0]
const status = await request('/api/student/chat/status')
assert.equal(status.payload.data.sampleData, true)
assert.equal(
  status.payload.data.mode,
  'extractive',
  'This smoke test is offline-only; it never authorizes billable calls.',
)
const chat = await request('/api/student/chat', {
  subjectId: fixture.subjectId,
  content: 'Phân biệt vật chất và ý thức bằng một ví dụ.',
})
assert.equal(chat.response.status, 201, JSON.stringify(chat.payload))
assert.equal(chat.payload.data.answerMode, 'extractive')
assert.equal(chat.payload.data.sampleData, true)
assert.equal(chat.payload.data.moderation.requiresReview, true)
assert.ok(chat.payload.data.citations.length > 0)
assert.ok(
  chat.payload.data.citations.every((c) => c.materialVersionId === fixture.materialVersionId),
)
const db = new DatabaseSync(new URL('../../data/local-rag/pilot.sqlite', import.meta.url), {
  readOnly: true,
})
try {
  const stored = db
    .prepare(
      `SELECT rr.status, rs.raw_response_json FROM rag_requests rr
    JOIN rag_responses rs ON rs.request_id = rr.id WHERE rr.question_id = ?`,
    )
    .get(chat.payload.data.questionId)
  assert.equal(stored.status, 'succeeded')
  const answer = JSON.parse(stored.raw_response_json)
  assertSchema(schemaIds.answer, answer)
  assert.equal(answer.usage.inputTokens, 0)
  assert.equal(answer.usage.outputTokens, 0)
  for (const citation of answer.citations) {
    const chunk = fixture.chunks.find((c) => c.id === citation.chunkId)
    assert.equal(citation.quote, chunk.text)
    assert.equal(citation.chunkSha256, createHash('sha256').update(chunk.text).digest('hex'))
  }
  const absent = await request('/api/student/chat', {
    subjectId: 'sub1',
    content: 'zzqxwwvvuu zzzqqqppp',
  })
  assert.equal(absent.response.status, 201)
  assert.equal(absent.payload.data.citations.length, 0)
  const denied = await request('/api/student/chat', {
    subjectId: 'not-enrolled',
    content: 'Phân biệt vật chất và ý thức.',
  })
  assert.equal(denied.response.status, 403)
  console.log(
    JSON.stringify(
      {
        result: 'PASS',
        mode: 'extractive-no-LLM',
        checks: [
          'authentication',
          'sample mode',
          'chat POST',
          'persisted answer contract',
          'citation IDs/quotes/SHA256',
          'no-source abstention',
          'subject access denied',
        ],
        citations: answer.citations.length,
        timing: answer.timing,
      },
      null,
      2,
    ),
  )
} finally {
  db.close()
}
