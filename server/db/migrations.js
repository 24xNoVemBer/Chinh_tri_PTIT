import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { basename, join } from 'node:path'

const MIGRATION_NAME = /^(\d+)_([a-z0-9-]+)\.sql$/i

function describeMigration(fileName) {
  const match = fileName.match(MIGRATION_NAME)
  if (!match) throw new Error(`Invalid migration filename: ${fileName}`)
  return { version: match[1], name: match[2] }
}

function checksum(sql) {
  return createHash('sha256').update(sql).digest('hex')
}

export async function listMigrations(migrationDirectory) {
  const files = (await readdir(migrationDirectory))
    .filter((fileName) => fileName.endsWith('.sql'))
    .sort()

  return Promise.all(
    files.map(async (fileName) => {
      const sql = await readFile(join(migrationDirectory, fileName), 'utf8')
      return {
        ...describeMigration(fileName),
        fileName,
        sql,
        checksum: checksum(sql),
      }
    }),
  )
}

export async function assertMigrationsCurrent(client, { migrationDirectory } = {}) {
  if (!client || typeof client.many !== 'function') {
    throw new Error('assertMigrationsCurrent requires a database client with many().')
  }
  if (!migrationDirectory) throw new Error('Migration directory is required.')

  const known = await listMigrations(migrationDirectory)
  const applied = await client.many(
    'SELECT version, name, checksum, applied_at FROM schema_migrations ORDER BY version',
  )
  const appliedByVersion = new Map(
    applied.map((migration) => [String(migration.version), migration]),
  )
  const knownVersions = new Set(known.map((migration) => migration.version))
  const mismatches = []

  for (const migration of known) {
    const existing = appliedByVersion.get(migration.version)
    if (!existing) {
      mismatches.push({ version: migration.version, issue: 'missing' })
    } else if (existing.name !== migration.name || existing.checksum !== migration.checksum) {
      mismatches.push({ version: migration.version, issue: 'metadata-mismatch' })
    }
  }
  for (const migration of applied) {
    if (!knownVersions.has(String(migration.version))) {
      mismatches.push({ version: String(migration.version), issue: 'unknown-applied-migration' })
    }
  }
  if (mismatches.length) {
    throw new Error('PostgreSQL migrations are not current: ' + JSON.stringify(mismatches))
  }

  return Object.freeze({
    known: known.length,
    applied: applied.length,
    latest: applied.at(-1) ?? null,
  })
}
export async function runMigrations(client, { migrationDirectory, logger = console } = {}) {
  if (!client || typeof client.transaction !== 'function')
    throw new Error('runMigrations requires a database client with transaction().')
  if (!migrationDirectory) throw new Error('Migration directory is required.')

  await client.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      checksum TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )
  `)

  const migrations = await listMigrations(migrationDirectory)
  const applied = await client.many(
    'SELECT version, name, checksum, applied_at FROM schema_migrations ORDER BY version',
  )
  const appliedByVersion = new Map(applied.map((migration) => [migration.version, migration]))
  const pending = []

  for (const migration of migrations) {
    const existing = appliedByVersion.get(migration.version)
    if (existing) {
      if (existing.checksum !== migration.checksum) {
        throw new Error(`Migration checksum mismatch for version ${migration.version}.`)
      }
      continue
    }
    pending.push(migration)
  }

  for (const migration of pending) {
    await client.transaction(async (transaction) => {
      await transaction.exec(migration.sql)
      await transaction.execute(
        `INSERT INTO schema_migrations (version, name, checksum, applied_at)
         VALUES (?, ?, ?, ?)`,
        [migration.version, migration.name, migration.checksum, new Date().toISOString()],
      )
    })
    logger.info?.(`Applied migration ${migration.version}_${migration.name}.`)
  }

  return {
    applied: pending.map(({ version, name }) => ({ version, name })),
    total: migrations.length,
  }
}

export function migrationVersionFromFile(fileName) {
  return describeMigration(basename(fileName)).version
}
