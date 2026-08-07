// @vitest-environment node
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createPgDumpArgs,
  createPgRestoreArgs,
  createPgToolEnvironment,
  hashFileSha256,
  readVerifiedBackupManifest,
  resolveBackupArtifactPath,
  runPgTool,
} from './pgTools.js'

let temporaryDirectory

afterEach(async () => {
  if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true })
  temporaryDirectory = undefined
})

describe('PostgreSQL backup tools', () => {
  it('keeps archives inside the explicit backup root', async () => {
    temporaryDirectory = await mkdtemp(join(tmpdir(), 'ptit-pg-tools-'))
    expect(
      resolveBackupArtifactPath(join(temporaryDirectory, 'staging.dump'), {
        backupRoot: temporaryDirectory,
      }),
    ).toBe(resolve(temporaryDirectory, 'staging.dump'))
    expect(() =>
      resolveBackupArtifactPath(join(temporaryDirectory, '..', 'outside.dump'), {
        backupRoot: temporaryDirectory,
      }),
    ).toThrow('must be a file inside')
    expect(() =>
      resolveBackupArtifactPath(join(temporaryDirectory, 'staging.sql'), {
        backupRoot: temporaryDirectory,
      }),
    ).toThrow('.dump extension')
  })

  it('passes credentials through libpq environment instead of tool arguments', () => {
    const environment = createPgToolEnvironment(
      {
        url: 'postgres://ptit_app:encoded%20secret@db.ptit.test:5433/ptit_restore',
        sslMode: 'verify-full',
        sslCaPath: 'config/secrets/ca.pem',
        connectionTimeoutMs: 4500,
        applicationName: 'ptit-staging',
      },
      { PATH: 'test-path', RAG_SERVICE_TOKEN: 'must-not-leak' },
    )
    expect(environment).toMatchObject({
      PGHOST: 'db.ptit.test',
      PGPORT: '5433',
      PGDATABASE: 'ptit_restore',
      PGUSER: 'ptit_app',
      PGPASSWORD: 'encoded secret',
      PGSSLMODE: 'verify-full',
      PGCONNECT_TIMEOUT: '5',
      PATH: 'test-path',
    })
    expect(environment.PGSSLROOTCERT).toBe(resolve('config/secrets/ca.pem'))
    expect(environment.RAG_SERVICE_TOKEN).toBeUndefined()
  })

  it('builds custom backup and atomic clean-restore arguments without credentials', () => {
    expect(createPgDumpArgs('backup.dump')).toEqual([
      '--format=custom',
      '--compress=9',
      '--no-owner',
      '--no-privileges',
      '--file',
      'backup.dump',
    ])
    expect(createPgRestoreArgs('backup.dump', 'ptit_restore_drill')).toEqual([
      '--dbname',
      'ptit_restore_drill',
      '--clean',
      '--if-exists',
      '--single-transaction',
      '--exit-on-error',
      '--no-owner',
      '--no-privileges',
      'backup.dump',
    ])
    expect(createPgRestoreArgs('backup.dump', 'ptit_restore_drill').join(' ')).not.toContain(
      'password',
    )
  })

  it('executes without a shell and surfaces stderr without exposing the environment', async () => {
    const execFileImpl = vi.fn((_command, _args, options, callback) => {
      expect(options).toMatchObject({ windowsHide: true })
      callback(null, 'archive ok', '')
    })
    await expect(
      runPgTool('pg_restore', ['--list', 'archive.dump'], {
        env: { PGPASSWORD: 'not-logged' },
        execFileImpl,
      }),
    ).resolves.toEqual({ stdout: 'archive ok', stderr: '' })
    expect(execFileImpl.mock.calls[0][1]).not.toContain('not-logged')
  })

  it('verifies archive checksum, size and filename against the sidecar manifest', async () => {
    temporaryDirectory = await mkdtemp(join(tmpdir(), 'ptit-pg-tools-'))
    const archivePath = join(temporaryDirectory, 'staging.dump')
    await writeFile(archivePath, 'archive-content')
    const sha256 = await hashFileSha256(archivePath)
    await writeFile(
      archivePath + '.manifest.json',
      JSON.stringify({
        formatVersion: '1',
        archive: 'staging.dump',
        bytes: 15,
        sha256,
      }),
    )
    await expect(readVerifiedBackupManifest(archivePath)).resolves.toMatchObject({
      checksum: sha256,
    })

    await writeFile(archivePath, 'tampered-content')
    await expect(readVerifiedBackupManifest(archivePath)).rejects.toThrow(
      'does not match its manifest',
    )
  })
})
