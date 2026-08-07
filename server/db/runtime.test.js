// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest'
import { createPostgresPoolOptions, createRuntimeDatabase } from './runtime.js'

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
        connectionTimeoutMs: 2000,
        queryTimeoutMs: 5000,
        statementTimeoutMs: 4000,
        adminQueryTimeoutMs: 31000,
        adminStatementTimeoutMs: 30000,
        idleInTransactionTimeoutMs: 5000,
        applicationName: 'ptit-test',
      },
    })
    expect(client.dialect).toBe('postgres')
  })

  it('maps runtime and administrative timeout settings to pg pool options', () => {
    const databaseConfig = {
      poolMax: 4,
      idleTimeoutMs: 1000,
      connectionTimeoutMs: 2000,
      queryTimeoutMs: 5000,
      statementTimeoutMs: 4000,
      adminQueryTimeoutMs: 31000,
      adminStatementTimeoutMs: 30000,
      idleInTransactionTimeoutMs: 5000,
      applicationName: 'ptit-test',
    }

    expect(createPostgresPoolOptions(databaseConfig)).toEqual({
      max: 4,
      idleTimeoutMillis: 1000,
      connectionTimeoutMillis: 2000,
      query_timeout: 5000,
      statement_timeout: 4000,
      idle_in_transaction_session_timeout: 5000,
      application_name: 'ptit-test',
    })
    expect(createPostgresPoolOptions(databaseConfig, { administrative: true })).toEqual({
      max: 4,
      idleTimeoutMillis: 1000,
      connectionTimeoutMillis: 2000,
      query_timeout: 31000,
      statement_timeout: 30000,
      idle_in_transaction_session_timeout: 5000,
      application_name: 'ptit-test-admin',
    })
  })
})
