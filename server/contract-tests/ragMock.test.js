import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createRagMockServer } from '../mocks/ragMockServer.js'
import { assertSchema, schemaIds, validateEventSequence } from '../contracts/schemaRegistry.js'
import requestFixture from '../../contracts/examples/chat-request.json' with { type: 'json' }

let server
let baseUrl

beforeAll(async () => {
  server = createRagMockServer()
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

afterAll(() => server.close())

async function post(scenario, options = {}) {
  const headers = {
    'content-type': 'application/json',
    'idempotency-key': `test-${scenario}-${Math.random()}`,
    ...(scenario ? { 'x-mock-scenario': scenario } : {}),
    ...(options.headers ?? {}),
  }
  return fetch(`${baseUrl}/internal/v1/answers`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...requestFixture, requestId: crypto.randomUUID() }),
  })
}

describe('RAG mock contract', () => {
  it('returns a schema-valid grounded answer', async () => {
    const response = await post('answered-single-citation')
    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(() => assertSchema(schemaIds.answer, payload)).not.toThrow()
    expect(payload.citations).toHaveLength(1)
  })

  it('rejects citations outside the authorized allow-list', async () => {
    const response = await post('invalid-citation')
    expect(response.status).toBe(502)
    expect((await response.json()).code).toBe('INVALID_CITATION')
  })

  it('supports abstain and safety outcomes', async () => {
    const abstained = await post('abstained-no-source')
    expect((await abstained.json()).outcome).toBe('abstained')
    const blocked = await post('blocked-safety')
    expect((await blocked.json()).safety.decision).toBe('block')
  })

  it.each([
    ['rate-limited', 429, 'RATE_LIMITED'],
    ['provider-unavailable', 503, 'PROVIDER_UNAVAILABLE'],
    ['provider-timeout', 504, 'PROVIDER_TIMEOUT'],
  ])('maps %s to a stable error', async (scenario, status, code) => {
    const response = await post(scenario)
    expect(response.status).toBe(status)
    expect((await response.json()).code).toBe(code)
  })

  it('replays the same terminal answer for the same idempotency key', async () => {
    const key = `replay-${crypto.randomUUID()}`
    const body = { ...requestFixture, requestId: crypto.randomUUID() }
    const headers = { 'content-type': 'application/json', 'idempotency-key': key }
    const first = await fetch(`${baseUrl}/internal/v1/answers`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
    const second = await fetch(`${baseUrl}/internal/v1/answers`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
    expect((await first.json()).providerJobId).toBe((await second.json()).providerJobId)
  })

  it('rejects an idempotency key reused for another payload', async () => {
    const key = `same-${crypto.randomUUID()}`
    const headers = { 'content-type': 'application/json', 'idempotency-key': key }
    const first = await fetch(`${baseUrl}/internal/v1/answers`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...requestFixture, requestId: crypto.randomUUID() }),
    })
    expect(first.status).toBe(200)
    const second = await fetch(`${baseUrl}/internal/v1/answers`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ...requestFixture,
        requestId: crypto.randomUUID(),
        query: { ...requestFixture.query, text: 'câu hỏi khác' },
      }),
    })
    expect(second.status).toBe(409)
  })

  it('streams ordered SSE events', async () => {
    const response = await post('answered-single-citation', {
      headers: { accept: 'text/event-stream' },
    })
    expect(response.status).toBe(200)
    const text = await response.text()
    const events = [...text.matchAll(/id: (\d+)\nevent: ([^\n]+)\ndata: (.+)\n/g)].map((match) => ({
      sequence: Number(match[1]),
      type: match[2],
      data: JSON.parse(match[3]),
      schemaVersion: '1.0',
      eventId: crypto.randomUUID(),
      requestId: match[3].includes('requestId')
        ? JSON.parse(match[3]).requestId
        : requestFixture.requestId,
      occurredAt: new Date().toISOString(),
    }))
    expect(events.map((event) => event.type)).toEqual(['processing', 'delta', 'terminal'])
    expect(() => validateEventSequence(events)).not.toThrow()
  })
})
