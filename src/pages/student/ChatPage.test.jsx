import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ChatPage from './ChatPage'

const repositoryMocks = vi.hoisted(() => ({
  createMessage: vi.fn(),
  listSubjectProgress: vi.fn(),
}))

vi.mock('../../features/auth/useAuth', () => ({
  useAuth: () => ({ user: { id: 's1', name: 'Nguyễn Tuấn Anh' } }),
}))

vi.mock('../../services/appRepositories', () => ({
  chatRepository: {
    createMessage: repositoryMocks.createMessage,
  },
  learningRepository: {
    listSubjectProgress: repositoryMocks.listSubjectProgress,
  },
}))

const subject = {
  id: 'sub1',
  name: 'Triết học Mác-Lênin',
}

function renderPage() {
  return render(
    <MemoryRouter
      initialEntries={['/student/chat?subject=Tri%E1%BA%BFt%20h%E1%BB%8Dc%20M%C3%A1c-L%C3%AAnin']}
    >
      <ChatPage />
    </MemoryRouter>,
  )
}

describe('ChatPage', () => {
  beforeEach(() => {
    repositoryMocks.listSubjectProgress.mockReset().mockResolvedValue([subject])
    repositoryMocks.createMessage.mockReset().mockResolvedValue({
      responseId: 'rag-response-1',
      content: 'Câu trả lời demo được tạo và lưu từ backend.',
      reviewStatus: 'pending_review',
      moderation: {
        priority: 'sample',
        queue: 'sample',
        requiresReview: false,
        reason: 'Câu hỏi khớp học phần và có nguồn theo trang.',
      },
      citations: [
        {
          id: 'citation-1',
          title: 'Giáo trình Triết học Mác-Lênin',
          author: 'Bộ Giáo dục và Đào tạo',
          location: 'Chương 2, trang 42',
        },
      ],
    })
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    )
    HTMLElement.prototype.scrollTo = vi.fn()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('keeps the student UI while sending the question through the backend repository', async () => {
    renderPage()

    const subjectSelect = await screen.findByRole('combobox', { name: 'Học phần đang hỏi' })
    expect(subjectSelect).toHaveValue('sub1')

    fireEvent.change(screen.getByLabelText('Câu hỏi cho trợ giảng'), {
      target: { value: 'Vật chất và ý thức có quan hệ như thế nào?' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Gửi câu hỏi' }))

    await waitFor(() =>
      expect(repositoryMocks.createMessage).toHaveBeenCalledWith({
        content: 'Vật chất và ý thức có quan hệ như thế nào?',
        subjectId: 'sub1',
      }),
    )
    expect(
      await screen.findByText('Câu trả lời demo được tạo và lưu từ backend.'),
    ).toBeInTheDocument()
    expect(screen.getByText('AI tạo · Được đưa vào kiểm tra lấy mẫu')).toBeInTheDocument()
    expect(screen.getAllByText(/Giáo trình Triết học Mác-Lênin/)).toHaveLength(2)
  })

  it('restores the question when the backend request fails', async () => {
    repositoryMocks.createMessage.mockRejectedValueOnce(
      new Error('Không thể tạo câu trả lời demo.'),
    )
    renderPage()

    await screen.findByRole('combobox', { name: 'Học phần đang hỏi' })
    const input = screen.getByLabelText('Câu hỏi cho trợ giảng')
    fireEvent.change(input, { target: { value: 'Giúp mình ôn lại nội dung bài học.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Gửi câu hỏi' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Không thể tạo câu trả lời demo.')
    expect(input).toHaveValue('Giúp mình ôn lại nội dung bài học.')
    expect(screen.queryByLabelText('Bạn')).not.toBeInTheDocument()
  })
})
