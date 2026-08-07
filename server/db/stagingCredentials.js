import { hashPassword } from '../auth.js'
import { STAGING_DISABLED_PASSWORD_HASH } from './applicationSchema.js'

const PUBLIC_DEMO_PASSWORDS = new Set(['Student@123', 'Lecturer@123'])
const PTIT_EMAIL_SUFFIX = '@ptit.edu.vn'

function required(env, name) {
  const value = env[name]
  if (value === undefined || value === null || value === '') {
    throw new Error(name + ' is required for staging credential rotation.')
  }
  return String(value)
}

function normalizeEmail(env, name) {
  const email = required(env, name).trim().toLowerCase()
  if (!email.endsWith(PTIT_EMAIL_SUFFIX) || email === PTIT_EMAIL_SUFFIX) {
    throw new Error(name + ' must be a PTIT email ending in ' + PTIT_EMAIL_SUFFIX + '.')
  }
  return email
}

function validatePassword(env, name) {
  const password = required(env, name)
  if (password !== password.trim()) {
    throw new Error(name + ' must not start or end with whitespace.')
  }
  if (PUBLIC_DEMO_PASSWORDS.has(password)) {
    throw new Error(name + ' must not reuse a public development password.')
  }
  if (password.length < 16 || password.length > 128) {
    throw new Error(name + ' must contain between 16 and 128 characters.')
  }
  return password
}

export function resolveStagingCredentials(env = process.env) {
  if (env.STAGING_CREDENTIAL_ROTATION_CONFIRM !== 'true') {
    throw new Error(
      'Set STAGING_CREDENTIAL_ROTATION_CONFIRM=true only after staging snapshot validation.',
    )
  }

  const accounts = [
    Object.freeze({
      role: 'student',
      email: normalizeEmail(env, 'STAGING_STUDENT_EMAIL'),
      password: validatePassword(env, 'STAGING_STUDENT_PASSWORD'),
    }),
    Object.freeze({
      role: 'lecturer',
      email: normalizeEmail(env, 'STAGING_LECTURER_EMAIL'),
      password: validatePassword(env, 'STAGING_LECTURER_PASSWORD'),
    }),
  ]
  if (accounts[0].email === accounts[1].email) {
    throw new Error('Staging student and lecturer emails must be different.')
  }
  if (accounts[0].password === accounts[1].password) {
    throw new Error('Staging student and lecturer passwords must be different.')
  }

  return Object.freeze(accounts)
}

export async function rotateStagingCredentials(
  client,
  accounts,
  { hashPasswordImpl = hashPassword } = {},
) {
  if (!client || typeof client.transaction !== 'function') {
    throw new Error('rotateStagingCredentials requires a transactional database client.')
  }
  if (!Array.isArray(accounts) || accounts.length !== 2) {
    throw new Error('Exactly one student and one lecturer staging account are required.')
  }
  const roles = new Set(accounts.map((account) => account.role))
  if (!roles.has('student') || !roles.has('lecturer') || roles.size !== 2) {
    throw new Error('Staging credential accounts must contain student and lecturer roles.')
  }

  const prepared = accounts.map((account) => {
    if (!account?.email || typeof account.password !== 'string') {
      throw new Error('Each staging credential account requires an email and password.')
    }
    return {
      role: account.role,
      email: account.email,
      passwordHash: hashPasswordImpl(account.password),
    }
  })
  const rotated = []

  await client.transaction(async (transaction) => {
    const users = []
    for (const account of prepared) {
      const user = await transaction.one(
        'SELECT id, email, role, password_hash FROM users WHERE email = ? FOR UPDATE',
        [account.email],
      )
      if (!user) throw new Error('Staging ' + account.role + ' account was not found.')
      if (user.role !== account.role) {
        throw new Error('Staging account role mismatch for ' + account.role + '.')
      }
      if (user.password_hash !== STAGING_DISABLED_PASSWORD_HASH) {
        throw new Error(
          'Staging ' + account.role + ' credential is not disabled; refusing to overwrite it.',
        )
      }
      users.push({ account, user })
    }

    for (const { account, user } of users) {
      const result = await transaction.execute('UPDATE users SET password_hash = ? WHERE id = ?', [
        account.passwordHash,
        user.id,
      ])
      if (Number(result?.rowCount ?? 0) !== 1) {
        throw new Error('Failed to rotate exactly one ' + account.role + ' credential.')
      }
      rotated.push(Object.freeze({ id: user.id, email: user.email, role: user.role }))
    }
  })

  return Object.freeze(rotated)
}
