import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { createRuntimeConfig } from '../server/runtimeConfig.js'
import { createPostgresClient } from '../server/db/postgres.js'
import { assertMigrationsCurrent } from '../server/db/migrations.js'
import {
  createPgRestoreArgs,
  createPgToolEnvironment,
  readVerifiedBackupManifest,
  resolveBackupArtifactPath,
  runPgTool,
} from '../server/db/pgTools.js'
import { createPostgresPoolOptions } from '../server/db/runtime.js'
import {
  assertDisposableRestoreTarget,
  createRestoreConfirmationEnvironment,
  createRestoreRuntimeEnvironment,
} from '../server/db/restoreSafety.js'
import {
  inspectConnectedPostgresTls,
  inspectPostgresApplicationSchema,
  resolveConfirmedPostgresTarget,
  verifyConnectedPostgresTarget,
} from '../server/db/targetSafety.js'

if (existsSync('.env')) process.loadEnvFile('.env')

const { positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {},
  allowPositionals: true,
  strict: true,
})
if (positionals.length !== 1) {
  throw new Error('db:restore:drill requires exactly one .dump archive path.')
}

const archivePath = resolveBackupArtifactPath(positionals[0])
const { manifest, manifestPath, checksum } = await readVerifiedBackupManifest(archivePath)
const restoreEnvironment = createRestoreRuntimeEnvironment(process.env)
const config = createRuntimeConfig(restoreEnvironment)
const confirmationEnvironment = createRestoreConfirmationEnvironment(process.env)
const target = resolveConfirmedPostgresTarget(config.database.url, confirmationEnvironment, {
  operation: 'disposable restore drill',
})
const drill = assertDisposableRestoreTarget(manifest, target, process.env)
const migrationDirectory = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../server/db/migrations',
)

async function inspectTarget({ requireApplicationSchema }) {
  const client = createPostgresClient({
    connectionString: config.database.url,
    poolOptions: createPostgresPoolOptions(config.database, { administrative: true }),
  })
  try {
    const identity = await verifyConnectedPostgresTarget(client, target)
    const transport = await inspectConnectedPostgresTls(client, { required: true })
    if (!requireApplicationSchema) return { identity, transport }
    const schema = await inspectPostgresApplicationSchema(client)
    const migrations = await assertMigrationsCurrent(client, { migrationDirectory })
    return { identity, transport, schema, migrations }
  } finally {
    await client.close()
  }
}

const before = await inspectTarget({ requireApplicationSchema: false })
const toolEnvironment = createPgToolEnvironment(config.database)
await runPgTool('pg_restore', createPgRestoreArgs(archivePath, target.database), {
  env: toolEnvironment,
})
const after = await inspectTarget({ requireApplicationSchema: true })

console.log(
  JSON.stringify(
    {
      status: 'restore-drill-complete',
      archivePath,
      manifestPath,
      checksum,
      drill,
      before,
      after,
    },
    null,
    2,
  ),
)
