import { existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { createSqliteClient } from '../server/db/client.js'
import {
  exportDatabaseSnapshot,
  fingerprintSnapshotTables,
  sanitizeStagingSnapshot,
  STAGING_EXCLUDED_TABLES,
  validateSnapshotImportability,
  validateStagingSnapshot,
  writeDatabaseSnapshot,
} from '../server/db/dataMigration.js'

if (existsSync('.env')) process.loadEnvFile('.env')

const args = process.argv.slice(2)
const includeRuntimeData = args.includes('--include-runtime-data')
const requestedPath = args.find((argument) => !argument.startsWith('--'))
const configuredDatabasePath = process.env.DATABASE_PATH ?? 'data/ptit-teaching-assistant.sqlite'
if (configuredDatabasePath === ':memory:') {
  throw new Error('db:export requires an existing SQLite file, not :memory:.')
}

const databasePath = resolve(configuredDatabasePath)
if (!existsSync(databasePath) || !statSync(databasePath).isFile()) {
  throw new Error('SQLite source does not exist or is not a file: ' + databasePath)
}

const outputPath = resolve(
  requestedPath ?? process.env.DB_SNAPSHOT_PATH ?? 'data/ptit-staging-snapshot-db5.json',
)
if (outputPath.toLowerCase() === databasePath.toLowerCase()) {
  throw new Error('Snapshot output must not overwrite the SQLite source database.')
}

const db = createSqliteClient(new DatabaseSync(databasePath, { readOnly: true }))
try {
  db.exec('PRAGMA query_only = ON')
  const snapshot = sanitizeStagingSnapshot(
    exportDatabaseSnapshot(db, {
      excludeTables: includeRuntimeData ? [] : STAGING_EXCLUDED_TABLES,
    }),
  )
  const validationOptions = { allowRuntimeData: includeRuntimeData }
  const validation = validateStagingSnapshot(snapshot, validationOptions)
  await validateSnapshotImportability(snapshot, validationOptions)
  const fingerprints = fingerprintSnapshotTables(snapshot)
  await writeDatabaseSnapshot(snapshot, outputPath)
  console.log(
    'SQLite snapshot written from a read-only transaction: ' +
      outputPath +
      ' (' +
      validation.totalRows +
      ' rows; excluded: ' +
      (snapshot.excludedTables.join(', ') || 'none') +
      '; users fingerprint: ' +
      fingerprints.users +
      ').',
  )
} finally {
  db.close()
}
