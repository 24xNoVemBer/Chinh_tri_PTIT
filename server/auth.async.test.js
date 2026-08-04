// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createDatabase } from './database.js'
import { authenticateRequestAsync, createSessionAsync, destroySessionAsync } from './auth.js'

describe('async authentication boundary', () => {
  it('creates, authenticates and destroys a session through query API', async () => {
    const db = createDatabase({ databasePath: ':memory:' })
    try {
      const session = await createSessionAsync(db, 's1')
      const request = { headers: { cookie: `ptit_session=${session.token}` } }

      await expect(authenticateRequestAsync(db, request)).resolves.toMatchObject({
        sessionId: expect.any(String),
        user: { id: 's1', role: 'student' },
      })

      await destroySessionAsync(db, session.token)
      await expect(authenticateRequestAsync(db, request)).resolves.toBeNull()
    } finally {
      db.close()
    }
  })
})
