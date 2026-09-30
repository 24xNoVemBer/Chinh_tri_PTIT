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

  it('labels MBA references as unverified instead of approved citations', async () => {
    chatRepository.getStatus.mockResolvedValue({
      mode: 'mba',
      sampleData: false,
      dataset: 'mba',
      enabledSubjectIds: ['sub1', 'sub2', 'sub3', 'sub5'],
    })
    learningRepository.listSubjectProgress.mockResolvedValue([
      {
        id: 'sub1',
        name: 'Triết học Mác - Lênin',
        classes: [{ id: 'c1', classCode: 'TH01', groupNumber: 1 }],
      },
      {
        id: 'sub2',
        name: 'Kinh tế chính trị Mác - Lênin',
        classes: [{ id: 'c2', classCode: 'KT01', groupNumber: 1 }],
      },
      {
        id: 'sub4',
        name: 'Tư tưởng Hồ Chí Minh',
        classes: [{ id: 'c4', classCode: 'HCM01', groupNumber: 1 }],
      },
    ])
    chatRepository.createMessage.mockResolvedValue({
      responseId: 'mba-1',
      content: 'Vật chất là **thực tại khách quan**.',
      reviewStatus: 'unverified',
      answerMode: 'mba',
      citations: [],
      sources: [
        {
          id: 'source-1',
          title: 'triet-hoc.pdf',
          author: 'Nguồn MBA_API',
          location: 'Đoạn truy xuất · chưa đối chiếu học liệu lớp',
          quote: 'Vật chất là một phạm trù triết học.',
        },
      ],
    })
    render(
      <MemoryRouter>
        <ChatPage />
      </MemoryRouter>,
    )
    expect(await screen.findByText('Đã kết nối MBA_API · nguồn chưa đối chiếu')).toBeInTheDocument()
    await screen.findByRole('option', { name: 'Triết học Mác - Lênin' })
    expect(screen.queryByRole('option', { name: 'Tư tưởng Hồ Chí Minh' })).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Trình bày định nghĩa vật chất của V.I. Lênin.' }),
    ).toBeInTheDocument()
    const input = screen.getByLabelText('Câu hỏi cho trợ giảng')
    fireEvent.change(input, { target: { value: 'Vật chất được định nghĩa thế nào?' } })
    fireEvent.submit(input.closest('form'))
    const emphasizedAnswer = await screen.findByText('thực tại khách quan', {
      selector: 'strong',
    })
    expect(emphasizedAnswer.closest('article')).toHaveTextContent(
      'Vật chất là thực tại khách quan.',
    )
    expect(
      screen.getByText('AI tạo · Nguồn MBA_API chưa được đối chiếu học liệu lớp'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Nguồn truy xuất MBA_API · chưa xác thực trích dẫn'),
    ).toBeInTheDocument()
    expect(screen.getByText('Vật chất là một phạm trù triết học.')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Học phần đang hỏi'), { target: { value: 'sub2' } })
    expect(
      screen.getByRole('button', {
        name: 'Theo giáo trình, hàng hóa có những thuộc tính cơ bản nào?',
      }),
    ).toBeInTheDocument()
    expect(screen.queryByText('Vật chất là một phạm trù triết học.')).not.toBeInTheDocument()
    expect(screen.queryByText('Vật chất được định nghĩa thế nào?')).not.toBeInTheDocument()
    expect(
      screen.queryByText('thực tại khách quan', { selector: 'strong' }),
    ).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Học phần đang hỏi'), { target: { value: 'sub1' } })
    expect(screen.getByText('Vật chất được định nghĩa thế nào?')).toBeInTheDocument()
    expect(screen.getByText('Vật chất là một phạm trù triết học.')).toBeInTheDocument()
  })
})
