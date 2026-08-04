import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { createDatabase } from '../server/database.js'
import { exportDatabaseSnapshot, writeDatabaseSnapshot } from '../server/db/dataMigration.js'

if (existsSync('.env')) process.loadEnvFile('.env')

const databasePath = process.env.DATABASE_PATH ?? 'data/ptit-teaching-assistant.sqlite'
const outputPath = resolve(
  process.argv[2] ?? process.env.DB_SNAPSHOT_PATH ?? 'data/ptit-snapshot.json',
)
const db = createDatabase({ databasePath, seed: false })

try {
  const snapshot = exportDatabaseSnapshot(db)
  await writeDatabaseSnapshot(snapshot, outputPath)
  const rowCount = Object.values(snapshot.tables).reduce((sum, rows) => sum + rows.length, 0)
  console.log(`SQLite snapshot written: ${outputPath} (${rowCount} rows).`)
} finally {
  db.close()
}
