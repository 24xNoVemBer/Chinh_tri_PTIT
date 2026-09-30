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
let upstreamSources
const enabledSourceMap = {
  sub1: 'BAS1150',
  sub2: 'BAS1151',
  sub3: 'BAS1152',
  sub5: 'BAS1153',
}

beforeEach(async () => {
  upstreamCalls = []
  upstreamSources = [
    {
      id: 'node-1',
      file_name: 'triet-hoc.pdf',
      score: 0.725,
      text: 'Đoạn tài liệu truy xuất.',
    },
  ]
  const upstream = vi.fn(async (url, options) => {
    upstreamCalls.push({ url, options })
    if (url.endsWith('/health')) return Response.json({ api_status: 'healthy' })
    return Response.json({
      status: 'ok',
      text: {
        response: 'Vật chất là thực tại khách quan.',
        sources: upstreamSources,
      },
      session_id: 'mba-session',
    })
  })
  db = createDatabase({ databasePath: ':memory:' })
  server = createApiServer({
    db,
    mbaChatClient: createMbaChatClient({ baseUrl: 'http://127.0.0.1:4558', fetchImpl: upstream }),
    mbaChatSourceMap: enabledSourceMap,
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
        MBA_CHAT_SOURCE_MAP: JSON.stringify(enabledSourceMap),
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
        MBA_CHAT_SOURCE_MAP: JSON.stringify(enabledSourceMap),
      }).mbaChat.sourceMap,
    ).toEqual(enabledSourceMap)
  })

  it('sends a mapped, authenticated student question without MBA history writes', async () => {
    const cookie = await studentCookie()
    const status = await fetch(`${baseUrl}/api/student/chat/status`, {
      headers: { Cookie: cookie },
    })
    expect((await status.json()).data).toMatchObject({
      mode: 'mba',
      sampleData: false,
      enabledSubjectIds: Object.keys(enabledSourceMap),
    })

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
      sourceId: 'BAS1150',
      providerNodeId: 'node-1',
      retrievalScore: 0.725,
      title: 'triet-hoc.pdf',
      quote: 'Đoạn tài liệu truy xuất.',
    })
    const body = JSON.parse(upstreamCalls.at(-1).options.body)
    expect(body).toMatchObject({
      userId: 'ptit:s1',
      source: 'BAS1150',
      save: false,
      mode: 'default',
    })
    expect(body.sessionId).toBeTruthy()
  })

  it('preserves the full eight-chunk MBA evidence set for the source panel', async () => {
    upstreamSources = Array.from({ length: 8 }, (_, index) => ({
      id: `node-${index + 1}`,
      file_name: 'ktct.pdf',
      score: 0.7 - index / 100,
      text: `Đoạn trích ${index + 1}`,
    }))
    upstreamSources[6].text = 'Định nghĩa trực tiếp ở đoạn thứ bảy.'

    const cookie = await studentCookie()
    const response = await fetch(`${baseUrl}/api/student/chat`, {
      method: 'POST',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subjectId: 'sub2',
        classId: 'class2',
        content: 'Giá trị sử dụng của hàng hóa là gì?',
      }),
    })

    expect(response.status).toBe(201)
    const answer = (await response.json()).data
    expect(answer.sources).toHaveLength(8)
    expect(answer.sources[6].quote).toBe('Định nghĩa trực tiếp ở đoạn thứ bảy.')
    expect(answer.sources[6]).toMatchObject({
      sourceId: 'BAS1151',
      providerNodeId: 'node-7',
      title: 'ktct.pdf',
    })
  })

  it('blocks unmapped subjects and classes outside enrollment before contacting MBA_API', async () => {
    const cookie = await studentCookie()
    const send = (subjectId, classId) =>
      fetch(`${baseUrl}/api/student/chat`, {
        method: 'POST',
        headers: { Cookie: cookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjectId, classId, content: 'Vật chất được định nghĩa thế nào?' }),
      })
    expect((await send('sub4', 'class1')).status).toBe(409)
    expect((await send('sub2', 'class1')).status).toBe(403)
    expect((await send('sub1', 'not-my-class')).status).toBe(403)
    expect(upstreamCalls).toHaveLength(0)
  })

  it('routes every enabled subject to its own MBA source', async () => {
    for (const [subjectId, classId] of [
      ['sub3', 'mba-test-class3'],
      ['sub5', 'mba-test-class5'],
    ]) {
      db.execute(
        `INSERT INTO course_classes
         (id, subject_id, name, lecturer_id, semester, academic_term_id,
          group_number, class_code, status)
         SELECT ?, ?, ?, lecturer_id, semester, academic_term_id, ?, ?, status
         FROM course_classes WHERE id = 'class1'`,
        [classId, subjectId, classId, subjectId === 'sub3' ? 3 : 5, classId],
      )
      db.execute('INSERT INTO enrollments (id, student_id, class_id) VALUES (?, ?, ?)', [
        `mba-test-enrollment-${subjectId}`,
        's1',
        classId,
      ])
    }

    const cookie = await studentCookie()
    for (const [subjectId, classId] of [
      ['sub1', 'class1'],
      ['sub2', 'class2'],
      ['sub3', 'mba-test-class3'],
      ['sub5', 'mba-test-class5'],
    ]) {
      const response = await fetch(`${baseUrl}/api/student/chat`, {
        method: 'POST',
        headers: { Cookie: cookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectId,
          classId,
          content: 'Theo giáo trình, khái niệm này được giải thích thế nào?',
        }),
      })
      expect(response.status).toBe(201)
      expect((await response.json()).data.answerMode).toBe('mba')
    }

    expect(upstreamCalls.map(({ options }) => JSON.parse(options.body).source)).toEqual(
      Object.values(enabledSourceMap),
    )
  })
})
