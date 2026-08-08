#!/usr/bin/env node

import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const LOAD_PROFILES = Object.freeze({
  smoke: Object.freeze({
    sessions: 10,
    active: 5,
    rounds: 1,
    concurrency: 5,
    rampMs: 0,
    thinkTimeMs: 0,
  }),
  baseline: Object.freeze({
    sessions: 1000,
    active: 150,
    rounds: 3,
    concurrency: 100,
    rampMs: 30_000,
    thinkTimeMs: 250,
  }),
  'login-storm': Object.freeze({
    sessions: 300,
    active: 0,
    rounds: 0,
    concurrency: 150,
    rampMs: 5_000,
    thinkTimeMs: 0,
  }),
  'exam-peak': Object.freeze({
    sessions: 3000,
    active: 500,
    rounds: 5,
    concurrency: 200,
    rampMs: 60_000,
    thinkTimeMs: 250,
  }),
})

const READ_ROUTES = Object.freeze([
  Object.freeze({ name: 'me', path: '/api/auth/me' }),
  Object.freeze({ name: 'dashboard', path: '/api/student/dashboard' }),
  Object.freeze({ name: 'subjects', path: '/api/student/subjects' }),
  Object.freeze({ name: 'questions', path: '/api/student/questions' }),
  Object.freeze({ name: 'searchHistory', path: '/api/student/search-history' }),
])

export function parseOptions(args) {
  const result = {}
  const flags = new Set(['allow-high', 'dry-run', 'help', 'verbose'])
  const valueOptions = new Set([
    'profile',
    'base-url',
    'sessions',
    'users',
    'active',
    'concurrency',
    'rounds',
    'ramp-ms',
    'think-time-ms',
    'timeout-ms',
    'max-error-rate',
    'max-login-p95-ms',
    'max-read-p95-ms',
    'max-requests',
    'email',
    'password',
    'credentials-path',
    'confirm-host',
  ])
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index]
    if (!token.startsWith('--')) throw new Error('Unexpected positional argument: ' + token + '.')
    const key = token.slice(2)
    if (!flags.has(key) && !valueOptions.has(key)) {
      throw new Error('Unknown load-test option: --' + key + '.')
    }
    if (Object.prototype.hasOwnProperty.call(result, key)) {
      throw new Error('Duplicate load-test option: --' + key + '.')
    }
    if (flags.has(key)) {
      result[key] = true
      continue
    }
    const value = args[index + 1]
    if (!value || value.startsWith('--')) throw new Error('Missing value for --' + key + '.')
    result[key] = value
    index += 1
  }
  return result
}

export function resolveLoadTestConfig(args, env = process.env) {
  const options = parseOptions(args)
  const profileName = String(options.profile ?? env.LOAD_TEST_PROFILE ?? 'smoke')
  const profile = LOAD_PROFILES[profileName]
  if (!profile) {
    throw new Error(
      'Unknown load profile "' +
        profileName +
        '". Choose smoke, baseline, login-storm, or exam-peak.',
    )
  }

  const baseUrl = String(
    options['base-url'] ?? env.LOAD_TEST_BASE_URL ?? 'http://127.0.0.1:3001',
  ).replace(/\/$/, '')
  const target = new URL(baseUrl)
  if (!['http:', 'https:'].includes(target.protocol)) {
    throw new Error('Load test target must use HTTP or HTTPS.')
  }
  if (
    target.username ||
    target.password ||
    target.search ||
    target.hash ||
    target.pathname !== '/'
  ) {
    throw new Error(
      'Load test base URL must be an origin without credentials, path, query, or hash.',
    )
  }

  const sessions = integerOption(
    options.sessions ?? options.users,
    env.LOAD_TEST_SESSIONS ?? env.LOAD_TEST_USERS ?? profile.sessions,
    1,
    10_000,
    'sessions',
  )
  const active = integerOption(
    options.active,
    env.LOAD_TEST_ACTIVE ?? profile.active,
    0,
    sessions,
    'active',
  )
  const concurrency = integerOption(
    options.concurrency,
    env.LOAD_TEST_CONCURRENCY ?? profile.concurrency,
    1,
    sessions,
    'concurrency',
  )
  const rounds = integerOption(
    options.rounds,
    env.LOAD_TEST_ROUNDS ?? profile.rounds,
    active === 0 ? 0 : 1,
    100,
    'rounds',
  )
  const rampMs = integerOption(
    options['ramp-ms'],
    env.LOAD_TEST_RAMP_MS ?? profile.rampMs,
    0,
    600_000,
    'ramp-ms',
  )
  const thinkTimeMs = integerOption(
    options['think-time-ms'],
    env.LOAD_TEST_THINK_TIME_MS ?? profile.thinkTimeMs,
    0,
    60_000,
    'think-time-ms',
  )
  const timeoutMs = integerOption(
    options['timeout-ms'],
    env.LOAD_TEST_TIMEOUT_MS ?? 10_000,
    100,
    120_000,
    'timeout-ms',
  )
  const maxErrorRate = numberOption(
    options['max-error-rate'],
    env.LOAD_TEST_MAX_ERROR_RATE ?? 0.01,
    0,
    1,
    'max-error-rate',
  )
  const maxLoginP95Ms = numberOption(
    options['max-login-p95-ms'],
    env.LOAD_TEST_MAX_LOGIN_P95_MS ?? 2000,
    1,
    120_000,
    'max-login-p95-ms',
  )
  const maxReadP95Ms = numberOption(
    options['max-read-p95-ms'],
    env.LOAD_TEST_MAX_READ_P95_MS ?? 1000,
    1,
    120_000,
    'max-read-p95-ms',
  )
  const maxRequests = integerOption(
    options['max-requests'],
    env.LOAD_TEST_MAX_REQUESTS ?? 20_000,
    1,
    1_000_000,
    'max-requests',
  )
  const projectedRequests = sessions + active * rounds * READ_ROUTES.length
  if (projectedRequests > maxRequests) {
    throw new Error(
      'Projected workload of ' +
        projectedRequests +
        ' requests exceeds LOAD_TEST_MAX_REQUESTS=' +
        maxRequests +
        '.',
    )
  }

  const isLocal = ['127.0.0.1', 'localhost', '::1'].includes(target.hostname)
  if (!isLocal && target.protocol !== 'https:') {
    throw new Error('Remote load test targets must use HTTPS.')
  }
  if (!isLocal && options.password) {
    throw new Error(
      'Do not pass a remote load-test password on the command line; use LOAD_TEST_PASSWORD.',
    )
  }
  const credentialsPath = String(
    options['credentials-path'] ?? env.LOAD_TEST_CREDENTIALS_PATH ?? '',
  ).trim()
  const email = options.email ?? env.LOAD_TEST_EMAIL ?? (isLocal ? 'tuananh@ptit.edu.vn' : '')
  const password = options.password ?? env.LOAD_TEST_PASSWORD ?? (isLocal ? 'Student@123' : '')
  if (!credentialsPath && (!email || !password)) {
    throw new Error('LOAD_TEST_EMAIL and LOAD_TEST_PASSWORD are required for a remote target.')
  }

  const highRisk = sessions > 500 || active > 200 || concurrency > 100
  const allowHigh = Boolean(options['allow-high']) || asBoolean(env.LOAD_TEST_ALLOW_HIGH)
  const confirmHost = String(options['confirm-host'] ?? env.LOAD_TEST_CONFIRM_HOST ?? '')
  const confirmStaging = asBoolean(env.LOAD_TEST_CONFIRM_STAGING)
  if (highRisk && (!allowHigh || !confirmStaging || confirmHost !== target.host)) {
    throw new Error(
      'High-load run blocked. Set LOAD_TEST_ALLOW_HIGH=true, LOAD_TEST_CONFIRM_STAGING=true, and LOAD_TEST_CONFIRM_HOST=' +
        target.host +
        ' after confirming the disposable staging target.',
    )
  }
  if (highRisk && !credentialsPath) {
    throw new Error(
      'High-load profiles require LOAD_TEST_CREDENTIALS_PATH so concurrent logins use distinct staging accounts.',
    )
  }

  return Object.freeze({
    profile: profileName,
    baseUrl,
    targetHost: target.host,
    sessions,
    active,
    concurrency,
    rounds,
    rampMs,
    thinkTimeMs,
    timeoutMs,
    maxErrorRate,
    maxLoginP95Ms,
    maxReadP95Ms,
    maxRequests,
    projectedRequests,
    email,
    password,
    credentialsPath,
    requiresCredentialPool: highRisk,
    dryRun: Boolean(options['dry-run']),
    verbose: Boolean(options.verbose),
  })
}

export async function runLoadTest(config, fetchImpl = fetch) {
  const credentials = await loadCredentialPool(config)
  const metrics = new Map()
  const ttfbMetrics = new Map()
  const statusCodes = {}
  const errors = []
  const outcomes = { attempted: 0, succeeded: 0, failed: 0 }
  const runId = randomUUID()
  const startedAtUtc = new Date().toISOString()
  const startedAt = performance.now()

  const preflight = {}
  for (const path of ['/api/health', '/api/ready']) {
    const result = await fetchJson(config.baseUrl + path, config.timeoutMs, fetchImpl)
    preflight[path] = { status: result.status, durationMs: round(result.durationMs) }
    if (result.status !== 200) {
      throw new Error('Preflight ' + path + ' returned HTTP ' + result.status + '.')
    }
  }

  async function workloadRequest(stage, path, options = {}, validate) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs)
    const requestStartedAt = performance.now()
    let response
    let ttfbMs = null
    outcomes.attempted += 1
    try {
      response = await fetchImpl(config.baseUrl + path, {
        ...options,
        signal: controller.signal,
        headers: { accept: 'application/json', ...(options.headers ?? {}) },
      })
      ttfbMs = performance.now() - requestStartedAt
      statusCodes[response.status] = (statusCodes[response.status] ?? 0) + 1
      if (!response.ok) {
        await response.arrayBuffer()
        throw new Error(stage + ' returned HTTP ' + response.status + '.')
      }
      const value = validate ? await validate(response) : await readJsonResponse(response, stage)
      pushMetric(metrics, stage, performance.now() - requestStartedAt)
      pushMetric(ttfbMetrics, stage, ttfbMs)
      outcomes.succeeded += 1
      return { ok: true, value }
    } catch (error) {
      pushMetric(metrics, stage, performance.now() - requestStartedAt)
      if (ttfbMs !== null) pushMetric(ttfbMetrics, stage, ttfbMs)
      outcomes.failed += 1
      const message = error instanceof Error ? error.message : String(error)
      if (errors.length < 20) errors.push({ stage, message })
      if (config.verbose) console.error(stage + ' failed:', message)
      return { ok: false }
    } finally {
      clearTimeout(timeout)
    }
  }

  const sessions = new Array(config.sessions)
  const loginStartedAt = performance.now()
  await runPool(config.sessions, config.concurrency, async (index) => {
    const targetStartMs =
      config.sessions > 1 ? (index / (config.sessions - 1)) * config.rampMs : config.rampMs
    const waitMs = targetStartMs - (performance.now() - loginStartedAt)
    if (waitMs > 0) await delay(waitMs)

    const credential = credentials[index % credentials.length]
    const login = await workloadRequest(
      'login',
      '/api/auth/login',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(credential),
      },
      async (response) => {
        const cookie = sessionCookieFrom(response.headers)
        const body = await response.json()
        const role = body?.data?.role ?? body?.role
        if (role !== 'student') {
          throw new Error('Login response did not resolve to the student role.')
        }
        return cookie
      },
    )
    if (login.ok) sessions[index] = login.value
  })
  const loginElapsedMs = performance.now() - loginStartedAt

  const availableSessions = sessions.filter(Boolean)
  const activeSessions = availableSessions.slice(0, config.active)
  const activeShortfall = Math.max(0, config.active - activeSessions.length)
  const readStartedAt = performance.now()
  if (activeSessions.length > 0) {
    await runPool(
      activeSessions.length,
      Math.min(config.concurrency, activeSessions.length),
      async (index) => {
        const cookie = activeSessions[index]
        for (let roundIndex = 0; roundIndex < config.rounds; roundIndex += 1) {
          for (const route of READ_ROUTES) {
            await workloadRequest(route.name, route.path, { headers: { cookie } })
            if (config.thinkTimeMs > 0) await delay(config.thinkTimeMs)
          }
        }
      },
    )
  }
  const readElapsedMs = performance.now() - readStartedAt
  const elapsedMs = performance.now() - startedAt

  const loginLatency = summarize(metrics.get('login') ?? [])
  const readValues = READ_ROUTES.flatMap((route) => metrics.get(route.name) ?? [])
  const readLatency = summarize(readValues)
  const readTtfbValues = READ_ROUTES.flatMap((route) => ttfbMetrics.get(route.name) ?? [])
  const errorRate = outcomes.attempted > 0 ? outcomes.failed / outcomes.attempted : 1
  const violations = []
  if (activeShortfall > 0) {
    violations.push(
      'Only ' +
        activeSessions.length +
        ' of ' +
        config.active +
        ' requested active sessions were available.',
    )
  }
  if (errorRate > config.maxErrorRate) {
    violations.push(
      'Error rate ' + percentage(errorRate) + ' exceeds ' + percentage(config.maxErrorRate) + '.',
    )
  }
  if ((loginLatency.p95 ?? 0) > config.maxLoginP95Ms) {
    violations.push('Login p95 ' + loginLatency.p95 + 'ms exceeds ' + config.maxLoginP95Ms + 'ms.')
  }
  if (readValues.length > 0 && (readLatency.p95 ?? 0) > config.maxReadP95Ms) {
    violations.push('Read p95 ' + readLatency.p95 + 'ms exceeds ' + config.maxReadP95Ms + 'ms.')
  }

  return {
    runId,
    startedAt: startedAtUtc,
    finishedAt: new Date().toISOString(),
    profile: config.profile,
    baseUrl: config.baseUrl,
    config: {
      sessions: config.sessions,
      active: config.active,
      concurrency: config.concurrency,
      rounds: config.rounds,
      rampMs: config.rampMs,
      thinkTimeMs: config.thinkTimeMs,
      timeoutMs: config.timeoutMs,
      projectedRequests: config.projectedRequests,
      maxRequests: config.maxRequests,
    },
    preflight,
    elapsedMs: round(elapsedMs),
    phaseElapsedMs: {
      login: round(loginElapsedMs),
      studentRead: round(readElapsedMs),
    },
    throughputRps: {
      overall: round((outcomes.attempted * 1000) / Math.max(elapsedMs, 1)),
      login: round((config.sessions * 1000) / Math.max(loginElapsedMs, 1)),
      studentRead: round((readValues.length * 1000) / Math.max(readElapsedMs, 1)),
    },
    sessionsCreated: availableSessions.length,
    activeSessions: activeSessions.length,
    distinctCredentials: credentials.length,
    outcomes: {
      ...outcomes,
      errorRate: percentage(errorRate),
      statusCodes,
      sampleErrors: errors,
    },
    latencyMs: {
      login: loginLatency,
      studentRead: readLatency,
      routes: Object.fromEntries(
        READ_ROUTES.map((route) => [route.name, summarize(metrics.get(route.name) ?? [])]),
      ),
    },
    ttfbMs: {
      login: summarize(ttfbMetrics.get('login') ?? []),
      studentRead: summarize(readTtfbValues),
      routes: Object.fromEntries(
        READ_ROUTES.map((route) => [route.name, summarize(ttfbMetrics.get(route.name) ?? [])]),
      ),
    },
    thresholds: {
      maxErrorRate: percentage(config.maxErrorRate),
      maxLoginP95Ms: config.maxLoginP95Ms,
      maxReadP95Ms: config.maxReadP95Ms,
      violations,
      passed: violations.length === 0,
    },
  }
}

export async function loadCredentialPool(config) {
  let credentials
  if (Array.isArray(config.credentials)) {
    credentials = config.credentials
  } else if (config.credentialsPath) {
    let parsed
    try {
      parsed = JSON.parse(await readFile(resolve(config.credentialsPath), 'utf8'))
    } catch (error) {
      throw new Error(
        'Cannot read LOAD_TEST_CREDENTIALS_PATH: ' +
          (error instanceof Error ? error.message : String(error)),
        { cause: error },
      )
    }
    credentials = parsed
  } else {
    credentials = [{ email: config.email, password: config.password }]
  }

  if (!Array.isArray(credentials) || credentials.length === 0) {
    throw new Error('Load-test credential pool must be a non-empty JSON array.')
  }

  const normalized = credentials.map((credential, index) => {
    if (!credential || typeof credential !== 'object' || Array.isArray(credential)) {
      throw new Error(`Load-test credential at index ${index} must be an object.`)
    }
    const email = String(credential.email ?? '')
      .trim()
      .toLowerCase()
    const password = String(credential.password ?? '')
    if (!email || !password) {
      throw new Error(`Load-test credential at index ${index} requires email and password.`)
    }
    return Object.freeze({ email, password })
  })

  if (new Set(normalized.map(({ email }) => email)).size !== normalized.length) {
    throw new Error('Load-test credential pool contains duplicate email addresses.')
  }

  const requiresCredentialPool =
    config.requiresCredentialPool ?? (config.profile !== undefined && config.profile !== 'smoke')
  const requiredCredentials = requiresCredentialPool
    ? Math.min(config.sessions, config.concurrency)
    : 1
  if (normalized.length < requiredCredentials) {
    throw new Error(
      `Load-test profile ${config.profile} requires at least ${requiredCredentials} distinct credentials; received ${normalized.length}.`,
    )
  }
  return Object.freeze(normalized)
}

export function summarize(values) {
  if (!values.length) return { count: 0 }
  const sorted = [...values].sort((a, b) => a - b)
  return {
    count: values.length,
    min: round(sorted[0]),
    p50: round(percentile(sorted, 0.5)),
    p95: round(percentile(sorted, 0.95)),
    p99: round(percentile(sorted, 0.99)),
    max: round(sorted.at(-1)),
  }
}

export function percentile(sorted, ratio) {
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)
  return sorted[Math.max(0, index)]
}

async function fetchJson(url, timeoutMs, fetchImpl) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  const startedAt = performance.now()
  try {
    const response = await fetchImpl(url, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
    })
    const body = await response.json()
    return { status: response.status, body, durationMs: performance.now() - startedAt }
  } finally {
    clearTimeout(timeout)
  }
}

function sessionCookieFrom(headers) {
  const values =
    typeof headers.getSetCookie === 'function'
      ? headers.getSetCookie()
      : [headers.get('set-cookie')].filter(Boolean)
  for (const value of values) {
    const match = String(value).match(/(?:^|,\s*)ptit_session=([^;,\s]+)/)
    if (match) return 'ptit_session=' + match[1]
  }
  throw new Error('Login response did not set the ptit_session cookie.')
}
async function readJsonResponse(response, stage) {
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    await response.arrayBuffer()
    throw new Error(stage + ' did not return JSON.')
  }
  return response.json()
}

async function runPool(total, concurrency, task) {
  let next = 0
  async function worker() {
    while (true) {
      const index = next
      next += 1
      if (index >= total) return
      await task(index)
    }
  }
  await Promise.all(Array.from({ length: Math.min(total, concurrency) }, () => worker()))
}

function pushMetric(metrics, name, value) {
  const values = metrics.get(name) ?? []
  values.push(value)
  metrics.set(name, values)
}

function integerOption(value, fallback, min, max, name) {
  const parsed = Number(value ?? fallback)
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error('--' + name + ' must be an integer between ' + min + ' and ' + max + '.')
  }
  return parsed
}

function numberOption(value, fallback, min, max, name) {
  const parsed = Number(value ?? fallback)
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new Error('--' + name + ' must be a number between ' + min + ' and ' + max + '.')
  }
  return parsed
}

function asBoolean(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value ?? '').toLowerCase())
}

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds))
}

function round(value) {
  return Math.round(value * 100) / 100
}

function percentage(value) {
  return round(value * 100) + '%'
}

function printHelp() {
  console.log(
    [
      'PTIT backend load test',
      '',
      'Profiles: smoke, baseline, login-storm, exam-peak',
      'Example:',
      '  npm run load:test -- --profile smoke',
      '  npm run load:test -- --profile baseline --allow-high --confirm-host staging.example.ptit.edu.vn',
      '',
      'Key overrides:',
      '  --base-url --sessions/--users --active --concurrency --rounds',
      '  --ramp-ms --think-time-ms --timeout-ms',
      '  --max-error-rate --max-login-p95-ms --max-read-p95-ms --max-requests',
      '  --credentials-path (required for high-load profiles)',
      '  --dry-run --verbose',
    ].join('\n'),
  )
}

async function main() {
  const rawArgs = process.argv.slice(2)
  if (rawArgs.includes('--help')) {
    printHelp()
    return
  }
  const config = resolveLoadTestConfig(rawArgs)
  if (config.dryRun) {
    const credentials = await loadCredentialPool(config)
    console.log(
      JSON.stringify(
        {
          ...config,
          email: config.email,
          password: '[redacted]',
          credentialPoolSize: credentials.length,
        },
        null,
        2,
      ),
    )
    return
  }
  const report = await runLoadTest(config)
  console.log(JSON.stringify(report, null, 2))
  if (!report.thresholds.passed) process.exitCode = 1
}

const isEntryPoint =
  process.argv[1] &&
  resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase()
if (isEntryPoint) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
