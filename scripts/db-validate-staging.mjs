import { existsSync } from 'node:fs'
import { createRuntimeConfig } from '../server/runtimeConfig.js'
import { createPostgresClient } from '../server/db/postgres.js'

if (existsSync('.env')) process.loadEnvFile('.env')

const config = createRuntimeConfig()
if (config.database.driver !== 'postgres') {
  throw new Error('Set DATABASE_DRIVER=postgres before validating staging.')
}

const requiredTables = [
  'users',
  'subjects',
  'course_classes',
  'enrollments',
  'chapters',
  'lessons',
  'materials',
  'material_versions',
  'questions',
  'lecturer_answers',
  'rag_requests',
  'rag_responses',
  'rag_citations',
  'rag_reviews',
  'learning_progress',
  'search_history',
  'sessions',
  'audit_logs',
]
const client = createPostgresClient({
  connectionString: config.database.url,
  poolOptions: {
    max: config.database.poolMax,
    idleTimeoutMillis: config.database.idleTimeoutMs,
  },
})

try {
  const migration = await client.one(
    'SELECT version, checksum FROM schema_migrations ORDER BY version DESC LIMIT 1',
  )
  if (!migration) throw new Error('No applied PostgreSQL migration was found.')

  const rows = await client.many(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public'`,
  )
  const actualTables = new Set(rows.map((row) => row.table_name))
  const missingTables = requiredTables.filter((table) => !actualTables.has(table))
  if (missingTables.length) throw new Error(`Missing tables: ${missingTables.join(', ')}`)

  const counts = {}
  for (const table of ['users', 'subjects', 'course_classes', 'questions']) {
    const row = await client.one(`SELECT COUNT(*)::int AS count FROM ${table}`)
    counts[table] = Number(row.count)
  }

  console.log(
    JSON.stringify(
      {
        status: 'ok',
        migration,
        tableCount: actualTables.size,
        requiredTables: requiredTables.length,
        counts,
      },
      null,
      2,
    ),
  )
} finally {
  await client.close()
}
