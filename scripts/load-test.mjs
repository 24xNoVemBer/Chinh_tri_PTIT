const options = parseOptions(process.argv.slice(2))
const baseUrl = String(
  options.baseUrl ??
    options['base-url'] ??
    process.env.LOAD_TEST_BASE_URL ??
    'http://127.0.0.1:3001',
).replace(/\/$/, '')
const users = integerOption(options.users, process.env.LOAD_TEST_USERS ?? 100, 1, 10_000)
const concurrency = integerOption(
  options.concurrency,
  process.env.LOAD_TEST_CONCURRENCY ?? Math.min(users, 50),
  1,
  users,
)
const email = options.email ?? process.env.LOAD_TEST_EMAIL ?? 'tuananh@ptit.edu.vn'
const password = options.password ?? process.env.LOAD_TEST_PASSWORD ?? 'Student@123'

const durations = { login: [], me: [] }
const outcomes = { login: 0, me: 0, errors: 0 }
let nextJob = 0

async function worker() {
  while (true) {
    const index = nextJob++
    if (index >= users) return
    const loginStarted = performance.now()
    try {
      const login = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      durations.login.push(performance.now() - loginStarted)
      outcomes.login += 1
      if (!login.ok) {
        outcomes.errors += 1
        continue
      }
      const cookieHeader = login.headers.get('set-cookie')
      if (!cookieHeader) {
        outcomes.errors += 1
        continue
      }

      const meStarted = performance.now()
      const me = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { cookie: cookieHeader.split(';')[0] },
      })
      durations.me.push(performance.now() - meStarted)
      outcomes.me += 1
      if (!me.ok) outcomes.errors += 1
    } catch (error) {
      outcomes.errors += 1
      if (options.verbose) console.error(`request ${index + 1} failed:`, error.message)
    }
  }
}

const started = performance.now()
await Promise.all(Array.from({ length: concurrency }, () => worker()))
const elapsedMs = performance.now() - started

const report = {
  baseUrl,
  users,
  concurrency,
  elapsedMs: round(elapsedMs),
  requestsPerSecond: round((users * 2 * 1000) / Math.max(elapsedMs, 1)),
  outcomes,
  latencyMs: {
    login: summarize(durations.login),
    me: summarize(durations.me),
  },
}
console.log(JSON.stringify(report, null, 2))
if (outcomes.errors > 0) process.exitCode = 1

function parseOptions(args) {
  const result = {}
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index]
    if (!token.startsWith('--')) continue
    const key = token.slice(2)
    if (key === 'verbose') {
      result.verbose = true
      continue
    }
    result[key] = args[index + 1]
    index += 1
  }
  return result
}

function integerOption(value, fallback, min, max) {
  const parsed = Number(value ?? fallback)
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`Option must be an integer between ${min} and ${max}.`)
  }
  return parsed
}

function summarize(values) {
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

function percentile(sorted, ratio) {
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)
  return sorted[Math.max(0, index)]
}

function round(value) {
  return Math.round(value * 100) / 100
}
