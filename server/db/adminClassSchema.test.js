// @vitest-environment node
import { DatabaseSync } from 'node:sqlite'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createDatabase } from '../database.js'

describe('admin and multi-lecturer schema', () => {
  let directory

  afterEach(async () => {
    if (directory) await rm(directory, { recursive: true, force: true })
  })

  it('backfills terms, class assignments and class-scoped activity', () => {
    const db = createDatabase({ databasePath: ':memory:', seed: true })
    try {
      expect(db.one('SELECT COUNT(*) AS count FROM academic_terms').count).toBe(1)
      expect(db.one('SELECT COUNT(*) AS count FROM class_lecturer_assignments').count).toBe(2)
      expect(
        db.one(
          `SELECT COUNT(*) AS count
           FROM questions
           WHERE class_id IS NOT NULL AND routing_status <> 'unrouted'`,
        ).count,
      ).toBe(5)
      expect(
        db.one('SELECT COUNT(*) AS count FROM practice_question_class_assignments').count,
      ).toBe(6)
    } finally {
      db.close()
    }
  })

  it('allows several lecturers but only one active lead per class', () => {
    const db = createDatabase({ databasePath: ':memory:', seed: true })
    try {
      db.execute(
        `INSERT INTO class_lecturer_assignments
         (id, class_id, lecturer_id, assignment_role, status, assigned_at)
         VALUES (?, ?, ?, 'lecturer', 'active', ?)`,
        ['assignment_class1_l2', 'class1', 'l2', '2026-08-12T00:00:00.000Z'],
      )
      expect(
        db.one(
          `SELECT COUNT(*) AS count
           FROM class_lecturer_assignments
           WHERE class_id = 'class1' AND status = 'active'`,
        ).count,
      ).toBe(2)
      expect(() =>
        db.execute(
          `UPDATE class_lecturer_assignments
           SET assignment_role = 'lead'
           WHERE id = ?`,
          ['assignment_class1_l2'],
        ),
      ).toThrow()
    } finally {
      db.close()
    }
  })

  it('upgrades the legacy SQLite user role constraint without data loss', async () => {
    directory = await mkdtemp(join(tmpdir(), 'ptit-admin-schema-'))
    const databasePath = join(directory, 'legacy.sqlite')
    const legacy = new DatabaseSync(databasePath)
    legacy.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        role TEXT NOT NULL CHECK (role IN ('student', 'lecturer')),
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      INSERT INTO users VALUES (
        'legacy-student', 'Legacy Student', 'legacy@ptit.edu.vn', 'student', 'hash',
        '2026-08-12T00:00:00.000Z'
      );
    `)
    legacy.close()

    const db = createDatabase({ databasePath, seed: false })
    try {
      db.execute(
        `INSERT INTO users (id, name, email, role, password_hash, created_at)
         VALUES (?, ?, ?, 'admin', ?, ?)`,
        ['admin-test', 'Admin Test', 'admin.test@ptit.edu.vn', 'hash', '2026-08-12T00:00:00.000Z'],
      )
      expect(db.one(`SELECT role FROM users WHERE id = 'admin-test'`).role).toBe('admin')
      expect(db.one(`SELECT name FROM users WHERE id = 'legacy-student'`).name).toBe(
        'Legacy Student',
      )
      expect(db.many('PRAGMA foreign_key_check')).toEqual([])
    } finally {
      db.close()
    }
  })
})
