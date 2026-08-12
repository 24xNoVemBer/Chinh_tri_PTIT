import {
  createHash,
  randomBytes,
  randomUUID,
  scrypt,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto'

const SESSION_COOKIE = 'ptit_session'
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7
const PASSWORD_KEY_LENGTH = 64
const PASSWORD_HASH_HEX_LENGTH = PASSWORD_KEY_LENGTH * 2

export const DUMMY_PASSWORD_HASH =
  'scrypt$auth-dummy-v1$edca08e3a78b525dc139085fd9ab524b70b75978a70fe825a50e268da13dff6d7361756f8af248a62eedef658b3b8fbb5d704cfed69724e23e92c42557ba0445'

export function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const derivedKey = scryptSync(password, salt, PASSWORD_KEY_LENGTH).toString('hex')
  return `scrypt$${salt}$${derivedKey}`
}

function derivePasswordKeyAsync(password, salt, keyLength) {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, (error, derivedKey) => {
      if (error) reject(error)
      else resolve(derivedKey)
    })
  })
}

function parsePasswordHash(storedHash) {
  const parts = String(storedHash ?? '').split('$')
  if (parts.length !== 3) return null

  const [algorithm, salt, expectedHex] = parts
  if (algorithm !== 'scrypt' || !salt || salt.length > 256) return null
  if (expectedHex.length !== PASSWORD_HASH_HEX_LENGTH || !/^[0-9a-f]+$/i.test(expectedHex)) {
    return null
  }

  return { salt, expected: Buffer.from(expectedHex, 'hex') }
}

export async function verifyPasswordAsync(
  password,
  storedHash,
  { deriveKey = derivePasswordKeyAsync } = {},
) {
  const parsedHash = parsePasswordHash(storedHash)
  if (!parsedHash) return false

  const derivedKey = await deriveKey(String(password), parsedHash.salt, PASSWORD_KEY_LENGTH)
  const actual = Buffer.from(derivedKey)
  return (
    actual.length === parsedHash.expected.length && timingSafeEqual(actual, parsedHash.expected)
  )
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

function parseCookies(cookieHeader = '') {
  return Object.fromEntries(
    cookieHeader
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separator = part.indexOf('=')
        if (separator < 0) return [part, '']
        return [part.slice(0, separator), decodeURIComponent(part.slice(separator + 1))]
      }),
  )
}

export function createSession(db, userId) {
  const token = randomBytes(32).toString('base64url')
  const now = new Date()
  const expiresAt = new Date(now.getTime() + SESSION_TTL_SECONDS * 1000)

  const user = db.prepare('SELECT auth_version FROM users WHERE id = ?').get(userId)
  if (!user) throw new Error('Cannot create a session for an unknown user.')
  db.prepare(
    `INSERT INTO sessions (id, user_id, token_hash, auth_version, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    randomUUID(),
    userId,
    hashToken(token),
    user.auth_version,
    expiresAt.toISOString(),
    now.toISOString(),
  )

  return { token, expiresAt }
}

export function getSessionToken(request) {
  return parseCookies(request.headers.cookie)[SESSION_COOKIE] ?? null
}

export function authenticateRequest(db, request) {
  const token = getSessionToken(request)
  if (!token) return null

  const now = new Date().toISOString()
  const session = db
    .prepare(
      `SELECT
         sessions.id AS session_id,
         sessions.expires_at,
         sessions.auth_version AS session_auth_version,
         users.id,
         users.name,
         users.email,
         users.role,
         users.status,
         users.auth_version AS user_auth_version
       FROM sessions
       JOIN users ON users.id = sessions.user_id
       WHERE sessions.token_hash = ?`,
    )
    .get(hashToken(token))

  if (!session) return null
  if (
    session.expires_at <= now ||
    session.status !== 'active' ||
    session.session_auth_version !== session.user_auth_version
  ) {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(session.session_id)
    return null
  }

  return {
    sessionId: session.session_id,
    user: {
      id: session.id,
      name: session.name,
      email: session.email,
      role: session.role,
    },
  }
}

export function destroySession(db, token) {
  if (!token) return
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token))
}

export function createSessionCookie(token, { secure = false } = {}) {
  const attributes = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${SESSION_TTL_SECONDS}`,
  ]
  if (secure) attributes.push('Secure')
  return attributes.join('; ')
}

export function clearSessionCookie({ secure = false } = {}) {
  const attributes = [`${SESSION_COOKIE}=`, 'HttpOnly', 'Path=/', 'SameSite=Lax', 'Max-Age=0']
  if (secure) attributes.push('Secure')
  return attributes.join('; ')
}

export async function createSessionAsync(client, userId) {
  const token = randomBytes(32).toString('base64url')
  const now = new Date()
  const expiresAt = new Date(now.getTime() + SESSION_TTL_SECONDS * 1000)

  const user = await client.one('SELECT auth_version FROM users WHERE id = ?', [userId])
  if (!user) throw new Error('Cannot create a session for an unknown user.')
  await client.execute(
    `INSERT INTO sessions (id, user_id, token_hash, auth_version, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      randomUUID(),
      userId,
      hashToken(token),
      user.auth_version,
      expiresAt.toISOString(),
      now.toISOString(),
    ],
  )

  return { token, expiresAt }
}

export async function authenticateRequestAsync(client, request) {
  const token = getSessionToken(request)
  if (!token) return null

  const now = new Date().toISOString()
  const session = await client.one(
    `SELECT
       sessions.id AS session_id,
       sessions.expires_at,
       sessions.auth_version AS session_auth_version,
       users.id,
       users.name,
       users.email,
       users.role,
       users.status,
       users.auth_version AS user_auth_version
     FROM sessions
     JOIN users ON users.id = sessions.user_id
     WHERE sessions.token_hash = ?`,
    [hashToken(token)],
  )

  if (!session) return null
  if (
    session.expires_at <= now ||
    session.status !== 'active' ||
    session.session_auth_version !== session.user_auth_version
  ) {
    await client.execute('DELETE FROM sessions WHERE id = ?', [session.session_id])
    return null
  }

  return {
    sessionId: session.session_id,
    user: {
      id: session.id,
      name: session.name,
      email: session.email,
      role: session.role,
    },
  }
}

export async function destroySessionAsync(client, token) {
  if (!token) return
  await client.execute('DELETE FROM sessions WHERE token_hash = ?', [hashToken(token)])
}
