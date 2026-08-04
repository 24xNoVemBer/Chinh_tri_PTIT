import { Pool } from 'pg'
import { normalizeParams, toPostgresSql } from './query.js'

class PostgresTransactionClient {
  #connection

  constructor(connection) {
    this.#connection = connection
    this.dialect = 'postgres'
  }

  async one(sql, params) {
    const result = await this.#connection.query(toPostgresSql(sql), normalizeParams(params))
    return result.rows[0]
  }

  async many(sql, params) {
    const result = await this.#connection.query(toPostgresSql(sql), normalizeParams(params))
    return result.rows
  }

  async execute(sql, params) {
    const result = await this.#connection.query(toPostgresSql(sql), normalizeParams(params))
    return { rowCount: result.rowCount, rows: result.rows }
  }

  async exec(sql) {
    return this.#connection.query(sql)
  }
}

export class PostgresDatabaseClient {
  #pool
  #ownsPool

  constructor(pool, { ownsPool = false } = {}) {
    if (!pool || typeof pool.query !== 'function')
      throw new Error('PostgresDatabaseClient requires a pg Pool-compatible object.')
    this.#pool = pool
    this.#ownsPool = ownsPool
    this.dialect = 'postgres'
  }

  async one(sql, params) {
    const result = await this.#pool.query(toPostgresSql(sql), normalizeParams(params))
    return result.rows[0]
  }

  async many(sql, params) {
    const result = await this.#pool.query(toPostgresSql(sql), normalizeParams(params))
    return result.rows
  }

  async execute(sql, params) {
    const result = await this.#pool.query(toPostgresSql(sql), normalizeParams(params))
    return { rowCount: result.rowCount, rows: result.rows }
  }

  async exec(sql) {
    return this.#pool.query(sql)
  }

  async transaction(callback) {
    if (typeof callback !== 'function') throw new TypeError('Transaction callback is required.')
    if (typeof this.#pool.connect !== 'function')
      throw new Error('PostgreSQL transactions require a pool with connect().')

    const connection = await this.#pool.connect()
    const transactionClient = new PostgresTransactionClient(connection)
    try {
      await connection.query('BEGIN')
      const result = await callback(transactionClient)
      await connection.query('COMMIT')
      return result
    } catch (error) {
      try {
        await connection.query('ROLLBACK')
      } catch {
        // Preserve the original transaction error if rollback also fails.
      }
      throw error
    } finally {
      connection.release()
    }
  }

  async close() {
    if (this.#ownsPool) await this.#pool.end()
  }
}

export function createPostgresClient({ connectionString, pool, poolOptions = {} } = {}) {
  if (!pool && !connectionString)
    throw new Error('createPostgresClient requires connectionString or a pool.')
  return new PostgresDatabaseClient(pool ?? new Pool({ connectionString, ...poolOptions }), {
    ownsPool: !pool,
  })
}
