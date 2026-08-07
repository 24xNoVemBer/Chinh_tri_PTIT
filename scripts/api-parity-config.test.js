import { describe, expect, it } from 'vitest'
import { resolveApiParityConfig } from './api-parity-config.mjs'

const credentials = {
  PARITY_STUDENT_EMAIL: 'student@ptit.edu.vn',
  PARITY_STUDENT_PASSWORD: 'student-secret',
  PARITY_LECTURER_EMAIL: 'lecturer@ptit.edu.vn',
  PARITY_LECTURER_PASSWORD: 'lecturer-secret',
}

describe('API parity configuration', () => {
  it('requires an explicit health-only mode when credentials are absent', () => {
    expect(() => resolveApiParityConfig([], {})).toThrow('PARITY_STUDENT_EMAIL is required')
    expect(resolveApiParityConfig(['--health-only'], {})).toMatchObject({
      healthOnly: true,
      writeEnabled: false,
      baseUrl: 'http://127.0.0.1:3001',
    })
  })

  it('uses a clean HTTPS origin and both role credentials for staging parity', () => {
    const config = resolveApiParityConfig([], {
      ...credentials,
      API_BASE_URL: 'https://staging.ptit.test',
    })
    expect(config).toMatchObject({
      baseUrl: 'https://staging.ptit.test',
      targetHost: 'staging.ptit.test',
      healthOnly: false,
      writeEnabled: false,
    })
    expect(() =>
      resolveApiParityConfig(['--health-only', '--base-url', 'http://staging.ptit.test'], {}),
    ).toThrow('Remote API parity targets must use HTTPS')
  })

  it('rejects unknown options and non-origin targets', () => {
    expect(() => resolveApiParityConfig(['--typo'], credentials)).toThrow('Unknown option')
    expect(() =>
      resolveApiParityConfig(['--base-url', 'https://staging.ptit.test/api'], credentials),
    ).toThrow('must be an origin without credentials')
  })

  it('requires disposable, write and exact-host confirmations together', () => {
    const args = ['--write', '--base-url', 'https://staging.ptit.test']
    expect(() => resolveApiParityConfig(args, credentials)).toThrow(
      'PARITY_CONFIRM_DISPOSABLE=true',
    )
    expect(
      resolveApiParityConfig(args, {
        ...credentials,
        PARITY_ALLOW_WRITES: 'true',
        PARITY_CONFIRM_DISPOSABLE: 'true',
        PARITY_CONFIRM_HOST: 'staging.ptit.test',
      }),
    ).toMatchObject({ writeEnabled: true, targetHost: 'staging.ptit.test' })
  })

  it('shows help without requiring secrets', () => {
    expect(resolveApiParityConfig(['--help'], {})).toMatchObject({ help: true })
  })
})
