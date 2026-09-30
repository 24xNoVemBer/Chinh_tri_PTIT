import { describe, expect, it, vi } from 'vitest'
import { extractChatResult, runCli, validateApiBase } from './evaluate-chat.mjs'

describe('MBA chat evaluation runner', () => {
  it('accepts only loopback API bases', () => {
    expect(validateApiBase('http://127.0.0.1:4558').toString()).toBe('http://127.0.0.1:4558/')
    expect(() => validateApiBase('https://example.com')).toThrow(/loopback/u)
  })

  it('normalizes the MBA_API answer and preserves complete source text', () => {
    expect(
      extractChatResult({
        status: 'ok',
        text: {
          response: 'Đáp án',
          sources: [{ file_name: 'giao-trinh.pdf', score: 0.7, text: 'Đoạn trích đầy đủ.' }],
        },
      }),
    ).toEqual({
      status: 'ok',
      answer: 'Đáp án',
      sources: [{ fileName: 'giao-trinh.pdf', score: 0.7, text: 'Đoạn trích đầy đủ.' }],
    })
  })

  it('prints a dry-run without making an upstream request', async () => {
    const fetchImpl = vi.fn()
    const log = vi.spyOn(globalThis.console, 'log').mockImplementation(() => {})

    await expect(runCli(['--source', 'BAS1151'], {}, fetchImpl)).resolves.toBe(0)

    expect(fetchImpl).not.toHaveBeenCalled()
    expect(JSON.parse(log.mock.calls[0][0])).toMatchObject({
      mode: 'dry-run',
      source: 'BAS1151',
      request: { save: false, source: 'BAS1151' },
    })
    log.mockRestore()
  })

  it('supports a custom diagnostic question without sending it by default', async () => {
    const fetchImpl = vi.fn()
    const log = vi.spyOn(globalThis.console, 'log').mockImplementation(() => {})
    const question = 'Theo giáo trình, giá trị sử dụng của hàng hóa là gì?'

    await expect(
      runCli(['--source', 'BAS1151', '--question', question], {}, fetchImpl),
    ).resolves.toBe(0)

    expect(fetchImpl).not.toHaveBeenCalled()
    expect(JSON.parse(log.mock.calls[0][0])).toMatchObject({
      mode: 'dry-run',
      question,
      request: { text: question, source: 'BAS1151' },
    })
    log.mockRestore()
  })

  it('requires explicit opt-in before a live request', async () => {
    await expect(runCli(['--source', 'BAS1151', '--run'], {}, vi.fn())).rejects.toThrow(
      /--confirm-chat-request/u,
    )
  })
})
