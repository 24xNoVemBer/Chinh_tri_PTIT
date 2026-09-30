// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApiServer } from '../app.js'
import { createDatabase } from '../database.js'
import { createRuntimeConfig } from '../runtimeConfig.js'
import { createMbaChatClient } from './client.js'

let db
let server
let baseUrl
let upstreamCalls

beforeEach(async () => {
  upstreamCalls = []
  const upstream = vi.fn(async (url, options) => {
    upstreamCalls.push({ url, options })
    if (url.endsWith('/health')) return Response.json({ api_status: 'healthy' })
    return Response.json({
      status: 'ok',
      text: {
        response: 'Vật chất là thực tại khách quan.',
        sources: [{ id: 'node-1', file_name: 'triet-hoc.pdf', text: 'Đoạn tài liệu truy xuất.' }],
      },
      session_id: 'mba-session',
    })
  })
  db = createDatabase({ databasePath: ':memory:' })
  server = createApiServer({
    db,
    mbaChatClient: createMbaChatClient({ baseUrl: 'http://127.0.0.1:4558', fetchImpl: upstream }),
    mbaChatSourceMap: { sub1: 'triet_ptit' },
    allowDemoRag: false,
    logger: { error() {} },
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

afterEach(async () => {
  await new Promise((resolve) => server.close(resolve))
  db.close()
})

async function studentCookie() {
  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'tuananh@ptit.edu.vn', password: 'Student@123' }),
  })
  return login.headers.get('set-cookie').split(';')[0]
}

describe('MBA_API chat bridge', () => {
  it('requires a deliberate, safe upstream and subject mapping', () => {
    expect(createRuntimeConfig({ NODE_ENV: 'test' }).mbaChat.enabled).toBe(false)
    expect(() => createRuntimeConfig({ MBA_CHAT_ENABLED: 'true' })).toThrow('MBA_CHAT_BASE_URL')
    expect(() =>
      createRuntimeConfig({
        MBA_CHAT_ENABLED: 'true',
        MBA_CHAT_BASE_URL: 'http://remote.example',
        MBA_CHAT_SOURCE_MAP: '{"sub1":"triet_ptit"}',
      }),
    ).toThrow('MBA_CHAT_BASE_URL')
    expect(() =>
      createRuntimeConfig({
        MBA_CHAT_ENABLED: 'true',
        MBA_CHAT_BASE_URL: 'http://127.0.0.1:4558',
      }),
    ).toThrow('MBA_CHAT_SOURCE_MAP')
    expect(
      createRuntimeConfig({
        MBA_CHAT_ENABLED: 'true',
        MBA_CHAT_BASE_URL: 'http://127.0.0.1:4558',
        MBA_CHAT_SOURCE_MAP: '{"sub1":"triet_ptit"}',
      }).mbaChat.sourceMap,
    ).toEqual({ sub1: 'triet_ptit' })
  })

  it('sends a mapped, authenticated student question without MBA history writes', async () => {
    const cookie = await studentCookie()
    const status = await fetch(`${baseUrl}/api/student/chat/status`, {
      headers: { Cookie: cookie },
    })
    expect((await status.json()).data).toMatchObject({ mode: 'mba', sampleData: false })

    const response = await fetch(`${baseUrl}/api/student/chat`, {
      method: 'POST',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subjectId: 'sub1',
        classId: 'class1',
        content: 'Vật chất được định nghĩa thế nào?',
      }),
    })
    expect(response.status).toBe(201)
    const answer = (await response.json()).data
    expect(answer).toMatchObject({
      answerMode: 'mba',
      reviewStatus: 'unverified',
      content: 'Vật chất là thực tại khách quan.',
      citations: [],
    })
    expect(answer.sources[0]).toMatchObject({
      title: 'triet-hoc.pdf',
      quote: 'Đoạn tài liệu truy xuất.',
    })
    const body = JSON.parse(upstreamCalls.at(-1).options.body)
    expect(body).toMatchObject({
      userId: 'ptit:s1',
      source: 'triet_ptit',
      save: false,
      mode: 'default',
    })
    expect(body.sessionId).toBeTruthy()
  })

  it('blocks unmapped subjects and classes outside enrollment before contacting MBA_API', async () => {
    const cookie = await studentCookie()
    const send = (subjectId, classId) =>
      fetch(`${baseUrl}/api/student/chat`, {
        method: 'POST',
        headers: { Cookie: cookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjectId, classId, content: 'Vật chất được định nghĩa thế nào?' }),
      })
    expect((await send('sub2', 'class1')).status).toBe(409)
    expect((await send('sub1', 'not-my-class')).status).toBe(403)
    expect(upstreamCalls).toHaveLength(0)
  })
})
