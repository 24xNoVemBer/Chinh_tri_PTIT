import { existsSync } from 'node:fs'
import { mkdir, rm, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { createRuntimeConfig } from '../server/runtimeConfig.js'
import { createPostgresClient } from '../server/db/postgres.js'
import { assertMigrationsCurrent } from '../server/db/migrations.js'
import { createPostgresPoolOptions } from '../server/db/runtime.js'
import {
  createPgDumpArgs,
  createPgToolEnvironment,
  hashFileSha256,
  resolveBackupArtifactPath,
  runPgTool,
} from '../server/db/pgTools.js'
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
if (positionals.length > 1) throw new Error('db:backup:staging accepts at most one archive path.')

const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '')
const archivePath = resolveBackupArtifactPath(
  positionals[0] ?? resolve('data', 'backups', 'ptit-staging-' + timestamp + '.dump'),
)
const manifestPath = archivePath + '.manifest.json'
if (existsSync(archivePath) || existsSync(manifestPath)) {
  throw new Error('Backup archive or manifest already exists; refusing to overwrite it.')
}

const config = createRuntimeConfig()
if (config.database.driver !== 'postgres') {
  throw new Error('Set DATABASE_DRIVER=postgres before backing up staging.')
}
const target = resolveConfirmedPostgresTarget(config.database.url, process.env, {
  operation: 'staging backup',
})
const migrationDirectory = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../server/db/migrations',
)
const client = createPostgresClient({
  connectionString: config.database.url,
  poolOptions: createPostgresPoolOptions(config.database, { administrative: true }),
})

let connectedTarget
let transport
let migrations
try {
  connectedTarget = await verifyConnectedPostgresTarget(client, target)
  transport = await inspectConnectedPostgresTls(client, {
    required: config.database.sslMode === 'verify-full',
  })
  await inspectPostgresApplicationSchema(client)
  migrations = await assertMigrationsCurrent(client, { migrationDirectory })
} finally {
  await client.close()
}

await mkdir(dirname(archivePath), { recursive: true })
const toolEnvironment = createPgToolEnvironment(config.database)
try {
  await runPgTool('pg_dump', createPgDumpArgs(archivePath), { env: toolEnvironment })
  await runPgTool('pg_restore', ['--list', archivePath], { env: toolEnvironment })

  const archiveInfo = await stat(archivePath)
  const sha256 = await hashFileSha256(archivePath)
  const manifest = Object.freeze({
    formatVersion: '1',
    createdAt: new Date().toISOString(),
    archive: basename(archivePath),
    bytes: archiveInfo.size,
    sha256,
    format: 'postgres-custom',
    database: Object.freeze({ ...connectedTarget, confirmedHost: target.host }),
    transport,
    migrations,
  })
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n', {
    encoding: 'utf8',
    flag: 'wx',
  })
  console.log(
    JSON.stringify({ status: 'backup-created', archivePath, manifestPath, ...manifest }, null, 2),
  )
} catch (error) {
  await rm(archivePath, { force: true })
  await rm(manifestPath, { force: true })
  throw error
}
