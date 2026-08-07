import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { basename, isAbsolute, relative, resolve } from 'node:path'

export const DEFAULT_BACKUP_ROOT = resolve('data', 'backups')

export function resolveBackupArtifactPath(inputPath, { backupRoot = DEFAULT_BACKUP_ROOT } = {}) {
  if (!inputPath) throw new Error('A backup archive path is required.')
  const root = resolve(backupRoot)
  const artifact = resolve(inputPath)
  const relativePath = relative(root, artifact)
  if (!relativePath || relativePath.startsWith('..') || isAbsolute(relativePath)) {
    throw new Error('Backup archives must be a file inside ' + root + '.')
  }
  if (!artifact.toLowerCase().endsWith('.dump')) {
    throw new Error('Backup archive must use the .dump extension.')
  }
  return artifact
}

export function createPgToolEnvironment(databaseConfig, baseEnv = process.env) {
  if (!databaseConfig?.url) throw new Error('PostgreSQL tool connection URL is required.')
  const url = new URL(databaseConfig.url)
  const database = decodeURIComponent(url.pathname.replace(/^\//, ''))
  const user = decodeURIComponent(url.username)
  if (!url.hostname || !database || !user) {
    throw new Error('PostgreSQL tool connection requires host, database and user.')
  }
  const sslMode = databaseConfig.sslMode ?? 'disable'
  if (!['disable', 'verify-full'].includes(sslMode)) {
    throw new Error('PostgreSQL tools support only disable or verify-full SSL modes.')
  }
  if (sslMode === 'verify-full' && !databaseConfig.sslCaPath) {
    throw new Error('PostgreSQL verify-full tools require a CA certificate path.')
  }

  const environment = {}
  for (const name of [
    'PATH',
    'Path',
    'SystemRoot',
    'SYSTEMROOT',
    'WINDIR',
    'TEMP',
    'TMP',
    'TMPDIR',
    'HOME',
    'USERPROFILE',
    'LANG',
    'LC_ALL',
    'LD_LIBRARY_PATH',
  ]) {
    if (baseEnv[name] !== undefined) environment[name] = baseEnv[name]
  }
  Object.assign(environment, {
    PGHOST: url.hostname,
    PGPORT: url.port || '5432',
    PGDATABASE: database,
    PGUSER: user,
    PGPASSWORD: decodeURIComponent(url.password),
    PGAPPNAME: (databaseConfig.applicationName ?? 'ptit-politics') + '-pg-tool',
    PGCONNECT_TIMEOUT: String(
      Math.max(1, Math.ceil(Number(databaseConfig.connectionTimeoutMs ?? 5000) / 1000)),
    ),
    PGSSLMODE: sslMode,
  })
  if (sslMode === 'verify-full') environment.PGSSLROOTCERT = resolve(databaseConfig.sslCaPath)
  else delete environment.PGSSLROOTCERT
  return Object.freeze(environment)
}

export function createPgDumpArgs(archivePath) {
  if (!archivePath) throw new Error('pg_dump archive path is required.')
  return Object.freeze([
    '--format=custom',
    '--compress=9',
    '--no-owner',
    '--no-privileges',
    '--file',
    archivePath,
  ])
}

export function createPgRestoreArgs(archivePath, database) {
  if (!archivePath || !database) throw new Error('pg_restore archive and database are required.')
  return Object.freeze([
    '--dbname',
    database,
    '--clean',
    '--if-exists',
    '--single-transaction',
    '--exit-on-error',
    '--no-owner',
    '--no-privileges',
    archivePath,
  ])
}

export function runPgTool(executable, args, { env, execFileImpl = execFile } = {}) {
  if (!executable || !Array.isArray(args)) throw new Error('PostgreSQL tool and args are required.')
  return new Promise((resolveRun, rejectRun) => {
    execFileImpl(
      executable,
      args,
      { env, windowsHide: true, maxBuffer: 4 * 1024 * 1024 },
      (error, stdout = '', stderr = '') => {
        if (error) {
          const detail = String(stderr).trim()
          rejectRun(
            new Error(executable + ' failed' + (detail ? ': ' + detail : '.'), { cause: error }),
          )
          return
        }
        resolveRun(Object.freeze({ stdout: String(stdout), stderr: String(stderr) }))
      },
    )
  })
}

export async function hashFileSha256(path) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest('hex')
}

export async function readVerifiedBackupManifest(archivePath) {
  const manifestPath = archivePath + '.manifest.json'
  let manifest
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  } catch (error) {
    throw new Error('Backup manifest is missing or invalid: ' + manifestPath + '.', {
      cause: error,
    })
  }
  const archiveInfo = await stat(archivePath)
  const checksum = await hashFileSha256(archivePath)
  if (
    manifest?.formatVersion !== '1' ||
    manifest.archive !== basename(archivePath) ||
    manifest.bytes !== archiveInfo.size ||
    manifest.sha256 !== checksum
  ) {
    throw new Error('Backup archive does not match its manifest.')
  }
  return Object.freeze({ manifest: Object.freeze(manifest), manifestPath, checksum })
}
