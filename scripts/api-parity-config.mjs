import { parseArgs } from 'node:util'

function requiredSecret(env, name) {
  const value = String(env[name] ?? '')
  if (!value) throw new Error(name + ' is required for authenticated parity.')
  return value
}

export function resolveApiParityConfig(args, env = process.env) {
  const { values } = parseArgs({
    args,
    options: {
      'base-url': { type: 'string' },
      'timeout-ms': { type: 'string' },
      write: { type: 'boolean' },
      'health-only': { type: 'boolean' },
      help: { type: 'boolean' },
    },
    allowPositionals: false,
    strict: true,
  })

  const baseUrl = String(values['base-url'] ?? env.API_BASE_URL ?? 'http://127.0.0.1:3001').replace(
    /\/$/,
    '',
  )
  const target = new URL(baseUrl)
  if (!['http:', 'https:'].includes(target.protocol)) {
    throw new Error('API parity target must use HTTP or HTTPS.')
  }
  if (
    target.username ||
    target.password ||
    target.search ||
    target.hash ||
    target.pathname !== '/'
  ) {
    throw new Error('API base URL must be an origin without credentials, path, query, or hash.')
  }
  const localTarget = ['127.0.0.1', 'localhost', '::1'].includes(target.hostname)
  if (!localTarget && target.protocol !== 'https:') {
    throw new Error('Remote API parity targets must use HTTPS.')
  }

  const timeoutMs = Number(values['timeout-ms'] ?? env.PARITY_TIMEOUT_MS ?? 10_000)
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 120_000) {
    throw new Error('PARITY_TIMEOUT_MS must be an integer between 100 and 120000.')
  }

  const healthOnly = Boolean(values['health-only'])
  const writeEnabled = Boolean(values.write)
  if (healthOnly && writeEnabled) throw new Error('--health-only cannot be combined with --write.')

  let studentEmail = ''
  let studentPassword = ''
  let lecturerEmail = ''
  let lecturerPassword = ''
  if (!healthOnly && !values.help) {
    studentEmail = requiredSecret(env, 'PARITY_STUDENT_EMAIL')
    studentPassword = requiredSecret(env, 'PARITY_STUDENT_PASSWORD')
    lecturerEmail = requiredSecret(env, 'PARITY_LECTURER_EMAIL')
    lecturerPassword = requiredSecret(env, 'PARITY_LECTURER_PASSWORD')
  }

  if (writeEnabled) {
    const confirmedHost = String(env.PARITY_CONFIRM_HOST ?? '')
    if (
      env.PARITY_ALLOW_WRITES !== 'true' ||
      env.PARITY_CONFIRM_DISPOSABLE !== 'true' ||
      confirmedHost !== target.host
    ) {
      throw new Error(
        'Write parity requires PARITY_ALLOW_WRITES=true, PARITY_CONFIRM_DISPOSABLE=true, and PARITY_CONFIRM_HOST=' +
          target.host +
          '.',
      )
    }
  }

  const subjectId = String(env.PARITY_SUBJECT_ID ?? 'sub1').trim()
  const lessonId = String(env.PARITY_LESSON_ID ?? 'les3').trim()
  if (writeEnabled && (!subjectId || !lessonId)) {
    throw new Error('PARITY_SUBJECT_ID and PARITY_LESSON_ID must not be empty for write parity.')
  }

  return Object.freeze({
    baseUrl,
    targetHost: target.host,
    timeoutMs,
    healthOnly,
    writeEnabled,
    studentEmail,
    studentPassword,
    lecturerEmail,
    lecturerPassword,
    subjectId,
    lessonId,
    help: Boolean(values.help),
  })
}
