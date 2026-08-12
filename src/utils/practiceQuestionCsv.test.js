import { describe, expect, it } from 'vitest'
import {
  createPracticeQuestionCsvTemplate,
  parsePracticeQuestionCsv,
  PRACTICE_CSV_HEADERS,
} from './practiceQuestionCsv'

describe('practice question CSV', () => {
  it('creates a UTF-8 template that can be parsed back', () => {
    const template = createPracticeQuestionCsvTemplate()
    expect(template.startsWith('\uFEFF')).toBe(true)
    expect(template).toContain(PRACTICE_CSV_HEADERS.join(','))

    const rows = parsePracticeQuestionCsv(template)
    expect(rows).toHaveLength(1)
    expect(rows[0].valid).toBe(true)
    expect(rows[0].question.correctOptionKey).toBe('B')
  })

  it('supports semicolon-delimited CSV and quoted line breaks', () => {
    const csv = [
      PRACTICE_CSV_HEADERS.join(';'),
      [
        'Câu hỏi có nội dung đủ dài?',
        'Đáp án A',
        'Đáp án B',
        'Đáp án C',
        'Đáp án D',
        'A',
        '"Giải thích có hai dòng\nvà vẫn hợp lệ."',
        'dễ',
      ].join(';'),
    ].join('\r\n')

    const rows = parsePracticeQuestionCsv(csv)
    expect(rows).toHaveLength(1)
    expect(rows[0].valid).toBe(true)
    expect(rows[0].question.difficulty).toBe('easy')
    expect(rows[0].question.explanation).toContain('\n')
  })

  it('reports row-level format errors', () => {
    const csv = [
      PRACTICE_CSV_HEADERS.join(','),
      ['Ngắn', 'A', 'A', '', 'D', 'E', 'Thiếu', 'unknown'].join(','),
    ].join('\n')

    const rows = parsePracticeQuestionCsv(csv)
    expect(rows[0].valid).toBe(false)
    expect(rows[0].errors.length).toBeGreaterThan(2)
  })
})
