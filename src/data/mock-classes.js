export const subjects = [
  { id: 'sub1', name: 'Triết học Mác-Lênin', credits: 4 },
  { id: 'sub2', name: 'Kinh tế Chính trị Mác-Lênin', credits: 2 },
  { id: 'sub3', name: 'Chủ nghĩa Xã hội Khoa học', credits: 2 },
  { id: 'sub4', name: 'Tư tưởng Hồ Chí Minh', credits: 2 },
  { id: 'sub5', name: 'Lịch sử Đảng CSVN', credits: 2 },
]

export const chapters = [
  // Môn 1
  {
    id: 'chap1',
    subjectId: 'sub1',
    order: 1,
    title: 'Chương 1: Khái luận về triết học và triết học Mác - Lênin',
  },
  { id: 'chap2', subjectId: 'sub1', order: 2, title: 'Chương 2: Chủ nghĩa duy vật biện chứng' },
  { id: 'chap3', subjectId: 'sub1', order: 3, title: 'Chương 3: Chủ nghĩa duy vật lịch sử' },
  // Môn 2
  {
    id: 'chap4',
    subjectId: 'sub2',
    order: 1,
    title: 'Chương 1: Đối tượng, phương pháp nghiên cứu và chức năng của kinh tế chính trị',
  },
  {
    id: 'chap5',
    subjectId: 'sub2',
    order: 2,
    title: 'Chương 2: Hàng hóa, thị trường và vai trò của các chủ thể',
  },
  {
    id: 'chap6',
    subjectId: 'sub2',
    order: 3,
    title: 'Chương 3: Giá trị thặng dư trong nền kinh tế thị trường',
  },
  // Môn 3
  {
    id: 'chap7',
    subjectId: 'sub3',
    order: 1,
    title: 'Chương 1: Nhập môn Chủ nghĩa xã hội khoa học',
  },
  {
    id: 'chap8',
    subjectId: 'sub3',
    order: 2,
    title: 'Chương 2: Sứ mệnh lịch sử của giai cấp công nhân',
  },
  {
    id: 'chap9',
    subjectId: 'sub3',
    order: 3,
    title: 'Chương 3: Chủ nghĩa xã hội và thời kỳ quá độ',
  },
  // Môn 4
  {
    id: 'chap10',
    subjectId: 'sub4',
    order: 1,
    title: 'Chương 1: Đối tượng, phương pháp nghiên cứu TT HCM',
  },
  {
    id: 'chap11',
    subjectId: 'sub4',
    order: 2,
    title: 'Chương 2: Cơ sở, quá trình hình thành TT HCM',
  },
  {
    id: 'chap12',
    subjectId: 'sub4',
    order: 3,
    title: 'Chương 3: Tư tưởng Hồ Chí Minh về độc lập dân tộc',
  },
  // Môn 5
  { id: 'chap13', subjectId: 'sub5', order: 1, title: 'Chương 1: Đảng Cộng sản Việt Nam ra đời' },
  {
    id: 'chap14',
    subjectId: 'sub5',
    order: 2,
    title: 'Chương 2: Đảng lãnh đạo hai cuộc kháng chiến',
  },
  {
    id: 'chap15',
    subjectId: 'sub5',
    order: 3,
    title: 'Chương 3: Đảng lãnh đạo cả nước tiến hành đổi mới',
  },
]

export const courseClasses = [
  {
    id: 'class1',
    subjectId: 'sub1',
    name: 'N01 - Triết học Mác-Lênin',
    lecturerId: 'l1',
    semester: '2023-2024',
  },
  {
    id: 'class2',
    subjectId: 'sub2',
    name: 'N02 - Kinh tế Chính trị',
    lecturerId: 'l1',
    semester: '2023-2024',
  },
]

export const enrollments = [
  { id: 'e1', studentId: 's1', classId: 'class1' },
  { id: 'e2', studentId: 's2', classId: 'class1' },
  { id: 'e3', studentId: 's3', classId: 'class1' },
  { id: 'e4', studentId: 's1', classId: 'class2' },
  { id: 'e5', studentId: 's4', classId: 'class2' },
  { id: 'e6', studentId: 's5', classId: 'class2' },
]
