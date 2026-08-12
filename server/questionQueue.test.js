// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApiServer } from './app.js'
import { hashPassword } from './auth.js'
import { createDatabase } from './database.js'

describe('shared class question queue', () => {
  let db
  let server
  let baseUrl

  beforeEach(async () => {
    db = createDatabase({ databasePath: ':memory:', seed: true })
    const timestamp = new Date().toISOString()
    await db.execute(
      `INSERT INTO users
       (id, name, email, role, password_hash, status, auth_version, created_at)
       VALUES ('admin-queue', 'Quản trị hàng đợi', 'admin.queue@ptit.edu.vn', 'admin', ?,
               'active', 1, ?)`,
      [hashPassword('Admin@123'), timestamp],
    )
    await db.execute(
      `INSERT INTO users
       (id, name, email, role, password_hash, status, auth_version, created_at)
       VALUES ('l3-queue', 'Giảng viên ngoài lớp', 'outside.queue@ptit.edu.vn', 'lecturer', ?,
               'active', 1, ?)`,
      [hashPassword('Lecturer@123'), timestamp],
    )
    await db.execute(
      `INSERT INTO class_lecturer_assignments
       (id, class_id, lecturer_id, assignment_role, status, assigned_by, assigned_at)
       VALUES ('assignment-queue-l2', 'class1', 'l2', 'lecturer', 'active',
               'admin-queue', ?)`,
      [timestamp],
    )
    await db.execute(
      `INSERT INTO questions
       (id, subject_id, student_id, class_id, content, status, routing_status,
        row_version, created_at, updated_at)
       VALUES ('queue-test', 'sub1', 's1', 'class1',
               'Câu hỏi dùng để kiểm thử hàng đợi chung của lớp tín chỉ?',
               'unanswered', 'queued', 0, '2023-09-01T00:00:00.000Z', ?)`,
      [timestamp],
    )
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

  it('allows only one lecturer to atomically claim the same queued question', async () => {
    const [lead, lecturer] = await Promise.all([
      login('ductu@ptit.edu.vn', 'Lecturer@123'),
      login('nva@ptit.edu.vn', 'Lecturer@123'),
    ])
    const path = '/api/lecturer/classes/class1/question-queue/queue-test/claim'
    const responses = await Promise.all([
      api(path, lead, { method: 'POST' }),
      api(path, lecturer, { method: 'POST' }),
    ])
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409])

    const stored = await db.one(
      "SELECT claimed_by, routing_status, row_version FROM questions WHERE id = 'queue-test'",
    )
    expect(['l1', 'l2']).toContain(stored.claimed_by)
    expect(stored.routing_status).toBe('claimed')
    expect(Number(stored.row_version)).toBeGreaterThan(0)

    const winner = stored.claimed_by === 'l1' ? lead : lecturer
    const loser = stored.claimed_by === 'l1' ? lecturer : lead
    expect(
      (
        await api('/api/lecturer/classes/class1/question-queue/queue-test/release', loser, {
          method: 'POST',
        })
      ).status,
    ).toBe(409)
    expect(
      (
        await api('/api/lecturer/classes/class1/question-queue/queue-test/release', winner, {
          method: 'POST',
        })
      ).status,
    ).toBe(200)
  })

  it('reports overdue SLA to the lead and lets admin reassign within the class', async () => {
    const [lead, lecturer, admin] = await Promise.all([
      login('ductu@ptit.edu.vn', 'Lecturer@123'),
      login('nva@ptit.edu.vn', 'Lecturer@123'),
      login('admin.queue@ptit.edu.vn', 'Admin@123'),
    ])

    const leadQueue = await api('/api/lecturer/classes/class1/question-queue', lead)
    expect(leadQueue.status).toBe(200)
    const leadData = (await leadQueue.json()).data
    expect(leadData).toMatchObject({ viewerRole: 'lead', leadAlert: true, slaHours: 24 })
    expect(leadData.items.find((item) => item.id === 'queue-test').sla.status).toBe('overdue')

    const lecturerQueue = await api('/api/lecturer/classes/class1/question-queue', lecturer)
    expect((await lecturerQueue.json()).data.leadAlert).toBe(false)

    expect(
      (
        await api('/api/lecturer/classes/class1/question-queue/queue-test/claim', lead, {
          method: 'POST',
        })
      ).status,
    ).toBe(200)
    const reassignResponse = await api('/api/admin/questions/queue-test/reassign', admin, {
      method: 'POST',
      body: JSON.stringify({ lecturerId: 'l2' }),
    })
    expect(reassignResponse.status).toBe(200)
    expect(
      db.one("SELECT claimed_by, routing_status FROM questions WHERE id = 'queue-test'"),
    ).toMatchObject({ claimed_by: 'l2', routing_status: 'claimed' })

    const leadAnswer = await api('/api/lecturer/questions/queue-test/answer', lead, {
      method: 'POST',
      body: JSON.stringify({ content: 'Câu trả lời đủ dài nhưng không còn thuộc quyền xử lý.' }),
    })
    expect(leadAnswer.status).toBe(409)
  })

  it('auto-claims an unclaimed question when the assigned lecturer answers it', async () => {
    const lead = await login('ductu@ptit.edu.vn', 'Lecturer@123')
    const response = await api('/api/lecturer/questions/queue-test/answer', lead, {
      method: 'POST',
      body: JSON.stringify({
        content: 'Mối liên hệ phổ biến biểu hiện sự ràng buộc và tác động qua lại giữa các sự vật.',
      }),
    })
    expect(response.status).toBe(200)
    expect(
      db.one("SELECT status, routing_status, claimed_by FROM questions WHERE id = 'queue-test'"),
    ).toMatchObject({ status: 'answered', routing_status: 'answered', claimed_by: 'l1' })
  })

  it('rejects queue access and reassignment outside active class assignments', async () => {
    const [outsideLecturer, admin] = await Promise.all([
      login('outside.queue@ptit.edu.vn', 'Lecturer@123'),
      login('admin.queue@ptit.edu.vn', 'Admin@123'),
    ])

    expect((await api('/api/lecturer/classes/class1/question-queue', outsideLecturer)).status).toBe(
      403,
    )

    const response = await api('/api/admin/questions/queue-test/reassign', admin, {
      method: 'POST',
      body: JSON.stringify({ lecturerId: 'l3-queue' }),
    })
    expect(response.status).toBe(409)
    expect((await response.json()).error.code).toBe('LECTURER_NOT_ASSIGNED')
  })
})
