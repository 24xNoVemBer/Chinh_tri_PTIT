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
        classIds: ['class1'],
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

    const draftResponse = await api(
      `/api/lecturer/practice-questions/${created.id}/draft`,
      lecturer,
      { method: 'POST' },
    )
    expect(draftResponse.status).toBe(200)
    expect((await draftResponse.json()).data.status).toBe('draft')

    const publishAgainResponse = await api(
      `/api/lecturer/practice-questions/${created.id}/publish`,
      lecturer,
      { method: 'POST' },
    )
    expect(publishAgainResponse.status).toBe(200)
    expect((await publishAgainResponse.json()).data.status).toBe('published')

    const archiveResponse = await api(
      `/api/lecturer/practice-questions/${created.id}/archive`,
      lecturer,
      { method: 'POST' },
    )
    expect(archiveResponse.status).toBe(200)
    expect((await archiveResponse.json()).data.status).toBe('archived')

    const restoreResponse = await api(
      `/api/lecturer/practice-questions/${created.id}/restore`,
      lecturer,
      { method: 'POST' },
    )
    expect(restoreResponse.status).toBe(200)
    expect((await restoreResponse.json()).data.status).toBe('draft')

    const republishResponse = await api(
      `/api/lecturer/practice-questions/${created.id}/publish`,
      lecturer,
      { method: 'POST' },
    )
    expect(republishResponse.status).toBe(200)
    expect((await republishResponse.json()).data.status).toBe('published')

    const rearchiveResponse = await api(
      `/api/lecturer/practice-questions/${created.id}/archive`,
      lecturer,
      { method: 'POST' },
    )
    expect(rearchiveResponse.status).toBe(200)
    expect((await rearchiveResponse.json()).data.status).toBe('archived')

    const deleteResponse = await api(`/api/lecturer/practice-questions/${created.id}`, lecturer, {
      method: 'DELETE',
    })
    expect(deleteResponse.status).toBe(200)
    expect((await deleteResponse.json()).data.deleted).toBe(true)

    const listResponse = await api(
      '/api/lecturer/practice-questions?status=all&page=1&pageSize=2',
      lecturer,
    )
    expect(listResponse.status).toBe(200)
    const list = (await listResponse.json()).data
    expect(list).toHaveProperty('items')
    expect(list.items.length).toBeLessThanOrEqual(2)
    expect(list).toHaveProperty('total')
  })

  it('keeps lecturer-owned banks private while exposing shared questions read-only', async () => {
    await db.execute(
      `INSERT INTO class_lecturer_assignments
       (id, class_id, lecturer_id, assignment_role, status, assigned_at)
       VALUES ('assignment-class1-l2', 'class1', 'l2', 'lecturer', 'active', ?)`,
      [new Date().toISOString()],
    )
    await db.execute("UPDATE practice_questions SET scope = 'subject_shared' WHERE id = 'pq1'")
    const lecturer = await login('nva@ptit.edu.vn', 'Lecturer@123')

    const listResponse = await api('/api/lecturer/practice-questions?status=all', lecturer)
    expect(listResponse.status).toBe(200)
    const list = (await listResponse.json()).data.items
    expect(list.find((item) => item.id === 'pq1')).toMatchObject({
      scope: 'subject_shared',
      canEdit: false,
    })
    expect(list.some((item) => item.id === 'pq2')).toBe(false)

    const privateResponse = await api('/api/lecturer/practice-questions/pq2', lecturer)
    expect(privateResponse.status).toBe(403)

    const classResponse = await api(
      '/api/lecturer/classes/class1/practice-questions?status=all',
      lecturer,
    )
    expect(classResponse.status).toBe(200)
    expect((await classResponse.json()).data.items.map((item) => item.id)).toContain('pq1')
  })

  it('shows students only shared questions and private questions assigned to their class', async () => {
    const timestamp = new Date().toISOString()
    await db.execute(
      `INSERT INTO course_classes
       (id, subject_id, name, lecturer_id, semester, academic_term_id, group_number, class_code, status)
       SELECT 'class-scope-test', 'sub1', 'N03 - Triết học Mác-Lênin', 'l1', semester,
              academic_term_id, 3, 'N03', 'active'
       FROM course_classes WHERE id = 'class1'`,
    )
    await db.execute(
      `INSERT INTO class_lecturer_assignments
       (id, class_id, lecturer_id, assignment_role, status, assigned_at)
       VALUES ('assignment-scope-test', 'class-scope-test', 'l1', 'lead', 'active', ?)`,
      [timestamp],
    )
    await db.execute(
      `INSERT INTO enrollments (id, student_id, class_id)
       VALUES ('enrollment-scope-test', 's1', 'class-scope-test')`,
    )
    await db.execute("UPDATE practice_questions SET scope = 'subject_shared' WHERE id = 'pq1'")

    const lecturer = await login('ductu@ptit.edu.vn', 'Lecturer@123')
    const createResponse = await api('/api/lecturer/practice-questions', lecturer, {
      method: 'POST',
      body: JSON.stringify({
        subjectId: 'sub1',
        chapterId: 'chap1',
        classIds: ['class1'],
        content: 'Câu hỏi riêng chỉ được phân phối cho đúng lớp tín chỉ đã chọn?',
        explanation: 'Câu hỏi riêng được lọc theo bảng phân công câu hỏi cho lớp tín chỉ.',
        correctOptionKey: 'A',
        options: [
          { key: 'A', content: 'Chỉ lớp được gán' },
          { key: 'B', content: 'Mọi lớp cùng môn' },
          { key: 'C', content: 'Mọi sinh viên' },
          { key: 'D', content: 'Không lớp nào' },
        ],
      }),
    })
    expect(createResponse.status).toBe(201)
    const privateQuestion = (await createResponse.json()).data
    await api(`/api/lecturer/practice-questions/${privateQuestion.id}/publish`, lecturer, {
      method: 'POST',
    })

    const student = await login('tuananh@ptit.edu.vn', 'Student@123')
    const sessionResponse = await api('/api/student/practice-sessions', student, {
      method: 'POST',
      body: JSON.stringify({
        subjectId: 'sub1',
        classId: 'class-scope-test',
        questionCount: 20,
        randomize: false,
      }),
    })
    expect(sessionResponse.status).toBe(201)
    const questionIds = (await sessionResponse.json()).data.questions.map(
      (item) => item.question.id,
    )
    expect(questionIds).toContain('pq1')
    expect(questionIds).not.toContain(privateQuestion.id)
  })

  it('imports a CSV question batch atomically as drafts', async () => {
    const lecturer = await login('ductu@ptit.edu.vn', 'Lecturer@123')
    const questions = [
      {
        content: 'Câu hỏi CSV thứ nhất dùng để kiểm tra nhập hàng loạt?',
        explanation: 'Giải thích đầy đủ cho câu hỏi CSV thứ nhất trong lô nhập.',
        difficulty: 'easy',
        correctOptionKey: 'A',
        options: [
          { key: 'A', content: 'Đáp án thứ nhất A' },
          { key: 'B', content: 'Đáp án thứ nhất B' },
          { key: 'C', content: 'Đáp án thứ nhất C' },
          { key: 'D', content: 'Đáp án thứ nhất D' },
        ],
      },
      {
        content: 'Câu hỏi CSV thứ hai dùng để kiểm tra nhập hàng loạt?',
        explanation: 'Giải thích đầy đủ cho câu hỏi CSV thứ hai trong lô nhập.',
        difficulty: 'hard',
        correctOptionKey: 'C',
        options: [
          { key: 'A', content: 'Đáp án thứ hai A' },
          { key: 'B', content: 'Đáp án thứ hai B' },
          { key: 'C', content: 'Đáp án thứ hai C' },
          { key: 'D', content: 'Đáp án thứ hai D' },
        ],
      },
    ]

    const response = await api('/api/lecturer/practice-questions/import', lecturer, {
      method: 'POST',
      body: JSON.stringify({
        subjectId: 'sub1',
        chapterId: 'chap1',
        classIds: ['class1'],
        questions,
      }),
    })
    expect(response.status).toBe(201)
    const imported = (await response.json()).data
    expect(imported).toMatchObject({ importedCount: 2, status: 'draft' })
    expect(imported.ids).toHaveLength(2)

    for (const id of imported.ids) {
      const stored = await db.one(
        'SELECT status, source_type FROM practice_questions WHERE id = ?',
        [id],
      )
      expect(stored).toMatchObject({ status: 'draft', source_type: 'csv' })
    }

    const beforeInvalidImport = await db.one(
      'SELECT COUNT(*) AS total FROM practice_questions WHERE source_type = ?',
      ['csv'],
    )
    const invalidResponse = await api('/api/lecturer/practice-questions/import', lecturer, {
      method: 'POST',
      body: JSON.stringify({
        subjectId: 'sub1',
        chapterId: 'chap1',
        classIds: ['class1'],
        questions: [
          {
            ...questions[0],
            content: 'Một câu hợp lệ mới trong lô nhập bị từ chối toàn bộ?',
          },
          { ...questions[1], content: 'Ngắn' },
        ],
      }),
    })
    expect(invalidResponse.status).toBe(400)
    const afterInvalidImport = await db.one(
      'SELECT COUNT(*) AS total FROM practice_questions WHERE source_type = ?',
      ['csv'],
    )
    expect(Number(afterInvalidImport.total)).toBe(Number(beforeInvalidImport.total))
  })

  it('keeps option ids when saving a question referenced by practice history', async () => {
    const lecturer = await login('ductu@ptit.edu.vn', 'Lecturer@123')
    const createResponse = await api('/api/lecturer/practice-questions', lecturer, {
      method: 'POST',
      body: JSON.stringify({
        subjectId: 'sub1',
        chapterId: 'chap1',
        classIds: ['class1'],
        content: 'Câu hỏi dùng để kiểm tra chỉnh sửa sau khi đã luyện tập?',
        explanation: 'Giải thích đủ dài cho câu hỏi kiểm tra chỉnh sửa lịch sử.',
        difficulty: 'medium',
        correctOptionKey: 'B',
        options: [
          { key: 'A', content: 'Phương án kiểm tra A' },
          { key: 'B', content: 'Phương án kiểm tra B' },
          { key: 'C', content: 'Phương án kiểm tra C' },
          { key: 'D', content: 'Phương án kiểm tra D' },
        ],
      }),
    })
    expect(createResponse.status).toBe(201)
    const created = (await createResponse.json()).data

    const publishResponse = await api(
      `/api/lecturer/practice-questions/${created.id}/publish`,
      lecturer,
      { method: 'POST' },
    )
    expect(publishResponse.status).toBe(200)

    const timestamp = new Date().toISOString()
    await db.execute(
      `INSERT INTO practice_sessions
       (id, student_id, subject_id, chapter_id, status, question_count, answered_count,
        correct_count, started_at, completed_at, updated_at)
       VALUES (?, 's1', 'sub1', 'chap1', 'completed', 1, 1, 1, ?, ?, ?)`,
      ['session-option-history', timestamp, timestamp, timestamp],
    )
    await db.execute(
      `INSERT INTO practice_session_questions
       (id, session_id, question_id, position, selected_option_id, is_correct, answered_at)
       VALUES ('session-option-history-item', 'session-option-history', ?, 1, ?, 1, ?)`,
      [created.id, created.correctOptionId, timestamp],
    )

    await api(`/api/lecturer/practice-questions/${created.id}/archive`, lecturer, {
      method: 'POST',
    })
    await api(`/api/lecturer/practice-questions/${created.id}/restore`, lecturer, {
      method: 'POST',
    })

    const updateResponse = await api(`/api/lecturer/practice-questions/${created.id}`, lecturer, {
      method: 'PATCH',
      body: JSON.stringify({
        subjectId: 'sub1',
        chapterId: 'chap1',
        classIds: ['class1'],
        content: 'Câu hỏi đã chỉnh sửa nhưng vẫn giữ lịch sử luyện tập?',
        explanation: 'Giải thích đã chỉnh sửa và vẫn bảo toàn lịch sử lựa chọn.',
        difficulty: 'hard',
        correctOptionKey: 'B',
        options: [
          { key: 'A', content: 'Phương án sau chỉnh sửa A' },
          { key: 'B', content: 'Phương án sau chỉnh sửa B' },
          { key: 'C', content: 'Phương án sau chỉnh sửa C' },
          { key: 'D', content: 'Phương án sau chỉnh sửa D' },
        ],
      }),
    })
    expect(updateResponse.status).toBe(200)
    const updated = (await updateResponse.json()).data
    expect(updated.correctOptionId).toBe(created.correctOptionId)
    expect(updated.status).toBe('draft')
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

  it('keeps mock-exam answers private until submission and allows answer review', async () => {
    const student = await login('tuananh@ptit.edu.vn', 'Student@123')
    const createResponse = await api('/api/student/practice-sessions', student, {
      method: 'POST',
      body: JSON.stringify({
        subjectId: 'sub1',
        questionCount: 2,
        sessionType: 'mock_exam',
        randomize: true,
      }),
    })
    expect(createResponse.status).toBe(201)
    const session = (await createResponse.json()).data
    expect(session.sessionType).toBe('mock_exam')
    expect(session.correctCount).toBeNull()

    const first = session.questions[0]
    const firstAnswerResponse = await api(
      `/api/student/practice-sessions/${session.id}/answers`,
      student,
      {
        method: 'POST',
        body: JSON.stringify({
          questionId: first.question.id,
          optionId: first.question.options[0].id,
        }),
      },
    )
    expect(firstAnswerResponse.status).toBe(200)
    const firstAnswer = (await firstAnswerResponse.json()).data
    expect(firstAnswer.isCorrect).toBeUndefined()
    expect(firstAnswer.correctOptionId).toBeUndefined()
    expect(firstAnswer.explanation).toBeUndefined()

    const changeAnswerResponse = await api(
      `/api/student/practice-sessions/${session.id}/answers`,
      student,
      {
        method: 'POST',
        body: JSON.stringify({
          questionId: first.question.id,
          optionId: first.question.options[1].id,
        }),
      },
    )
    expect(changeAnswerResponse.status).toBe(200)
    expect((await changeAnswerResponse.json()).data.answeredCount).toBe(1)

    const inProgressResponse = await api(`/api/student/practice-sessions/${session.id}`, student)
    const inProgress = (await inProgressResponse.json()).data
    expect(inProgress.correctCount).toBeNull()
    expect(inProgress.questions[0].isCorrect).toBeNull()
    expect(inProgress.questions[0].selectedOptionId).toBe(first.question.options[1].id)
    expect(inProgress.questions[0].question.explanation).toBeUndefined()

    const second = session.questions[1]
    await api(`/api/student/practice-sessions/${session.id}/answers`, student, {
      method: 'POST',
      body: JSON.stringify({
        questionId: second.question.id,
        optionId: second.question.options[0].id,
      }),
    })
    const completeResponse = await api(
      `/api/student/practice-sessions/${session.id}/complete`,
      student,
      { method: 'POST' },
    )
    expect(completeResponse.status).toBe(200)
    const completed = (await completeResponse.json()).data
    expect(typeof completed.correctCount).toBe('number')
    expect(completed.questions.every((item) => item.question.correctOptionId)).toBe(true)
    expect(completed.questions.every((item) => item.question.explanation)).toBe(true)
  })

  it('prevents students from practising outside their enrolled subject', async () => {
    const student = await login('tuananh@ptit.edu.vn', 'Student@123')
    const response = await api('/api/student/practice-sessions', student, {
      method: 'POST',
      body: JSON.stringify({ subjectId: 'sub3', questionCount: 5 }),
    })
    expect(response.status).toBe(403)
  })

  it('returns class-scoped practice data and supports retrying wrong answers', async () => {
    const student = await login('tuananh@ptit.edu.vn', 'Student@123')
    const configResponse = await api('/api/student/practice/config/sub1', student)
    expect(configResponse.status).toBe(200)
    const config = (await configResponse.json()).data
    expect(config.classes.length).toBeGreaterThan(0)

    const createResponse = await api('/api/student/practice-sessions', student, {
      method: 'POST',
      body: JSON.stringify({
        subjectId: 'sub1',
        classId: config.classes[0].id,
        chapterId: 'chap1',
        questionCount: 2,
      }),
    })
    expect(createResponse.status).toBe(201)
    const session = (await createResponse.json()).data
    expect(session.classId).toBe(config.classes[0].id)
    expect(session.mode).toBe('standard')

    const item = session.questions[0]
    const correct = db.one(
      'SELECT id FROM practice_question_options WHERE question_id = ? AND is_correct = 1',
      [item.question.id],
    )
    const wrong = item.question.options.find((option) => option.id !== correct.id)
    const answerResponse = await api(
      `/api/student/practice-sessions/${session.id}/answers`,
      student,
      {
        method: 'POST',
        body: JSON.stringify({ questionId: item.question.id, optionId: wrong.id }),
      },
    )
    expect(answerResponse.status).toBe(200)
    expect((await answerResponse.json()).data.isCorrect).toBe(false)

    const retryResponse = await api('/api/student/practice-sessions', student, {
      method: 'POST',
      body: JSON.stringify({
        subjectId: 'sub1',
        classId: config.classes[0].id,
        mode: 'retry_wrong',
        sourceSessionId: session.id,
        questionCount: 5,
      }),
    })
    expect(retryResponse.status).toBe(201)
    const retry = (await retryResponse.json()).data
    expect(retry.mode).toBe('retry_wrong')
    expect(retry.sourceSessionId).toBe(session.id)
    expect(retry.questionCount).toBe(1)

    const overviewResponse = await api('/api/student/practice/overview', student)
    expect(overviewResponse.status).toBe(200)
    expect((await overviewResponse.json()).data.summary.answered).toBeGreaterThan(0)
  })

  it('returns lecturer practice analytics scoped to owned classes', async () => {
    const lecturer = await login('ductu@ptit.edu.vn', 'Lecturer@123')
    const response = await api('/api/lecturer/practice-analytics?classId=class1', lecturer)
    expect(response.status).toBe(200)
    const analytics = (await response.json()).data
    expect(analytics.scope.classId).toBe('class1')
    expect(analytics.summary).toHaveProperty('studentCount')
    expect(Array.isArray(analytics.questions)).toBe(true)
  })
})
