import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import NavBar from './NavBar'

const authMocks = vi.hoisted(() => ({ logout: vi.fn() }))

vi.mock('../../features/auth/useAuth', () => ({
  useAuth: () => ({ logout: authMocks.logout }),
}))

function LocationProbe() {
  const location = useLocation()
  return <output aria-label="Đường dẫn hiện tại">{location.pathname + location.search}</output>
}

function renderNavBar() {
  return render(
    <MemoryRouter initialEntries={['/student']}>
      <Routes>
        <Route
          path="*"
          element={
            <>
              <NavBar role="student" userName="Nguyễn Tuấn Anh" />
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  )
}

describe('NavBar', () => {
  afterEach(() => {
    cleanup()
    authMocks.logout.mockReset()
  })

  it('submits the compact student search to the deep-linked search page', () => {
    renderNavBar()

    fireEvent.change(screen.getByRole('searchbox', { name: 'Tra cứu học liệu' }), {
      target: { value: 'vật chất và ý thức' },
    })
    fireEvent.submit(screen.getByRole('search', { name: 'Tra cứu nhanh' }))

    expect(screen.getByLabelText('Đường dẫn hiện tại')).toHaveTextContent(
      '/student/search?q=v%E1%BA%ADt%20ch%E1%BA%A5t%20v%C3%A0%20%C3%BD%20th%E1%BB%A9c',
    )
  })

  it('keeps an accessible name when the assistant action becomes icon-only', () => {
    renderNavBar()

    expect(screen.getByRole('link', { name: 'Hỏi trợ giảng' })).toHaveAttribute(
      'href',
      '/student/chat',
    )
  })

  it('closes the mobile menu with Escape and restores focus', () => {
    renderNavBar()
    const toggle = screen.getByRole('button', { name: 'Mở menu' })

    fireEvent.click(toggle)
    expect(screen.getByRole('navigation', { name: 'Điều hướng nhỏ' })).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('navigation', { name: 'Điều hướng nhỏ' })).not.toBeInTheDocument()
    expect(toggle).toHaveFocus()
  })
})
