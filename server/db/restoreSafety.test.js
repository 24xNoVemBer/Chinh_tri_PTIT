// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  assertDisposableRestoreTarget,
  createRestoreConfirmationEnvironment,
  createRestoreRuntimeEnvironment,
} from './restoreSafety.js'

describe('PostgreSQL restore drill safety', () => {
  it('maps only dedicated RESTORE_* connection and confirmation settings', () => {
    expect(
      createRestoreRuntimeEnvironment({
        DATABASE_URL: 'postgres://wrong/source',
        RESTORE_DATABASE_URL: 'postgres://restore/ptit_restore_drill',
        RESTORE_DATABASE_SSL_CA_PATH: 'secrets/restore-ca.pem',
      }),
    ).toMatchObject({
      NODE_ENV: 'production',
      DATABASE_DRIVER: 'postgres',
      DATABASE_URL: 'postgres://restore/ptit_restore_drill',
      DATABASE_SSL_MODE: 'verify-full',
      DATABASE_SSL_CA_PATH: 'secrets/restore-ca.pem',
    })
    expect(
      createRestoreConfirmationEnvironment({
        RESTORE_CONFIRM_HOST: 'restore.ptit.test:5432',
        RESTORE_CONFIRM_NAME: 'ptit_restore_drill',
        RESTORE_CONFIRM_USER: 'ptit_restore',
      }),
    ).toEqual({
      DATABASE_CONFIRM_HOST: 'restore.ptit.test:5432',
      DATABASE_CONFIRM_NAME: 'ptit_restore_drill',
      DATABASE_CONFIRM_USER: 'ptit_restore',
      DATABASE_ALLOW_PRODUCTION_ADMIN: 'false',
    })
  })

  it('requires two destructive confirmations and a disposable database name', () => {
    const source = { database: { database: 'ptit_politics_staging' } }
    const target = {
      database: 'ptit_restore_drill',
      host: 'restore.ptit.test:5432',
    }
    expect(() => assertDisposableRestoreTarget(source, target, {})).toThrow(
      'RESTORE_CONFIRM_DISPOSABLE=true',
    )
    expect(
      assertDisposableRestoreTarget(source, target, {
        RESTORE_CONFIRM_DISPOSABLE: 'true',
        RESTORE_CONFIRM_CLEAN: 'true',
      }),
    ).toEqual({
      sourceDatabase: 'ptit_politics_staging',
      targetDatabase: 'ptit_restore_drill',
      targetHost: 'restore.ptit.test:5432',
    })
    expect(() =>
      assertDisposableRestoreTarget(
        source,
        { ...target, database: 'ptit_politics_copy' },
        { RESTORE_CONFIRM_DISPOSABLE: 'true', RESTORE_CONFIRM_CLEAN: 'true' },
      ),
    ).toThrow('must identify a restore/drill/disposable target')
  })

  it('never permits restore into the source database name', () => {
    expect(() =>
      assertDisposableRestoreTarget(
        { database: { database: 'ptit_restore_drill' } },
        { database: 'ptit_restore_drill', host: 'other.ptit.test:5432' },
        { RESTORE_CONFIRM_DISPOSABLE: 'true', RESTORE_CONFIRM_CLEAN: 'true' },
      ),
    ).toThrow('must differ from the source')
  })
})
