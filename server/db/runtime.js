import { readFileSync } from 'node:fs'
import { createDatabase, DEFAULT_DATABASE_PATH } from '../database.js'
import { createPostgresClient } from './postgres.js'

export function resolvePostgresSslOptions(databaseConfig, { readFile = readFileSync } = {}) {
  const mode = databaseConfig.sslMode ?? 'disable'
  if (mode === 'disable') return false
  if (mode !== 'verify-full') {
    throw new Error('Unsupported PostgreSQL SSL mode: ' + mode + '.')
  }
  if (!databaseConfig.sslCaPath) {
    throw new Error('PostgreSQL verify-full requires a CA certificate path.')
  }
  const ca = String(readFile(databaseConfig.sslCaPath, 'utf8'))
  if (!ca.trim()) throw new Error('PostgreSQL CA certificate must not be empty.')
  return Object.freeze({ ca, rejectUnauthorized: true })
}

export function createPostgresPoolOptions(
  databaseConfig,
  { administrative = false, readFile = readFileSync } = {},
) {
  return {
    max: databaseConfig.poolMax,
    idleTimeoutMillis: databaseConfig.idleTimeoutMs,
    connectionTimeoutMillis: databaseConfig.connectionTimeoutMs,
    query_timeout: administrative
      ? databaseConfig.adminQueryTimeoutMs
      : databaseConfig.queryTimeoutMs,
    statement_timeout: administrative
      ? databaseConfig.adminStatementTimeoutMs
      : databaseConfig.statementTimeoutMs,
    idle_in_transaction_session_timeout: databaseConfig.idleInTransactionTimeoutMs,
    application_name: databaseConfig.applicationName + (administrative ? '-admin' : ''),
    ssl: resolvePostgresSslOptions(databaseConfig, { readFile }),
  }
}

export function createRuntimeDatabase(config) {
  if (!config?.database) throw new Error('createRuntimeDatabase requires runtime config.')

  if (config.database.driver === 'postgres') {
    return createPostgresClient({
      connectionString: config.database.url,
      poolOptions: createPostgresPoolOptions(config.database),
    })
  }

  return createDatabase({
    databasePath: config.databasePath ?? DEFAULT_DATABASE_PATH,
  })
}
