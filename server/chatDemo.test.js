import { describe, expect, it } from 'vitest'
import { buildDemoChatContent, classifyDemoModeration } from './chatDemo.js'

describe('chat demo content', () => {
  it('returns the concept explanation for material and consciousness questions', () => {
    const reply = buildDemoChatContent(
      'Vật chất và ý thức khác nhau như thế nào?',
      'Nội dung dự phòng',
    )

    expect(reply).toContain('tồn tại khách quan')
    expect(reply).toContain('chờ giảng viên kiểm duyệt')
  })

  it('uses the subject fallback for open-ended prompts', () => {
    expect(buildDemoChatContent('Giúp mình ôn nhanh nội dung hôm nay', 'Nội dung theo môn')).toBe(
      'Nội dung theo môn',
    )
  })

  it('routes a cited in-scope concept to sampling instead of mandatory review', () => {
    expect(
      classifyDemoModeration({
        question: 'Vật chất và ý thức có quan hệ như thế nào?',
        subjectId: 'sub1',
        hasPageCitation: true,
      }),
    ).toMatchObject({ priority: 'sample', requiresReview: false })
  })

  it('raises cross-subject questions to high priority', () => {
    expect(
      classifyDemoModeration({
        question: 'Vật chất và ý thức có quan hệ như thế nào?',
        subjectId: 'sub2',
        hasPageCitation: true,
      }),
    ).toMatchObject({ priority: 'high', requiresReview: true })
  })
})
