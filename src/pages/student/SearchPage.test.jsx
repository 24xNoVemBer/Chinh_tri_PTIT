import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SearchPage from './SearchPage'

const repositoryMocks = vi.hoisted(() => ({
  listChapters: vi.fn(),
  listForStudent: vi.fn(),
  listLessons: vi.fn(),
  search: vi.fn(),
}))

vi.mock('../../features/auth/useAuth', () => ({
  useAuth: () => ({ user: { id: 's1', name: 'Nguyễn Tuấn Anh' } }),
}))

vi.mock('../../services/appRepositories', () => ({
  searchRepository: {
    search: repositoryMocks.search,
  },
  subjectRepository: {
    listChapters: repositoryMocks.listChapters,
    listForStudent: repositoryMocks.listForStudent,
    listLessons: repositoryMocks.listLessons,
  },
}))

function buildResult(id, title) {
  return {
    id,
    title,
    excerpt: 'Nội dung kết quả kiểm thử.',
    lessonId: null,
    sourceLabel: 'Nguồn kiểm thử',
    sourceType: 'material',
    subject: null,
  }
}

function SearchAgainButton() {
  const navigate = useNavigate()
  return (
    <button type="button" onClick={() => navigate('/student/search?q=phép biện chứng')}>
      Tìm từ thanh điều hướng
    </button>
  )
}

describe('SearchPage', () => {
  beforeEach(() => {
    repositoryMocks.listForStudent.mockReset().mockResolvedValue([])
    repositoryMocks.listChapters.mockReset().mockResolvedValue([])
    repositoryMocks.listLessons.mockReset().mockResolvedValue([])
    repositoryMocks.search.mockReset().mockResolvedValue([])
  })

  afterEach(() => cleanup())

  it('runs a second deep-linked search while the page remains mounted', async () => {
    render(
      <MemoryRouter initialEntries={['/student/search?q=vật chất']}>
        <Routes>
          <Route
            path="/student/search"
            element={
              <>
                <SearchPage />
                <SearchAgainButton />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() =>
      expect(repositoryMocks.search).toHaveBeenCalledWith(
        expect.objectContaining({ query: 'vật chất', recordHistory: false }),
      ),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Tìm từ thanh điều hướng' }))

    await waitFor(() =>
      expect(repositoryMocks.search).toHaveBeenCalledWith(
        expect.objectContaining({ query: 'phép biện chứng', recordHistory: false }),
      ),
    )
    expect(screen.getByRole('searchbox', { name: 'Từ khóa tra cứu' })).toHaveValue(
      'phép biện chứng',
    )
  })

  it('keeps the newest result when an older request resolves later', async () => {
    let resolveFirstSearch
    let resolveSecondSearch
    repositoryMocks.search
      .mockReset()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirstSearch = resolve
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecondSearch = resolve
          }),
      )

    render(
      <MemoryRouter initialEntries={['/student/search?q=vật chất']}>
        <Routes>
          <Route
            path="/student/search"
            element={
              <>
                <SearchPage />
                <SearchAgainButton />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => expect(repositoryMocks.search).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('button', { name: 'Tìm từ thanh điều hướng' }))
    await waitFor(() => expect(repositoryMocks.search).toHaveBeenCalledTimes(2))

    await act(async () => {
      resolveSecondSearch([buildResult('second', 'Kết quả mới')])
    })
    expect(await screen.findByText('Kết quả mới')).toBeInTheDocument()

    await act(async () => {
      resolveFirstSearch([buildResult('first', 'Kết quả cũ')])
    })
    expect(screen.getByText('Kết quả mới')).toBeInTheDocument()
    expect(screen.queryByText('Kết quả cũ')).not.toBeInTheDocument()
  })

  it('clears stale results when the query is emptied', async () => {
    repositoryMocks.search.mockReset().mockResolvedValue([buildResult('old', 'Kết quả cũ')])

    render(
      <MemoryRouter initialEntries={['/student/search?q=vật chất']}>
        <Routes>
          <Route path="/student/search" element={<SearchPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText('Kết quả cũ')).toBeInTheDocument()
    const searchbox = screen.getByRole('searchbox', { name: 'Từ khóa tra cứu' })
    fireEvent.change(searchbox, { target: { value: '' } })

    expect(searchbox).toHaveValue('')
    expect(screen.queryByText('Kết quả cũ')).not.toBeInTheDocument()
    expect(screen.getByText('Gợi ý tra cứu')).toBeInTheDocument()
  })
})
