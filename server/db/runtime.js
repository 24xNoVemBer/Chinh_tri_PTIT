import { createDatabase, DEFAULT_DATABASE_PATH } from '../database.js'
import { createPostgresClient } from './postgres.js'

export function createRuntimeDatabase(config) {
  if (!config?.database) throw new Error('createRuntimeDatabase requires runtime config.')

  if (config.database.driver === 'postgres') {
    return createPostgresClient({
      connectionString: config.database.url,
      poolOptions: {
        max: config.database.poolMax,
        idleTimeoutMillis: config.database.idleTimeoutMs,
      },
    })
  }

  return createDatabase({
    databasePath: config.databasePath ?? DEFAULT_DATABASE_PATH,
  })
}
