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

    // les1 is published into class1, which s1 is enrolled in. les3 is still a draft and is
    // covered by the visibility test below.
    const progressResponse = await api('/api/student/lessons/les1/progress', studentCookie, {
      method: 'PATCH',
      body: JSON.stringify({ progress: 64 }),
    })
    expect(progressResponse.status).toBe(200)

    const createQuestionResponse = await api('/api/student/questions', studentCookie, {
      method: 'POST',
      body: JSON.stringify({
        subjectId: 'sub1',
        lessonId: 'les1',
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

  it('hides draft and unscheduled lessons from students', async () => {
    const studentCookie = await login('tuananh@ptit.edu.vn', 'Student@123')

    // les3 is scheduled into the student's class but still a draft; les4 was never
    // scheduled into any class. Neither may reach the student, in content or in listings.
    for (const lessonId of ['les3', 'les4']) {
      const response = await api(`/api/student/lessons/${lessonId}`, studentCookie)
      expect(response.status).toBe(404)

      const progress = await api(`/api/student/lessons/${lessonId}/progress`, studentCookie, {
        method: 'PATCH',
        body: JSON.stringify({ progress: 10 }),
      })
      expect(progress.status).toBe(404)
    }

    const overview = await parseData(await api('/api/student/subjects/sub1', studentCookie))
    const visibleIds = overview.chapters.flatMap((chapter) =>
      chapter.lessons.map((lesson) => lesson.id),
    )
    expect(visibleIds).not.toContain('les3')
    expect(visibleIds).not.toContain('les4')
    expect(visibleIds).toContain('les1')
  })

  it('never serves unapproved RAG content to the student who owns the question', async () => {
    const studentCookie = await login('trang.pt@ptit.edu.vn', 'Student@123')
    const questions = await parseData(await api('/api/student/questions', studentCookie))
    const pending = questions.find((question) => question.ragResponse)

    expect(pending).toBeDefined()
    expect(pending.ragResponse.reviewStatus).not.toBe('approved')
    // The status envelope survives so the UI can say "awaiting review"; the payload does not.
    expect(pending.ragResponse.content).toBeNull()
    expect(pending.ragResponse.citations).toEqual([])
  })

  it('scopes a student to their own questions', async () => {
    const studentCookie = await login('tuananh@ptit.edu.vn', 'Student@123')

    const list = await parseData(await api('/api/student/questions', studentCookie))
    expect(list.every((question) => question.studentId === 's1')).toBe(true)

    // sq2 belongs to s2 and must not be readable by s1.
    const foreign = await api('/api/student/questions/sq2', studentCookie)
    expect(foreign.status).toBe(403)
  })

  it("keeps another student's question wording out of search results", async () => {
    const studentCookie = await login('tuananh@ptit.edu.vn', 'Student@123')

    // "Em chưa hiểu rõ" appears only in s2's question wording, never in the lecturer's
    // answer, so a match on it could only come from indexing a peer's own text.
    const byPeerWording = await parseData(
      await api('/api/student/search', studentCookie, {
        method: 'POST',
        body: JSON.stringify({ query: 'Em chưa hiểu rõ', recordHistory: false }),
      }),
    )
    expect(byPeerWording.filter((result) => result.sourceType === 'answer')).toHaveLength(0)

    // The lecturer's answer itself stays discoverable, just without the original question.
    const byAnswerText = await parseData(
      await api('/api/student/search', studentCookie, {
        method: 'POST',
        body: JSON.stringify({ query: 'cơn mưa', recordHistory: false }),
      }),
    )
    const answerHits = byAnswerText.filter((result) => result.sourceType === 'answer')
    expect(answerHits).toHaveLength(1)
    expect(answerHits[0].title).not.toContain('Em chưa hiểu')
    expect(answerHits[0].questionId).toBeNull()
  })

  it('throttles repeated failed logins', async () => {
    const attempt = () =>
      fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'tuananh@ptit.edu.vn', password: 'wrong-password' }),
      })

    const statuses = []
    for (let i = 0; i < 10; i += 1) statuses.push((await attempt()).status)

    expect(statuses.filter((status) => status === 401).length).toBe(8)
    expect(statuses.at(-1)).toBe(429)
  })

  it('rejects malformed paths and cookies instead of failing the request', async () => {
    const brokenCookie = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: 'ptit_session=%' },
    })
    expect(brokenCookie.status).toBe(401)

    const studentCookie = await login('mai.tt@ptit.edu.vn', 'Student@123')
    const brokenPath = await api('/api/student/lessons/%/progress', studentCookie, {
      method: 'PATCH',
      body: JSON.stringify({ progress: 10 }),
    })
    expect(brokenPath.status).toBe(400)
  })

  it('caps the length of user supplied text', async () => {
    const studentCookie = await login('tuananh@ptit.edu.vn', 'Student@123')
    const response = await api('/api/student/questions', studentCookie, {
      method: 'POST',
      body: JSON.stringify({ subjectId: 'sub1', content: 'a'.repeat(5000) }),
    })
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'VALIDATION' } })
  })

  it('accepts a loopback origin whose host differs from the API host', async () => {
    // In dev the UI is served by Vite on :5173 and /api is proxied to the API port, which
    // rewrites Host to the upstream. Comparing Origin against Host therefore always fails
    // and used to 403 every login. Any reverse proxy behaves the same way.
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
      body: JSON.stringify({ email: 'tuananh@ptit.edu.vn', password: 'Student@123' }),
    })
    expect(response.status).toBe(200)
  })

  it('rejects a state-changing request from a foreign origin', async () => {
    const studentCookie = await login('tuananh@ptit.edu.vn', 'Student@123')
    const response = await api('/api/student/questions', studentCookie, {
      method: 'POST',
      headers: { Origin: 'https://evil.example' },
      body: JSON.stringify({
        subjectId: 'sub1',
        content: 'Câu hỏi này được gửi từ một trang web khác.',
      }),
    })
    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'CROSS_ORIGIN' } })
  })

  it('connects a student chat message to the lecturer RAG review queue', async () => {
    const studentCookie = await login('tuananh@ptit.edu.vn', 'Student@123')
    const lecturerCookie = await login('ductu@ptit.edu.vn', 'Lecturer@123')

    const chatResponse = await api('/api/student/chat', studentCookie, {
      method: 'POST',
      body: JSON.stringify({
        subjectId: 'sub1',
        content: 'Vật chất và ý thức có mối quan hệ như thế nào?',
      }),
    })
    expect(chatResponse.status).toBe(201)
    const chat = await parseData(chatResponse)
    expect(chat).toMatchObject({
      reviewStatus: 'pending_review',
      isDemo: true,
      moderation: {
        priority: 'sample',
        requiresReview: false,
      },
    })
    expect(chat.citations).toHaveLength(1)

    const queue = await parseData(
      await api('/api/lecturer/rag/reviews?priority=sample', lecturerCookie),
    )
    const queuedQuestion = queue.find((question) => question.id === chat.questionId)
    expect(queuedQuestion).toMatchObject({
      content: 'Vật chất và ý thức có mối quan hệ như thế nào?',
      ragResponse: {
        id: chat.responseId,
        reviewStatus: 'pending_review',
        isDemo: true,
      },
    })
    expect(queuedQuestion.ragResponse.citations).toHaveLength(1)

    const attentionQueue = await parseData(
      await api('/api/lecturer/rag/reviews?priority=attention', lecturerCookie),
    )
    expect(attentionQueue.some((question) => question.id === chat.questionId)).toBe(false)

    const crossSubjectResponse = await api('/api/student/chat', studentCookie, {
      method: 'POST',
      body: JSON.stringify({
        subjectId: 'sub2',
        content: 'Vật chất và ý thức có mối quan hệ như thế nào?',
      }),
    })
    const crossSubjectChat = await parseData(crossSubjectResponse)
    expect(crossSubjectChat.moderation).toMatchObject({
      priority: 'high',
      requiresReview: true,
    })

    const refreshedAttentionQueue = await parseData(
      await api('/api/lecturer/rag/reviews?priority=attention', lecturerCookie),
    )
    expect(
      refreshedAttentionQueue.some((question) => question.id === crossSubjectChat.questionId),
    ).toBe(true)
  })
})

describe('SQLite persistence', () => {
  it('keeps changes after closing and reopening the database', () => {
    const directory = mkdtempSync(join(tmpdir(), 'ptit-phase4-'))
    const databasePath = join(directory, 'app.sqlite')
    let fileDb

    try {
      fileDb = createDatabase({ databasePath })
      createRepositories(fileDb).learningRepository.updateProgress('s1', 'les1', 88)
      fileDb.close()

      fileDb = createDatabase({ databasePath })
      const lesson = createRepositories(fileDb).learningRepository.getLessonForStudent('s1', 'les1')
      expect(lesson.progress).toBe(88)
    } finally {
      fileDb?.close()
      rmSync(directory, { force: true, recursive: true })
    }
  })
})
