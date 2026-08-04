// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest'
import { createRuntimeDatabase } from './runtime.js'

let client

afterEach(async () => {
  await client?.close()
  client = undefined
})

describe('runtime database adapter', () => {
  it('creates the SQLite adapter by default', async () => {
    client = createRuntimeDatabase({ databasePath: ':memory:', database: { driver: 'sqlite' } })
    expect(client.dialect).toBe('sqlite')
    expect(client.one('SELECT 1 AS value')).toEqual({ value: 1 })
  })

  it('creates a pooled PostgreSQL adapter when configured', async () => {
    client = createRuntimeDatabase({
      database: {
        driver: 'postgres',
        url: 'postgres://localhost/ptit',
        poolMax: 4,
        idleTimeoutMs: 1000,
      },
    })
    expect(client.dialect).toBe('postgres')
  })
})
