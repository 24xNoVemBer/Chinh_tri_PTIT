// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createDatabase } from '../database.js'
import {
  assertDatabaseEmpty,
  assertDatabaseSnapshotParity,
  exportDatabaseSnapshot,
  fingerprintRows,
  fingerprintSnapshotTables,
  importDatabaseSnapshot,
  DATA_TABLE_ORDER,
  sanitizeStagingSnapshot,
  STAGING_DISABLED_PASSWORD_HASH,
  STAGING_EXCLUDED_TABLES,
  validateSnapshotImportability,
  validateStagingSnapshot,
} from './dataMigration.js'

describe('database snapshot migration', () => {
  it('exports seeded SQLite data and imports it idempotently', async () => {
    const source = createDatabase({ databasePath: ':memory:', seed: true })
    const target = createDatabase({ databasePath: ':memory:', seed: false })

    try {
      const snapshot = exportDatabaseSnapshot(source, { exportedAt: '2026-08-04T00:00:00.000Z' })
      expect(snapshot.formatVersion).toBe('1')
      expect(Object.keys(snapshot.tables)).toEqual(DATA_TABLE_ORDER)
      expect(snapshot.tables.users).toHaveLength(7)
      expect(snapshot.tables.questions).toHaveLength(5)

      const firstImport = await importDatabaseSnapshot(target, snapshot, { logger: { info() {} } })
      const secondImport = await importDatabaseSnapshot(target, snapshot, { logger: { info() {} } })

      expect(firstImport.users).toBe(7)
      expect(firstImport.questions).toBe(5)
      expect(secondImport.users).toBe(0)
      expect(secondImport.questions).toBe(0)
      expect(target.one('SELECT COUNT(*) AS count FROM users').count).toBe(7)
      expect(target.one('SELECT COUNT(*) AS count FROM rag_citations').count).toBe(2)
    } finally {
      source.close()
      target.close()
    }
  })

  it('exports a staging-safe snapshot without sessions or development audit logs', () => {
    const source = createDatabase({ databasePath: ':memory:', seed: true })

    try {
      const snapshot = sanitizeStagingSnapshot(
        exportDatabaseSnapshot(source, {
          exportedAt: '2026-08-08T00:00:00.000Z',
          excludeTables: STAGING_EXCLUDED_TABLES,
        }),
      )
      const validation = validateStagingSnapshot(snapshot)

      expect(snapshot.excludedTables).toEqual(STAGING_EXCLUDED_TABLES)
      expect(snapshot.tables.sessions).toEqual([])
      expect(snapshot.tables.audit_logs).toEqual([])
      expect(new Set(snapshot.tables.users.map((user) => user.password_hash))).toEqual(
        new Set([STAGING_DISABLED_PASSWORD_HASH]),
      )
      expect(validation.totalRows).toBeGreaterThan(0)
    } finally {
      source.close()
    }
  })

  it('rejects active credential hashes until a snapshot is sanitized', () => {
    const source = createDatabase({ databasePath: ':memory:', seed: true })

    try {
      const rawSnapshot = exportDatabaseSnapshot(source, {
        excludeTables: STAGING_EXCLUDED_TABLES,
      })
      expect(() => validateStagingSnapshot(rawSnapshot)).toThrow(
        'Staging snapshot contains active development credential hashes',
      )

      const sanitized = sanitizeStagingSnapshot(rawSnapshot)
      expect(() => validateStagingSnapshot(sanitized)).not.toThrow()
      expect(rawSnapshot.tables.users[0].password_hash).not.toBe(STAGING_DISABLED_PASSWORD_HASH)
    } finally {
      source.close()
    }
  })

  it('fingerprints table content independently of row and object-key order', () => {
    const first = [
      { id: 'b', nested: { second: 2, first: 1 } },
      { id: 'a', enabled: true },
    ]
    const reordered = [
      { enabled: true, id: 'a' },
      { nested: { first: 1, second: 2 }, id: 'b' },
    ]

    expect(fingerprintRows(first)).toBe(fingerprintRows(reordered))
    expect(fingerprintRows(first)).not.toBe(
      fingerprintRows([{ id: 'a', enabled: false }, first[0]]),
    )
  })

  it('fingerprints every required table in a complete snapshot', () => {
    const source = createDatabase({ databasePath: ':memory:', seed: true })

    try {
      const snapshot = sanitizeStagingSnapshot(
        exportDatabaseSnapshot(source, { excludeTables: STAGING_EXCLUDED_TABLES }),
      )
      const fingerprints = fingerprintSnapshotTables(snapshot)

      expect(Object.keys(fingerprints)).toEqual(DATA_TABLE_ORDER)
      expect(fingerprints.users).toMatch(/^[a-f0-9]{64}$/)
      expect(fingerprints.sessions).toBe(fingerprintRows([]))
    } finally {
      source.close()
    }
  })

  it('detects same-count content drift after a snapshot import', async () => {
    const source = createDatabase({ databasePath: ':memory:', seed: true })
    const target = createDatabase({ databasePath: ':memory:', seed: false })

    try {
      const snapshot = sanitizeStagingSnapshot(
        exportDatabaseSnapshot(source, { excludeTables: STAGING_EXCLUDED_TABLES }),
      )
      await importDatabaseSnapshot(target, snapshot, {
        conflictPolicy: 'ignore',
        logger: { info() {} },
        requireEmpty: true,
      })

      const parity = await assertDatabaseSnapshotParity(target, snapshot)
      expect(parity.counts.users).toBe(snapshot.tables.users.length)
      expect(parity.fingerprints.users).toBe(fingerprintSnapshotTables(snapshot).users)

      target.execute("UPDATE users SET name = 'Changed without changing row count' WHERE id = ?", [
        snapshot.tables.users[0].id,
      ])
      await expect(assertDatabaseSnapshotParity(target, snapshot)).rejects.toThrow(
        'content-fingerprint',
      )
    } finally {
      source.close()
      target.close()
    }
  })

  it('verifies import constraints and PostgreSQL-compatible types offline', async () => {
    const source = createDatabase({ databasePath: ':memory:', seed: true })

    try {
      const validSnapshot = sanitizeStagingSnapshot(
        exportDatabaseSnapshot(source, { excludeTables: STAGING_EXCLUDED_TABLES }),
      )
      await expect(validateSnapshotImportability(validSnapshot)).resolves.toBe(true)

      const invalidCheckConstraint = structuredClone(validSnapshot)
      invalidCheckConstraint.tables.subjects[0].credits = 0
      await expect(validateSnapshotImportability(invalidCheckConstraint)).rejects.toThrow()

      const invalidPostgresType = structuredClone(validSnapshot)
      invalidPostgresType.tables.subjects[0].credits = 'abc'
      await expect(validateSnapshotImportability(invalidPostgresType)).rejects.toThrow(
        'must be a PostgreSQL INTEGER',
      )
    } finally {
      source.close()
    }
  })
  it('rejects runtime session data unless explicitly allowed', () => {
    const source = createDatabase({ databasePath: ':memory:', seed: true })

    try {
      const snapshot = sanitizeStagingSnapshot(exportDatabaseSnapshot(source))
      snapshot.tables.sessions = [{ id: 'legacy-session' }]

      expect(() => validateStagingSnapshot(snapshot)).toThrow(
        'Staging snapshot contains runtime data: sessions',
      )
      expect(validateStagingSnapshot(snapshot, { allowRuntimeData: true }).counts.sessions).toBe(1)
    } finally {
      source.close()
    }
  })

  it('requires an empty target for a safe staging import', async () => {
    const target = createDatabase({ databasePath: ':memory:', seed: false })

    try {
      await expect(assertDatabaseEmpty(target)).resolves.toBe(true)
      target.execute('INSERT INTO subjects (id, name, credits) VALUES (?, ?, ?)', [
        'subject-test',
        'Subject test',
        2,
      ])
      await expect(assertDatabaseEmpty(target)).rejects.toThrow(
        'Target database is not empty: subjects=1',
      )
    } finally {
      target.close()
    }
  })

  it('can fail loudly on conflicts instead of hiding duplicate rows', async () => {
    const source = createDatabase({ databasePath: ':memory:', seed: true })
    const target = createDatabase({ databasePath: ':memory:', seed: false })

    try {
      const snapshot = exportDatabaseSnapshot(source, {
        excludeTables: STAGING_EXCLUDED_TABLES,
      })
      snapshot.tables.schema_meta = []
      await importDatabaseSnapshot(target, snapshot, {
        logger: { info() {} },
        conflictPolicy: 'error',
      })

      await expect(
        importDatabaseSnapshot(target, snapshot, {
          logger: { info() {} },
          conflictPolicy: 'error',
        }),
      ).rejects.toThrow()
      expect(target.one('SELECT COUNT(*) AS count FROM users').count).toBe(7)
    } finally {
      source.close()
      target.close()
    }
  })

  it('rejects snapshots with missing tables or malformed rows', () => {
    const source = createDatabase({ databasePath: ':memory:', seed: true })

    try {
      const missingTable = exportDatabaseSnapshot(source, {
        excludeTables: STAGING_EXCLUDED_TABLES,
      })
      delete missingTable.tables.users
      expect(() => validateStagingSnapshot(missingTable)).toThrow(
        'Database snapshot is missing tables: users',
      )

      const malformedRow = exportDatabaseSnapshot(source, {
        excludeTables: STAGING_EXCLUDED_TABLES,
      })
      malformedRow.tables.users = [null]
      expect(() => validateStagingSnapshot(malformedRow)).toThrow(
        'Snapshot row users[0] must be an object.',
      )
    } finally {
      source.close()
    }
  })

  it('rejects a structurally complete staging snapshot without required seed data', () => {
    const source = createDatabase({ databasePath: ':memory:', seed: true })

    try {
      const snapshot = sanitizeStagingSnapshot(
        exportDatabaseSnapshot(source, {
          excludeTables: STAGING_EXCLUDED_TABLES,
        }),
      )
      snapshot.tables.users = []
      snapshot.tables.subjects = []
      expect(() => validateStagingSnapshot(snapshot)).toThrow(
        'Staging snapshot is missing required seed data: users, subjects',
      )
    } finally {
      source.close()
    }
  })

  it('checks the empty-target invariant inside the import transaction', async () => {
    const source = createDatabase({ databasePath: ':memory:', seed: true })
    const target = createDatabase({ databasePath: ':memory:', seed: false })

    try {
      const snapshot = exportDatabaseSnapshot(source, {
        excludeTables: STAGING_EXCLUDED_TABLES,
      })
      target.execute('INSERT INTO subjects (id, name, credits) VALUES (?, ?, ?)', [
        'occupied',
        'Occupied target',
        2,
      ])

      await expect(
        importDatabaseSnapshot(target, snapshot, {
          logger: { info() {} },
          conflictPolicy: 'error',
          requireEmpty: true,
        }),
      ).rejects.toThrow('Target database is not empty: subjects=1')
      expect(target.one('SELECT COUNT(*) AS count FROM users').count).toBe(0)
    } finally {
      source.close()
      target.close()
    }
  })
  it('locks PostgreSQL import tables before checking an empty target', async () => {
    const source = createDatabase({ databasePath: ':memory:', seed: true })
    try {
      const snapshot = exportDatabaseSnapshot(source)
      for (const table of DATA_TABLE_ORDER) snapshot.tables[table] = []

      const events = []
      const client = {
        async transaction(callback) {
          return callback({
            dialect: 'postgres',
            async exec(sql) {
              events.push({ type: 'exec', sql })
            },
            async one(sql) {
              events.push({ type: 'one', sql })
              return { count: 0 }
            },
            async execute() {
              throw new Error('Empty snapshot should not execute inserts.')
            },
          })
        },
      }

      await importDatabaseSnapshot(client, snapshot, {
        logger: { info() {} },
        conflictPolicy: 'error',
        requireEmpty: true,
      })

      expect(events[0]).toMatchObject({ type: 'exec' })
      expect(events[0].sql).toContain('LOCK TABLE')
      expect(events.filter((event) => event.type === 'one')).toHaveLength(
        DATA_TABLE_ORDER.length - 1,
      )
    } finally {
      source.close()
    }
  })
  it('locks PostgreSQL tables even for an explicitly non-empty import', async () => {
    const source = createDatabase({ databasePath: ':memory:', seed: true })
    try {
      const snapshot = exportDatabaseSnapshot(source)
      for (const table of DATA_TABLE_ORDER) snapshot.tables[table] = []

      const events = []
      const client = {
        async transaction(callback) {
          return callback({
            dialect: 'postgres',
            async exec(sql) {
              events.push({ type: 'exec', sql })
            },
            async execute() {
              throw new Error('Empty snapshot should not execute inserts.')
            },
          })
        },
      }

      await importDatabaseSnapshot(client, snapshot, {
        logger: { info() {} },
        conflictPolicy: 'ignore',
        requireEmpty: false,
      })

      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({ type: 'exec' })
      expect(events[0].sql).toContain('LOCK TABLE')
    } finally {
      source.close()
    }
  })
  it('rejects unsupported snapshots before opening a transaction', async () => {
    const target = createDatabase({ databasePath: ':memory:', seed: false })
    try {
      await expect(
        importDatabaseSnapshot(target, { formatVersion: '2', source: 'postgres', tables: {} }),
      ).rejects.toThrow('Unsupported database snapshot format.')
    } finally {
      target.close()
    }
  })
})
