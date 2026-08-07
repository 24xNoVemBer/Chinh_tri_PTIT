import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { createRuntimeConfig } from '../server/runtimeConfig.js'
import { createPostgresClient } from '../server/db/postgres.js'
import { createPostgresPoolOptions } from '../server/db/runtime.js'
import { assertMigrationsCurrent } from '../server/db/migrations.js'
import {
  assertDatabaseSnapshotParity,
  fingerprintSnapshotTables,
  readDatabaseSnapshot,
  validateStagingSnapshot,
} from '../server/db/dataMigration.js'
import {
  inspectConnectedPostgresTls,
  inspectPostgresApplicationSchema,
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

let snapshot = null
let expected = null
if (!schemaOnly) {
  const snapshotPath = resolve(configuredSnapshotPath)
  snapshot = await readDatabaseSnapshot(snapshotPath)
  const validation = validateStagingSnapshot(snapshot)
  expected = Object.freeze({
    snapshotPath,
    totalRows: validation.totalRows,
    counts: validation.counts,
    fingerprints: fingerprintSnapshotTables(snapshot),
  })
}

const config = createRuntimeConfig()
if (config.database.driver !== 'postgres') {
  throw new Error('Set DATABASE_DRIVER=postgres before validating staging.')
}
const target = resolveConfirmedPostgresTarget(config.database.url, process.env, {
  operation: 'staging validation',
})

const requiredIndexes = Object.freeze([
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
])

const migrationDirectory = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../server/db/migrations',
)
const client = createPostgresClient({
  connectionString: config.database.url,
  poolOptions: createPostgresPoolOptions(config.database, { administrative: true }),
})

try {
  const connectedTarget = await verifyConnectedPostgresTarget(client, target)
  const transport = await inspectConnectedPostgresTls(client, {
    required: config.database.sslMode === 'verify-full',
  })
  const versionInfo = await client.one("SELECT current_setting('server_version') AS version")
  const databaseInfo = { ...connectedTarget, version: versionInfo.version }
  const schema = await inspectPostgresApplicationSchema(client)
  const migrations = await assertMigrationsCurrent(client, { migrationDirectory })

  const indexRows = await client.many(
    "SELECT indexname FROM pg_indexes WHERE schemaname = 'public'",
  )
  const actualIndexes = new Set(indexRows.map((row) => row.indexname))
  const missingIndexes = requiredIndexes.filter((index) => !actualIndexes.has(index))
  if (missingIndexes.length) throw new Error('Missing indexes: ' + missingIndexes.join(', '))

  const parity = snapshot
    ? await client.transaction(async (transaction) => {
        await transaction.exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY')
        return assertDatabaseSnapshotParity(transaction, snapshot)
      })
    : null

  console.log(
    JSON.stringify(
      {
        status: 'ok',
        validationMode: schemaOnly ? 'schema-only' : 'schema-and-exact-data',
        database: databaseInfo,
        transport,
        migrations,
        schema,
        requiredIndexes: requiredIndexes.length,
        parity,
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
