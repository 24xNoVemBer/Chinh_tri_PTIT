import { DATA_TABLE_ORDER, POSTGRES_PUBLIC_TABLES } from './applicationSchema.js'

const SYSTEM_DATABASES = new Set(['postgres', 'template0', 'template1'])
const PRODUCTION_TOKEN = /(^|[._-])prod(?:uction)?($|[._-])/i

function requireConfirmation(env, name, operation) {
  const value = String(env[name] ?? '').trim()
  if (!value) {
    throw new Error(name + ' is required before ' + operation + '.')
  }
  return value
}

function decoded(value, label) {
  try {
    return decodeURIComponent(value)
  } catch {
    throw new Error('DATABASE_URL contains an invalid encoded ' + label + '.')
  }
}

export function resolveConfirmedPostgresTarget(
  databaseUrl,
  env = process.env,
  { operation = 'PostgreSQL administration' } = {},
) {
  let parsed
  try {
    parsed = new URL(databaseUrl)
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL URL before ' + operation + '.')
  }

  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error('DATABASE_URL must use postgres:// or postgresql:// before ' + operation + '.')
  }

  if (parsed.hash) {
    throw new Error('DATABASE_URL must not contain a URL fragment before ' + operation + '.')
  }
  const identityOverrides = ['host', 'port', 'database', 'dbname', 'user', 'username'].filter(
    (name) => parsed.searchParams.has(name),
  )
  if (identityOverrides.length) {
    throw new Error(
      'DATABASE_URL must not override target identity through query parameters: ' +
        identityOverrides.join(', ') +
        '.',
    )
  }
  const database = decoded(parsed.pathname.replace(/^\//, ''), 'database name')
  const user = decoded(parsed.username, 'user name')
  const host = parsed.host.toLowerCase()
  if (!database || database.includes('/')) {
    throw new Error('DATABASE_URL must identify exactly one PostgreSQL database.')
  }
  if (!user) throw new Error('DATABASE_URL must identify a PostgreSQL user.')
  if (!host) throw new Error('DATABASE_URL must identify a PostgreSQL host.')
  if (SYSTEM_DATABASES.has(database.toLowerCase())) {
    throw new Error(
      'Administrative operations must not target PostgreSQL system database ' + database + '.',
    )
  }

  const confirmedDatabase = requireConfirmation(env, 'DATABASE_CONFIRM_NAME', operation)
  const confirmedUser = requireConfirmation(env, 'DATABASE_CONFIRM_USER', operation)
  const confirmedHost = requireConfirmation(env, 'DATABASE_CONFIRM_HOST', operation).toLowerCase()
  const mismatches = []
  if (confirmedDatabase !== database) mismatches.push('database')
  if (confirmedUser !== user) mismatches.push('user')
  if (confirmedHost !== host) mismatches.push('host')
  if (mismatches.length) {
    throw new Error(
      'PostgreSQL target confirmation mismatch for ' +
        mismatches.join(', ') +
        ' before ' +
        operation +
        '.',
    )
  }

  const productionLike = PRODUCTION_TOKEN.test(database) || PRODUCTION_TOKEN.test(parsed.hostname)
  if (productionLike && env.DATABASE_ALLOW_PRODUCTION_ADMIN !== 'true') {
    throw new Error(
      'Production-like PostgreSQL target blocked. Set DATABASE_ALLOW_PRODUCTION_ADMIN=true only through an approved break-glass procedure.',
    )
  }

  return Object.freeze({ database, user, host, operation, productionLike })
}

export async function verifyConnectedPostgresTarget(client, target) {
  if (!client || typeof client.one !== 'function') {
    throw new Error('verifyConnectedPostgresTarget requires a PostgreSQL client.')
  }
  if (!target?.database || !target?.user) {
    throw new Error('A confirmed PostgreSQL target is required before connection verification.')
  }

  const info = await client.one(
    'SELECT current_database() AS database, current_user AS user, inet_server_addr()::text AS server_addr, inet_server_port() AS server_port',
  )
  const mismatches = []
  if (info?.database !== target.database) mismatches.push('database')
  if (info?.user !== target.user) mismatches.push('user')
  if (mismatches.length) {
    throw new Error('Connected PostgreSQL identity mismatch for ' + mismatches.join(', ') + '.')
  }

  return Object.freeze({
    database: info.database,
    user: info.user,
    serverAddress: info.server_addr ?? null,
    serverPort: info.server_port == null ? null : Number(info.server_port),
  })
}
function quoteApplicationTable(table) {
  if (!DATA_TABLE_ORDER.includes(table)) {
    throw new Error('Unknown application table: ' + table + '.')
  }
  return '"' + table + '"'
}

export async function inspectPostgresApplicationSchema(client) {
  if (!client || typeof client.many !== 'function') {
    throw new Error('inspectPostgresApplicationSchema requires a PostgreSQL client.')
  }

  const rows = await client.many(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name",
  )
  const actual = new Set(rows.map((row) => row.table_name))
  const expected = new Set(POSTGRES_PUBLIC_TABLES)
  const missing = POSTGRES_PUBLIC_TABLES.filter((table) => !actual.has(table))
  const unexpected = [...actual].filter((table) => !expected.has(table)).sort()

  if (missing.length || unexpected.length) {
    const details = []
    if (missing.length) details.push('missing=' + missing.join(','))
    if (unexpected.length) details.push('unexpected=' + unexpected.join(','))
    throw new Error(
      'PostgreSQL application schema is not ready; run db:migrate on a dedicated target first (' +
        details.join('; ') +
        ').',
    )
  }

  return Object.freeze({
    tableCount: actual.size,
    tables: Object.freeze([...actual].sort()),
  })
}

export async function assertPostgresImportTargetReady(client, { requireEmpty = true } = {}) {
  if (!client || typeof client.one !== 'function') {
    throw new Error('assertPostgresImportTargetReady requires a PostgreSQL client.')
  }

  const schema = await inspectPostgresApplicationSchema(client)
  if (!requireEmpty) {
    return Object.freeze({ ...schema, requireEmpty, occupied: Object.freeze([]) })
  }

  const occupied = []
  for (const table of DATA_TABLE_ORDER) {
    if (table === 'schema_meta') continue
    const row = await client.one('SELECT COUNT(*) AS count FROM ' + quoteApplicationTable(table))
    const count = Number(row?.count)
    if (!Number.isSafeInteger(count) || count < 0) {
      throw new Error('PostgreSQL returned an invalid row count for ' + table + '.')
    }
    if (count > 0) occupied.push(Object.freeze({ table, count }))
  }
  if (occupied.length) {
    throw new Error(
      'Import target is not empty: ' +
        occupied.map(({ table, count }) => table + '=' + count).join(', ') +
        '.',
    )
  }

  return Object.freeze({
    ...schema,
    requireEmpty,
    occupied: Object.freeze(occupied),
  })
}
