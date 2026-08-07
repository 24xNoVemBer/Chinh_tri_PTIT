// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { DATA_TABLE_ORDER, POSTGRES_PUBLIC_TABLES } from './applicationSchema.js'
import {
  assertPostgresImportTargetReady,
  inspectConnectedPostgresTls,
  inspectPostgresApplicationSchema,
  resolveConfirmedPostgresTarget,
  verifyConnectedPostgresTarget,
} from './targetSafety.js'

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

  it('reports connection TLS and fails closed when encryption is required', async () => {
    const encrypted = {
      one: vi.fn().mockResolvedValue({
        ssl: true,
        version: 'TLSv1.3',
        cipher: 'TLS_AES_256_GCM_SHA384',
        bits: 256,
      }),
    }
    await expect(inspectConnectedPostgresTls(encrypted, { required: true })).resolves.toEqual({
      enabled: true,
      version: 'TLSv1.3',
      cipher: 'TLS_AES_256_GCM_SHA384',
      bits: 256,
    })
    await expect(
      inspectConnectedPostgresTls(
        { one: vi.fn().mockResolvedValue({ ssl: false }) },
        { required: true },
      ),
    ).rejects.toThrow('not using TLS')
  })

  it('requires the exact dedicated application schema before import', async () => {
    const rows = POSTGRES_PUBLIC_TABLES.map((table_name) => ({ table_name }))
    const client = {
      many: vi.fn().mockResolvedValue(rows),
      one: vi.fn().mockResolvedValue({ count: 0 }),
    }

    await expect(inspectPostgresApplicationSchema(client)).resolves.toEqual({
      tableCount: POSTGRES_PUBLIC_TABLES.length,
      tables: [...POSTGRES_PUBLIC_TABLES].sort(),
    })
    await expect(assertPostgresImportTargetReady(client)).resolves.toMatchObject({
      tableCount: POSTGRES_PUBLIC_TABLES.length,
      requireEmpty: true,
      occupied: [],
    })
    expect(client.one).toHaveBeenCalledTimes(DATA_TABLE_ORDER.length - 1)
  })

  it('rejects incomplete, shared or occupied import targets during read-only preflight', async () => {
    const completeRows = POSTGRES_PUBLIC_TABLES.map((table_name) => ({ table_name }))

    await expect(
      inspectPostgresApplicationSchema({
        many: vi
          .fn()
          .mockResolvedValue(completeRows.filter((row) => row.table_name !== 'questions')),
      }),
    ).rejects.toThrow('missing=questions')

    await expect(
      inspectPostgresApplicationSchema({
        many: vi.fn().mockResolvedValue([...completeRows, { table_name: 'other_application' }]),
      }),
    ).rejects.toThrow('unexpected=other_application')

    const occupiedClient = {
      many: vi.fn().mockResolvedValue(completeRows),
      one: vi.fn(async (sql) => ({ count: sql.includes('"subjects"') ? 5 : 0 })),
    }
    await expect(assertPostgresImportTargetReady(occupiedClient)).rejects.toThrow('subjects=5')
  })

  it('can skip only the empty-data check after an explicit break-glass decision', async () => {
    const client = {
      many: vi.fn().mockResolvedValue(POSTGRES_PUBLIC_TABLES.map((table_name) => ({ table_name }))),
      one: vi.fn(),
    }

    await expect(
      assertPostgresImportTargetReady(client, { requireEmpty: false }),
    ).resolves.toMatchObject({ requireEmpty: false, occupied: [] })
    expect(client.one).not.toHaveBeenCalled()
  })
})
