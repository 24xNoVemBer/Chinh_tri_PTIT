export function normalizeText(value = '') {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('vi')
    .trim()
}

export function includesNormalized(value, query) {
  return normalizeText(value).includes(normalizeText(query))
}
