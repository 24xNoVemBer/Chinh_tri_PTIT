import { createDatabase, DEFAULT_DATABASE_PATH } from '../database.js'
import { createPostgresClient } from './postgres.js'

export function createPostgresPoolOptions(databaseConfig, { administrative = false } = {}) {
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
