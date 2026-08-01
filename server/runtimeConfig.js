const asBoolean = (value, fallback = false) => {
  if (value === undefined) return fallback
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase())
}

const asInteger = (value, fallback, { min, max }) => {
  const parsed = Number(value ?? fallback)
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`Runtime value must be an integer between ${min} and ${max}.`)
  }
  return parsed
}

export function createRuntimeConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV ?? 'development'
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
    port: asInteger(env.PORT, 3001, { min: 1, max: 65535 }),
    databasePath: env.DATABASE_PATH ?? 'data/ptit-teaching-assistant.sqlite',
    rag: Object.freeze({
      enabled: ragEnabled,
      baseUrl: parsedUrl.toString().replace(/\/$/, ''),
      serviceToken: env.RAG_SERVICE_TOKEN ?? '',
      timeoutMs: asInteger(env.RAG_TIMEOUT_MS, 30_000, { min: 100, max: 120_000 }),
      maxRetries: asInteger(env.RAG_MAX_RETRIES, 2, { min: 0, max: 5 }),
      retryDelayMs: asInteger(env.RAG_RETRY_DELAY_MS, 100, { min: 0, max: 10_000 }),
    }),
  })
}
