export class ApiClientError extends Error {
  constructor({ code = 'NETWORK', message, retryable = false, status = 0 } = {}) {
    super(message ?? 'Không thể kết nối tới máy chủ.')
    this.name = 'ApiClientError'
    this.code = code
    this.retryable = retryable
    this.status = status
  }
}

export async function apiRequest(path, options = {}) {
  let response
  try {
    response = await fetch(path, {
      credentials: 'same-origin',
      ...options,
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    })
  } catch {
    throw new ApiClientError({
      message: 'Không thể kết nối tới máy chủ. Vui lòng thử lại.',
      retryable: true,
    })
  }

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new ApiClientError({
      code: payload?.error?.code,
      message: payload?.error?.message ?? 'Yêu cầu không thành công.',
      retryable: payload?.error?.retryable,
      status: response.status,
    })
  }
  return payload?.data
}

export function jsonBody(value) {
  return JSON.stringify(value)
}

export function withQuery(path, values = {}) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== '' && value !== 'all') {
      params.set(key, value)
    }
  }
  const query = params.toString()
  return query ? `${path}?${query}` : path
}
