// @vitest-environment node
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = join(dirname(fileURLToPath(import.meta.url)), 'migrations', '001_initial.sql')

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
})
