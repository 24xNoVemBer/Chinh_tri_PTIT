// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApiServer } from './app.js'
import { createDatabase } from './database.js'

describe('practice question bank and sessions', () => {
  let db
  let server
  let baseUrl

  beforeEach(async () => {
    db = createDatabase({ databasePath: ':memory:', seed: true })
    server = createApiServer({ db, logger: { error() {}, warn() {} } })
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    baseUrl = `http://127.0.0.1:${server.address().port}`
  })

  afterEach(async () => {
    await new Promise((resolve) => server.close(resolve))
    db.close()
  })

  async function login(email, password) {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    expect(response.status).toBe(200)
    return response.headers.get('set-cookie').split(';')[0]
  }

  function api(path, cookie, options = {}) {
    return fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        Cookie: cookie,
        ...options.headers,
      },
    })
  }

  it('creates, publishes and scopes lecturer questions by taught subject', async () => {
    const lecturer = await login('ductu@ptit.edu.vn', 'Lecturer@123')
    const response = await api('/api/lecturer/practice-questions', lecturer, {
      method: 'POST',
      body: JSON.stringify({
        subjectId: 'sub1',
        chapterId: 'chap1',
        content: 'Câu hỏi kiểm thử quyền giảng viên có đủ dài?',
        explanation: 'Giải thích cho câu hỏi kiểm thử quyền truy cập.',
        difficulty: 'medium',
        correctOptionKey: 'B',
        options: [
          { key: 'A', content: 'Phương án sai A' },
          { key: 'B', content: 'Phương án đúng B' },
          { key: 'C', content: 'Phương án sai C' },
          { key: 'D', content: 'Phương án sai D' },
        ],
      }),
    })
    expect(response.status).toBe(201)
    const created = (await response.json()).data
    expect(created.status).toBe('draft')
    expect(created.correctOptionId).toBeDefined()

    const publishResponse = await api(
      `/api/lecturer/practice-questions/${created.id}/publish`,
      lecturer,
      { method: 'POST' },
    )
    expect(publishResponse.status).toBe(200)
    expect((await publishResponse.json()).data.status).toBe('published')
  })

  it('hides answer keys before selection and returns feedback after one answer', async () => {
    const student = await login('tuananh@ptit.edu.vn', 'Student@123')
    const createResponse = await api('/api/student/practice-sessions', student, {
      method: 'POST',
      body: JSON.stringify({ subjectId: 'sub1', chapterId: 'chap1', questionCount: 1 }),
    })
    expect(createResponse.status).toBe(201)
    const session = (await createResponse.json()).data
    const item = session.questions[0]
    expect(item.question.correctOptionId).toBeUndefined()
    expect(item.question.explanation).toBeUndefined()

    const answerResponse = await api(
      `/api/student/practice-sessions/${session.id}/answers`,
      student,
      {
        method: 'POST',
        body: JSON.stringify({
          questionId: item.question.id,
          optionId: item.question.options[0].id,
        }),
      },
    )
    expect(answerResponse.status).toBe(200)
    const feedback = (await answerResponse.json()).data
    expect(feedback.correctOptionId).toBeDefined()
    expect(feedback.explanation).toBeTruthy()

    const duplicateResponse = await api(
      `/api/student/practice-sessions/${session.id}/answers`,
      student,
      {
        method: 'POST',
        body: JSON.stringify({
          questionId: item.question.id,
          optionId: item.question.options[1].id,
        }),
      },
    )
    expect(duplicateResponse.status).toBe(409)
  })

  it('prevents students from practising outside their enrolled subject', async () => {
    const student = await login('tuananh@ptit.edu.vn', 'Student@123')
    const response = await api('/api/student/practice-sessions', student, {
      method: 'POST',
      body: JSON.stringify({ subjectId: 'sub3', questionCount: 5 }),
    })
    expect(response.status).toBe(403)
  })
})
