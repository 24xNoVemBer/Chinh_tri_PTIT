// @vitest-environment node
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = join(dirname(fileURLToPath(import.meta.url)), 'migrations', '001_initial.sql')
const authMigrationPath = join(
  dirname(fileURLToPath(import.meta.url)),
  'migrations',
  '002_auth-login-limits.sql',
)
const adminClassMigrationPath = join(
  dirname(fileURLToPath(import.meta.url)),
  'migrations',
  '006_admin-class-management.sql',
)
const sessionVersionMigrationPath = join(
  dirname(fileURLToPath(import.meta.url)),
  'migrations',
  '007_session-auth-version.sql',
)

describe('PostgreSQL initial schema', () => {
  it('contains the complete DB-0 table and index inventory', async () => {
    const sql = await readFile(migrationPath, 'utf8')
    expect((sql.match(/CREATE TABLE IF NOT EXISTS/g) ?? []).length).toBe(25)
    expect((sql.match(/CREATE (?:UNIQUE )?INDEX IF NOT EXISTS/g) ?? []).length).toBe(12)
    expect(sql).toContain('users_email_lower_unique')
    expect(sql).toContain('is_approved SMALLINT')
  })

  it('does not carry SQLite-only schema statements', async () => {
    const sql = await readFile(migrationPath, 'utf8')
    expect(sql).not.toMatch(/PRAGMA|INSERT\s+OR\s+(IGNORE|REPLACE)|COLLATE\s+NOCASE/i)
  })

  it('adds shared login rate-limit state as a separate migration', async () => {
    const sql = await readFile(authMigrationPath, 'utf8')
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS auth_login_limits')
    expect(sql).toContain('scope_key TEXT PRIMARY KEY')
    expect(sql).toContain('idx_auth_login_limits_updated')
  })

  it('adds scoped administration and multi-lecturer class assignments', async () => {
    const sql = await readFile(adminClassMigrationPath, 'utf8')
    expect(sql).toContain("role IN ('student', 'lecturer', 'admin')")
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS academic_terms')
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS class_lecturer_assignments')
    expect(sql).toContain('idx_class_lecturers_one_active_lead')
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS practice_question_class_assignments')
    expect(sql).toContain(
      "routing_status IN ('unrouted', 'queued', 'claimed', 'answered', 'closed')",
    )
  })

  it('pins sessions to the account authorization version', async () => {
    const sql = await readFile(sessionVersionMigrationPath, 'utf8')
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS auth_version')
    expect(sql).toContain('SET auth_version = users.auth_version')
  })
})
