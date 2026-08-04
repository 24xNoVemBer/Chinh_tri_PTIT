import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

// Parent tables must be imported before dependent tables to satisfy foreign keys.
export const DATA_TABLE_ORDER = [
  'schema_meta',
  'users',
  'subjects',
  'course_classes',
  'enrollments',
  'enrollment_profiles',
  'chapters',
  'lessons',
  'class_lessons',
  'materials',
  'material_versions',
  'approved_sources',
  'class_materials',
  'questions',
  'lecturer_answers',
  'rag_requests',
  'rag_responses',
  'rag_citations',
  'rag_reviews',
  'mock_response_templates',
  'mock_responses',
  'learning_progress',
  'search_history',
  'sessions',
  'audit_logs',
]

const IDENTIFIER = /^[a-z_][a-z0-9_]*$/

function quoteIdentifier(value) {
  if (!IDENTIFIER.test(value)) throw new Error(`Unsafe database identifier: ${value}`)
  return `"${value}"`
}

function assertSnapshot(snapshot) {
  if (!snapshot || snapshot.formatVersion !== '1' || snapshot.source !== 'sqlite') {
    throw new Error('Unsupported database snapshot format.')
  }
  if (!snapshot.tables || typeof snapshot.tables !== 'object') {
    throw new Error('Database snapshot must contain tables.')
  }
}

export function exportDatabaseSnapshot(db, { exportedAt = new Date().toISOString() } = {}) {
  if (!db || typeof db.many !== 'function')
    throw new Error('exportDatabaseSnapshot requires a database client with many().')

  const tables = Object.fromEntries(
    DATA_TABLE_ORDER.map((table) => [table, db.many(`SELECT * FROM ${quoteIdentifier(table)}`)]),
  )
  return {
    formatVersion: '1',
    source: 'sqlite',
    exportedAt,
    tables,
  }
}

export async function writeDatabaseSnapshot(snapshot, filePath) {
  assertSnapshot(snapshot)
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8')
}

export async function readDatabaseSnapshot(filePath) {
  const snapshot = JSON.parse(await readFile(filePath, 'utf8'))
  assertSnapshot(snapshot)
  return snapshot
}

export async function importDatabaseSnapshot(client, snapshot, { logger = console } = {}) {
  assertSnapshot(snapshot)
  if (!client || typeof client.transaction !== 'function')
    throw new Error('importDatabaseSnapshot requires a database client with transaction().')

  const imported = {}
  await client.transaction(async (transaction) => {
    for (const table of DATA_TABLE_ORDER) {
      const rows = snapshot.tables[table] ?? []
      if (!Array.isArray(rows)) throw new Error(`Snapshot table ${table} must be an array.`)
      imported[table] = 0

      for (const row of rows) {
        const columns = Object.keys(row)
        if (!columns.length) continue
        columns.forEach((column) => quoteIdentifier(column))
        const placeholders = columns.map(() => '?').join(', ')
        const sql = `INSERT INTO ${quoteIdentifier(table)} (${columns
          .map(quoteIdentifier)
          .join(', ')}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`
        const result = await transaction.execute(
          sql,
          columns.map((column) => row[column]),
        )
        imported[table] += Number(result?.rowCount ?? result?.changes ?? 0)
      }
    }
  })

  logger.info?.(`Imported ${Object.values(imported).reduce((sum, count) => sum + count, 0)} rows.`)
  return imported
}
