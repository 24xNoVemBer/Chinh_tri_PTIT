export function normalizeParams(params) {
  if (params === undefined) return []
  return Array.isArray(params) ? params : [params]
}

/**
 * Converts the existing positional `?` placeholders to PostgreSQL `$n`
 * placeholders without touching quoted string literals.
 */
export function toPostgresSql(sql) {
  let parameterIndex = 0
  let quote = null
  let result = ''

  for (let index = 0; index < sql.length; index += 1) {
    const character = sql[index]
    const nextCharacter = sql[index + 1]

    if (quote) {
      result += character
      if (character === quote && nextCharacter === quote) {
        result += nextCharacter
        index += 1
      } else if (character === quote) {
        quote = null
      }
      continue
    }

    if (character === "'" || character === '"') {
      quote = character
      result += character
      continue
    }

    if (character === '?') {
      parameterIndex += 1
      result += `$${parameterIndex}`
      continue
    }

    result += character
  }

  return result
}
