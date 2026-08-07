// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { resolveConfirmedPostgresTarget, verifyConnectedPostgresTarget } from './targetSafety.js'

const confirmedEnv = {
  DATABASE_CONFIRM_HOST: 'db.staging.ptit.test:5432',
  DATABASE_CONFIRM_NAME: 'ptit_politics_staging',
  DATABASE_CONFIRM_USER: 'ptit_app',
}

describe('PostgreSQL administrative target safety', () => {
  it('requires exact host, database and user confirmations', () => {
    const target = resolveConfirmedPostgresTarget(
      'postgres://ptit_app:secret@db.staging.ptit.test:5432/ptit_politics_staging',
      confirmedEnv,
      { operation: 'staging migration' },
    )
    expect(target).toMatchObject({
      host: 'db.staging.ptit.test:5432',
      database: 'ptit_politics_staging',
      user: 'ptit_app',
      operation: 'staging migration',
      productionLike: false,
    })
  })

  it.each([
    ['DATABASE_CONFIRM_HOST', 'other.ptit.test:5432', 'host'],
    ['DATABASE_CONFIRM_NAME', 'other_database', 'database'],
    ['DATABASE_CONFIRM_USER', 'other_user', 'user'],
  ])('rejects a mismatched %s', (name, value, mismatch) => {
    expect(() =>
      resolveConfirmedPostgresTarget(
        'postgres://ptit_app:secret@db.staging.ptit.test:5432/ptit_politics_staging',
        { ...confirmedEnv, [name]: value },
      ),
    ).toThrow('mismatch for ' + mismatch)
  })

  it('rejects missing confirmations, non-PostgreSQL URLs and system databases', () => {
    expect(() =>
      resolveConfirmedPostgresTarget(
        'postgres://ptit_app:secret@db.staging.ptit.test:5432/ptit_politics_staging',
        {},
      ),
    ).toThrow('DATABASE_CONFIRM_NAME is required')
    expect(() => resolveConfirmedPostgresTarget('https://example.test/db', confirmedEnv)).toThrow(
      'must use postgres:// or postgresql://',
    )
    expect(() =>
      resolveConfirmedPostgresTarget('postgres://postgres@localhost:5432/postgres', {
        DATABASE_CONFIRM_HOST: 'localhost:5432',
        DATABASE_CONFIRM_NAME: 'postgres',
        DATABASE_CONFIRM_USER: 'postgres',
      }),
    ).toThrow('must not target PostgreSQL system database')
  })

  it('rejects query parameters that can override the confirmed identity', () => {
    expect(() =>
      resolveConfirmedPostgresTarget(
        'postgres://ptit_app:secret@db.staging.ptit.test:5432/ptit_politics_staging?host=other.ptit.test',
        confirmedEnv,
      ),
    ).toThrow('must not override target identity through query parameters: host')
  })
  it('requires a break-glass confirmation for production-like targets', () => {
    const url = 'postgres://ptit_app:secret@db.prod.ptit.test:5432/ptit_politics_prod'
    const env = {
      DATABASE_CONFIRM_HOST: 'db.prod.ptit.test:5432',
      DATABASE_CONFIRM_NAME: 'ptit_politics_prod',
      DATABASE_CONFIRM_USER: 'ptit_app',
    }
    expect(() => resolveConfirmedPostgresTarget(url, env)).toThrow(
      'Production-like PostgreSQL target blocked',
    )
    expect(
      resolveConfirmedPostgresTarget(url, {
        ...env,
        DATABASE_ALLOW_PRODUCTION_ADMIN: 'true',
      }).productionLike,
    ).toBe(true)
  })

  it('verifies the identity reported by the connected server', async () => {
    const client = {
      one: vi.fn().mockResolvedValue({
        database: 'ptit_politics_staging',
        user: 'ptit_app',
        server_addr: '10.20.30.40',
        server_port: 5432,
      }),
    }
    const info = await verifyConnectedPostgresTarget(client, {
      database: 'ptit_politics_staging',
      user: 'ptit_app',
    })
    expect(info).toEqual({
      database: 'ptit_politics_staging',
      user: 'ptit_app',
      serverAddress: '10.20.30.40',
      serverPort: 5432,
    })
    await expect(
      verifyConnectedPostgresTarget(client, {
        database: 'other_database',
        user: 'ptit_app',
      }),
    ).rejects.toThrow('identity mismatch for database')
  })
})
