export function buildDemoReply(question) {
  const normalizedQuestion = question.toLocaleLowerCase('vi')

  if (normalizedQuestion.includes('đại đoàn kết') || normalizedQuestion.includes('hồ chí minh')) {
    return {
      content:
        'Trong bản demo, câu trả lời sẽ bắt đầu bằng khái niệm cốt lõi, sau đó gợi ý bạn đối chiếu bối cảnh lịch sử và liên hệ với bài học. Khi nối RAG, phần này sẽ được tạo từ học liệu đã phê duyệt thay vì đoạn mô phỏng cố định.',
      citations: [
        {
          title: 'Giáo trình Tư tưởng Hồ Chí Minh',
          author: 'Bộ Giáo dục và Đào tạo',
          location: 'Chương về đại đoàn kết dân tộc',
        },
      ],
    }
  }

  if (normalizedQuestion.includes('vật chất') || normalizedQuestion.includes('ý thức')) {
    return {
      content:
        'Bạn có thể bắt đầu từ câu hỏi: điều gì tồn tại khách quan và điều gì phản ánh thế giới khách quan trong hoạt động của con người? Giao diện demo đang minh họa cách trợ giảng gợi mở thay vì đưa ngay một đáp án để chép lại.',
      citations: [
        {
          title: 'Giáo trình Triết học Mác - Lênin',
          author: 'Bộ Giáo dục và Đào tạo',
          location: 'Chương 2, mục Vật chất và ý thức',
        },
      ],
    }
  }

  return {
    content:
      'Để trả lời đúng ngữ cảnh, hãy xác định môn học, chương và luận điểm bạn đang đọc. Bản demo này cho thấy cấu trúc hội thoại, trích dẫn và phản hồi. Nội dung chưa được sinh bởi model RAG.',
    citations: [
      {
        title: 'Hướng dẫn học tập Triết học Mác - Lênin',
        author: 'Khoa Lý luận Chính trị PTIT',
        location: 'Tài liệu hướng dẫn học tập',
      },
    ],
  }
}
