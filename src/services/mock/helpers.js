export { includesNormalized, normalizeText } from '../../utils/text'

export function clone(value) {
  return structuredClone(value)
}

export function createRepositoryError(code, message, retryable = false) {
  const error = new Error(message)
  error.code = code
  error.retryable = retryable
  return error
}
