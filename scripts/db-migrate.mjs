import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { createRuntimeConfig } from '../server/runtimeConfig.js'
import { createPostgresClient } from '../server/db/postgres.js'
import { createPostgresPoolOptions } from '../server/db/runtime.js'
import { runMigrations } from '../server/db/migrations.js'
import {
  resolveConfirmedPostgresTarget,
  verifyConnectedPostgresTarget,
} from '../server/db/targetSafety.js'

if (existsSync('.env')) process.loadEnvFile('.env')

parseArgs({
  args: process.argv.slice(2),
  options: {},
  allowPositionals: false,
  strict: true,
})

const config = createRuntimeConfig()
if (config.database.driver !== 'postgres') {
  throw new Error('Set DATABASE_DRIVER=postgres before running database migrations.')
}
const target = resolveConfirmedPostgresTarget(config.database.url, process.env, {
  operation: 'database migration',
})

const migrationDirectory = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../server/db/migrations',
)
const client = createPostgresClient({
  connectionString: config.database.url,
  poolOptions: createPostgresPoolOptions(config.database, { administrative: true }),
})

try {
  const connectedTarget = await verifyConnectedPostgresTarget(client, target)
  const result = await runMigrations(client, { migrationDirectory })
  console.log(
    JSON.stringify(
      {
        status: 'migrated',
        database: connectedTarget,
        applied: result.applied.length,
        known: result.total,
      },
      null,
      2,
    ),
  )
} finally {
  await client.close()
}
