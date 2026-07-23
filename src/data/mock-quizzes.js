export const quizzes = [
  { id: 'q1', lessonId: 'les1', title: 'Trắc nghiệm: Khái quát về Triết học', timeLimit: 15 },
  { id: 'q2', lessonId: 'les3', title: 'Trắc nghiệm: Vật chất và Ý thức', timeLimit: 15 },
]

export const quizQuestions = [
  {
    id: 'qq1',
    quizId: 'q1',
    order: 1,
    question: 'Vấn đề cơ bản của triết học là gì?',
    options: [
      'Mối quan hệ giữa tư duy và tồn tại',
      'Mối quan hệ giữa con người và tự nhiên',
      'Mối quan hệ giữa các giai cấp trong xã hội',
      'Mối quan hệ giữa vật chất và vận động',
    ],
    correctOptionIndex: 0,
    explanation:
      'Theo Ăng-ghen, vấn đề cơ bản lớn của mọi triết học, đặc biệt là của triết học hiện đại, là vấn đề quan hệ giữa tư duy với tồn tại.',
  },
  {
    id: 'qq2',
    quizId: 'q1',
    order: 2,
    question: 'Hình thức phát triển cao nhất của chủ nghĩa duy vật là gì?',
    options: [
      'Chủ nghĩa duy vật chất phác',
      'Chủ nghĩa duy vật siêu hình',
      'Chủ nghĩa duy vật biện chứng',
      'Chủ nghĩa duy vật tầm thường',
    ],
    correctOptionIndex: 2,
    explanation:
      'Chủ nghĩa duy vật biện chứng do C.Mác và Ph.Ăng-ghen sáng lập, V.I.Lênin phát triển là hình thức phát triển cao nhất của chủ nghĩa duy vật.',
  },
  {
    id: 'qq3',
    quizId: 'q1',
    order: 3,
    question: 'Nguồn gốc nhận thức của triết học là sự hình thành của:',
    options: [
      'Tư duy trừu tượng, năng lực khái quát hóa của con người',
      'Sự phân công lao động trí óc và chân tay',
      'Sự xuất hiện của ngôn ngữ',
      'Sự ra đời của chữ viết',
    ],
    correctOptionIndex: 0,
    explanation:
      'Triết học ra đời khi tư duy của con người đạt tới trình độ trừu tượng hóa, khái quát hóa cao, rút ra được cái chung từ muôn vàn những sự vật, hiện tượng riêng lẻ.',
  },
  {
    id: 'qq4',
    quizId: 'q2',
    order: 1,
    question: 'Theo triết học Mác - Lênin, nguồn gốc tự nhiên của ý thức gồm:',
    options: [
      'Bộ óc người và thế giới khách quan tác động lên bộ óc người',
      'Lao động và ngôn ngữ',
      'Thế giới khách quan và lao động',
      'Bộ óc người và ngôn ngữ',
    ],
    correctOptionIndex: 0,
    explanation:
      'Nguồn gốc tự nhiên của ý thức bao gồm bộ óc người và thế giới khách quan tác động lên bộ óc người, tạo ra quá trình phản ánh.',
  },
  {
    id: 'qq5',
    quizId: 'q2',
    order: 2,
    question: 'Đặc tính quan trọng nhất của vật chất là gì?',
    options: [
      'Tồn tại khách quan',
      'Tồn tại chủ quan',
      'Có khối lượng và kích thước',
      'Có khả năng vận động',
    ],
    correctOptionIndex: 0,
    explanation:
      'Đặc tính quan trọng nhất, phổ biến nhất của mọi dạng vật chất là đặc tính tồn tại khách quan, độc lập với ý thức con người.',
  },
  {
    id: 'qq6',
    quizId: 'q2',
    order: 3,
    question: 'Bản chất của ý thức là gì?',
    options: [
      'Sự phản ánh nguyên xi thế giới khách quan',
      'Sự phản ánh năng động, sáng tạo thế giới khách quan vào bộ óc con người',
      'Sản phẩm của mọi dạng vật chất',
      'Sự hồi tưởng của linh hồn',
    ],
    correctOptionIndex: 1,
    explanation:
      'Ý thức là hình ảnh chủ quan của thế giới khách quan, là sự phản ánh năng động, sáng tạo thế giới khách quan vào bộ óc người.',
  },
]

export const quizAttempts = [
  {
    id: 'qa1',
    quizId: 'q1',
    studentId: 's1',
    score: 2,
    answers: { qq1: 0, qq2: 2, qq3: 1 }, // Tuan Anh got 2/3 right
    submittedAt: '2023-09-10T14:30:00Z',
  },
]
