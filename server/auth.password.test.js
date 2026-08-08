// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { hashPassword, verifyPasswordAsync } from './auth.js'

describe('async password verification', () => {
  it('keeps compatibility with the existing scrypt hash format', async () => {
    const storedHash = hashPassword('mat-khau-hop-le', 'fixed-test-salt')

    await expect(verifyPasswordAsync('mat-khau-hop-le', storedHash)).resolves.toBe(true)
    await expect(verifyPasswordAsync('mat-khau-sai', storedHash)).resolves.toBe(false)
  })

  it.each([
    null,
    '',
    'pbkdf2$salt$hash',
    'scrypt$$00',
    'scrypt$salt',
    'scrypt$salt$not-hex',
    `scrypt$salt$${'00'.repeat(63)}`,
    `scrypt$salt$${'00'.repeat(65)}`,
    `scrypt$${'s'.repeat(257)}$${'00'.repeat(64)}`,
  ])('rejects a malformed hash without starting key derivation: %s', async (storedHash) => {
    const deriveKey = vi.fn()

    await expect(verifyPasswordAsync('password', storedHash, { deriveKey })).resolves.toBe(false)
    expect(deriveKey).not.toHaveBeenCalled()
  })

  it('awaits asynchronous key derivation instead of doing request-path work synchronously', async () => {
    const expectedKey = Buffer.alloc(64, 42)
    const storedHash = `scrypt$test-salt$${expectedKey.toString('hex')}`
    let releaseDerivation
    const deriveKey = vi.fn(
      () =>
        new Promise((resolve) => {
          releaseDerivation = () => resolve(expectedKey)
        }),
    )

    let settled = false
    const verification = verifyPasswordAsync('password', storedHash, { deriveKey }).finally(() => {
      settled = true
    })

    await Promise.resolve()
    expect(deriveKey).toHaveBeenCalledWith('password', 'test-salt', 64)
    expect(settled).toBe(false)

    releaseDerivation()
    await expect(verification).resolves.toBe(true)
  })

  it('allows concurrent verification requests to wait independently', async () => {
    const expectedKey = Buffer.alloc(64, 7)
    const storedHash = `scrypt$concurrent-salt$${expectedKey.toString('hex')}`
    const releases = []
    const deriveKey = vi.fn(
      () =>
        new Promise((resolve) => {
          releases.push(() => resolve(expectedKey))
        }),
    )

    const verifications = Array.from({ length: 8 }, () =>
      verifyPasswordAsync('password', storedHash, { deriveKey }),
    )
    await Promise.resolve()

    expect(deriveKey).toHaveBeenCalledTimes(8)
    releases.forEach((release) => release())
    await expect(Promise.all(verifications)).resolves.toEqual(Array(8).fill(true))
  })
})
