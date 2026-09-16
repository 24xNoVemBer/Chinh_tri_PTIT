import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ChatPage from './ChatPage'
import { chatRepository, learningRepository } from '../../services/appRepositories'

afterEach(cleanup)

vi.mock('../../features/auth/useAuth', () => ({
  useAuth: () => ({ user: { id: 's1', name: 'Tuấn Anh' } }),
}))
vi.mock('../../services/appRepositories', () => ({
  chatRepository: { getStatus: vi.fn(), createMessage: vi.fn() },
  learningRepository: { listSubjectProgress: vi.fn() },
}))

beforeEach(() => {
  vi.clearAllMocks()
  window.matchMedia = vi.fn(() => ({ matches: true }))
  Element.prototype.scrollTo = vi.fn()
  chatRepository.getStatus.mockResolvedValue({ mode: 'extractive', sampleData: true })
  learningRepository.listSubjectProgress.mockResolvedValue([
    {
      id: 'sub1',
      name: 'Triết học Mác - Lênin',
      classes: [{ id: 'c1', classCode: 'TH01', groupNumber: 1 }],
    },
  ])
})

describe('local chatbot UI', () => {
  it('labels extractive mode, prevents duplicate sends, and exposes source quotes', async () => {
    let finish
    chatRepository.createMessage.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    render(
      <MemoryRouter>
        <ChatPage />
      </MemoryRouter>,
    )
    expect(await screen.findByText('Local · truy xuất, chưa dùng LLM')).toBeInTheDocument()
    const input = screen.getByLabelText('Câu hỏi cho trợ giảng')
    fireEvent.change(input, { target: { value: 'Phân biệt vật chất và ý thức.' } })
    fireEvent.submit(input.closest('form'))
    fireEvent.submit(input.closest('form'))
    expect(chatRepository.createMessage).toHaveBeenCalledTimes(1)
    expect(screen.getByLabelText('Gửi câu hỏi')).toBeDisabled()
    await act(async () =>
      finish({
        responseId: 'answer-1',
        content: 'Đoạn trích từ tài liệu mẫu.',
        answerMode: 'extractive',
        reviewStatus: 'pending_review',
        moderation: { requiresReview: true },
        citations: [
          {
            id: 'citation-1',
            title: '[DỮ LIỆU THỬ]',
            author: 'Tự soạn',
            location: 'Mẫu',
            quote: 'Nguồn gốc đoạn trích.',
          },
        ],
      }),
    )
    expect(
      await screen.findByText('Trích xuất tự động · Không phải câu trả lời do LLM tạo'),
    ).toBeInTheDocument()
    expect(screen.getByText('Xem đoạn trích')).toBeInTheDocument()
    expect(screen.getByText('Nguồn gốc đoạn trích.')).toBeInTheDocument()
  })

  it('shows provider failures without inventing a demo answer', async () => {
    chatRepository.createMessage.mockRejectedValue(new Error('PROVIDER_AUTH_FAILED'))
    render(
      <MemoryRouter>
        <ChatPage />
      </MemoryRouter>,
    )
    await screen.findByText('Local · truy xuất, chưa dùng LLM')
    const input = screen.getByLabelText('Câu hỏi cho trợ giảng')
    fireEvent.change(input, { target: { value: 'Phân biệt vật chất và ý thức.' } })
    fireEvent.submit(input.closest('form'))
    expect(await screen.findByRole('alert')).toHaveTextContent('PROVIDER_AUTH_FAILED')
    await waitFor(() => expect(input).toHaveValue('Phân biệt vật chất và ý thức.'))
    expect(screen.queryByText('Đoạn trích từ tài liệu mẫu.')).not.toBeInTheDocument()
  })
})
