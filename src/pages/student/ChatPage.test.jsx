import { describe, expect, it } from 'vitest'
import { buildDemoReply } from './chatDemo'

describe('chat demo replies', () => {
  it('returns the concept explanation for material and consciousness questions', () => {
    const reply = buildDemoReply('Vật chất và ý thức khác nhau như thế nào?')

    expect(reply.content).toContain('tồn tại khách quan')
    expect(reply.citations).toHaveLength(1)
  })

  it('keeps a source-backed fallback for open-ended prompts', () => {
    const reply = buildDemoReply('Giúp mình ôn nhanh nội dung hôm nay')

    expect(reply.content).toContain('chưa được sinh bởi model RAG')
    expect(reply.citations.length).toBeGreaterThan(0)
  })
})
