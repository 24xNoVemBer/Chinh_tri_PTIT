import { createHash } from 'node:crypto'
import { isIP } from 'node:net'

export const DEFAULT_AUTH_RATE_LIMIT_CONFIG = Object.freeze({
  enabled: true,
  trustProxy: false,
  windowMs: 15 * 60 * 1000,
  blockMs: 15 * 60 * 1000,
  accountMax: 20,
  sourceAccountMax: 5,
  cleanupIntervalMs: 5 * 60 * 1000,
})

function normalizeAddress(value) {
  const candidate = String(value ?? '').trim()
  if (!candidate) return null
  const withoutMappedPrefix = candidate.startsWith('::ffff:') ? candidate.slice(7) : candidate
  return isIP(withoutMappedPrefix) ? withoutMappedPrefix.toLowerCase() : null
}

function requestHeader(request, name) {
  const value = request.headers?.[name] ?? request.headers?.get?.(name)
  return Array.isArray(value) ? value[0] : value
}

export function getRequestClientAddress(request, { trustProxy = false } = {}) {
  if (trustProxy) {
    const forwardedAddress = String(requestHeader(request, 'x-forwarded-for') ?? '')
      .split(',')
      .map(normalizeAddress)
      .find(Boolean)
    if (forwardedAddress) return forwardedAddress
  }

  return normalizeAddress(request.socket?.remoteAddress) ?? 'unknown'
}

function opaqueScopeKey(scope, value) {
  return `${scope}:${createHash('sha256').update(value).digest('hex')}`
}

function assertConfig(config) {
  for (const field of [
    'windowMs',
    'blockMs',
    'accountMax',
    'sourceAccountMax',
    'cleanupIntervalMs',
  ]) {
    if (!Number.isInteger(config[field]) || config[field] < 1) {
      throw new Error(`Auth rate-limit ${field} must be a positive integer.`)
    }
  }
}

export class LoginRateLimiter {
  #db
  #config
  #clock
  #nextCleanupAt = 0
  #cleanupPromise = null

  constructor({ db, config = DEFAULT_AUTH_RATE_LIMIT_CONFIG, clock = Date.now } = {}) {
    if (!db || typeof db.one !== 'function' || typeof db.execute !== 'function') {
      throw new Error('LoginRateLimiter requires a database query client.')
    }
    this.#config = { ...DEFAULT_AUTH_RATE_LIMIT_CONFIG, ...config }
    assertConfig(this.#config)
    this.#db = db
    this.#clock = clock
  }

  get enabled() {
    return this.#config.enabled
  }

  clientAddress(request) {
    return getRequestClientAddress(request, { trustProxy: this.#config.trustProxy })
  }

  scopeKeys(email, clientAddress) {
    const normalizedEmail = String(email).trim().toLowerCase()
    return {
      sourceAccount: opaqueScopeKey('source-account', `${clientAddress}\0${normalizedEmail}`),
      account: opaqueScopeKey('account', normalizedEmail),
    }
  }

  async consume(email, clientAddress) {
    if (!this.enabled) return { allowed: true, remaining: null }

    const nowMs = Number(this.#clock())
    const keys = this.scopeKeys(email, clientAddress)
    await this.#maybeCleanup(nowMs)

    const sourceAccount = await this.#reserve(
      keys.sourceAccount,
      this.#config.sourceAccountMax,
      nowMs,
    )
    if (!sourceAccount.allowed) return sourceAccount

    const account = await this.#reserve(keys.account, this.#config.accountMax, nowMs)
    if (!account.allowed) return account

    return {
      allowed: true,
      limit: Math.min(sourceAccount.limit, account.limit),
      remaining: Math.min(sourceAccount.remaining, account.remaining),
      windowMs: this.#config.windowMs,
    }
  }

  async reset(email, clientAddress) {
    if (!this.enabled) return
    const keys = this.scopeKeys(email, clientAddress)
    await this.#db.execute('DELETE FROM auth_login_limits WHERE scope_key IN (?, ?)', [
      keys.sourceAccount,
      keys.account,
    ])
  }

  async #reserve(scopeKey, limit, nowMs) {
    const now = new Date(nowMs).toISOString()
    const expiredWindowCutoff = new Date(nowMs - this.#config.windowMs).toISOString()
    const blockUntil = new Date(nowMs + this.#config.blockMs).toISOString()
    const row = await this.#db.one(
      `INSERT INTO auth_login_limits (
         scope_key, attempt_count, window_started_at, blocked_until, updated_at
       ) VALUES (?, 1, ?, NULL, ?)
       ON CONFLICT (scope_key) DO UPDATE SET
         attempt_count = CASE
           WHEN auth_login_limits.window_started_at <= ? THEN 1
           ELSE auth_login_limits.attempt_count + 1
         END,
         window_started_at = CASE
           WHEN auth_login_limits.window_started_at <= ? THEN excluded.window_started_at
           ELSE auth_login_limits.window_started_at
         END,
         blocked_until = CASE
           WHEN auth_login_limits.blocked_until > ? THEN auth_login_limits.blocked_until
           WHEN auth_login_limits.window_started_at <= ? THEN NULL
           WHEN auth_login_limits.attempt_count + 1 > ? THEN ?
           ELSE NULL
         END,
         updated_at = excluded.updated_at
       RETURNING attempt_count, blocked_until`,
      [
        scopeKey,
        now,
        now,
        expiredWindowCutoff,
        expiredWindowCutoff,
        now,
        expiredWindowCutoff,
        limit,
        blockUntil,
      ],
    )

    const blockedUntilMs = row.blocked_until ? Date.parse(row.blocked_until) : 0
    const allowed = Number(row.attempt_count) <= limit && blockedUntilMs <= nowMs
    return {
      allowed,
      limit,
      remaining: Math.max(0, limit - Number(row.attempt_count)),
      retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil((blockedUntilMs - nowMs) / 1000)),
      resetAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil((blockedUntilMs - nowMs) / 1000)),
      windowMs: this.#config.windowMs,
    }
  }

  async #maybeCleanup(nowMs) {
    if (nowMs < this.#nextCleanupAt) return
    if (this.#cleanupPromise) return this.#cleanupPromise

    this.#nextCleanupAt = nowMs + this.#config.cleanupIntervalMs
    const retentionMs = Math.max(this.#config.windowMs, this.#config.blockMs) * 2
    const staleBefore = new Date(nowMs - retentionMs).toISOString()
    const now = new Date(nowMs).toISOString()
    this.#cleanupPromise = Promise.resolve(
      this.#db.execute(
        `DELETE FROM auth_login_limits
         WHERE updated_at <= ?
           AND (blocked_until IS NULL OR blocked_until <= ?)`,
        [staleBefore, now],
      ),
    ).finally(() => {
      this.#cleanupPromise = null
    })
    return this.#cleanupPromise
  }
}

export function createLoginRateLimiter(options) {
  return new LoginRateLimiter(options)
}

export function loginRateLimitHeaders(result) {
  const retryAfter = Math.max(1, Number(result.retryAfterSeconds) || 1)
  const windowSeconds = Math.max(1, Math.ceil(Number(result.windowMs) / 1000))
  return {
    'Retry-After': String(retryAfter),
    'RateLimit-Limit': String(result.limit),
    'RateLimit-Remaining': '0',
    'RateLimit-Reset': String(retryAfter),
    'RateLimit-Policy': `${result.limit};w=${windowSeconds}`,
  }
}
