// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApiServer } from './app.js'
import { createDatabase } from './database.js'

describe('runtime health endpoints', () => {
  let db
  let server
  let baseUrl

  beforeEach(async () => {
    db = createDatabase({ databasePath: ':memory:' })
    server = createApiServer({ db, logger: { error() {}, warn() {} } })
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    baseUrl = `http://127.0.0.1:${server.address().port}`
  })

  afterEach(async () => {
    await new Promise((resolve) => server.close(resolve))
    db.close()
  })

  it('reports database and disabled RAG readiness', async () => {
    const response = await fetch(`${baseUrl}/api/ready`)
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: { status: 'ready', database: 'connected', rag: 'disabled' },
    })
  })
})
