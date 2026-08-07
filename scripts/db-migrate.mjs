import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { createRuntimeConfig } from '../server/runtimeConfig.js'
import { createPostgresClient } from '../server/db/postgres.js'
import { createPostgresPoolOptions } from '../server/db/runtime.js'
import { runMigrations } from '../server/db/migrations.js'

if (existsSync('.env')) process.loadEnvFile('.env')

const config = createRuntimeConfig()
if (config.database.driver !== 'postgres') {
  throw new Error('Set DATABASE_DRIVER=postgres before running database migrations.')
}

const migrationDirectory = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../server/db/migrations',
)
const client = createPostgresClient({
  connectionString: config.database.url,
  poolOptions: createPostgresPoolOptions(config.database, { administrative: true }),
})

try {
  const result = await runMigrations(client, { migrationDirectory })
  console.log(
    `Database migrations complete: ${result.applied.length} applied, ${result.total} known.`,
  )
} finally {
  await client.close()
}
