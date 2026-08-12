import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import NavBar from './NavBar'

vi.mock('../../features/auth/useAuth', () => ({
  useAuth: () => ({ logout: vi.fn() }),
}))

describe('admin navigation', () => {
  it('exposes every implemented admin workspace from the top navigation', () => {
    render(
      <MemoryRouter>
        <NavBar role="admin" userName="Quản trị demo" />
      </MemoryRouter>,
    )

    expect(screen.getAllByRole('link', { name: 'Tài khoản' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: 'Môn & nội dung' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: 'Lớp tín chỉ' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: 'Vận hành' }).length).toBeGreaterThan(0)
    expect(screen.getByText('Quản trị viên')).toBeInTheDocument()
  })
})
