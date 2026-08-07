import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { createRuntimeConfig } from '../server/runtimeConfig.js'
import { createPostgresClient } from '../server/db/postgres.js'
import { createPostgresPoolOptions } from '../server/db/runtime.js'
import { assertMigrationsCurrent } from '../server/db/migrations.js'
import {
  inspectPostgresApplicationSchema,
  resolveConfirmedPostgresTarget,
  verifyConnectedPostgresTarget,
} from '../server/db/targetSafety.js'
import {
  resolveStagingCredentials,
  rotateStagingCredentials,
} from '../server/db/stagingCredentials.js'

if (existsSync('.env')) process.loadEnvFile('.env')

parseArgs({
  args: process.argv.slice(2),
  options: {},
  allowPositionals: false,
  strict: true,
})

const accounts = resolveStagingCredentials(process.env)
const config = createRuntimeConfig()
if (config.database.driver !== 'postgres') {
  throw new Error('Set DATABASE_DRIVER=postgres before rotating staging credentials.')
}
const target = resolveConfirmedPostgresTarget(config.database.url, process.env, {
  operation: 'staging credential rotation',
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
  await inspectPostgresApplicationSchema(client)
  const migrations = await assertMigrationsCurrent(client, { migrationDirectory })
  const rotated = await rotateStagingCredentials(client, accounts)
  console.log(
    JSON.stringify(
      {
        status: 'credentials-rotated',
        database: connectedTarget,
        migrations,
        count: rotated.length,
        accounts: rotated,
      },
      null,
      2,
    ),
  )
} finally {
  await client.close()
}
