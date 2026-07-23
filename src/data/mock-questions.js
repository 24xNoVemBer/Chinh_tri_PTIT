export const studentQuestions = [
  {
    id: 'sq1',
    lessonId: 'les1',
    studentId: 's1',
    content:
      'Thưa thầy, làm sao để phân biệt rõ nhất giữa chủ nghĩa duy vật biện chứng và chủ nghĩa duy vật siêu hình ạ?',
    status: 'answered',
    createdAt: '2023-09-08T08:15:00Z',
  },
  {
    id: 'sq2',
    lessonId: 'les3',
    studentId: 's2',
    content:
      'Em chưa hiểu rõ ý "ý thức là hình ảnh chủ quan của thế giới khách quan", thầy có thể lấy ví dụ thực tế được không ạ?',
    status: 'answered',
    createdAt: '2023-09-20T19:30:00Z',
  },
  {
    id: 'sq3',
    lessonId: 'les4',
    studentId: 's1',
    content: 'Mối liên hệ phổ biến có áp dụng cho các hiện tượng tâm lý học không ạ?',
    status: 'unanswered',
    createdAt: '2023-09-25T10:00:00Z',
  },
  {
    id: 'sq4',
    lessonId: 'les7',
    studentId: 's4',
    content: 'Vai trò của hàng hóa sức lao động trong thời đại AI hiện nay như thế nào ạ?',
    status: 'unanswered',
    createdAt: '2023-09-15T22:10:00Z',
  },
  {
    id: 'sq5',
    lessonId: 'les8',
    studentId: 's5',
    content: 'Làm thế nào để xác định giá trị thặng dư khi mà nền kinh tế số ngày càng phát triển?',
    status: 'unanswered',
    createdAt: '2023-09-20T09:45:00Z',
  },
]

export const lecturerAnswers = [
  {
    id: 'la1',
    questionId: 'sq1',
    lecturerId: 'l1',
    content:
      'Chào em, khác biệt lớn nhất nằm ở phương pháp xem xét. Chủ nghĩa duy vật siêu hình xem xét sự vật trong trạng thái cô lập, tĩnh tại, không vận động phát triển. Ngược lại, chủ nghĩa duy vật biện chứng xem xét sự vật trong mối liên hệ phổ biến, luôn vận động và biến đổi không ngừng.',
    createdAt: '2023-09-08T10:20:00Z',
  },
  {
    id: 'la2',
    questionId: 'sq2',
    lecturerId: 'l1',
    content:
      'Ví dụ: Cùng nhìn một cơn mưa (thế giới khách quan), người nông dân đang hạn hán thì thấy vui mừng, còn người bán muối lại thấy buồn rầu. Cảm xúc và nhận thức (hình ảnh chủ quan) của mỗi người về cùng một sự vật là khác nhau, phụ thuộc vào hoàn cảnh và mục đích của họ.',
    createdAt: '2023-09-21T08:00:00Z',
  },
]
