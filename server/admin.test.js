// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createAdminRepository } from './adminRepository.js'
import { createApiServer } from './app.js'
import { hashPassword } from './auth.js'
import { createDatabase } from './database.js'

async function parseData(response) {
  const payload = await response.json()
  return payload.data
}

describe('admin management API', () => {
  let baseUrl
  let db
  let server

  beforeEach(async () => {
    db = createDatabase({ databasePath: ':memory:', seed: true })
    db.execute(
      `INSERT INTO users
       (id, name, email, role, password_hash, status, auth_version, created_at)
       VALUES (?, ?, ?, 'admin', ?, 'active', 1, ?)`,
      ['admin1', 'Quản trị demo', 'admin@ptit.edu.vn', hashPassword('Admin@123'), '2026-08-12'],
    )
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

  it('allows only administrators to manage subjects', async () => {
    const lecturerCookie = await login('ductu@ptit.edu.vn', 'Lecturer@123')
    expect((await api('/api/admin/subjects', lecturerCookie)).status).toBe(403)

    const adminCookie = await login('admin@ptit.edu.vn', 'Admin@123')
    const response = await api('/api/admin/subjects', adminCookie, {
      method: 'POST',
      body: JSON.stringify({ name: 'Pháp luật đại cương', credits: 2 }),
    })
    expect(response.status).toBe(201)
    await expect(parseData(response)).resolves.toMatchObject({
      name: 'Pháp luật đại cương',
      status: 'active',
    })
  })

  it('protects the last active administrator and revokes sessions after a role change', async () => {
    const adminCookie = await login('admin@ptit.edu.vn', 'Admin@123')
    const lastAdminResponse = await api('/api/admin/users/admin1/role', adminCookie, {
      method: 'PATCH',
      body: JSON.stringify({ role: 'lecturer' }),
    })
    expect(lastAdminResponse.status).toBe(409)

    const lecturerCookie = await login('nva@ptit.edu.vn', 'Lecturer@123')
    const roleResponse = await api('/api/admin/users/l2/role', adminCookie, {
      method: 'PATCH',
      body: JSON.stringify({ role: 'student' }),
    })
    expect(roleResponse.status).toBe(200)
    expect((await api('/api/auth/me', lecturerCookie)).status).toBe(401)
  })

  it('supports multiple lecturers and releases owned claims when an assignment ends', async () => {
    const repository = createAdminRepository(db)
    await repository.assignLecturer(
      'class1',
      { lecturerId: 'l2', assignmentRole: 'lecturer' },
      'admin1',
    )
    await db.execute(
      `UPDATE questions SET claimed_by = 'l2', claimed_at = ?, routing_status = 'claimed', status = 'unanswered'
       WHERE id = 'sq3'`,
      ['2026-08-12T10:00:00.000Z'],
    )

    const active = await repository.listClassLecturers('class1')
    expect(active.filter((item) => item.status === 'active')).toHaveLength(2)

    await repository.endLecturerAssignment('class1', 'l2', 'admin1')
    expect(
      db.one("SELECT status FROM class_lecturer_assignments WHERE lecturer_id = 'l2'").status,
    ).toBe('inactive')
    expect(
      db.one("SELECT claimed_by, routing_status FROM questions WHERE id = 'sq3'"),
    ).toMatchObject({
      claimed_by: null,
      routing_status: 'queued',
    })
  })

  it('replaces the lead atomically while preserving the former lecturer assignment', async () => {
    const repository = createAdminRepository(db)
    await repository.assignLecturer(
      'class1',
      { lecturerId: 'l2', assignmentRole: 'lead' },
      'admin1',
    )

    const active = (await repository.listClassLecturers('class1')).filter(
      (assignment) => assignment.status === 'active',
    )
    expect(active.filter((assignment) => assignment.assignment_role === 'lead')).toHaveLength(1)
    expect(active.find((assignment) => assignment.lecturer_id === 'l2')?.assignment_role).toBe(
      'lead',
    )
    expect(active.find((assignment) => assignment.lecturer_id === 'l1')?.assignment_role).toBe(
      'lecturer',
    )
  })

  it('creates curriculum and shared practice content through the admin scope', async () => {
    const repository = createAdminRepository(db)
    const chapter = await repository.createChapter(
      'sub1',
      { title: 'Chương quản trị thử nghiệm', order: 99 },
      'admin1',
    )
    const lesson = await repository.createLesson(
      chapter.id,
      { title: 'Bài thử nghiệm', order: 1, contentHtml: '<p>Nội dung</p>' },
      'admin1',
    )
    expect(lesson.chapter_id).toBe(chapter.id)

    const question = await repository.createSharedQuestion(
      {
        subjectId: 'sub1',
        chapterId: chapter.id,
        content: 'Câu hỏi dùng chung do quản trị viên tạo?',
        explanation: 'Đáp án A là phương án minh họa.',
        correctOptionKey: 'A',
        options: ['A', 'B', 'C', 'D'].map((key) => ({ key, content: `Phương án ${key}` })),
      },
      'admin1',
    )
    expect(question).toMatchObject({ scope: 'subject_shared', status: 'published' })
    expect(question.options.find((option) => option.isCorrect)?.key).toBe('A')
  })

  it('imports the admin CSV question batch atomically as shared drafts', async () => {
    const adminCookie = await login('admin@ptit.edu.vn', 'Admin@123')
    const response = await api('/api/admin/practice-questions/import', adminCookie, {
      method: 'POST',
      body: JSON.stringify({
        subjectId: 'sub1',
        chapterId: 'chap1',
        questions: [
          {
            content: 'Nội dung câu hỏi CSV dùng chung thứ nhất?',
            explanation: 'Giải thích hợp lệ cho câu hỏi thứ nhất.',
            correctOptionKey: 'A',
            options: ['A', 'B', 'C', 'D'].map((key) => ({ key, content: `Lựa chọn ${key} một` })),
          },
          {
            content: 'Nội dung câu hỏi CSV dùng chung thứ hai?',
            explanation: 'Giải thích hợp lệ cho câu hỏi thứ hai.',
            correctOptionKey: 'B',
            options: ['A', 'B', 'C', 'D'].map((key) => ({ key, content: `Lựa chọn ${key} hai` })),
          },
        ],
      }),
    })
    expect(response.status).toBe(201)
    await expect(parseData(response)).resolves.toMatchObject({
      importedCount: 2,
      scope: 'subject_shared',
      status: 'draft',
    })
    expect(
      Number(
        db.one(
          "SELECT COUNT(*) AS count FROM practice_questions WHERE source_type = 'csv' AND scope = 'subject_shared' AND status = 'draft'",
        ).count,
      ),
    ).toBe(2)
  })
})
