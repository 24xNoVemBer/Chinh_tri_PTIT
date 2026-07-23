export const learningProgress = [
  {
    id: 'lp1',
    studentId: 's1',
    lessonId: 'les1',
    progress: 100,
    lastReadAt: '2023-09-26T08:30:00Z',
  },
  {
    id: 'lp2',
    studentId: 's1',
    lessonId: 'les2',
    progress: 72,
    lastReadAt: '2023-09-25T14:10:00Z',
  },
  {
    id: 'lp3',
    studentId: 's1',
    lessonId: 'les3',
    progress: 35,
    lastReadAt: '2023-09-24T09:20:00Z',
  },
  {
    id: 'lp4',
    studentId: 's1',
    lessonId: 'les7',
    progress: 58,
    lastReadAt: '2023-09-23T16:45:00Z',
  },
  {
    id: 'lp5',
    studentId: 's1',
    lessonId: 'les8',
    progress: 100,
    lastReadAt: '2023-09-22T07:50:00Z',
  },
]

export const searchHistory = [
  {
    id: 'sh1',
    studentId: 's1',
    query: 'mối liên hệ phổ biến',
    subjectId: 'sub1',
    lessonId: 'les4',
    resultCount: 2,
    createdAt: '2023-09-26T09:15:00Z',
  },
  {
    id: 'sh2',
    studentId: 's1',
    query: 'hàng hóa sức lao động',
    subjectId: 'sub2',
    lessonId: null,
    resultCount: 3,
    createdAt: '2023-09-24T20:10:00Z',
  },
]

export const subjectMockResponses = [
  {
    subjectId: 'sub1',
    title: 'Gợi ý từ kho Triết học Mác - Lênin',
    content:
      'Khi phân tích một khái niệm triết học, em nên xác định định nghĩa, mối quan hệ với các khái niệm gần nhất và một ví dụ thực tiễn. Hãy đối chiếu lại phần nguyên lý về mối liên hệ phổ biến và sự phát triển trong giáo trình.',
    sourceLabel: 'Giáo trình Triết học Mác - Lênin, 2021',
    materialId: 'mat1',
  },
  {
    subjectId: 'sub2',
    title: 'Gợi ý từ kho Kinh tế chính trị',
    content:
      'Em nên tách câu hỏi thành chủ thể kinh tế, quan hệ sản xuất và cách giá trị được tạo ra hoặc phân phối. Phần hàng hóa, sức lao động và giá trị thặng dư trong giáo trình là nguồn phù hợp để đối chiếu.',
    sourceLabel: 'Giáo trình Kinh tế chính trị Mác - Lênin, 2021',
    materialId: 'mat2',
  },
  {
    subjectId: 'sub3',
    title: 'Gợi ý từ kho Chủ nghĩa xã hội khoa học',
    content:
      'Hãy đặt khái niệm trong bối cảnh lịch sử cụ thể, xác định lực lượng xã hội liên quan và liên hệ giữa lý luận với điều kiện thực tiễn. Cách tiếp cận này giúp tránh ghi nhớ khái niệm một cách tách rời.',
    sourceLabel: 'Giáo trình Chủ nghĩa xã hội khoa học, 2021',
    materialId: 'mat3',
  },
  {
    subjectId: 'sub4',
    title: 'Gợi ý từ kho Tư tưởng Hồ Chí Minh',
    content:
      'Em nên làm rõ bối cảnh hình thành tư tưởng, nội dung cốt lõi và giá trị vận dụng trong từng giai đoạn. Ưu tiên đối chiếu với giáo trình và các trích dẫn đã được giảng viên phê duyệt.',
    sourceLabel: 'Giáo trình Tư tưởng Hồ Chí Minh, 2021',
    materialId: 'mat4',
  },
  {
    subjectId: 'sub5',
    title: 'Gợi ý từ kho Lịch sử Đảng',
    content:
      'Với câu hỏi lịch sử, em nên xác định mốc thời gian, hoàn cảnh, chủ trương và kết quả trước khi đánh giá ý nghĩa. Trình bày theo chuỗi nguyên nhân – diễn biến – kết quả sẽ dễ kiểm chứng hơn.',
    sourceLabel: 'Giáo trình Lịch sử Đảng Cộng sản Việt Nam, 2021',
    materialId: 'mat5',
  },
]

export const initialQuestionMockResponses = [
  {
    id: 'mr1',
    questionId: 'sq3',
    ...subjectMockResponses[0],
    createdAt: '2023-09-25T10:00:05Z',
  },
]
