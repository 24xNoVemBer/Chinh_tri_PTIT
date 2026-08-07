// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { STAGING_DISABLED_PASSWORD_HASH } from './applicationSchema.js'
import { resolveStagingCredentials, rotateStagingCredentials } from './stagingCredentials.js'

const validEnv = {
  STAGING_CREDENTIAL_ROTATION_CONFIRM: 'true',
  STAGING_STUDENT_EMAIL: 'student.staging@ptit.edu.vn',
  STAGING_STUDENT_PASSWORD: 'Student-staging-2026!',
  STAGING_LECTURER_EMAIL: 'lecturer.staging@ptit.edu.vn',
  STAGING_LECTURER_PASSWORD: 'Lecturer-staging-2026!',
}

describe('staging credential rotation', () => {
  it('requires explicit confirmation and non-public, distinct PTIT credentials', () => {
    expect(() => resolveStagingCredentials({})).toThrow('STAGING_CREDENTIAL_ROTATION_CONFIRM=true')
    expect(() =>
      resolveStagingCredentials({ ...validEnv, STAGING_STUDENT_PASSWORD: 'Student@123' }),
    ).toThrow('must not reuse a public development password')
    expect(() =>
      resolveStagingCredentials({
        ...validEnv,
        STAGING_LECTURER_PASSWORD: validEnv.STAGING_STUDENT_PASSWORD,
      }),
    ).toThrow('passwords must be different')
    expect(() =>
      resolveStagingCredentials({
        ...validEnv,
        STAGING_STUDENT_EMAIL: 'student@example.com',
      }),
    ).toThrow('must be a PTIT email')
  })

  it('updates one disabled student and lecturer credential in one transaction', async () => {
    const accounts = resolveStagingCredentials(validEnv)
    const users = new Map([
      [
        accounts[0].email,
        {
          id: 'student-1',
          email: accounts[0].email,
          role: 'student',
          password_hash: STAGING_DISABLED_PASSWORD_HASH,
        },
      ],
      [
        accounts[1].email,
        {
          id: 'lecturer-1',
          email: accounts[1].email,
          role: 'lecturer',
          password_hash: STAGING_DISABLED_PASSWORD_HASH,
        },
      ],
    ])
    const updates = []
    const transaction = {
      one: vi.fn(async (_sql, params) => users.get(String(params[0]).toLowerCase())),
      execute: vi.fn(async (_sql, params) => {
        updates.push(params)
        return { rowCount: 1 }
      }),
    }
    const client = { transaction: vi.fn(async (callback) => callback(transaction)) }

    await expect(
      rotateStagingCredentials(client, accounts, {
        hashPasswordImpl: (password) => 'scrypt$test$' + password,
      }),
    ).resolves.toEqual([
      { id: 'student-1', email: accounts[0].email, role: 'student' },
      { id: 'lecturer-1', email: accounts[1].email, role: 'lecturer' },
    ])
    expect(client.transaction).toHaveBeenCalledTimes(1)
    expect(transaction.one.mock.calls.every(([sql]) => sql.includes('FOR UPDATE'))).toBe(true)
    expect(updates).toEqual([
      ['scrypt$test$' + accounts[0].password, 'student-1'],
      ['scrypt$test$' + accounts[1].password, 'lecturer-1'],
    ])
  })

  it('refuses to overwrite an account whose credential is already active', async () => {
    const accounts = resolveStagingCredentials(validEnv)
    const transaction = {
      one: vi.fn(async (_sql, params) => ({
        id: String(params[0]).includes('student') ? 'student-1' : 'lecturer-1',
        email: params[0],
        role: String(params[0]).includes('student') ? 'student' : 'lecturer',
        password_hash: 'scrypt$already$active',
      })),
      execute: vi.fn(),
    }
    const client = { transaction: vi.fn(async (callback) => callback(transaction)) }

    await expect(
      rotateStagingCredentials(client, accounts, {
        hashPasswordImpl: () => 'scrypt$new$hash',
      }),
    ).rejects.toThrow('credential is not disabled')
    expect(transaction.execute).not.toHaveBeenCalled()
  })
})
