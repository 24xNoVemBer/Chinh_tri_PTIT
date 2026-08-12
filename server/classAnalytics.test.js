// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApiServer } from './app.js'
import { hashPassword } from './auth.js'
import { createDatabase } from './database.js'

describe('class-scoped analytics', () => {
  let db
  let server
  let baseUrl

  beforeEach(async () => {
    db = createDatabase({ databasePath: ':memory:', seed: true })
    const timestamp = '2026-08-12T08:00:00.000Z'
    const term = await db.one('SELECT id FROM academic_terms ORDER BY id LIMIT 1')
    await db.execute(
      `INSERT INTO users
       (id, name, email, role, password_hash, status, auth_version, created_at)
       VALUES ('admin-analytics', 'Quản trị thống kê', 'admin.analytics@ptit.edu.vn', 'admin', ?,
               'active', 1, ?)`,
      [hashPassword('Admin@123'), timestamp],
    )
    await db.execute(
      `INSERT INTO course_classes
       (id, subject_id, name, lecturer_id, semester, academic_term_id, group_number,
        class_code, status)
       VALUES ('class-analytics-other', 'sub1', 'N99 - Triết học Mác-Lênin', 'l2',
               '2023-2024', ?, 99, 'N99', 'active')`,
      [term.id],
    )
    await db.execute(
      `INSERT INTO class_lecturer_assignments
       (id, class_id, lecturer_id, assignment_role, status, assigned_by, assigned_at)
       VALUES ('assignment-analytics-other', 'class-analytics-other', 'l2', 'lead', 'active',
               'admin-analytics', ?)`,
      [timestamp],
    )
    await db.execute(
      `INSERT INTO enrollments (id, student_id, class_id)
       VALUES ('enrollment-analytics-other', 's4', 'class-analytics-other')`,
    )
    await insertSession({
      id: 'analytics-class1-session',
      studentId: 's1',
      classId: 'class1',
      correct: true,
      timestamp,
    })
    await insertSession({
      id: 'analytics-other-session',
      studentId: 's4',
      classId: 'class-analytics-other',
      correct: false,
      timestamp,
    })
    server = createApiServer({ db, logger: { error() {}, warn() {} } })
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    baseUrl = `http://127.0.0.1:${server.address().port}`
  })

  afterEach(async () => {
    await new Promise((resolve) => server.close(resolve))
    db.close()
  })

  async function insertSession({ id, studentId, classId, correct, timestamp }) {
    await db.execute(
      `INSERT INTO practice_sessions
       (id, student_id, subject_id, chapter_id, class_id, mode, session_type, status,
        question_count, answered_count, correct_count, started_at, completed_at, updated_at)
       VALUES (?, ?, 'sub1', 'chap1', ?, 'standard', 'practice', 'completed', 1, 1, ?,
               ?, ?, ?)`,
      [id, studentId, classId, correct ? 1 : 0, timestamp, timestamp, timestamp],
    )
    await db.execute(
      `INSERT INTO practice_session_questions
       (id, session_id, question_id, position, selected_option_id, is_correct, answered_at,
        started_at, answer_duration_ms)
       VALUES (?, ?, 'pq1', 1, ?, ?, ?, ?, 12000)`,
      [`item-${id}`, id, correct ? 'pqo1' : 'pqo2', correct ? 1 : 0, timestamp, timestamp],
    )
  }

  async function login(email, password) {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    expect(response.status).toBe(200)
    return response.headers.get('set-cookie').split(';')[0]
  }

  function api(path, cookie) {
    return fetch(`${baseUrl}${path}`, { headers: { Cookie: cookie } })
  }

  it('isolates practice and student metrics between classes of the same subject', async () => {
    const lecturer = await login('ductu@ptit.edu.vn', 'Lecturer@123')
    const response = await api('/api/lecturer/classes/class1/analytics', lecturer)
    expect(response.status).toBe(200)
    const analytics = (await response.json()).data

    expect(analytics.scope.classId).toBe('class1')
    expect(analytics.summary).toMatchObject({
      studentCount: 3,
      activeStudentCount: 1,
      participationRate: 33,
      attemptCount: 1,
      accuracy: 100,
    })
    expect(analytics.students).toHaveLength(3)
    expect(analytics.students.some((student) => student.id === 's4')).toBe(false)
    expect(analytics).toHaveProperty('qna.overdue')
    expect(Array.isArray(analytics.lecturerActivity)).toBe(true)
  })

  it('allows admin to inspect every class and rejects an unassigned lecturer', async () => {
    const [admin, unassignedLecturer] = await Promise.all([
      login('admin.analytics@ptit.edu.vn', 'Admin@123'),
      login('nva@ptit.edu.vn', 'Lecturer@123'),
    ])
    const adminResponse = await api('/api/admin/classes/class1/analytics', admin)
    expect(adminResponse.status).toBe(200)
    expect((await adminResponse.json()).data.courseClass.id).toBe('class1')

    const denied = await api('/api/lecturer/classes/class1/analytics', unassignedLecturer)
    expect(denied.status).toBe(403)

    const missing = await api('/api/admin/classes/class-does-not-exist/analytics', admin)
    expect(missing.status).toBe(404)
  })
})
