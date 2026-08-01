// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApiServer } from '../app.js'
import { createDatabase } from '../database.js'
import { createRagMockServer } from '../mocks/ragMockServer.js'
import { createRagClient } from './client.js'

describe('live chat against the contract mock', () => {
  let db
  let appServer
  let ragServer
  let baseUrl

  beforeEach(async () => {
    db = createDatabase({ databasePath: ':memory:' })
    ragServer = createRagMockServer()
    await new Promise((resolve) => ragServer.listen(0, '127.0.0.1', resolve))
    const ragClient = createRagClient({ baseUrl: `http://127.0.0.1:${ragServer.address().port}` })
    appServer = createApiServer({ db, ragClient, logger: { error() {}, warn() {} } })
    await new Promise((resolve) => appServer.listen(0, '127.0.0.1', resolve))
    baseUrl = `http://127.0.0.1:${appServer.address().port}`
  })

  afterEach(async () => {
    await new Promise((resolve) => appServer.close(resolve))
    await new Promise((resolve) => ragServer.close(resolve))
    db.close()
  })

  it('uses approved seeded material IDs end-to-end', async () => {
    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'tuananh@ptit.edu.vn', password: 'Student@123' }),
    })
    const cookie = login.headers.get('set-cookie').split(';')[0]
    const response = await fetch(`${baseUrl}/api/student/chat`, {
      method: 'POST',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subjectId: 'sub1',
        content: 'Giải thích quan hệ giữa vật chất và ý thức.',
      }),
    })
    expect(response.status).toBe(201)
    const payload = await response.json()
    expect(payload.data.isDemo).toBe(false)
    expect(payload.data.citations[0].materialId).toBe('mat6')
  })
})
