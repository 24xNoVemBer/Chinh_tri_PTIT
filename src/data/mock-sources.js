export const materials = [
  {
    id: 'mat1',
    subjectId: 'sub1',
    title: 'Giáo trình Triết học Mác - Lênin',
    type: 'book',
    author: 'Bộ Giáo dục và Đào tạo',
  },
  {
    id: 'mat2',
    subjectId: 'sub2',
    title: 'Giáo trình Kinh tế chính trị Mác - Lênin',
    type: 'book',
    author: 'Bộ Giáo dục và Đào tạo',
  },
  {
    id: 'mat3',
    subjectId: 'sub3',
    title: 'Giáo trình Chủ nghĩa xã hội khoa học',
    type: 'book',
    author: 'Bộ Giáo dục và Đào tạo',
  },
  {
    id: 'mat4',
    subjectId: 'sub4',
    title: 'Giáo trình Tư tưởng Hồ Chí Minh',
    type: 'book',
    author: 'Bộ Giáo dục và Đào tạo',
  },
  {
    id: 'mat5',
    subjectId: 'sub5',
    title: 'Giáo trình Lịch sử Đảng Cộng sản Việt Nam',
    type: 'book',
    author: 'Bộ Giáo dục và Đào tạo',
  },
  {
    id: 'mat6',
    subjectId: 'sub1',
    title: 'Hướng dẫn học tập Triết học Mác - Lênin',
    type: 'guide',
    author: 'Khoa Lý luận Chính trị PTIT',
  },
]

export const materialVersions = [
  { id: 'mv1', materialId: 'mat1', year: 2021, fileUrl: '/docs/triet-hoc-2021.pdf' },
  { id: 'mv2', materialId: 'mat2', year: 2021, fileUrl: '/docs/kinh-te-ct-2021.pdf' },
  { id: 'mv3', materialId: 'mat3', year: 2021, fileUrl: '/docs/cnxhkh-2021.pdf' },
  { id: 'mv4', materialId: 'mat4', year: 2021, fileUrl: '/docs/tt-hcm-2021.pdf' },
  { id: 'mv5', materialId: 'mat5', year: 2021, fileUrl: '/docs/ls-dang-2021.pdf' },
  { id: 'mv6', materialId: 'mat6', year: 2023, fileUrl: '/docs/huong-dan-triet-hoc.pdf' },
]

export const approvedSources = [
  { id: 'as1', materialId: 'mat1', isApproved: true },
  { id: 'as2', materialId: 'mat2', isApproved: true },
  { id: 'as3', materialId: 'mat4', isApproved: true },
  { id: 'as4', materialId: 'mat6', isApproved: true },
]

export const aiResponses = [
  {
    id: 'air1',
    questionId: 'sq3',
    content:
      'Có, mối liên hệ phổ biến áp dụng cho cả tự nhiên, xã hội và tư duy (bao gồm các hiện tượng tâm lý). Trong tâm lý học, một trạng thái cảm xúc (ví dụ: buồn bã) không tồn tại cô lập mà có mối liên hệ mật thiết với các yếu tố sinh lý học cơ thể, môi trường xã hội xung quanh, và những trải nghiệm quá khứ.',
    status: 'approved',
    lecturerId: 'l1',
    createdAt: '2023-09-25T10:05:00Z',
  },
  {
    id: 'air2',
    questionId: 'sq4',
    content:
      'Trong thời đại AI, sức lao động của con người vẫn là một loại hàng hóa đặc biệt, nhưng tính chất của nó thay đổi. Lao động trí óc, sự sáng tạo và khả năng quản lý AI ngày càng chiếm tỷ trọng lớn hơn so với lao động chân tay cơ bắp. Máy móc (kể cả AI) chỉ chuyển dịch giá trị của nó vào sản phẩm mới chứ không thể tự tạo ra giá trị mới; chỉ có lao động sống của con người mới là nguồn gốc tạo ra giá trị thặng dư.',
    status: 'generated',
    createdAt: '2023-09-15T22:12:00Z',
  },
]

export const citations = [
  {
    id: 'cit1',
    aiResponseId: 'air1',
    materialVersionId: 'mv1',
    pageNumber: 85,
    quote:
      'Nguyên lý về mối liên hệ phổ biến khái quát toàn cảnh thế giới, trong đó mọi sự vật, hiện tượng, quá trình ở cả tự nhiên, xã hội và tư duy đều có liên hệ với nhau.',
  },
  {
    id: 'cit2',
    aiResponseId: 'air2',
    materialVersionId: 'mv2',
    pageNumber: 120,
    quote:
      'Sức lao động là toàn bộ các năng lực thể chất và tinh thần tồn tại trong cơ thể, trong một con người đang sống, và được người đó đem ra vận dụng mỗi khi sản xuất ra một giá trị sử dụng nào đó.',
  },
]
