// @vitest-environment node
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { runMigrations } from './migrations.js'

function createFakeClient() {
  const applied = new Map()
  const executed = []
  const client = {
    executed,
    async exec(sql) {
      executed.push({ method: 'exec', sql })
    },
    async many() {
      return [...applied.values()]
    },
    async transaction(callback) {
      const transaction = {
        async exec(sql) {
          executed.push({ method: 'transaction.exec', sql })
        },
        async execute(_sql, params) {
          applied.set(params[0], {
            version: params[0],
            name: params[1],
            checksum: params[2],
            applied_at: params[3],
          })
        },
      }
      return callback(transaction)
    },
  }
  return client
}

describe('PostgreSQL migration runner', () => {
  let directory

  afterEach(async () => {
    if (directory) await rm(directory, { recursive: true, force: true })
  })

  it('applies migrations in filename order and is idempotent', async () => {
    directory = await mkdtemp(join(tmpdir(), 'ptit-migrations-'))
    await mkdir(directory, { recursive: true })
    await writeFile(join(directory, '002_second.sql'), 'SELECT 2;')
    await writeFile(join(directory, '001_first.sql'), 'SELECT 1;')
    const client = createFakeClient()
    const logger = { info: vi.fn() }

    await expect(runMigrations(client, { migrationDirectory: directory, logger })).resolves.toEqual(
      {
        applied: [
          { version: '001', name: 'first' },
          { version: '002', name: 'second' },
        ],
        total: 2,
      },
    )
    await expect(runMigrations(client, { migrationDirectory: directory, logger })).resolves.toEqual(
      {
        applied: [],
        total: 2,
      },
    )
    expect(logger.info).toHaveBeenCalledTimes(2)
  })

  it('rejects a changed checksum for an applied version', async () => {
    directory = await mkdtemp(join(tmpdir(), 'ptit-migrations-'))
    await writeFile(join(directory, '001_first.sql'), 'SELECT 1;')
    const client = createFakeClient()
    await runMigrations(client, { migrationDirectory: directory, logger: { info() {} } })
    await writeFile(join(directory, '001_first.sql'), 'SELECT 99;')

    await expect(
      runMigrations(client, { migrationDirectory: directory, logger: { info() {} } }),
    ).rejects.toThrow('Migration checksum mismatch for version 001.')
  })
})
