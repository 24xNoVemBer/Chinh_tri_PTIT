// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApiServer } from './app.js'
import { createDatabase } from './database.js'

let db
let server
let baseUrl

beforeEach(async () => {
  db = createDatabase({ databasePath: ':memory:' })
  server = createApiServer({ db, allowDemoRag: false, logger: { error() {} } })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

afterEach(async () => {
  await new Promise((resolve) => server.close(resolve))
  db.close()
})

describe('production RAG guard', () => {
  it('does not silently fall back to demo data when disabled', async () => {
    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'tuananh@ptit.edu.vn', password: 'Student@123' }),
    })
    const cookie = login.headers.get('set-cookie').split(';')[0]
    const response = await fetch(`${baseUrl}/api/student/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        subjectId: 'sub1',
        content: 'Mối quan hệ giữa vật chất và ý thức được hiểu thế nào?',
      }),
    })
    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'RAG_UNAVAILABLE' },
    })
  })
})
