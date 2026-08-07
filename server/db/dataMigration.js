import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { createDatabase } from '../database.js'

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

export const STAGING_EXCLUDED_TABLES = ['sessions', 'audit_logs']
export const STAGING_DISABLED_PASSWORD_HASH = 'disabled$staging-import'

export function sanitizeStagingSnapshot(snapshot) {
  assertSnapshot(snapshot)
  return {
    ...snapshot,
    sanitizedFields: ['users.password_hash'],
    tables: {
      ...snapshot.tables,
      users: snapshot.tables.users.map((user) => ({
        ...user,
        password_hash: STAGING_DISABLED_PASSWORD_HASH,
      })),
    },
  }
}

const IDENTIFIER = /^[a-z_][a-z0-9_]*$/
const REQUIRED_ROW_KEY = Object.freeze({
  schema_meta: 'key',
  enrollment_profiles: 'enrollment_id',
  mock_response_templates: 'subject_id',
  users: 'id',
  subjects: 'id',
  course_classes: 'id',
  enrollments: 'id',
  chapters: 'id',
  lessons: 'id',
  class_lessons: 'id',
  materials: 'id',
  material_versions: 'id',
  approved_sources: 'id',
  class_materials: 'id',
  questions: 'id',
  lecturer_answers: 'id',
  rag_requests: 'id',
  rag_responses: 'id',
  rag_citations: 'id',
  rag_reviews: 'id',
  mock_responses: 'id',
  learning_progress: 'id',
  search_history: 'id',
  sessions: 'id',
  audit_logs: 'id',
})

function quoteIdentifier(value) {
  if (!IDENTIFIER.test(value)) throw new Error('Unsafe database identifier: ' + value)
  return '"' + value + '"'
}

function assertSnapshot(snapshot) {
  if (!snapshot || snapshot.formatVersion !== '1' || snapshot.source !== 'sqlite') {
    throw new Error('Unsupported database snapshot format.')
  }
  if (!snapshot.tables || typeof snapshot.tables !== 'object' || Array.isArray(snapshot.tables)) {
    throw new Error('Database snapshot must contain a tables object.')
  }

  const tableNames = Object.keys(snapshot.tables)
  const missingTables = DATA_TABLE_ORDER.filter(
    (table) => !Object.prototype.hasOwnProperty.call(snapshot.tables, table),
  )
  if (missingTables.length) {
    throw new Error('Database snapshot is missing tables: ' + missingTables.join(', '))
  }
  const unknownTables = tableNames.filter((table) => !DATA_TABLE_ORDER.includes(table))
  if (unknownTables.length) {
    throw new Error('Database snapshot contains unknown tables: ' + unknownTables.join(', '))
  }

  if (snapshot.excludedTables !== undefined) {
    if (!Array.isArray(snapshot.excludedTables)) {
      throw new Error('Database snapshot excludedTables must be an array.')
    }
    const unknownExcluded = snapshot.excludedTables.filter(
      (table) => !DATA_TABLE_ORDER.includes(table),
    )
    if (unknownExcluded.length) {
      throw new Error(
        'Database snapshot contains unknown excluded tables: ' + unknownExcluded.join(', '),
      )
    }
  }

  for (const table of DATA_TABLE_ORDER) {
    const rows = snapshot.tables[table]
    if (!Array.isArray(rows)) throw new Error('Snapshot table ' + table + ' must be an array.')
    const requiredKey = REQUIRED_ROW_KEY[table]
    rows.forEach((row, index) => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        throw new Error('Snapshot row ' + table + '[' + index + '] must be an object.')
      }
      if (Object.keys(row).length === 0) {
        throw new Error('Snapshot row ' + table + '[' + index + '] must not be empty.')
      }
      const keyValue = row[requiredKey]
      if (keyValue === undefined || keyValue === null || String(keyValue).length === 0) {
        throw new Error(
          'Snapshot row ' + table + '[' + index + '] is missing required key ' + requiredKey + '.',
        )
      }
    })
  }
}

export function exportDatabaseSnapshot(
  db,
  { exportedAt = new Date().toISOString(), excludeTables = [] } = {},
) {
  if (!db || typeof db.many !== 'function' || typeof db.transaction !== 'function') {
    throw new Error('exportDatabaseSnapshot requires a transactional database client.')
  }

  const excluded = new Set(excludeTables)
  const unknownExcluded = [...excluded].filter((table) => !DATA_TABLE_ORDER.includes(table))
  if (unknownExcluded.length) {
    throw new Error('Unknown snapshot exclude table: ' + unknownExcluded.join(', '))
  }

  return db.transaction(
    (transaction) => {
      const tables = Object.fromEntries(
        DATA_TABLE_ORDER.map((table) => [
          table,
          excluded.has(table) ? [] : transaction.many('SELECT * FROM ' + quoteIdentifier(table)),
        ]),
      )
      return {
        formatVersion: '1',
        source: 'sqlite',
        exportedAt,
        excludedTables: [...excluded],
        tables,
      }
    },
    { mode: 'DEFERRED' },
  )
}

export function validateStagingSnapshot(
  snapshot,
  { allowRuntimeData = false, allowCredentialHashes = false, requireSeedData = true } = {},
) {
  assertSnapshot(snapshot)
  const counts = Object.fromEntries(
    DATA_TABLE_ORDER.map((table) => [table, snapshot.tables[table].length]),
  )

  if (!allowRuntimeData) {
    const includedRuntimeTables = STAGING_EXCLUDED_TABLES.filter((table) => counts[table] > 0)
    if (includedRuntimeTables.length) {
      throw new Error('Staging snapshot contains runtime data: ' + includedRuntimeTables.join(', '))
    }
  }

  if (!allowCredentialHashes) {
    const usersWithCredentials = snapshot.tables.users
      .filter((user) => user.password_hash !== STAGING_DISABLED_PASSWORD_HASH)
      .map((user) => user.id)
    if (usersWithCredentials.length) {
      throw new Error(
        'Staging snapshot contains active development credential hashes for users: ' +
          usersWithCredentials.join(', '),
      )
    }
  }
  if (requireSeedData) {
    const emptyRequiredTables = ['users', 'subjects'].filter((table) => counts[table] === 0)
    if (emptyRequiredTables.length) {
      throw new Error(
        'Staging snapshot is missing required seed data: ' + emptyRequiredTables.join(', '),
      )
    }
  }

  return {
    counts,
    totalRows: Object.values(counts).reduce((sum, count) => sum + count, 0),
  }
}

async function lockImportTables(transaction) {
  if (transaction.dialect !== 'postgres') return
  await transaction.exec(
    'LOCK TABLE ' + DATA_TABLE_ORDER.map(quoteIdentifier).join(', ') + ' IN ACCESS EXCLUSIVE MODE',
  )
}
export async function assertDatabaseEmpty(client, { tables = DATA_TABLE_ORDER } = {}) {
  if (!client || typeof client.one !== 'function') {
    throw new Error('assertDatabaseEmpty requires a database client with one().')
  }

  const occupied = []
  for (const table of tables) {
    if (table === 'schema_meta') continue
    if (!DATA_TABLE_ORDER.includes(table)) throw new Error('Unknown database table: ' + table)
    const row = await client.one('SELECT COUNT(*) AS count FROM ' + quoteIdentifier(table))
    const count = Number(row?.count ?? 0)
    if (count > 0) occupied.push({ table, count })
  }

  if (occupied.length) {
    throw new Error(
      'Target database is not empty: ' +
        occupied.map(({ table, count }) => table + '=' + count).join(', '),
    )
  }

  return true
}

function stableValue(value) {
  if (value === null || ['string', 'boolean'].includes(typeof value)) return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error('Snapshot contains a non-finite number that cannot be fingerprinted.')
    }
    return value
  }
  if (Array.isArray(value)) return value.map(stableValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableValue(value[key])]),
    )
  }
  throw new Error('Snapshot contains a value that cannot be fingerprinted.')
}

export function fingerprintRows(rows) {
  if (!Array.isArray(rows)) throw new Error('fingerprintRows requires an array.')
  const canonicalRows = rows.map((row) => JSON.stringify(stableValue(row))).sort()
  return createHash('sha256').update(canonicalRows.join('\n')).digest('hex')
}

export function fingerprintSnapshotTables(snapshot) {
  assertSnapshot(snapshot)
  return Object.fromEntries(
    DATA_TABLE_ORDER.map((table) => [table, fingerprintRows(snapshot.tables[table])]),
  )
}

function assertPostgresCompatibleTypes(database, snapshot) {
  for (const table of DATA_TABLE_ORDER) {
    const columns = new Map(
      database
        .many('PRAGMA table_info(' + quoteIdentifier(table) + ')')
        .map((column) => [column.name, String(column.type).toUpperCase()]),
    )

    snapshot.tables[table].forEach((row, rowIndex) => {
      for (const [column, value] of Object.entries(row)) {
        const declaredType = columns.get(column)
        if (!declaredType) {
          throw new Error(
            'Snapshot row ' + table + '[' + rowIndex + '] has unknown column ' + column + '.',
          )
        }
        if (value === null) continue

        if (declaredType === 'INTEGER') {
          const isPostgresInteger =
            typeof value === 'number' &&
            Number.isInteger(value) &&
            value >= -2147483648 &&
            value <= 2147483647
          if (!isPostgresInteger) {
            throw new Error(
              'Snapshot value ' +
                table +
                '[' +
                rowIndex +
                '].' +
                column +
                ' must be a PostgreSQL INTEGER.',
            )
          }
        } else if (['REAL', 'DOUBLE', 'DOUBLE PRECISION', 'FLOAT'].includes(declaredType)) {
          if (typeof value !== 'number' || !Number.isFinite(value)) {
            throw new Error(
              'Snapshot value ' +
                table +
                '[' +
                rowIndex +
                '].' +
                column +
                ' must be a finite PostgreSQL number.',
            )
          }
        } else if (declaredType === 'TEXT' && typeof value !== 'string') {
          throw new Error(
            'Snapshot value ' +
              table +
              '[' +
              rowIndex +
              '].' +
              column +
              ' must be PostgreSQL-compatible text.',
          )
        }
      }
    })
  }
}

export async function validateSnapshotImportability(snapshot, options = {}) {
  validateStagingSnapshot(snapshot, options)
  const target = createDatabase({ databasePath: ':memory:', seed: false })
  try {
    assertPostgresCompatibleTypes(target, snapshot)
    target.execute('DELETE FROM schema_meta')
    await importDatabaseSnapshot(target, snapshot, {
      logger: { info() {} },
      conflictPolicy: 'error',
      requireEmpty: true,
    })
    return true
  } finally {
    target.close()
  }
}
export async function writeDatabaseSnapshot(snapshot, filePath) {
  assertSnapshot(snapshot)
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, JSON.stringify(snapshot, null, 2) + '\n', 'utf8')
}

export async function readDatabaseSnapshot(filePath) {
  const snapshot = JSON.parse(await readFile(filePath, 'utf8'))
  assertSnapshot(snapshot)
  return snapshot
}

export async function importDatabaseSnapshot(
  client,
  snapshot,
  { logger = console, conflictPolicy = 'ignore', requireEmpty = false } = {},
) {
  assertSnapshot(snapshot)
  if (!client || typeof client.transaction !== 'function') {
    throw new Error('importDatabaseSnapshot requires a database client with transaction().')
  }
  if (!['ignore', 'error'].includes(conflictPolicy)) {
    throw new Error('conflictPolicy must be ignore or error.')
  }

  const imported = {}
  await client.transaction(async (transaction) => {
    if (requireEmpty) {
      await lockImportTables(transaction)
      await assertDatabaseEmpty(transaction)
    }

    for (const table of DATA_TABLE_ORDER) {
      const rows = snapshot.tables[table]
      imported[table] = 0

      for (const row of rows) {
        const columns = Object.keys(row)
        columns.forEach((column) => quoteIdentifier(column))
        const placeholders = columns.map(() => '?').join(', ')
        const sql =
          'INSERT INTO ' +
          quoteIdentifier(table) +
          ' (' +
          columns.map(quoteIdentifier).join(', ') +
          ') VALUES (' +
          placeholders +
          ')' +
          (conflictPolicy === 'ignore' ? ' ON CONFLICT DO NOTHING' : '')
        const result = await transaction.execute(
          sql,
          columns.map((column) => row[column]),
        )
        imported[table] += Number(result?.rowCount ?? result?.changes ?? 0)
      }
    }
  })

  const totalRows = Object.values(imported).reduce((sum, count) => sum + count, 0)
  logger.info?.('Imported ' + totalRows + ' rows.')
  return imported
}
