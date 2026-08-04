import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { createRuntimeConfig } from '../server/runtimeConfig.js'
import { createPostgresClient } from '../server/db/postgres.js'
import { runMigrations } from '../server/db/migrations.js'
import { importDatabaseSnapshot, readDatabaseSnapshot } from '../server/db/dataMigration.js'

if (existsSync('.env')) process.loadEnvFile('.env')

const config = createRuntimeConfig()
if (config.database.driver !== 'postgres') {
  throw new Error('Set DATABASE_DRIVER=postgres before importing a database snapshot.')
}

const snapshotPath = resolve(
  process.argv[2] ?? process.env.DB_SNAPSHOT_PATH ?? 'data/ptit-snapshot.json',
)
const migrationDirectory = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../server/db/migrations',
)
const client = createPostgresClient({
  connectionString: config.database.url,
  poolOptions: {
    max: config.database.poolMax,
    idleTimeoutMillis: config.database.idleTimeoutMs,
  },
})

try {
  await runMigrations(client, { migrationDirectory })
  const snapshot = await readDatabaseSnapshot(snapshotPath)
  const imported = await importDatabaseSnapshot(client, snapshot)
  const rowCount = Object.values(imported).reduce((sum, count) => sum + count, 0)
  console.log(`PostgreSQL snapshot imported: ${rowCount} rows.`)
} finally {
  await client.close()
}
