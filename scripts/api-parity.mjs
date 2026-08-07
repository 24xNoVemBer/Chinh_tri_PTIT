#!/usr/bin/env node

/**
 * API parity smoke test for a deployed/staging PTIT instance.
 *
 * Read-only checks are the default. Passing --write enables a complete
 * student-to-lecturer journey, but only when PARITY_ALLOW_WRITES=true. The
 * script never calls the RAG provider. Credentials are supplied through
 * environment variables so they never need to be checked into the repository
 * or passed on a shared command line.
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
const parsedBaseUrl = new URL(baseUrl)
const localTarget = ['127.0.0.1', 'localhost', '::1'].includes(parsedBaseUrl.hostname)
if (
  parsedBaseUrl.username ||
  parsedBaseUrl.password ||
  parsedBaseUrl.search ||
  parsedBaseUrl.hash ||
  parsedBaseUrl.pathname !== '/'
) {
  throw new Error('API base URL must be an origin without credentials, path, query, or hash.')
}
if (!localTarget && parsedBaseUrl.protocol !== 'https:') {
  throw new Error('Remote API parity targets must use HTTPS.')
}
const studentEmail = process.env.PARITY_STUDENT_EMAIL
const studentPassword = process.env.PARITY_STUDENT_PASSWORD
const lecturerEmail = process.env.PARITY_LECTURER_EMAIL
const lecturerPassword = process.env.PARITY_LECTURER_PASSWORD
const timeoutMs = Number(readOption('timeout-ms', process.env.PARITY_TIMEOUT_MS ?? 10_000))
if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 120_000) {
  throw new Error('PARITY_TIMEOUT_MS must be an integer between 100 and 120000.')
}
const writeEnabled = args.includes('--write')
const paritySubjectId = process.env.PARITY_SUBJECT_ID ?? 'sub1'
const parityLessonId = process.env.PARITY_LESSON_ID ?? 'les3'

if (writeEnabled && process.env.PARITY_ALLOW_WRITES !== 'true') {
  throw new Error(
    'Set PARITY_ALLOW_WRITES=true before using --write against a disposable database.',
  )
}

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

function dataFrom(result) {
  return result.body?.data ?? result.body
}

function cookieFrom(result) {
  const headers = result.response.headers
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

async function login(email, password, role) {
  const result = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  assertStatus(result, 200, role + ' login')
  assertObject(result, role + ' login')
  const user = dataFrom(result)
  if (user?.role !== role) {
    throw new Error(role + ' login resolved to unexpected role ' + (user?.role ?? 'unknown') + '.')
  }
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
  let lecturer
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
      return { userId: student.body?.data?.id ?? student.body?.id ?? null }
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
      lecturer = await login(lecturerEmail, lecturerPassword, 'lecturer')
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
      return { userId: lecturer.body?.data?.id ?? lecturer.body?.id ?? null }
    })
  } else {
    checks.push({
      name: 'lecturer session and read routes',
      status: 'skipped',
      reason: 'Set PARITY_LECTURER_EMAIL and PARITY_LECTURER_PASSWORD',
    })
  }

  if (writeEnabled) {
    if (!student || !lecturer) {
      checks.push({
        name: 'student-to-lecturer write journey',
        status: 'failed',
        error: 'Write parity requires both student and lecturer credentials.',
      })
    } else {
      await check('student-to-lecturer write journey', async () => {
        const progress = await request(
          '/api/student/lessons/' + encodeURIComponent(parityLessonId) + '/progress',
          {
            method: 'PATCH',
            headers: { cookie: student.cookie, 'content-type': 'application/json' },
            body: JSON.stringify({ progress: 64 }),
          },
        )
        assertStatus(progress, 200, 'student progress update')

        const question = await request('/api/student/questions', {
          method: 'POST',
          headers: { cookie: student.cookie, 'content-type': 'application/json' },
          body: JSON.stringify({
            subjectId: paritySubjectId,
            lessonId: parityLessonId,
            content: '[DB5 parity] Kiểm tra luồng hỏi đáp ' + new Date().toISOString(),
          }),
        })
        assertStatus(question, 201, 'student question create')
        const createdQuestion = dataFrom(question)
        if (!createdQuestion?.id) throw new Error('Question create did not return an id')

        const lecturerRead = await request(
          '/api/lecturer/questions/' + encodeURIComponent(createdQuestion.id),
          { headers: { cookie: lecturer.cookie } },
        )
        assertStatus(lecturerRead, 200, 'lecturer question read')

        const answer = await request(
          '/api/lecturer/questions/' + encodeURIComponent(createdQuestion.id) + '/answer',
          {
            method: 'POST',
            headers: { cookie: lecturer.cookie, 'content-type': 'application/json' },
            body: JSON.stringify({
              content: '[DB5 parity] Phản hồi kiểm thử từ giảng viên.',
            }),
          },
        )
        assertStatus(answer, 200, 'lecturer answer create')

        const studentRead = await request(
          '/api/student/questions/' + encodeURIComponent(createdQuestion.id),
          { headers: { cookie: student.cookie } },
        )
        assertStatus(studentRead, 200, 'student answered question read')
        const answeredQuestion = dataFrom(studentRead)
        if (answeredQuestion?.status !== 'answered') {
          throw new Error('Student question did not transition to answered.')
        }

        const audit = await request('/api/lecturer/audit-logs', {
          headers: { cookie: lecturer.cookie },
        })
        assertStatus(audit, 200, 'lecturer audit read')
        const auditEntries = dataFrom(audit)
        const actions = Array.isArray(auditEntries) ? auditEntries.map((entry) => entry.action) : []
        if (!actions.includes('question.created') || !actions.includes('answer.created')) {
          throw new Error('Audit log is missing question.created or answer.created.')
        }

        return {
          questionId: createdQuestion.id,
          subjectId: paritySubjectId,
          lessonId: parityLessonId,
        }
      })
    }
  }

  const failed = checks.filter((item) => item.status === 'failed')
  console.log(JSON.stringify({ baseUrl, checks, passed: failed.length === 0 }, null, 2))
  if (failed.length > 0) process.exitCode = 1
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
