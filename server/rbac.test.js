// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { authenticateRequestAsync, createSessionAsync } from './auth.js'
import { createDatabase } from './database.js'
import { createAsyncRepositories } from './repositoriesAsync.js'

function requestWithToken(token) {
  return { headers: { cookie: `ptit_session=${encodeURIComponent(token)}` } }
}

describe('scoped RBAC', () => {
  it('grants every active assigned lecturer access to the class', async () => {
    const db = createDatabase({ databasePath: ':memory:', seed: true })
    try {
      const repositories = createAsyncRepositories(db)
      await db.execute(
        `INSERT INTO class_lecturer_assignments
         (id, class_id, lecturer_id, assignment_role, status, assigned_at)
         VALUES (?, ?, ?, 'lecturer', 'active', ?)`,
        ['assignment_class1_l2', 'class1', 'l2', '2026-08-12T00:00:00.000Z'],
      )

      await expect(repositories.classRepository.getById('class1', 'l2')).resolves.toMatchObject({
        id: 'class1',
        assignmentRole: 'lecturer',
      })
      await expect(repositories.questionRepository.listForLecturer('l2')).resolves.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            courseClass: expect.objectContaining({ id: 'class1' }),
          }),
        ]),
      )

      await db.execute(
        `UPDATE class_lecturer_assignments
         SET status = 'inactive', ended_at = ?
         WHERE id = ?`,
        ['2026-08-12T01:00:00.000Z', 'assignment_class1_l2'],
      )
      await expect(repositories.classRepository.getById('class1', 'l2')).rejects.toMatchObject({
        status: 403,
        code: 'FORBIDDEN',
      })
    } finally {
      db.close()
    }
  })

  it('invalidates sessions when account status or auth version changes', async () => {
    const db = createDatabase({ databasePath: ':memory:', seed: true })
    try {
      const first = await createSessionAsync(db, 'l1')
      await expect(
        authenticateRequestAsync(db, requestWithToken(first.token)),
      ).resolves.toMatchObject({ user: { id: 'l1', role: 'lecturer' } })

      await db.execute('UPDATE users SET auth_version = auth_version + 1 WHERE id = ?', ['l1'])
      await expect(authenticateRequestAsync(db, requestWithToken(first.token))).resolves.toBeNull()

      const second = await createSessionAsync(db, 'l1')
      await db.execute("UPDATE users SET status = 'inactive' WHERE id = ?", ['l1'])
      await expect(authenticateRequestAsync(db, requestWithToken(second.token))).resolves.toBeNull()
      expect(db.one('SELECT COUNT(*) AS count FROM sessions WHERE user_id = ?', ['l1']).count).toBe(
        0,
      )
    } finally {
      db.close()
    }
  })
})
