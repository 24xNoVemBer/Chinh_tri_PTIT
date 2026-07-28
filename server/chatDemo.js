export function buildDemoChatContent(question, fallbackContent) {
  const normalizedQuestion = String(question).toLocaleLowerCase('vi')

  if (normalizedQuestion.includes('đại đoàn kết') || normalizedQuestion.includes('hồ chí minh')) {
    return 'Trong bản demo, câu trả lời bắt đầu từ nội dung cốt lõi của tư tưởng đại đoàn kết, sau đó gợi ý đối chiếu bối cảnh lịch sử và liên hệ với bài học. Nội dung này đang chờ giảng viên kiểm duyệt và sẽ được thay bằng kết quả từ RAG khi pipeline học liệu được kết nối.'
  }

  if (normalizedQuestion.includes('vật chất') || normalizedQuestion.includes('ý thức')) {
    return 'Bạn có thể bắt đầu từ câu hỏi: điều gì tồn tại khách quan và điều gì phản ánh thế giới khách quan trong hoạt động của con người? Câu trả lời demo đang minh họa cách trợ giảng gợi mở, có nguồn đối chiếu và chờ giảng viên kiểm duyệt.'
  }

  return fallbackContent
}

export function classifyDemoModeration({ question, subjectId, hasPageCitation }) {
  const normalizedQuestion = String(question).toLocaleLowerCase('vi')
  const topicRules = [
    { subjectId: 'sub1', keywords: ['vật chất', 'ý thức', 'mối liên hệ'] },
    { subjectId: 'sub2', keywords: ['sức lao động', 'giá trị thặng dư', 'hàng hóa'] },
    { subjectId: 'sub4', keywords: ['hồ chí minh', 'đại đoàn kết'] },
  ]
  const matchedTopic = topicRules.find((rule) =>
    rule.keywords.some((keyword) => normalizedQuestion.includes(keyword)),
  )

  if (matchedTopic && matchedTopic.subjectId !== subjectId) {
    return {
      priority: 'high',
      queue: 'attention',
      requiresReview: true,
      reason: 'Câu hỏi có dấu hiệu không thuộc học phần đã chọn.',
    }
  }

  if (!hasPageCitation) {
    return {
      priority: 'high',
      queue: 'attention',
      requiresReview: true,
      reason: 'Citation demo chưa xác định được trang cần đối chiếu.',
    }
  }

  if (!matchedTopic) {
    return {
      priority: 'medium',
      queue: 'attention',
      requiresReview: true,
      reason: 'Câu hỏi mở cần giảng viên xem xét theo ngữ cảnh môn học.',
    }
  }

  return {
    priority: 'sample',
    queue: 'sample',
    requiresReview: false,
    reason: 'Câu hỏi khớp học phần và có citation theo trang; đưa vào kiểm tra lấy mẫu.',
  }
}
