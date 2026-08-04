#!/usr/bin/env node

/**
 * Read-only API parity smoke test for a deployed/staging PTIT instance.
 *
 * The script intentionally uses only public read endpoints plus login. It does
 * not create questions, mutate progress, or call the RAG provider. Credentials
 * are supplied through environment variables so they never need to be checked
 * into the repository or passed on a shared command line.
 */

const args = process.argv.slice(2)

function readOption(name, fallback) {
  const index = args.indexOf(`--${name}`)
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback
}

const baseUrl = readOption('base-url', process.env.API_BASE_URL ?? 'http://127.0.0.1:3001').replace(
  /\/$/,
  '',
)
const studentEmail = process.env.PARITY_STUDENT_EMAIL
const studentPassword = process.env.PARITY_STUDENT_PASSWORD
const lecturerEmail = process.env.PARITY_LECTURER_EMAIL
const lecturerPassword = process.env.PARITY_LECTURER_PASSWORD
const timeoutMs = Number(readOption('timeout-ms', process.env.PARITY_TIMEOUT_MS ?? 10_000))

const checks = []

async function request(path, options = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      signal: controller.signal,
      headers: { accept: 'application/json', ...(options.headers ?? {}) },
    })
    let body = null
    const contentType = response.headers.get('content-type') ?? ''
    if (contentType.includes('application/json')) body = await response.json()
    else await response.text()
    return { response, body }
  } finally {
    clearTimeout(timeout)
  }
}

async function check(name, fn) {
  const startedAt = performance.now()
  try {
    const detail = await fn()
    checks.push({
      name,
      status: 'passed',
      durationMs: Math.round(performance.now() - startedAt),
      detail,
    })
  } catch (error) {
    checks.push({
      name,
      status: 'failed',
      durationMs: Math.round(performance.now() - startedAt),
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

function assertStatus(result, expected, label) {
  if (result.response.status !== expected) {
    throw new Error(`${label}: expected HTTP ${expected}, got ${result.response.status}`)
  }
}

function assertObject(result, label) {
  if (!result.body || typeof result.body !== 'object')
    throw new Error(`${label}: expected JSON object`)
}

function cookieFrom(result) {
  const cookie = result.response.headers.get('set-cookie')
  if (!cookie) throw new Error('Login response did not set a session cookie')
  return cookie.split(';', 1)[0]
}

async function login(email, password, role) {
  const result = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  assertStatus(result, 200, `${role} login`)
  assertObject(result, `${role} login`)
  return { cookie: cookieFrom(result), body: result.body }
}

async function run() {
  await check('health', async () => {
    const result = await request('/api/health')
    assertStatus(result, 200, 'health')
    assertObject(result, 'health')
    return result.body
  })

  await check('readiness', async () => {
    const result = await request('/api/ready')
    assertStatus(result, 200, 'readiness')
    assertObject(result, 'readiness')
    return result.body
  })

  let student
  if (studentEmail && studentPassword) {
    await check('student session and read routes', async () => {
      student = await login(studentEmail, studentPassword, 'student')
      const [me, dashboard, subjects, questions, history] = await Promise.all([
        request('/api/auth/me', { headers: { cookie: student.cookie } }),
        request('/api/student/dashboard', { headers: { cookie: student.cookie } }),
        request('/api/student/subjects', { headers: { cookie: student.cookie } }),
        request('/api/student/questions', { headers: { cookie: student.cookie } }),
        request('/api/student/search-history', { headers: { cookie: student.cookie } }),
      ])
      for (const [label, response] of Object.entries({
        me,
        dashboard,
        subjects,
        questions,
        history,
      })) {
        assertStatus(response, 200, `student ${label}`)
        assertObject(response, `student ${label}`)
      }
      return { userId: student.body?.data?.user?.id ?? student.body?.user?.id ?? null }
    })
  } else {
    checks.push({
      name: 'student session and read routes',
      status: 'skipped',
      reason: 'Set PARITY_STUDENT_EMAIL and PARITY_STUDENT_PASSWORD',
    })
  }

  if (lecturerEmail && lecturerPassword) {
    await check('lecturer session and read routes', async () => {
      const lecturer = await login(lecturerEmail, lecturerPassword, 'lecturer')
      const [me, classes, questions, reviews, audit] = await Promise.all([
        request('/api/auth/me', { headers: { cookie: lecturer.cookie } }),
        request('/api/lecturer/classes', { headers: { cookie: lecturer.cookie } }),
        request('/api/lecturer/questions', { headers: { cookie: lecturer.cookie } }),
        request('/api/lecturer/rag/reviews', { headers: { cookie: lecturer.cookie } }),
        request('/api/lecturer/audit-logs', { headers: { cookie: lecturer.cookie } }),
      ])
      for (const [label, response] of Object.entries({ me, classes, questions, reviews, audit })) {
        assertStatus(response, 200, `lecturer ${label}`)
        assertObject(response, `lecturer ${label}`)
      }
      return { userId: lecturer.body?.data?.user?.id ?? lecturer.body?.user?.id ?? null }
    })
  } else {
    checks.push({
      name: 'lecturer session and read routes',
      status: 'skipped',
      reason: 'Set PARITY_LECTURER_EMAIL and PARITY_LECTURER_PASSWORD',
    })
  }

  const failed = checks.filter((item) => item.status === 'failed')
  console.log(JSON.stringify({ baseUrl, checks, passed: failed.length === 0 }, null, 2))
  if (failed.length > 0) process.exitCode = 1
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
