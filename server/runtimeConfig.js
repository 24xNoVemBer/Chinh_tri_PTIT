const asBoolean = (value, fallback = false) => {
  if (value === undefined) return fallback
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase())
}

const asInteger = (value, fallback, { min, max }) => {
  const parsed = Number(value ?? fallback)
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error('Runtime value must be an integer between ' + min + ' and ' + max + '.')
  }
  return parsed
}

export function createRuntimeConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV ?? 'development'
  const host = String(env.HOST ?? '127.0.0.1').trim()
  if (!host) throw new Error('HOST must not be empty.')
  const databaseDriver = env.DATABASE_DRIVER ?? 'sqlite'
  if (!['sqlite', 'postgres'].includes(databaseDriver)) {
    throw new Error('DATABASE_DRIVER must be sqlite or postgres.')
  }
  if (databaseDriver === 'postgres' && !env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required when DATABASE_DRIVER=postgres.')
  }

  const statementTimeoutMs = asInteger(env.DATABASE_STATEMENT_TIMEOUT_MS, 15_000, {
    min: 100,
    max: 120_000,
  })
  const queryTimeoutMs = asInteger(env.DATABASE_QUERY_TIMEOUT_MS, 20_000, {
    min: 100,
    max: 180_000,
  })
  if (queryTimeoutMs <= statementTimeoutMs) {
    throw new Error('DATABASE_QUERY_TIMEOUT_MS must be greater than DATABASE_STATEMENT_TIMEOUT_MS.')
  }

  const adminStatementTimeoutMs = asInteger(env.DATABASE_ADMIN_STATEMENT_TIMEOUT_MS, 120_000, {
    min: 1_000,
    max: 900_000,
  })
  const adminQueryTimeoutMs = asInteger(env.DATABASE_ADMIN_QUERY_TIMEOUT_MS, 125_000, {
    min: 1_000,
    max: 930_000,
  })
  if (adminQueryTimeoutMs <= adminStatementTimeoutMs) {
    throw new Error(
      'DATABASE_ADMIN_QUERY_TIMEOUT_MS must be greater than DATABASE_ADMIN_STATEMENT_TIMEOUT_MS.',
    )
  }

  const applicationName = String(env.DATABASE_APPLICATION_NAME ?? 'ptit-politics-api').trim()
  if (!applicationName) throw new Error('DATABASE_APPLICATION_NAME must not be empty.')

  const ragEnabled = asBoolean(env.RAG_ENABLED, false)
  const ragBaseUrl = env.RAG_BASE_URL ?? 'http://127.0.0.1:8787'
  let parsedUrl
  try {
    parsedUrl = new URL(ragBaseUrl)
  } catch {
    throw new Error('RAG_BASE_URL must be an absolute URL.')
  }
  if (ragEnabled && !['https:', 'http:'].includes(parsedUrl.protocol)) {
    throw new Error('RAG_BASE_URL must use HTTP or HTTPS.')
  }
  if (ragEnabled && nodeEnv === 'production' && parsedUrl.protocol !== 'https:') {
    throw new Error('RAG_BASE_URL must use HTTPS in production.')
  }
  if (ragEnabled && !env.RAG_SERVICE_TOKEN) {
    throw new Error('RAG_SERVICE_TOKEN is required when RAG_ENABLED=true.')
  }

  return Object.freeze({
    nodeEnv,
    host,
    port: asInteger(env.PORT, 3001, { min: 1, max: 65535 }),
    databasePath: env.DATABASE_PATH ?? 'data/ptit-teaching-assistant.sqlite',
    database: Object.freeze({
      driver: databaseDriver,
      url: env.DATABASE_URL ?? '',
      poolMax: asInteger(env.DATABASE_POOL_MAX, 10, { min: 1, max: 100 }),
      idleTimeoutMs: asInteger(env.DATABASE_IDLE_TIMEOUT_MS, 10_000, {
        min: 0,
        max: 300_000,
      }),
      connectionTimeoutMs: asInteger(env.DATABASE_CONNECTION_TIMEOUT_MS, 5_000, {
        min: 100,
        max: 60_000,
      }),
      queryTimeoutMs,
      statementTimeoutMs,
      idleInTransactionTimeoutMs: asInteger(env.DATABASE_IDLE_IN_TRANSACTION_TIMEOUT_MS, 10_000, {
        min: 1_000,
        max: 300_000,
      }),
      adminQueryTimeoutMs,
      adminStatementTimeoutMs,
      applicationName,
    }),
    rag: Object.freeze({
      demoData: asBoolean(env.RAG_DEMO_DATA, nodeEnv !== 'production'),
      enabled: ragEnabled,
      baseUrl: parsedUrl.toString().replace(/\/$/, ''),
      serviceToken: env.RAG_SERVICE_TOKEN ?? '',
      timeoutMs: asInteger(env.RAG_TIMEOUT_MS, 30_000, { min: 100, max: 120_000 }),
      maxRetries: asInteger(env.RAG_MAX_RETRIES, 2, { min: 0, max: 5 }),
      retryDelayMs: asInteger(env.RAG_RETRY_DELAY_MS, 100, { min: 0, max: 10_000 }),
    }),
  })
}
