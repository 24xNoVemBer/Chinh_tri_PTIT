// @vitest-environment node
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApiServer } from './app.js'
import { createDatabase } from './database.js'
import { createRepositories } from './repositories.js'

async function parseData(response) {
  const payload = await response.json()
  return payload.data
}

describe('Phase 4 API', () => {
  let baseUrl
  let db
  let server

  beforeEach(async () => {
    db = createDatabase({ databasePath: ':memory:' })
    server = createApiServer({ db, logger: { error() {} } })
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

  it('infers the account role, authenticates a session, and blocks the wrong role', async () => {
    const studentCookie = await login('tuananh@ptit.edu.vn', 'Student@123')

    const meResponse = await api('/api/auth/me', studentCookie)
    expect(meResponse.status).toBe(200)
    await expect(parseData(meResponse)).resolves.toMatchObject({
      id: 's1',
      role: 'student',
    })

    const forbiddenResponse = await api('/api/lecturer/classes', studentCookie)
    expect(forbiddenResponse.status).toBe(403)
    await expect(forbiddenResponse.json()).resolves.toMatchObject({
      error: { code: 'FORBIDDEN' },
    })
  })

  it('connects the student and lecturer vertical slices with audit history', async () => {
    const studentCookie = await login('tuananh@ptit.edu.vn', 'Student@123')
    const lecturerCookie = await login('ductu@ptit.edu.vn', 'Lecturer@123')

    const progressResponse = await api('/api/student/lessons/les3/progress', studentCookie, {
      method: 'PATCH',
      body: JSON.stringify({ progress: 64 }),
    })
    expect(progressResponse.status).toBe(200)

    const createQuestionResponse = await api('/api/student/questions', studentCookie, {
      method: 'POST',
      body: JSON.stringify({
        subjectId: 'sub1',
        lessonId: 'les3',
        content: 'Giảng viên có thể giải thích rõ hơn mối quan hệ biện chứng này không?',
      }),
    })
    expect(createQuestionResponse.status).toBe(201)
    const createdQuestion = await parseData(createQuestionResponse)

    const lecturerQuestionResponse = await api(
      `/api/lecturer/questions/${createdQuestion.id}`,
      lecturerCookie,
    )
    expect(lecturerQuestionResponse.status).toBe(200)

    const answerResponse = await api(
      `/api/lecturer/questions/${createdQuestion.id}/answer`,
      lecturerCookie,
      {
        method: 'POST',
        body: JSON.stringify({
          content:
            'Mối quan hệ biện chứng cho thấy hai mặt vừa tác động, vừa chuyển hóa lẫn nhau trong điều kiện cụ thể.',
        }),
      },
    )
    expect(answerResponse.status).toBe(200)

    const studentQuestionResponse = await api(
      `/api/student/questions/${createdQuestion.id}`,
      studentCookie,
    )
    const studentQuestion = await parseData(studentQuestionResponse)
    expect(studentQuestion).toMatchObject({
      status: 'answered',
      lecturerAnswer: { lecturerId: 'l1' },
    })

    const auditResponse = await api('/api/lecturer/audit-logs', lecturerCookie)
    const auditLogs = await parseData(auditResponse)
    expect(auditLogs.map((entry) => entry.action)).toEqual(
      expect.arrayContaining(['question.created', 'answer.created']),
    )
  })

  it('returns a stable conflict error for duplicate class content', async () => {
    const lecturerCookie = await login('ductu@ptit.edu.vn', 'Lecturer@123')
    const availableResponse = await api(
      '/api/lecturer/classes/class1/lessons/available',
      lecturerCookie,
    )
    const [availableLesson] = await parseData(availableResponse)
    expect(availableLesson).toBeTruthy()

    const input = { lessonId: availableLesson.id, date: '2026-08-01' }
    const firstResponse = await api('/api/lecturer/classes/class1/lessons', lecturerCookie, {
      method: 'POST',
      body: JSON.stringify(input),
    })
    expect(firstResponse.status).toBe(201)

    const duplicateResponse = await api('/api/lecturer/classes/class1/lessons', lecturerCookie, {
      method: 'POST',
      body: JSON.stringify(input),
    })
    expect(duplicateResponse.status).toBe(409)
    await expect(duplicateResponse.json()).resolves.toMatchObject({
      error: { code: 'CONFLICT' },
    })
  })

  it('serves cited RAG demo data and persists lecturer review decisions', async () => {
    const lecturerCookie = await login('ductu@ptit.edu.vn', 'Lecturer@123')
    const queueResponse = await api('/api/lecturer/rag/reviews', lecturerCookie)
    expect(queueResponse.status).toBe(200)
    const queue = await parseData(queueResponse)
    expect(queue).toHaveLength(1)
    expect(queue[0].ragResponse).toMatchObject({
      isDemo: true,
      reviewStatus: 'pending_review',
    })
    expect(queue[0].ragResponse.citations).toHaveLength(1)

    const reviewResponse = await api(
      `/api/lecturer/rag/responses/${queue[0].ragResponse.id}/review`,
      lecturerCookie,
      {
        method: 'POST',
        body: JSON.stringify({
          action: 'approve',
          content: `${queue[0].ragResponse.content} Nội dung đã được giảng viên đối chiếu.`,
          note: 'Dữ liệu fixture phục vụ demo UI.',
        }),
      },
    )
    expect(reviewResponse.status).toBe(200)
    const reviewedQuestion = await parseData(reviewResponse)
    expect(reviewedQuestion).toMatchObject({
      status: 'answered',
      ragResponse: { reviewStatus: 'approved', reviewedBy: 'l1' },
    })

    const refreshedQueue = await parseData(await api('/api/lecturer/rag/reviews', lecturerCookie))
    expect(refreshedQueue).toHaveLength(0)
  })
})

describe('SQLite persistence', () => {
  it('keeps changes after closing and reopening the database', () => {
    const directory = mkdtempSync(join(tmpdir(), 'ptit-phase4-'))
    const databasePath = join(directory, 'app.sqlite')
    let fileDb

    try {
      fileDb = createDatabase({ databasePath })
      createRepositories(fileDb).learningRepository.updateProgress('s1', 'les3', 88)
      fileDb.close()

      fileDb = createDatabase({ databasePath })
      const lesson = createRepositories(fileDb).learningRepository.getLessonForStudent('s1', 'les3')
      expect(lesson.progress).toBe(88)
    } finally {
      fileDb?.close()
      rmSync(directory, { force: true, recursive: true })
    }
  })
})
