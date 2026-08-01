import { assertSchema, schemaIds, validateAnswerScope } from '../contracts/schemaRegistry.js'

const RETRYABLE_STATUS = new Set([429, 502, 503, 504])

export class RagClientError extends Error {
  constructor(code, message, { status = 502, retryable = false, requestId, cause } = {}) {
    super(message, { cause })
    this.name = 'RagClientError'
    this.code = code
    this.status = status
    this.retryable = retryable
    this.requestId = requestId
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export function createRagClient({
  baseUrl,
  serviceToken = '',
  timeoutMs = 30_000,
  maxRetries = 2,
  retryDelayMs = 100,
  fetchImpl = fetch,
  logger = console,
}) {
  if (!baseUrl) throw new Error('createRagClient requires baseUrl.')
  const endpoint = `${baseUrl.replace(/\/$/, '')}/internal/v1/answers`

  async function generateAnswer(request, { idempotencyKey, requestId = request.requestId } = {}) {
    assertSchema(schemaIds.request, request)
    if (!idempotencyKey)
      throw new RagClientError('VALIDATION', 'Idempotency key is required.', {
        status: 400,
        requestId,
      })
    let attempt = 0
    while (true) {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), timeoutMs)
      try {
        const response = await fetchImpl(endpoint, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: serviceToken ? `Bearer ${serviceToken}` : undefined,
            'X-Request-ID': requestId,
            'Idempotency-Key': idempotencyKey,
          },
          body: JSON.stringify(request),
          signal: controller.signal,
        })
        clearTimeout(timeout)
        let payload
        try {
          payload = await response.json()
        } catch (error) {
          throw new RagClientError(
            'MALFORMED_PROVIDER_RESPONSE',
            'RAG response was not valid JSON.',
            { status: 502, retryable: attempt < maxRetries, requestId, cause: error },
          )
        }
        if (!response.ok) {
          const code = payload?.code ?? 'PROVIDER_UNAVAILABLE'
          const canRetry =
            RETRYABLE_STATUS.has(response.status) &&
            !['INVALID_CITATION', 'SAFETY_BLOCKED', 'VALIDATION'].includes(code)
          const retryable = canRetry && attempt < maxRetries
          if (retryable) {
            await sleep(retryDelayMs * 2 ** attempt)
            attempt += 1
            continue
          }
          throw new RagClientError(
            code,
            payload?.message ?? `RAG request failed with ${response.status}.`,
            {
              status: response.status,
              retryable: canRetry,
              requestId,
            },
          )
        }
        try {
          assertSchema(schemaIds.answer, payload)
          validateAnswerScope(payload, request.scope.allowedMaterialVersionIds)
        } catch (error) {
          throw new RagClientError('INVALID_CITATION', error.message, {
            status: 502,
            retryable: false,
            requestId,
            cause: error,
          })
        }
        return payload
      } catch (error) {
        clearTimeout(timeout)
        if (error instanceof RagClientError) throw error
        const timedOut = error?.name === 'AbortError'
        const retryable = attempt < maxRetries
        if (retryable) {
          logger.warn?.(
            `RAG ${timedOut ? 'timeout' : 'network error'}; retry ${attempt + 1}/${maxRetries}.`,
          )
          await sleep(retryDelayMs * 2 ** attempt)
          attempt += 1
          continue
        }
        throw new RagClientError(
          timedOut ? 'PROVIDER_TIMEOUT' : 'PROVIDER_UNAVAILABLE',
          timedOut ? 'RAG request timed out.' : 'RAG service is unavailable.',
          { status: timedOut ? 504 : 503, retryable: true, requestId, cause: error },
        )
      }
    }
  }

  async function probe(path, { signal } = {}) {
    const response = await fetchImpl(`${baseUrl.replace(/\/$/, '')}${path}`, {
      headers: { Authorization: serviceToken ? `Bearer ${serviceToken}` : undefined },
      signal,
    })
    let payload = {}
    try {
      payload = await response.json()
    } catch {
      /* health payload is optional */
    }
    if (!response.ok)
      throw new RagClientError(
        'PROVIDER_UNAVAILABLE',
        payload.message ?? `RAG probe failed with ${response.status}.`,
        { status: response.status, retryable: true },
      )
    return payload
  }

  return Object.freeze({
    generateAnswer,
    health: (options) => probe('/internal/v1/health', options),
    readiness: (options) => probe('/internal/v1/readiness', options),
    capabilities: (options) => probe('/internal/v1/capabilities', options),
  })
}
