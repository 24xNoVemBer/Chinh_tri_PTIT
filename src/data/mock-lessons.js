// Generate 2 lessons for each of the 15 chapters
export const curriculumLessons = Array.from({ length: 15 }).flatMap((_, i) => [
  {
    id: `les${i * 2 + 1}`,
    chapterId: `chap${i + 1}`,
    order: 1,
    title: `Bài giảng 1: Giới thiệu và khái quát (Chương ${i + 1})`,
    contentHtml: `<p>Đây là nội dung lý thuyết phần đầu của chương. Các học thuyết chính trị, triết học và định hướng xã hội chủ nghĩa được trình bày một cách có hệ thống.</p><p>Học viên cần nắm vững các định nghĩa cơ bản, bối cảnh lịch sử và ý nghĩa của các quan điểm đường lối được nêu ra trong bài giảng này.</p>`,
  },
  {
    id: `les${i * 2 + 2}`,
    chapterId: `chap${i + 1}`,
    order: 2,
    title: `Bài giảng 2: Phân tích chuyên sâu (Chương ${i + 1})`,
    contentHtml: `<p>Trong phần này, chúng ta sẽ đi sâu vào phân tích các nguyên lý, quy luật và sự vận dụng thực tiễn của tư tưởng lý luận vào hoàn cảnh cụ thể của Việt Nam.</p><p>Sự sáng tạo trong việc vận dụng các nguyên lý này là kim chỉ nam cho các hành động thực tiễn trong công cuộc xây dựng và bảo vệ đất nước.</p>`,
  },
])

// Class lessons map course classes to curriculum lessons
export const classLessons = [
  {
    id: 'cl1',
    classId: 'class1',
    lessonId: 'les1',
    date: '2023-09-05',
    status: 'published',
  },
  {
    id: 'cl2',
    classId: 'class1',
    lessonId: 'les2',
    date: '2023-09-12',
    status: 'published',
  },
  { id: 'cl3', classId: 'class1', lessonId: 'les3', date: '2023-09-19', status: 'draft' },
  {
    id: 'cl4',
    classId: 'class2',
    lessonId: 'les7',
    date: '2023-09-06',
    status: 'published',
  },
  {
    id: 'cl5',
    classId: 'class2',
    lessonId: 'les8',
    date: '2023-09-13',
    status: 'published',
  },
]
