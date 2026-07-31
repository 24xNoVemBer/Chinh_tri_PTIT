import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import StudentHome from './StudentHome'

const repositoryMocks = vi.hoisted(() => ({
  getDashboard: vi.fn(),
  listForStudent: vi.fn(),
  listSubjectProgress: vi.fn(),
}))

vi.mock('../../features/auth/useAuth', () => ({
  useAuth: () => ({ user: { id: 's1', name: 'Nguyễn Tuấn Anh' } }),
}))

vi.mock('../../services/appRepositories', () => ({
  learningRepository: {
    getDashboard: repositoryMocks.getDashboard,
    listSubjectProgress: repositoryMocks.listSubjectProgress,
  },
  questionRepository: {
    listForStudent: repositoryMocks.listForStudent,
  },
}))

const lesson = {
  id: 'les2',
  title: 'Vật chất và ý thức',
  progress: 72,
  lastReadAt: '2026-07-20T08:30:00Z',
  chapter: {
    subjectId: 'sub1',
    title: 'Chương 2: Chủ nghĩa duy vật biện chứng',
  },
}

const subject = {
  id: 'sub1',
  name: 'Triết học Mác-Lênin',
  credits: 4,
  lessonCount: 6,
  completedLessons: 2,
  progress: 48,
  nextLesson: lesson,
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/student']}>
      <StudentHome />
    </MemoryRouter>,
  )
}

describe('StudentHome', () => {
  beforeEach(() => {
    repositoryMocks.listSubjectProgress.mockReset()
    repositoryMocks.listForStudent.mockReset()
    repositoryMocks.getDashboard.mockReset()

    repositoryMocks.listSubjectProgress.mockResolvedValue([subject])
    repositoryMocks.listForStudent.mockResolvedValue([
      {
        id: 'sq1',
        status: 'answered',
        content: 'Phân biệt chủ nghĩa duy vật biện chứng như thế nào?',
        createdAt: '2026-07-19T08:00:00Z',
        subject: { id: 'sub1', name: subject.name },
        lecturerAnswer: {
          content: 'Hãy bắt đầu từ phương pháp xem xét sự vật trong mối liên hệ.',
          createdAt: '2026-07-20T09:00:00Z',
        },
      },
    ])
    repositoryMocks.getDashboard.mockResolvedValue({
      totalLessons: 6,
      completedLessons: 2,
      overallProgress: 48,
      recentLesson: lesson,
    })
  })

  afterEach(() => cleanup())

  it('renders the action-first learning hierarchy with real routes', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Chào Tuấn Anh' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Việc hôm nay' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Học phần của tôi' })).toBeInTheDocument()
    expect(screen.getByText('Bài tiếp theo')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^Tiếp tục học$/ })).toHaveAttribute(
      'href',
      '/student/lessons/les2',
    )
    expect(screen.getByRole('link', { name: /Hỏi trợ giảng/ })).toHaveAttribute(
      'href',
      '/student/chat?subject=Tri%E1%BA%BFt%20h%E1%BB%8Dc%20M%C3%A1c-L%C3%AAnin',
    )
  })

  it('shows an honest empty state when there is no recent lesson', async () => {
    repositoryMocks.listSubjectProgress.mockResolvedValue([])
    repositoryMocks.listForStudent.mockResolvedValue([])
    repositoryMocks.getDashboard.mockResolvedValue({
      totalLessons: 0,
      completedLessons: 0,
      overallProgress: 0,
      recentLesson: null,
    })

    renderPage()

    expect(await screen.findByText('Chọn một học phần để bắt đầu')).toBeInTheDocument()
    expect(screen.getByText('Chưa có việc cần ưu tiên')).toBeInTheDocument()
    expect(screen.getByText(/chưa được ghi danh vào học phần nào/i)).toBeInTheDocument()
  })

  it('labels an unopened lesson as ready instead of recently opened', async () => {
    repositoryMocks.getDashboard.mockResolvedValue({
      totalLessons: 6,
      completedLessons: 2,
      overallProgress: 48,
      recentLesson: {
        ...lesson,
        progress: 0,
        lastReadAt: null,
      },
    })

    renderPage()

    expect(await screen.findByText('Sẵn sàng')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^Bắt đầu học$/ })).toHaveAttribute(
      'href',
      '/student/lessons/les2',
    )
    expect(screen.getByText('Chưa mở bài học')).toBeInTheDocument()
  })

  it('lets the student retry after a repository error', async () => {
    repositoryMocks.listSubjectProgress
      .mockRejectedValueOnce(new Error('Không thể tải dữ liệu học tập.'))
      .mockResolvedValueOnce([subject])

    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Không thể tải dữ liệu học tập.')
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))

    expect(await screen.findByRole('heading', { name: 'Chào Tuấn Anh' })).toBeInTheDocument()
    expect(repositoryMocks.listSubjectProgress).toHaveBeenCalledTimes(2)
  })
})
