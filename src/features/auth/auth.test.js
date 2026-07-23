import { describe, expect, it } from 'vitest'
import { isValidRole, ROLES } from './auth'

describe('auth roles', () => {
  it('recognizes the student role', () => {
    expect(isValidRole(ROLES.STUDENT)).toBe(true)
  })

  it('recognizes the lecturer role', () => {
    expect(isValidRole(ROLES.LECTURER)).toBe(true)
  })

  it('rejects unsupported roles and keeps the role map immutable', () => {
    expect(isValidRole('admin')).toBe(false)
    expect(isValidRole(null)).toBe(false)
    expect(Object.isFrozen(ROLES)).toBe(true)
  })
})
