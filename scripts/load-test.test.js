import { describe, expect, it } from 'vitest'
import { LOAD_PROFILES, parseOptions, resolveLoadTestConfig, summarize } from './load-test.mjs'

describe('load test configuration', () => {
  it('parses flags and option values', () => {
    expect(
      parseOptions([
        '--profile',
        'baseline',
        '--allow-high',
        '--confirm-host',
        'staging.example.ptit.edu.vn',
      ]),
    ).toEqual({
      profile: 'baseline',
      'allow-high': true,
      'confirm-host': 'staging.example.ptit.edu.vn',
    })
  })

  it('uses the bounded local smoke profile by default', () => {
    const config = resolveLoadTestConfig([], {})
    expect(config).toMatchObject({
      profile: 'smoke',
      sessions: LOAD_PROFILES.smoke.sessions,
      active: LOAD_PROFILES.smoke.active,
      concurrency: LOAD_PROFILES.smoke.concurrency,
      email: 'tuananh@ptit.edu.vn',
    })
  })

  it('keeps --users as a backwards-compatible sessions alias', () => {
    const config = resolveLoadTestConfig(['--users', '20', '--active', '8'], {})
    expect(config.sessions).toBe(20)
    expect(config.active).toBe(8)
  })

  it('requires a clean HTTPS origin for remote targets', () => {
    expect(() =>
      resolveLoadTestConfig([], {
        LOAD_TEST_BASE_URL: 'http://staging.ptit.test',
        LOAD_TEST_EMAIL: 'student@ptit.edu.vn',
        LOAD_TEST_PASSWORD: 'secret',
      }),
    ).toThrow('Remote load test targets must use HTTPS.')

    expect(() =>
      resolveLoadTestConfig([], {
        LOAD_TEST_BASE_URL: 'https://user:secret@staging.ptit.test/api',
        LOAD_TEST_EMAIL: 'student@ptit.edu.vn',
        LOAD_TEST_PASSWORD: 'secret',
      }),
    ).toThrow('must be an origin without credentials')
  })

  it('rejects remote passwords supplied on the command line', () => {
    expect(() =>
      resolveLoadTestConfig(
        [
          '--base-url',
          'https://staging.ptit.test',
          '--email',
          'student@ptit.edu.vn',
          '--password',
          'visible-secret',
        ],
        {},
      ),
    ).toThrow('Do not pass a remote load-test password on the command line')
  })
  it('blocks high-load profiles without two explicit staging confirmations', () => {
    expect(() => resolveLoadTestConfig(['--profile', 'baseline'], {})).toThrow(
      'High-load run blocked',
    )
  })

  it('accepts a confirmed high-load staging profile without exposing defaults', () => {
    const config = resolveLoadTestConfig(
      ['--profile', 'baseline', '--allow-high', '--confirm-host', 'staging.ptit.test'],
      {
        LOAD_TEST_BASE_URL: 'https://staging.ptit.test',
        LOAD_TEST_EMAIL: 'load-student@ptit.edu.vn',
        LOAD_TEST_PASSWORD: 'secret-from-env',
      },
    )
    expect(config).toMatchObject({
      sessions: 1000,
      active: 150,
      targetHost: 'staging.ptit.test',
      email: 'load-student@ptit.edu.vn',
    })
  })

  it('rejects more active users than created sessions', () => {
    expect(() => resolveLoadTestConfig(['--sessions', '10', '--active', '11'], {})).toThrow(
      '--active must be an integer between 0 and 10.',
    )
  })
})

describe('load test statistics', () => {
  it('summarizes latency percentiles deterministically', () => {
    expect(summarize([10, 20, 30, 40, 50])).toEqual({
      count: 5,
      min: 10,
      p50: 30,
      p95: 50,
      p99: 50,
      max: 50,
    })
    expect(summarize([])).toEqual({ count: 0 })
  })
})
