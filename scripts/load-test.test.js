import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  loadCredentialPool,
  LOAD_PROFILES,
  parseOptions,
  resolveLoadTestConfig,
  summarize,
} from './load-test.mjs'

let temporaryDirectory

afterEach(async () => {
  if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true })
  temporaryDirectory = undefined
})

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

  it('rejects unknown, duplicate and positional CLI arguments', () => {
    expect(() => parseOptions(['--typo'])).toThrow('Unknown load-test option')
    expect(() => parseOptions(['baseline'])).toThrow('Unexpected positional argument')
    expect(() => parseOptions(['--profile', 'smoke', '--profile', 'baseline'])).toThrow(
      'Duplicate load-test option',
    )
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
        LOAD_TEST_CREDENTIALS_PATH: 'secrets/load-users.json',
        LOAD_TEST_CONFIRM_STAGING: 'true',
      },
    )
    expect(config).toMatchObject({
      sessions: 1000,
      active: 150,
      targetHost: 'staging.ptit.test',
      credentialsPath: 'secrets/load-users.json',
    })
  })

  it('requires a credential pool for high-load profiles', () => {
    expect(() =>
      resolveLoadTestConfig(
        ['--profile', 'baseline', '--allow-high', '--confirm-host', 'staging.ptit.test'],
        {
          LOAD_TEST_BASE_URL: 'https://staging.ptit.test',
          LOAD_TEST_EMAIL: 'load-student@ptit.edu.vn',
          LOAD_TEST_PASSWORD: 'secret-from-env',
          LOAD_TEST_CONFIRM_STAGING: 'true',
        },
      ),
    ).toThrow('High-load profiles require LOAD_TEST_CREDENTIALS_PATH')
  })

  it('calculates and enforces the projected workload request budget', () => {
    const config = resolveLoadTestConfig(['--sessions', '20', '--active', '8', '--rounds', '2'], {})
    expect(config.projectedRequests).toBe(100)
    expect(config.maxRequests).toBe(20_000)

    expect(() =>
      resolveLoadTestConfig(
        ['--sessions', '20', '--active', '8', '--rounds', '2', '--max-requests', '99'],
        {},
      ),
    ).toThrow('Projected workload of 100 requests exceeds')
  })

  it('rejects more active users than created sessions', () => {
    expect(() => resolveLoadTestConfig(['--sessions', '10', '--active', '11'], {})).toThrow(
      '--active must be an integer between 0 and 10.',
    )
  })
})

describe('load test credential pool', () => {
  it('loads distinct credentials from a secret file and enforces concurrent-user coverage', async () => {
    temporaryDirectory = await mkdtemp(join(tmpdir(), 'ptit-load-users-'))
    const credentialsPath = join(temporaryDirectory, 'credentials.json')
    const credentials = Array.from({ length: 3 }, (_, index) => ({
      email: `student-${index}@ptit.edu.vn`,
      password: `secret-${index}`,
    }))
    await writeFile(credentialsPath, JSON.stringify(credentials))

    await expect(
      loadCredentialPool({
        profile: 'baseline',
        sessions: 10,
        concurrency: 3,
        credentialsPath,
      }),
    ).resolves.toEqual(credentials)

    await expect(
      loadCredentialPool({
        profile: 'baseline',
        sessions: 10,
        concurrency: 4,
        credentialsPath,
      }),
    ).rejects.toThrow('requires at least 4 distinct credentials')
  })

  it('rejects duplicate accounts before sending load', async () => {
    await expect(
      loadCredentialPool({
        profile: 'smoke',
        sessions: 2,
        concurrency: 1,
        credentials: [
          { email: 'same@ptit.edu.vn', password: 'one' },
          { email: 'SAME@ptit.edu.vn', password: 'two' },
        ],
      }),
    ).rejects.toThrow('duplicate email addresses')
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
