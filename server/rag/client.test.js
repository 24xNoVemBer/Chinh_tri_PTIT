// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createRagMockServer } from '../mocks/ragMockServer.js'
import requestFixture from '../../contracts/examples/chat-request.json' with { type: 'json' }
import answerFixture from '../../contracts/examples/terminal-answer.json' with { type: 'json' }
import { createRuntimeConfig } from '../runtimeConfig.js'
import { createRagClient } from './client.js'

let server
let baseUrl

beforeAll(async () => {
  server = createRagMockServer({ requireAuth: true })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

afterAll(() => server.close())

describe('runtime config', () => {
  it('keeps RAG disabled by default', () => {
    const config = createRuntimeConfig({ NODE_ENV: 'test', PORT: '3001' })
    expect(config.rag.enabled).toBe(false)
    expect(config.rag.baseUrl).toBe('http://127.0.0.1:8787')
  })

  it('rejects HTTP RAG endpoints in production', () => {
    expect(() =>
      createRuntimeConfig({
        NODE_ENV: 'production',
        RAG_ENABLED: 'true',
        RAG_BASE_URL: 'http://rag.internal',
        RAG_SERVICE_TOKEN: 'secret',
      }),
    ).toThrow('HTTPS in production')
  })

  it('requires a service token when RAG is enabled', () => {
    expect(() =>
      createRuntimeConfig({ RAG_ENABLED: 'true', RAG_BASE_URL: 'https://rag.example' }),
    ).toThrow('RAG_SERVICE_TOKEN')
  })
})

describe('RAG client', () => {
  it('calls the private service with auth and validates the terminal answer', async () => {
    const client = createRagClient({ baseUrl, serviceToken: 'mock-service-token' })
    const answer = await client.generateAnswer(
      { ...requestFixture, requestId: crypto.randomUUID() },
      { idempotencyKey: `test-${crypto.randomUUID()}` },
    )
    expect(answer.outcome).toBe('answered')
    expect(answer.citations[0].materialVersionId).toBe('material-version-triet-hoc-2026')
  })

  it('turns an unauthorized citation into a non-retryable integration error', async () => {
    const client = createRagClient({
      baseUrl,
      serviceToken: 'mock-service-token',
      fetchImpl: (input, init) =>
        fetch(input, {
          ...init,
          headers: { ...init.headers, 'x-mock-scenario': 'invalid-citation' },
        }),
    })
    await expect(
      client.generateAnswer(
        { ...requestFixture, requestId: crypto.randomUUID() },
        { idempotencyKey: `test-${crypto.randomUUID()}`, requestId: requestFixture.requestId },
      ),
    ).rejects.toMatchObject({ code: 'INVALID_CITATION', status: 502, retryable: false })
  })

  it('retries retryable provider errors with the same idempotency key', async () => {
    let calls = 0
    const fetchImpl = async () => {
      calls += 1
      if (calls === 1)
        return {
          ok: false,
          status: 503,
          json: async () => ({ code: 'PROVIDER_UNAVAILABLE', message: 'try again' }),
        }
      return {
        ok: true,
        status: 200,
        json: async () => ({ ...answerFixture, requestId: requestFixture.requestId }),
      }
    }
    const client = createRagClient({
      baseUrl: 'http://mock',
      fetchImpl,
      maxRetries: 1,
      retryDelayMs: 0,
    })
    const answer = await client.generateAnswer(
      { ...requestFixture, requestId: requestFixture.requestId },
      { idempotencyKey: `test-${crypto.randomUUID()}` },
    )
    expect(answer.outcome).toBe('answered')
    expect(calls).toBe(2)
  })

  it('maps exhausted timeout retries retries to PROVIDER_TIMEOUT', async () => {
    const fetchImpl = async () => {
      const error = new Error('aborted')
      error.name = 'AbortError'
      throw error
    }
    const client = createRagClient({
      baseUrl: 'http://mock',
      fetchImpl,
      maxRetries: 1,
      retryDelayMs: 0,
    })
    await expect(
      client.generateAnswer(
        { ...requestFixture, requestId: crypto.randomUUID() },
        { idempotencyKey: `test-${crypto.randomUUID()}` },
      ),
    ).rejects.toMatchObject({ code: 'PROVIDER_TIMEOUT', status: 504, retryable: true })
  })
})
