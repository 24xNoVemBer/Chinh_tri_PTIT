// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  createLoginRateLimiter,
  getRequestClientAddress,
  loginRateLimitHeaders,
} from './authRateLimit.js'
import { createDatabase } from './database.js'

const TEST_CONFIG = Object.freeze({
  enabled: true,
  trustProxy: false,
  windowMs: 1_000,
  blockMs: 1_000,
  accountMax: 3,
  sourceAccountMax: 2,
  cleanupIntervalMs: 1_000,
})

function withDatabase(run) {
  const db = createDatabase({ databasePath: ':memory:' })
  return Promise.resolve(run(db)).finally(() => db.close())
}

describe('login rate limiter', () => {
  it('blocks an account and source pair after the configured attempt budget', () =>
    withDatabase(async (db) => {
      const limiter = createLoginRateLimiter({ db, config: TEST_CONFIG, clock: () => 10_000 })

      await expect(limiter.consume('student@ptit.edu.vn', '192.0.2.10')).resolves.toMatchObject({
        allowed: true,
        remaining: 1,
      })
      await expect(limiter.consume('student@ptit.edu.vn', '192.0.2.10')).resolves.toMatchObject({
        allowed: true,
        remaining: 0,
      })
      const blocked = await limiter.consume('student@ptit.edu.vn', '192.0.2.10')
      expect(blocked).toMatchObject({
        allowed: false,
        limit: 2,
        remaining: 0,
        retryAfterSeconds: 1,
      })
      expect(loginRateLimitHeaders(blocked)).toEqual({
        'Retry-After': '1',
        'RateLimit-Limit': '2',
        'RateLimit-Remaining': '0',
        'RateLimit-Reset': '1',
        'RateLimit-Policy': '2;w=1',
      })
    }))

  it('shares account limits across limiter instances and source addresses', () =>
    withDatabase(async (db) => {
      const config = { ...TEST_CONFIG, accountMax: 2, sourceAccountMax: 5 }
      const firstInstance = createLoginRateLimiter({ db, config, clock: () => 20_000 })
      const secondInstance = createLoginRateLimiter({ db, config, clock: () => 20_000 })

      await expect(firstInstance.consume('shared@ptit.edu.vn', '192.0.2.1')).resolves.toMatchObject(
        {
          allowed: true,
        },
      )
      await expect(
        secondInstance.consume('shared@ptit.edu.vn', '192.0.2.2'),
      ).resolves.toMatchObject({
        allowed: true,
      })
      await expect(firstInstance.consume('shared@ptit.edu.vn', '192.0.2.3')).resolves.toMatchObject(
        {
          allowed: false,
          limit: 2,
        },
      )
    }))

  it('atomically caps concurrent reservations against the shared account scope', () =>
    withDatabase(async (db) => {
      const limiter = createLoginRateLimiter({
        db,
        config: { ...TEST_CONFIG, accountMax: 3, sourceAccountMax: 10 },
        clock: () => 25_000,
      })

      const results = await Promise.all(
        Array.from({ length: 10 }, (_, index) =>
          limiter.consume('concurrent@ptit.edu.vn', `192.0.2.${index + 1}`),
        ),
      )

      expect(results.filter(({ allowed }) => allowed)).toHaveLength(3)
      expect(results.filter(({ allowed }) => !allowed)).toHaveLength(7)
    }))

  it('clears both scopes after a successful authentication', () =>
    withDatabase(async (db) => {
      const limiter = createLoginRateLimiter({ db, config: TEST_CONFIG, clock: () => 30_000 })
      const email = 'success@ptit.edu.vn'
      const address = '192.0.2.20'

      await limiter.consume(email, address)
      await limiter.consume(email, address)
      await limiter.reset(email, address)

      await expect(limiter.consume(email, address)).resolves.toMatchObject({
        allowed: true,
        remaining: 1,
      })
      expect(db.one('SELECT COUNT(*) AS count FROM auth_login_limits').count).toBe(2)
    }))

  it('starts a new attempt window after the previous block expires', () =>
    withDatabase(async (db) => {
      let now = 40_000
      const limiter = createLoginRateLimiter({
        db,
        config: { ...TEST_CONFIG, accountMax: 1, sourceAccountMax: 1 },
        clock: () => now,
      })

      await limiter.consume('window@ptit.edu.vn', '192.0.2.30')
      await expect(limiter.consume('window@ptit.edu.vn', '192.0.2.30')).resolves.toMatchObject({
        allowed: false,
      })

      now += 1_001
      await expect(limiter.consume('window@ptit.edu.vn', '192.0.2.30')).resolves.toMatchObject({
        allowed: true,
      })
    }))

  it('stores only opaque scope keys instead of raw email or address', () =>
    withDatabase(async (db) => {
      const limiter = createLoginRateLimiter({ db, config: TEST_CONFIG, clock: () => 50_000 })
      await limiter.consume('private@ptit.edu.vn', '192.0.2.40')

      const rows = db.many('SELECT scope_key FROM auth_login_limits')
      expect(rows).toHaveLength(2)
      expect(rows.every(({ scope_key }) => /^[a-z-]+:[a-f0-9]{64}$/.test(scope_key))).toBe(true)
      expect(JSON.stringify(rows)).not.toContain('private@ptit.edu.vn')
      expect(JSON.stringify(rows)).not.toContain('192.0.2.40')
    }))

  it('removes stale, unblocked rows during periodic cleanup', () =>
    withDatabase(async (db) => {
      db.execute(
        `INSERT INTO auth_login_limits
         (scope_key, attempt_count, window_started_at, blocked_until, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
        ['stale:key', 1, '1970-01-01T00:00:00.000Z', null, '1970-01-01T00:00:00.000Z'],
      )
      const limiter = createLoginRateLimiter({ db, config: TEST_CONFIG, clock: () => 100_000 })

      await limiter.consume('cleanup@ptit.edu.vn', '192.0.2.50')

      expect(
        db.one('SELECT scope_key FROM auth_login_limits WHERE scope_key = ?', ['stale:key']),
      ).toBeUndefined()
    }))
})

describe('request client address', () => {
  const request = {
    headers: { 'x-forwarded-for': '198.51.100.7, 10.0.0.1' },
    socket: { remoteAddress: '::ffff:127.0.0.1' },
  }

  it('ignores forwarded addresses unless the deployment explicitly trusts its proxy', () => {
    expect(getRequestClientAddress(request)).toBe('127.0.0.1')
    expect(getRequestClientAddress(request, { trustProxy: true })).toBe('198.51.100.7')
  })

  it('falls back to the socket address when a forwarded value is invalid', () => {
    expect(
      getRequestClientAddress(
        {
          headers: { 'x-forwarded-for': 'not-an-ip' },
          socket: { remoteAddress: '2001:db8::1' },
        },
        { trustProxy: true },
      ),
    ).toBe('2001:db8::1')
  })
})
