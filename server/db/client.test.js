// @vitest-environment node
import { DatabaseSync } from 'node:sqlite'
import { describe, expect, it } from 'vitest'
import { createSqliteClient } from './client.js'

describe('database client boundary', () => {
  it('exposes the SQLite dialect without leaking it to callers', () => {
    const client = createSqliteClient(new DatabaseSync(':memory:'))
    client.exec('CREATE TABLE records (id INTEGER PRIMARY KEY, value TEXT NOT NULL)')
    client.prepare('INSERT INTO records (value) VALUES (?)').run('first')
    expect(client.one('SELECT value FROM records WHERE value = ?', ['first'])).toEqual({
      value: 'first',
    })
    expect(client.many('SELECT value FROM records')).toEqual([{ value: 'first' }])
    expect(
      client.execute('UPDATE records SET value = ? WHERE value = ?', ['updated', 'first']).changes,
    ).toBe(1)

    expect(client.dialect).toBe('sqlite')
    expect(client.prepare('SELECT value FROM records').all()).toEqual([{ value: 'updated' }])

    client.close()
  })

  it('keeps an async transaction open until the Promise settles', async () => {
    const client = createSqliteClient(new DatabaseSync(':memory:'))
    client.exec('CREATE TABLE records (id INTEGER PRIMARY KEY, value TEXT NOT NULL)')

    await client.transaction(async (db) => {
      await db.execute('INSERT INTO records (value) VALUES (?)', ['async committed'])
    })
    expect(client.one('SELECT COUNT(*) AS count FROM records')).toEqual({ count: 1 })

    await expect(
      client.transaction(async (db) => {
        await db.execute('INSERT INTO records (value) VALUES (?)', ['async rolled back'])
        throw new Error('async abort')
      }),
    ).rejects.toThrow('async abort')
    expect(client.many('SELECT value FROM records')).toEqual([{ value: 'async committed' }])
    client.close()
  })
  it('commits a transaction and rolls back on failure', () => {
    const client = createSqliteClient(new DatabaseSync(':memory:'))
    client.exec('CREATE TABLE records (id INTEGER PRIMARY KEY, value TEXT NOT NULL)')

    client.transaction((db) => {
      db.prepare('INSERT INTO records (value) VALUES (?)').run('committed')
    })

    expect(client.prepare('SELECT COUNT(*) AS count FROM records').get().count).toBe(1)

    expect(() =>
      client.transaction((db) => {
        db.prepare('INSERT INTO records (value) VALUES (?)').run('rolled back')
        throw new Error('abort')
      }),
    ).toThrow('abort')

    expect(client.prepare('SELECT value FROM records').all()).toEqual([{ value: 'committed' }])
    client.close()
  })
})
