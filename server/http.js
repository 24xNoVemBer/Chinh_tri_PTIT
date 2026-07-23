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
