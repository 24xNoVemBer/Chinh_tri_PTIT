export const ROLES = Object.freeze({
  STUDENT: 'student',
  LECTURER: 'lecturer',
})

export function isValidRole(role) {
  return Object.values(ROLES).includes(role)
}
