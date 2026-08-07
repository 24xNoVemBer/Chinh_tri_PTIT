import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { createRuntimeConfig } from '../server/runtimeConfig.js'
import { createPostgresClient } from '../server/db/postgres.js'
import { createPostgresPoolOptions } from '../server/db/runtime.js'
import { listMigrations } from '../server/db/migrations.js'
import {
  DATA_TABLE_ORDER,
  readDatabaseSnapshot,
  validateStagingSnapshot,
} from '../server/db/dataMigration.js'
import {
  resolveConfirmedPostgresTarget,
  verifyConnectedPostgresTarget,
} from '../server/db/targetSafety.js'

if (existsSync('.env')) process.loadEnvFile('.env')

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    'schema-only': { type: 'boolean' },
  },
  allowPositionals: true,
  strict: true,
})
if (positionals.length > 1) {
  throw new Error('db:validate:staging accepts at most one snapshot path.')
}
const schemaOnly = Boolean(values['schema-only'])
if (schemaOnly && positionals.length > 0) {
  throw new Error('Do not provide a snapshot path together with --schema-only.')
}
const configuredSnapshotPath = positionals[0] ?? process.env.DB_SNAPSHOT_PATH
if (!schemaOnly && !configuredSnapshotPath) {
  throw new Error(
    'Provide a staging-safe snapshot path or set DB_SNAPSHOT_PATH. Use --schema-only only for an explicit schema check.',
  )
}

let expected = null
if (!schemaOnly) {
  const snapshotPath = resolve(configuredSnapshotPath)
  const snapshot = await readDatabaseSnapshot(snapshotPath)
  const validation = validateStagingSnapshot(snapshot)
  expected = {
    snapshotPath,
    totalRows: validation.totalRows,
    counts: validation.counts,
  }
}

const config = createRuntimeConfig()
if (config.database.driver !== 'postgres') {
  throw new Error('Set DATABASE_DRIVER=postgres before validating staging.')
}
const target = resolveConfirmedPostgresTarget(config.database.url, process.env, {
  operation: 'staging validation',
})

const requiredIndexes = [
  'users_email_lower_unique',
  'idx_classes_lecturer',
  'idx_enrollments_student',
  'idx_questions_student',
  'idx_questions_subject',
  'idx_rag_requests_question',
  'idx_rag_responses_review',
  'idx_rag_citations_response',
  'idx_rag_reviews_response',
  'idx_search_history_student',
  'idx_sessions_token',
  'idx_audit_actor',
]

const migrationDirectory = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../server/db/migrations',
)
const knownMigrations = await listMigrations(migrationDirectory)
const client = createPostgresClient({
  connectionString: config.database.url,
  poolOptions: createPostgresPoolOptions(config.database, { administrative: true }),
})

try {
  const connectedTarget = await verifyConnectedPostgresTarget(client, target)
  const versionInfo = await client.one("SELECT current_setting('server_version') AS version")
  const databaseInfo = { ...connectedTarget, version: versionInfo.version }
  const appliedMigrations = await client.many(
    'SELECT version, name, checksum, applied_at FROM schema_migrations ORDER BY version',
  )
  const appliedByVersion = new Map(
    appliedMigrations.map((migration) => [String(migration.version), migration]),
  )
  const migrationMismatches = []
  for (const migration of knownMigrations) {
    const applied = appliedByVersion.get(migration.version)
    if (!applied) {
      migrationMismatches.push({ version: migration.version, issue: 'missing' })
    } else if (applied.checksum !== migration.checksum || applied.name !== migration.name) {
      migrationMismatches.push({
        version: migration.version,
        issue: 'metadata-mismatch',
        expectedName: migration.name,
        actualName: applied.name,
        expectedChecksum: migration.checksum,
        actualChecksum: applied.checksum,
      })
    }
  }
  const knownVersions = new Set(knownMigrations.map((migration) => migration.version))
  for (const applied of appliedMigrations) {
    if (!knownVersions.has(String(applied.version))) {
      migrationMismatches.push({ version: applied.version, issue: 'unknown-applied-migration' })
    }
  }
  if (migrationMismatches.length) {
    throw new Error('Migration mismatch: ' + JSON.stringify(migrationMismatches))
  }

  const tableRows = await client.many(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'",
  )
  const actualTables = new Set(tableRows.map((row) => row.table_name))
  const missingTables = DATA_TABLE_ORDER.filter((table) => !actualTables.has(table))
  if (missingTables.length) throw new Error('Missing tables: ' + missingTables.join(', '))

  const indexRows = await client.many(
    "SELECT indexname FROM pg_indexes WHERE schemaname = 'public'",
  )
  const actualIndexes = new Set(indexRows.map((row) => row.indexname))
  const missingIndexes = requiredIndexes.filter((index) => !actualIndexes.has(index))
  if (missingIndexes.length) throw new Error('Missing indexes: ' + missingIndexes.join(', '))

  const counts = {}
  for (const table of DATA_TABLE_ORDER) {
    const row = await client.one('SELECT COUNT(*) AS count FROM "' + table + '"')
    counts[table] = Number(row.count)
  }

  let mismatches = []
  if (expected) {
    mismatches = DATA_TABLE_ORDER.filter((table) => counts[table] !== expected.counts[table]).map(
      (table) => ({
        table,
        expected: expected.counts[table],
        actual: counts[table],
      }),
    )
    if (mismatches.length) {
      throw new Error('Snapshot row-count mismatch: ' + JSON.stringify(mismatches))
    }
  }

  console.log(
    JSON.stringify(
      {
        status: 'ok',
        validationMode: schemaOnly ? 'schema-only' : 'schema-and-exact-data',
        database: databaseInfo,
        migrations: {
          applied: appliedMigrations.length,
          known: knownMigrations.length,
          latest: appliedMigrations.at(-1) ?? null,
        },
        tableCount: actualTables.size,
        requiredTables: DATA_TABLE_ORDER.length,
        requiredIndexes: requiredIndexes.length,
        counts,
        expected,
        pool: client.stats(),
      },
      null,
      2,
    ),
  )
} finally {
  await client.close()
}
