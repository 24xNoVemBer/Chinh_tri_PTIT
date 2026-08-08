// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createRuntimeConfig } from './runtimeConfig.js'

describe('database runtime configuration', () => {
  it('keeps SQLite as the default adapter', () => {
    const config = createRuntimeConfig({ NODE_ENV: 'test', PORT: '3001' })
    expect(config.host).toBe('127.0.0.1')
    expect(config.database).toMatchObject({
      driver: 'sqlite',
      url: '',
      poolMax: 10,
      connectionTimeoutMs: 5000,
      queryTimeoutMs: 20000,
      statementTimeoutMs: 15000,
      adminQueryTimeoutMs: 125000,
      adminStatementTimeoutMs: 120000,
      idleInTransactionTimeoutMs: 10000,
      applicationName: 'ptit-politics-api',
      sslMode: 'disable',
      sslCaPath: '',
    })
    expect(config.rag.demoData).toBe(true)
    expect(config.auth).toEqual({
      enabled: true,
      trustProxy: false,
      windowMs: 900000,
      blockMs: 900000,
      accountMax: 20,
      sourceAccountMax: 5,
      cleanupIntervalMs: 300000,
    })
  })

  it('requires a URL before selecting PostgreSQL', () => {
    expect(() =>
      createRuntimeConfig({ DATABASE_DRIVER: 'postgres', NODE_ENV: 'test', PORT: '3001' }),
    ).toThrow('DATABASE_URL is required')

    const config = createRuntimeConfig({
      DATABASE_DRIVER: 'postgres',
      DATABASE_URL: 'postgres://localhost/ptit',
      DATABASE_POOL_MAX: '24',
      DATABASE_CONNECTION_TIMEOUT_MS: '3000',
      DATABASE_QUERY_TIMEOUT_MS: '12000',
      DATABASE_STATEMENT_TIMEOUT_MS: '11000',
      DATABASE_ADMIN_QUERY_TIMEOUT_MS: '91000',
      DATABASE_ADMIN_STATEMENT_TIMEOUT_MS: '90000',
      DATABASE_IDLE_IN_TRANSACTION_TIMEOUT_MS: '9000',
      DATABASE_APPLICATION_NAME: 'ptit-test',
      HOST: '0.0.0.0',
      NODE_ENV: 'test',
      PORT: '3001',
    })
    expect(config).toMatchObject({
      host: '0.0.0.0',
      database: {
        driver: 'postgres',
        poolMax: 24,
        connectionTimeoutMs: 3000,
        queryTimeoutMs: 12000,
        statementTimeoutMs: 11000,
        adminQueryTimeoutMs: 91000,
        adminStatementTimeoutMs: 90000,
        idleInTransactionTimeoutMs: 9000,
        applicationName: 'ptit-test',
      },
    })
    expect(createRuntimeConfig({ NODE_ENV: 'production', PORT: '3001' }).rag.demoData).toBe(false)
  })

  it('requires verified TLS for production PostgreSQL', () => {
    const production = {
      DATABASE_DRIVER: 'postgres',
      DATABASE_URL: 'postgres://ptit_app@db.ptit.edu.vn/ptit_politics',
      NODE_ENV: 'production',
      PORT: '3001',
    }
    expect(() => createRuntimeConfig(production)).toThrow(
      'Production PostgreSQL requires DATABASE_SSL_MODE=verify-full',
    )
    expect(() => createRuntimeConfig({ ...production, DATABASE_SSL_MODE: 'verify-full' })).toThrow(
      'DATABASE_SSL_CA_PATH is required',
    )

    expect(
      createRuntimeConfig({
        ...production,
        DATABASE_SSL_MODE: 'verify-full',
        DATABASE_SSL_CA_PATH: 'secrets/ptit-postgres-ca.pem',
      }).database,
    ).toMatchObject({
      sslMode: 'verify-full',
      sslCaPath: 'secrets/ptit-postgres-ca.pem',
    })
  })

  it('rejects PostgreSQL URL parameters that could override dedicated security settings', () => {
    expect(() =>
      createRuntimeConfig({
        DATABASE_DRIVER: 'postgres',
        DATABASE_URL: 'postgres://localhost/ptit?sslmode=disable',
        NODE_ENV: 'test',
      }),
    ).toThrow('query parameters and fragments are not allowed')
  })

  it('requires client query timeouts to exceed server statement timeouts', () => {
    expect(() =>
      createRuntimeConfig({
        DATABASE_QUERY_TIMEOUT_MS: '15000',
        DATABASE_STATEMENT_TIMEOUT_MS: '15000',
        NODE_ENV: 'test',
      }),
    ).toThrow('DATABASE_QUERY_TIMEOUT_MS must be greater')

    expect(() =>
      createRuntimeConfig({
        DATABASE_ADMIN_QUERY_TIMEOUT_MS: '120000',
        DATABASE_ADMIN_STATEMENT_TIMEOUT_MS: '120000',
        NODE_ENV: 'test',
      }),
    ).toThrow('DATABASE_ADMIN_QUERY_TIMEOUT_MS must be greater')
  })

  it('rejects an empty host or database application name', () => {
    expect(() => createRuntimeConfig({ HOST: ' ', NODE_ENV: 'test', PORT: '3001' })).toThrow(
      'HOST must not be empty',
    )
    expect(() =>
      createRuntimeConfig({
        DATABASE_APPLICATION_NAME: ' ',
        NODE_ENV: 'test',
        PORT: '3001',
      }),
    ).toThrow('DATABASE_APPLICATION_NAME must not be empty')
  })

  it('validates login protection and proxy settings', () => {
    expect(
      createRuntimeConfig({
        AUTH_TRUST_PROXY: 'true',
        AUTH_LOGIN_ACCOUNT_MAX: '30',
        AUTH_LOGIN_SOURCE_ACCOUNT_MAX: '8',
        AUTH_LOGIN_WINDOW_MS: '60000',
        AUTH_LOGIN_BLOCK_MS: '120000',
        AUTH_LOGIN_CLEANUP_INTERVAL_MS: '30000',
        NODE_ENV: 'test',
      }).auth,
    ).toEqual({
      enabled: true,
      trustProxy: true,
      windowMs: 60000,
      blockMs: 120000,
      accountMax: 30,
      sourceAccountMax: 8,
      cleanupIntervalMs: 30000,
    })

    expect(() =>
      createRuntimeConfig({ AUTH_RATE_LIMIT_ENABLED: 'false', NODE_ENV: 'production' }),
    ).toThrow('AUTH_RATE_LIMIT_ENABLED must remain enabled in production')
  })
})
