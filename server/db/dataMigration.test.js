// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createDatabase } from '../database.js'
import {
  exportDatabaseSnapshot,
  importDatabaseSnapshot,
  DATA_TABLE_ORDER,
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
