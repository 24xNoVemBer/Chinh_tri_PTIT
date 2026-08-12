export const PRACTICE_CSV_HEADERS = [
  'noi_dung',
  'dap_an_a',
  'dap_an_b',
  'dap_an_c',
  'dap_an_d',
  'dap_an_dung',
  'giai_thich',
  'do_kho',
]

const DIFFICULTY_ALIASES = new Map([
  ['easy', 'easy'],
  ['de', 'easy'],
  ['dễ', 'easy'],
  ['medium', 'medium'],
  ['trung_binh', 'medium'],
  ['trung bình', 'medium'],
  ['hard', 'hard'],
  ['kho', 'hard'],
  ['khó', 'hard'],
])

function escapeCsvCell(value) {
  const text = String(value ?? '')
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function createPracticeQuestionCsvTemplate() {
  const sample = [
    'Mục tiêu trực tiếp của sản xuất tư bản chủ nghĩa là gì?',
    'Tạo ra sản phẩm để tự cung tự cấp',
    'Tạo ra giá trị thặng dư',
    'Phân phối bình đẳng mọi nguồn lực',
    'Xóa bỏ trao đổi hàng hóa',
    'B',
    'Sản xuất tư bản chủ nghĩa hướng trực tiếp tới việc tạo ra giá trị thặng dư.',
    'medium',
  ]
  return `\uFEFF${[PRACTICE_CSV_HEADERS, sample]
    .map((row) => row.map(escapeCsvCell).join(','))
    .join('\r\n')}\r\n`
}

function parseWithDelimiter(text, delimiter) {
  const rows = []
  let row = []
  let cell = ''
  let quoted = false

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        cell += '"'
        index += 1
      } else if (character === '"') {
        quoted = false
      } else {
        cell += character
      }
      continue
    }

    if (character === '"') {
      quoted = true
    } else if (character === delimiter) {
      row.push(cell)
      cell = ''
    } else if (character === '\n') {
      row.push(cell.replace(/\r$/, ''))
      rows.push(row)
      row = []
      cell = ''
    } else {
      cell += character
    }
  }

  if (quoted) throw new Error('File CSV có dấu ngoặc kép chưa được đóng.')
  if (cell || row.length) {
    row.push(cell.replace(/\r$/, ''))
    rows.push(row)
  }
  return rows
}

function normalizeHeader(value) {
  return String(value ?? '')
    .replace(/^\uFEFF/, '')
    .trim()
    .toLocaleLowerCase()
}

function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? ''
  const candidates = [',', ';', '\t']
  return candidates
    .map((delimiter) => ({
      delimiter,
      columns: parseWithDelimiter(firstLine, delimiter)[0]?.length ?? 0,
    }))
    .sort((left, right) => right.columns - left.columns)[0].delimiter
}

function validateRow(values, rowNumber) {
  const errors = []
  const content = values.noi_dung.trim()
  const explanation = values.giai_thich.trim()
  const options = ['A', 'B', 'C', 'D'].map((key) => ({
    key,
    content: values[`dap_an_${key.toLocaleLowerCase()}`].trim(),
  }))
  const correctOptionKey = values.dap_an_dung.trim().toLocaleUpperCase()
  const difficultyInput = values.do_kho.trim().toLocaleLowerCase()
  const difficulty = DIFFICULTY_ALIASES.get(difficultyInput)

  if (content.length < 10) errors.push('Nội dung cần ít nhất 10 ký tự.')
  if (options.some((option) => !option.content)) errors.push('Cần nhập đủ đáp án A, B, C và D.')
  if (new Set(options.map((option) => option.content.toLocaleLowerCase())).size !== 4) {
    errors.push('Bốn đáp án không được trùng nhau.')
  }
  if (!['A', 'B', 'C', 'D'].includes(correctOptionKey)) {
    errors.push('Đáp án đúng phải là A, B, C hoặc D.')
  }
  if (explanation.length < 10) errors.push('Giải thích cần ít nhất 10 ký tự.')
  if (!difficulty) errors.push('Độ khó phải là easy, medium hoặc hard.')

  return {
    rowNumber,
    valid: errors.length === 0,
    errors,
    question: {
      content,
      explanation,
      difficulty: difficulty ?? difficultyInput,
      correctOptionKey,
      options,
    },
  }
}

export function parsePracticeQuestionCsv(text, { maxRows = 200 } = {}) {
  const source = String(text ?? '').replace(/^\uFEFF/, '')
  if (!source.trim()) throw new Error('File CSV đang trống.')

  const rows = parseWithDelimiter(source, detectDelimiter(source)).filter((row) =>
    row.some((cell) => String(cell).trim()),
  )
  if (rows.length < 2) throw new Error('File CSV chưa có dòng câu hỏi nào.')

  const headers = rows[0].map(normalizeHeader)
  const duplicateHeaders = headers.filter((header, index) => headers.indexOf(header) !== index)
  if (duplicateHeaders.length) throw new Error(`Tên cột bị trùng: ${duplicateHeaders.join(', ')}.`)

  const missingHeaders = PRACTICE_CSV_HEADERS.filter((header) => !headers.includes(header))
  if (missingHeaders.length) throw new Error(`Thiếu cột bắt buộc: ${missingHeaders.join(', ')}.`)
  if (rows.length - 1 > maxRows) throw new Error(`Mỗi lần chỉ được nhập tối đa ${maxRows} câu hỏi.`)

  const parsedRows = rows.slice(1).map((row, index) => {
    const values = Object.fromEntries(
      PRACTICE_CSV_HEADERS.map((header) => [header, row[headers.indexOf(header)] ?? '']),
    )
    return validateRow(values, index + 2)
  })

  const seen = new Map()
  for (const row of parsedRows) {
    const key = row.question.content.toLocaleLowerCase()
    if (seen.has(key)) {
      row.valid = false
      row.errors.push(`Trùng nội dung với dòng ${seen.get(key)}.`)
    } else {
      seen.set(key, row.rowNumber)
    }
  }

  return parsedRows
}
