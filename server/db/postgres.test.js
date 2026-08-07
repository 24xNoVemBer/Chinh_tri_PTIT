// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { createPostgresClient } from './postgres.js'

describe('PostgreSQL database adapter', () => {
  it('maps the neutral query API to pg parameters', async () => {
    const pool = {
      query: vi.fn().mockResolvedValue({ rows: [{ id: 'u1' }], rowCount: 1 }),
      totalCount: 5,
      idleCount: 3,
      waitingCount: 2,
    }
    const client = createPostgresClient({ pool })

    await expect(
      client.one("SELECT * FROM users WHERE id = ? AND note = '?'", ['u1']),
    ).resolves.toEqual({
      id: 'u1',
    })
    expect(pool.query).toHaveBeenCalledWith("SELECT * FROM users WHERE id = $1 AND note = '?'", [
      'u1',
    ])
    expect(client.stats()).toEqual({ total: 5, idle: 3, waiting: 2 })
  })

  it('logs unexpected errors from idle pooled connections', () => {
    const pool = {
      query: vi.fn(),
      on: vi.fn(),
    }
    const logger = { error: vi.fn() }
    createPostgresClient({ pool, logger })

    expect(pool.on).toHaveBeenCalledWith('error', expect.any(Function))
    const handler = pool.on.mock.calls[0][1]
    const error = new Error('connection reset')
    handler(error)
    expect(logger.error).toHaveBeenCalledWith('Unexpected PostgreSQL pool error.', error)
  })

  it('commits a transaction and releases the pooled connection', async () => {
    const connection = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 1 }),
      release: vi.fn(),
    }
    const pool = {
      query: vi.fn(),
      connect: vi.fn().mockResolvedValue(connection),
    }
    const client = createPostgresClient({ pool })

    await client.transaction(async (transaction) => {
      await transaction.execute('INSERT INTO users (id) VALUES (?)', ['u1'])
    })

    expect(connection.query).toHaveBeenNthCalledWith(1, 'BEGIN')
    expect(connection.query).toHaveBeenNthCalledWith(2, 'INSERT INTO users (id) VALUES ($1)', [
      'u1',
    ])
    expect(connection.query).toHaveBeenNthCalledWith(3, 'COMMIT')
    expect(connection.release).toHaveBeenCalledOnce()
  })

  it('rolls back and preserves the transaction error', async () => {
    const connection = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 1 }),
      release: vi.fn(),
    }
    const pool = { query: vi.fn(), connect: vi.fn().mockResolvedValue(connection) }
    const client = createPostgresClient({ pool })

    await expect(
      client.transaction(async () => {
        throw new Error('provider write failed')
      }),
    ).rejects.toThrow('provider write failed')

    expect(connection.query).toHaveBeenNthCalledWith(1, 'BEGIN')
    expect(connection.query).toHaveBeenNthCalledWith(2, 'ROLLBACK')
    expect(connection.release).toHaveBeenCalledOnce()
  })
})
