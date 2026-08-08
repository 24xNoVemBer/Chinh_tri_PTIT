// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApiServer } from './app.js'
import { createDatabase } from './database.js'

describe('login rate-limit HTTP boundary', () => {
  let baseUrl
  let db
  let server

  beforeEach(async () => {
    db = createDatabase({ databasePath: ':memory:' })
    server = createApiServer({
      db,
      logger: { error() {} },
      authConfig: {
        enabled: true,
        trustProxy: true,
        windowMs: 60_000,
        blockMs: 60_000,
        accountMax: 3,
        sourceAccountMax: 2,
        cleanupIntervalMs: 60_000,
      },
    })
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    baseUrl = `http://127.0.0.1:${server.address().port}`
  })

  afterEach(async () => {
    await new Promise((resolve) => server.close(resolve))
    db.close()
  })

  function login(password, address = '198.51.100.20') {
    return fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': address,
      },
      body: JSON.stringify({ email: 'tuananh@ptit.edu.vn', password }),
    })
  }

  it('returns stable 429 semantics and retry headers after repeated failures', async () => {
    expect((await login('wrong-1')).status).toBe(401)
    expect((await login('wrong-2')).status).toBe(401)

    const response = await login('Student@123')
    expect(response.status).toBe(429)
    expect(response.headers.get('retry-after')).toBe('60')
    expect(response.headers.get('ratelimit-limit')).toBe('2')
    expect(response.headers.get('ratelimit-remaining')).toBe('0')
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'AUTH_RATE_LIMITED',
        message: 'Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau.',
        retryable: true,
      },
    })
  })

  it('resets the attempt budget after valid credentials', async () => {
    expect((await login('wrong')).status).toBe(401)
    expect((await login('Student@123')).status).toBe(200)
    expect((await login('wrong-again')).status).toBe(401)
    expect((await login('Student@123')).status).toBe(200)
  })
})
