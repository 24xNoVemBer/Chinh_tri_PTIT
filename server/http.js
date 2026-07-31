export class ApiError extends Error {
  constructor(status, code, message, retryable = false) {
    super(message)
    this.status = status
    this.code = code
    this.retryable = retryable
  }
}

export function sendJson(response, status, payload, headers = {}) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'same-origin',
    ...headers,
  })
  response.end(JSON.stringify(payload))
}

export async function readJson(request, { maxBytes = 1_000_000 } = {}) {
  const chunks = []
  let size = 0

  for await (const chunk of request) {
    size += chunk.length
    if (size > maxBytes) {
      throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Dữ liệu gửi lên vượt quá giới hạn.')
    }
    chunks.push(chunk)
  }

  if (!chunks.length) return {}
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new ApiError(400, 'INVALID_JSON', 'Dữ liệu JSON không hợp lệ.')
  }
}

export function requireFields(input, fields) {
  const missing = fields.filter((field) => {
    const value = input[field]
    return value === undefined || value === null || String(value).trim() === ''
  })
  if (missing.length) {
    throw new ApiError(400, 'VALIDATION', `Thiếu trường bắt buộc: ${missing.join(', ')}.`)
  }
}

/**
 * Trims and length-checks a free-text field. Without an upper bound the API happily stores
 * a question hundreds of thousands of characters long, which then has to be rendered.
 */
export function requireText(input, field, { min = 1, max = 5000, label = field } = {}) {
  const value = String(input[field] ?? '').trim()
  if (value.length < min) {
    throw new ApiError(400, 'VALIDATION', `${label} cần có ít nhất ${min} ký tự.`)
  }
  if (value.length > max) {
    throw new ApiError(400, 'VALIDATION', `${label} không được vượt quá ${max} ký tự.`)
  }
  return value
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * Rejects cross-site state changes. The session cookie is SameSite=Lax, which already
 * blocks cross-site POSTs from ordinary navigation, but that leaves same-site subdomains
 * and any future SameSite relaxation unguarded — so verify the origin explicitly.
 */
const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

function isLoopbackOrigin(origin) {
  try {
    return LOOPBACK_HOSTNAMES.has(new URL(origin).hostname)
  } catch {
    return false
  }
}

function configuredOrigins() {
  return String(process.env.TRUSTED_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

export function requireSameOrigin(request) {
  const method = (request.method ?? 'GET').toUpperCase()
  if (SAFE_METHODS.has(method)) return

  const origin = request.headers.origin
  if (!origin) return // Same-origin non-browser clients (curl, tests) send no Origin.

  // Comparing Origin against Host does not work behind a proxy: the Vite dev server serves
  // the UI on :5173 and forwards /api to the API port, rewriting Host to the upstream, so
  // the two can never match. Any real reverse proxy does the same. Trust loopback origins
  // outside production, and otherwise match an explicit allowlist.
  if (process.env.NODE_ENV !== 'production' && isLoopbackOrigin(origin)) return

  const configured = configuredOrigins()
  const host = request.headers.host
  const allowed = configured.length
    ? configured
    : [`https://${host}`, `http://${host}`].filter(() => Boolean(host))

  if (!allowed.includes(origin)) {
    throw new ApiError(403, 'CROSS_ORIGIN', 'Yêu cầu bị từ chối vì nguồn gốc không hợp lệ.')
  }
}

export function requireRole(auth, roles) {
  if (!auth) throw new ApiError(401, 'UNAUTHENTICATED', 'Bạn cần đăng nhập để tiếp tục.')
  if (!roles.includes(auth.user.role)) {
    throw new ApiError(403, 'FORBIDDEN', 'Bạn không có quyền thực hiện thao tác này.')
  }
  return auth.user
}

export function serializeError(error) {
  if (error instanceof ApiError) {
    return {
      status: error.status,
      payload: {
        error: {
          code: error.code,
          message: error.message,
          retryable: error.retryable,
        },
      },
    }
  }

  return {
    status: 500,
    payload: {
      error: {
        code: 'INTERNAL',
        message: 'Hệ thống gặp lỗi ngoài dự kiến.',
        retryable: true,
      },
    },
  }
}
