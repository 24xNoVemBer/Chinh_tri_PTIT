// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { verifyPasswordAsync } from '../auth.js'
import { createDatabase } from '../database.js'
import { seedLargeDemoData } from './demoSeed.js'

describe('large demo seed', () => {
  it('creates the complete dataset and remains idempotent', async () => {
    const db = createDatabase({ databasePath: ':memory:', seed: true })
    try {
      const first = await seedLargeDemoData(db, { nodeEnv: 'test', confirmed: true })
      const second = await seedLargeDemoData(db, { nodeEnv: 'test', confirmed: true })

      expect(first).toEqual({
        admins: 2,
        lecturers: 10,
        students: 40,
        classes: 10,
        enrollments: 200,
        practice_questions: 45,
        sessions: 200,
        qna_questions: 80,
      })
      expect(second).toEqual(first)
      expect(
        await verifyPasswordAsync(
          'Admin@123',
          (await db.one("SELECT password_hash FROM users WHERE id = 'admin1'")).password_hash,
        ),
      ).toBe(true)
      expect(
        await verifyPasswordAsync(
          'Lecturer@123',
          (await db.one("SELECT password_hash FROM users WHERE id = 'l10'")).password_hash,
        ),
      ).toBe(true)
      expect(
        await verifyPasswordAsync(
          'Student@123',
          (await db.one("SELECT password_hash FROM users WHERE id = 's40'")).password_hash,
        ),
      ).toBe(true)
      expect(
        Number(
          (
            await db.one(
              "SELECT COUNT(*) AS count FROM class_lecturer_assignments WHERE id LIKE 'demo-assignment-%'",
            )
          ).count,
        ),
      ).toBe(20)
    } finally {
      db.close()
    }
  })

  it('is disabled in production even with explicit confirmation', async () => {
    const db = createDatabase({ databasePath: ':memory:', seed: false })
    try {
      await expect(
        seedLargeDemoData(db, { nodeEnv: 'production', confirmed: true }),
      ).rejects.toThrow('disabled in production')
      expect(Number((await db.one('SELECT COUNT(*) AS count FROM users')).count)).toBe(0)
    } finally {
      db.close()
    }
  })

  it('requires explicit confirmation outside production', async () => {
    const db = createDatabase({ databasePath: ':memory:', seed: false })
    try {
      await expect(seedLargeDemoData(db, { nodeEnv: 'test' })).rejects.toThrow(
        '--confirm-demo-seed',
      )
    } finally {
      db.close()
    }
  })
})
