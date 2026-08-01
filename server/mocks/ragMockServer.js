import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import {
  assertSchema,
  schemaIds,
  validateAnswerScope,
  validateRequestScope,
} from '../contracts/schemaRegistry.js'
import { RAG_SCENARIOS, createTerminalAnswer, errorForScenario } from './ragMockScenarios.js'

const json = (response, status, payload) => {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  response.end(JSON.stringify(payload))
}

async function readBody(request) {
  let body = ''
  for await (const chunk of request) {
    body += chunk
    if (body.length > 1_000_000) throw new Error('request body too large')
  }
  return body ? JSON.parse(body) : {}
}

function sse(response, event, payload, id) {
  response.write(`id: ${id}\nevent: ${event}\ndata: ${JSON.stringify(payload)}\n\n`)
}

export function createRagMockServer({ requireAuth = false, delayMs = 150 } = {}) {
  const seen = new Map()
  return createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost')
    if (requireAuth && request.headers.authorization !== 'Bearer mock-service-token') {
      return json(response, 401, {
        code: 'UNAUTHENTICATED',
        message: 'Mock service token required.',
        retryable: false,
      })
    }
    if (request.method === 'GET' && url.pathname === '/internal/v1/health')
      return json(response, 200, { status: 'ok' })
    if (request.method === 'GET' && url.pathname === '/internal/v1/readiness')
      return json(response, 200, { status: 'ready' })
    if (request.method === 'GET' && url.pathname === '/internal/v1/capabilities')
      return json(response, 200, {
        schemaVersion: '1.0',
        service: 'rag',
        supportedSchemaVersions: ['1.0'],
        streaming: true,
        maxContextTokens: 32768,
      })
    if (request.method !== 'POST' || url.pathname !== '/internal/v1/answers')
      return json(response, 404, {
        code: 'NOT_FOUND',
        message: 'Mock route not found.',
        retryable: false,
      })

    const scenario = RAG_SCENARIOS.includes(request.headers['x-mock-scenario'])
      ? request.headers['x-mock-scenario']
      : 'answered-single-citation'
    let payload
    try {
      payload = await readBody(request)
      assertSchema(schemaIds.request, payload)
      validateRequestScope(payload)
    } catch (error) {
      return json(response, 400, {
        code: 'VALIDATION',
        message: error.message,
        retryable: false,
        details: error.errors,
      })
    }
    const key = request.headers['idempotency-key']
    if (key && seen.has(key)) {
      const previous = seen.get(key)
      if (JSON.stringify(previous.request) !== JSON.stringify(payload)) {
        return json(response, 409, {
          code: 'IDEMPOTENCY_CONFLICT',
          message: 'Idempotency key payload differs.',
          retryable: false,
          requestId: payload.requestId,
        })
      }
      return json(response, 200, previous.answer)
    }
    if (['rate-limited', 'provider-unavailable'].includes(scenario))
      return json(
        response,
        scenario === 'rate-limited' ? 429 : 503,
        errorForScenario(scenario, payload.requestId),
      )
    if (scenario === 'provider-timeout') {
      await new Promise((resolve) => setTimeout(resolve, Math.min(delayMs, 200)))
      return json(response, 504, errorForScenario(scenario, payload.requestId))
    }
    if (scenario === 'slow-success') await new Promise((resolve) => setTimeout(resolve, delayMs))
    const answer = createTerminalAnswer(payload, scenario)
    if (scenario === 'malformed-response') {
      response.writeHead(200, { 'content-type': 'application/json' })
      return response.end('{"schemaVersion":"1.0","requestId":')
    }
    if (scenario === 'invalid-citation') {
      // The mock intentionally returns a structurally valid answer with an unauthorized source.
      try {
        assertSchema(schemaIds.answer, answer)
      } catch (error) {
        return json(response, 502, {
          code: 'MALFORMED_PROVIDER_RESPONSE',
          message: error.message,
          retryable: false,
        })
      }
    }
    if (request.headers.accept?.includes('text/event-stream')) {
      response.writeHead(200, {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      })
      const first = scenario === 'out-of-order-event' ? 2 : 1
      sse(response, 'processing', { requestId: payload.requestId }, first)
      sse(
        response,
        'delta',
        { text: answer.answer.text.slice(0, 30) },
        scenario === 'out-of-order-event' ? 1 : 2,
      )
      if (scenario === 'stream-disconnect') return response.destroy()
      sse(response, 'terminal', answer, 3)
      return response.end()
    }
    try {
      validateAnswerScope(answer, payload.scope.allowedMaterialVersionIds)
    } catch (error) {
      return json(response, 502, {
        code: 'INVALID_CITATION',
        message: error.message,
        retryable: false,
      })
    }
    seen.set(key ?? randomUUID(), { request: payload, answer })
    return json(response, 200, answer)
  })
}
