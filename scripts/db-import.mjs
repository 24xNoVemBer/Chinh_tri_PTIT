import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { createRuntimeConfig } from '../server/runtimeConfig.js'
import { createPostgresClient } from '../server/db/postgres.js'
import { createPostgresPoolOptions } from '../server/db/runtime.js'
import { runMigrations } from '../server/db/migrations.js'
import {
  fingerprintSnapshotTables,
  importDatabaseSnapshot,
  readDatabaseSnapshot,
  validateSnapshotImportability,
  validateStagingSnapshot,
} from '../server/db/dataMigration.js'

if (existsSync('.env')) process.loadEnvFile('.env')

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const allowExisting = args.includes('--allow-existing')
const allowRuntimeData = args.includes('--allow-runtime-data')
const requestedPath = args.find((argument) => !argument.startsWith('--'))
const snapshotPath = resolve(
  requestedPath ?? process.env.DB_SNAPSHOT_PATH ?? 'data/ptit-staging-snapshot-db5.json',
)

const snapshot = await readDatabaseSnapshot(snapshotPath)
const validation = validateStagingSnapshot(snapshot, { allowRuntimeData })
await validateSnapshotImportability(snapshot, { allowRuntimeData })
const fingerprints = fingerprintSnapshotTables(snapshot)

if (dryRun) {
  console.log(
    JSON.stringify(
      {
        status: 'dry-run',
        databaseAccess: false,
        snapshotPath,
        allowExisting,
        allowRuntimeData,
        totalRows: validation.totalRows,
        counts: validation.counts,
        fingerprints,
      },
      null,
      2,
    ),
  )
} else {
  const config = createRuntimeConfig()
  if (config.database.driver !== 'postgres') {
    throw new Error('Set DATABASE_DRIVER=postgres before importing a database snapshot.')
  }

  const migrationDirectory = resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../server/db/migrations',
  )
  const client = createPostgresClient({
    connectionString: config.database.url,
    poolOptions: createPostgresPoolOptions(config.database, { administrative: true }),
  })

  try {
    await runMigrations(client, { migrationDirectory })
    const imported = await importDatabaseSnapshot(client, snapshot, {
      conflictPolicy: allowExisting ? 'ignore' : 'error',
      requireEmpty: !allowExisting,
    })
    const rowCount = Object.values(imported).reduce((sum, count) => sum + count, 0)

    let analyzed = true
    let analyzeWarning = null
    try {
      await client.exec('ANALYZE')
    } catch (error) {
      analyzed = false
      analyzeWarning = error instanceof Error ? error.message : String(error)
      console.warn('Snapshot import committed, but ANALYZE failed: ' + analyzeWarning)
    }

    console.log(
      JSON.stringify(
        {
          status: 'imported',
          snapshotPath,
          rowCount,
          analyzed,
          analyzeWarning,
        },
        null,
        2,
      ),
    )
  } finally {
    await client.close()
  }
}
