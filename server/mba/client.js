import { randomUUID } from 'node:crypto'

export class MbaChatError extends Error {
  constructor(code, message, status = 502) {
    super(message)
    this.code = code
    this.status = status
  }
}

export function createMbaChatClient({ baseUrl, timeoutMs = 60_000, fetchImpl = fetch }) {
  const endpoint = baseUrl.replace(/\/$/, '')

  async function request(path, options = {}, requestTimeoutMs = timeoutMs) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs)
    try {
      const response = await fetchImpl(`${endpoint}${path}`, {
        ...options,
        signal: controller.signal,
      })
      if (!response.ok) {
        throw new MbaChatError('PROVIDER_UNAVAILABLE', `MBA_API trả HTTP ${response.status}.`)
      }
      return await response.json()
    } catch (error) {
      if (error instanceof MbaChatError) throw error
      if (controller.signal.aborted) {
        throw new MbaChatError('PROVIDER_TIMEOUT', 'MBA_API phản hồi quá thời gian chờ.', 504)
      }
      if (error instanceof SyntaxError) {
        throw new MbaChatError('MALFORMED_PROVIDER_RESPONSE', 'MBA_API trả dữ liệu không hợp lệ.')
      }
      throw new MbaChatError('PROVIDER_UNAVAILABLE', 'Không kết nối được MBA_API.', 503)
    } finally {
      clearTimeout(timeout)
    }
  }

  return Object.freeze({
    async health() {
      const result = await request('/health', {}, Math.min(timeoutMs, 5_000))
      if (result?.api_status !== 'healthy') {
        throw new MbaChatError('PROVIDER_UNAVAILABLE', 'MBA_API chưa sẵn sàng.', 503)
      }
      return result
    },
    async chat({ userId, text, source, subjectName }) {
      const result = await request('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          userId: `ptit:${userId}`,
          text,
          source,
          save: false,
          mode: 'default',
          sessionId: randomUUID(),
          metadata: { subject_name: subjectName },
        }),
      })
      const answer = result?.text
      const content = typeof answer === 'string' ? answer : answer?.response
      if (result?.status !== 'ok' || typeof content !== 'string' || !content.trim()) {
        throw new MbaChatError(
          'MALFORMED_PROVIDER_RESPONSE',
          'MBA_API không trả câu trả lời hợp lệ.',
        )
      }
      return {
        content: content.trim(),
        sources: Array.isArray(answer?.sources) ? answer.sources : [],
      }
    },
  })
}
