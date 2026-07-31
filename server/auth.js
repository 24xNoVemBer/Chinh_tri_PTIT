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

export function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const derivedKey = scryptSync(password, salt, 64).toString('hex')
  return `scrypt$${salt}$${derivedKey}`
}

// A throwaway hash with the same cost as a real one. Verifying against it when the email
// does not exist keeps the response time flat, so timing no longer reveals which emails
// are registered.
export const DUMMY_PASSWORD_HASH = hashPassword(randomBytes(24).toString('hex'))

function scryptAsync(password, salt, keylen) {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, (error, derivedKey) => {
      if (error) reject(error)
      else resolve(derivedKey)
    })
  })
}

// scryptSync costs ~40ms and runs on the event loop, so a burst of login attempts stalls
// every other request. The async form hands the work to the threadpool instead.
export async function verifyPassword(password, storedHash) {
  const [algorithm, salt, expectedHex] = String(storedHash).split('$')
  if (algorithm !== 'scrypt' || !salt || !expectedHex) return false

  const actual = await scryptAsync(password, salt, 64)
  const expected = Buffer.from(expectedHex, 'hex')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
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
        const rawValue = part.slice(separator + 1)
        // A cookie carrying a broken escape sequence (e.g. `%`) used to throw here and turn
        // every subsequent API call into a 500 that the user could not clear themselves.
        let value
        try {
          value = decodeURIComponent(rawValue)
        } catch {
          value = rawValue
        }
        return [part.slice(0, separator), value]
      }),
  )
}

export function createSession(db, userId) {
  const token = randomBytes(32).toString('base64url')
  const now = new Date()
  const expiresAt = new Date(now.getTime() + SESSION_TTL_SECONDS * 1000)

  db.prepare(
    `INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(randomUUID(), userId, hashToken(token), expiresAt.toISOString(), now.toISOString())

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
         users.id,
         users.name,
         users.email,
         users.role
       FROM sessions
       JOIN users ON users.id = sessions.user_id
       WHERE sessions.token_hash = ?`,
    )
    .get(hashToken(token))

  if (!session) return null
  if (session.expires_at <= now) {
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
