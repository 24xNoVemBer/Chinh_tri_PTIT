import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import QuestionHistoryPage from './QuestionHistoryPage'

const repositoryMocks = vi.hoisted(() => ({
  listHistory: vi.fn(),
  listForStudent: vi.fn(),
}))

vi.mock('../../features/auth/useAuth', () => ({
  useAuth: () => ({ user: { id: 's1', name: 'Nguyễn Tuấn Anh' } }),
}))

vi.mock('../../services/appRepositories', () => ({
  questionRepository: {
    listForStudent: repositoryMocks.listForStudent,
  },
  searchRepository: {
    listHistory: repositoryMocks.listHistory,
  },
}))

const waitingQuestion = {
  id: 'q-waiting',
  content: 'A'.repeat(900000),
  createdAt: '2026-07-20T08:30:00Z',
  status: 'unanswered',
  subject: { id: 'sub2', name: 'Kinh tế chính trị Mác-Lênin' },
  lesson: null,
  lecturerAnswer: null,
  ragRequest: null,
  ragResponse: null,
}

const answeredQuestion = {
  id: 'q-answered',
  content: 'Phân biệt vật chất và ý thức trong triết học Mác-Lênin?',
  createdAt: '2026-07-19T08:30:00Z',
  status: 'answered',
  subject: { id: 'sub1', name: 'Triết học Mác-Lênin' },
  lesson: { id: 'les2', title: 'Vật chất và ý thức' },
  lecturerAnswer: {
    content: 'Cần phân biệt khái niệm, mối quan hệ và vai trò của thực tiễn.',
  },
  ragRequest: null,
  ragResponse: null,
}

const searchItem = {
  id: 'search-1',
  query: 'mối liên hệ phổ biến',
  resultCount: 3,
  createdAt: '2026-07-18T08:30:00Z',
  subjectId: 'sub1',
  lessonId: null,
  subject: { id: 'sub1', name: 'Triết học Mác-Lênin' },
  lesson: null,
}

function renderPage(initialEntry = '/student/questions') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/student/questions" element={<QuestionHistoryPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('QuestionHistoryPage', () => {
  beforeEach(() => {
    repositoryMocks.listForStudent
      .mockReset()
      .mockResolvedValue([waitingQuestion, answeredQuestion])
    repositoryMocks.listHistory.mockReset().mockResolvedValue([searchItem])
  })

  afterEach(() => cleanup())

  it('uses the action-first hierarchy and safely previews extremely long questions', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Hỏi đáp của tôi' })).toBeInTheDocument()
    expect(screen.getByText('Tổng câu hỏi').nextElementSibling).toHaveTextContent('2')
    expect(
      screen.getByText('Đã phản hồi', { selector: 'dt' }).nextElementSibling,
    ).toHaveTextContent('1')

    const longQuestionLink = screen.getByRole('link', { name: /^A+…$/ })
    expect(longQuestionLink.textContent.length).toBeLessThan(300)

    fireEvent.click(screen.getByRole('button', { name: /Đã phản hồi/ }))
    expect(screen.getByText(answeredQuestion.content)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /^A+…$/ })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Chờ phản hồi/ }))
    expect(screen.getByRole('link', { name: /^A+…$/ })).toBeInTheDocument()
    expect(screen.queryByText(answeredQuestion.content)).not.toBeInTheDocument()
  })

  it('switches to a compact, deep-linked search history view', async () => {
    renderPage()

    await screen.findByRole('heading', { name: 'Hỏi đáp của tôi' })
    fireEvent.click(screen.getByRole('link', { name: /Lịch sử tra cứu/ }))

    expect(await screen.findByRole('heading', { name: 'Lịch sử tra cứu' })).toBeInTheDocument()
    expect(screen.getByText(searchItem.query)).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: `Mở lại tra cứu ${searchItem.query}` }),
    ).toHaveAttribute(
      'href',
      '/student/search?q=m%E1%BB%91i+li%C3%AAn+h%E1%BB%87+ph%E1%BB%95+bi%E1%BA%BFn&subject=sub1',
    )
  })
})
