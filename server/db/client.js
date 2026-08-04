import { normalizeParams } from './query.js'

/**
 * Small database port used by the application layer.
 *
 * The application only depends on this boundary; the SQLite driver stays
 * inside the adapter factory. The statement shape intentionally mirrors the
 * current synchronous driver so repositories can migrate incrementally.
 */
export class DatabaseClient {
  #connection
  constructor(connection, { dialect = 'unknown' } = {}) {
    if (!connection) throw new Error('DatabaseClient requires a connection.')
    this.#connection = connection
    this.dialect = dialect
  }

  prepare(sql) {
    return this.#connection.prepare(sql)
  }

  exec(sql) {
    return this.#connection.exec(sql)
  }

  one(sql, params) {
    return this.prepare(sql).get(...normalizeParams(params))
  }

  many(sql, params) {
    return this.prepare(sql).all(...normalizeParams(params))
  }

  execute(sql, params) {
    return this.prepare(sql).run(...normalizeParams(params))
  }

  transaction(callback, { mode = 'IMMEDIATE' } = {}) {
    if (typeof callback !== 'function') throw new TypeError('Transaction callback is required.')

    this.exec(`BEGIN ${mode}`)
    try {
      const result = callback(this)
      if (result && typeof result.then === 'function') {
        return result.then(
          (value) => {
            this.exec('COMMIT')
            return value
          },
          (error) => {
            try {
              this.exec('ROLLBACK')
            } catch {
              // Preserve the original transaction error if rollback also fails.
            }
            throw error
          },
        )
      }
      this.exec('COMMIT')
      return result
    } catch (error) {
      try {
        this.exec('ROLLBACK')
      } catch {
        // Preserve the original transaction error if rollback also fails.
      }
      throw error
    }
  }

  close() {
    return this.#connection.close()
  }
}

export function createSqliteClient(connection) {
  return new DatabaseClient(connection, { dialect: 'sqlite' })
}
