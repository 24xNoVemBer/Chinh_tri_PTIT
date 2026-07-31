import {
  BadgeCheck,
  Bell,
  BookOpenText,
  Bot,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircleQuestion,
  School,
  Search,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../features/auth/useAuth'
import './NavBar.css'

const ROLE_LINKS = {
  student: [
    { label: 'Tổng quan', to: '/student', icon: LayoutDashboard, end: true },
    { label: 'Học phần', to: '/student/subjects', icon: BookOpenText },
    { label: 'Hỏi đáp', to: '/student/questions', icon: MessageCircleQuestion },
    { label: 'Tra cứu', to: '/student/search', icon: Search },
  ],
  lecturer: [
    { label: 'Tổng quan', to: '/lecturer', icon: LayoutDashboard, end: true },
    { label: 'Lớp học', to: '/lecturer/classes', icon: School },
    { label: 'Hỏi đáp', to: '/lecturer/questions', icon: MessageCircleQuestion },
    { label: 'Chờ duyệt', to: '/lecturer/review-queue', icon: BadgeCheck },
  ],
}

export default function NavBar({ role, userName }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const navigate = useNavigate()
  const { logout } = useAuth()
  const links = ROLE_LINKS[role] ?? []
  const desktopLinks =
    role === 'student' ? links.filter((link) => link.to !== '/student/search') : links
  const initial = userName ? userName.charAt(0).toUpperCase() : 'U'
  const roleLabel = role === 'student' ? 'Sinh viên' : 'Giảng viên'
  const menuToggleRef = useRef(null)

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  const handleSearchSubmit = (event) => {
    event.preventDefault()
    const query = searchQuery.trim()
    navigate(query ? `/student/search?q=${encodeURIComponent(query)}` : '/student/search')
    setMenuOpen(false)
  }

  // Escape must dismiss the menu, and focus has to return to the control that opened it —
  // otherwise keyboard users are left with focus on a node that no longer exists.
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined
    const desktopViewport = window.matchMedia('(min-width: 60.01rem)')
    const closeMobileMenu = (event) => {
      if (event.matches) setMenuOpen(false)
    }

    desktopViewport.addEventListener?.('change', closeMobileMenu)
    return () => desktopViewport.removeEventListener?.('change', closeMobileMenu)
  }, [])
  useEffect(() => {
    if (!menuOpen) return undefined
    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return
      setMenuOpen(false)
      menuToggleRef.current?.focus()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [menuOpen])

  return (
    <header className={`navbar ${menuOpen ? 'navbar--open' : ''}`}>
      <div className="navbar__inner">
        <NavLink className="navbar__logo" to={`/${role}`} aria-label="Trang chủ PTIT Chính Trị">
          <span className="navbar__mark" aria-hidden="true">
            P
          </span>
          <span className="navbar__brand-name">PTIT Chính Trị</span>
        </NavLink>

        <nav className="navbar__nav" aria-label="Điều hướng chính">
          {desktopLinks.map((link) => (
            <NavLink
              end={link.end}
              key={link.to}
              to={link.to}
              className={({ isActive }) => `navbar__link ${isActive ? 'navbar__link--active' : ''}`}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="navbar__account">
          {role === 'student' && (
            <>
              <form
                className="navbar__search"
                role="search"
                aria-label="Tra cứu nhanh"
                onSubmit={handleSearchSubmit}
              >
                <label className="sr-only" htmlFor="student-navbar-search">
                  Tra cứu học liệu
                </label>
                <button type="submit" aria-label="Tra cứu">
                  <Search aria-hidden="true" size={17} />
                </button>
                <input
                  id="student-navbar-search"
                  name="q"
                  type="search"
                  value={searchQuery}
                  placeholder="Tra cứu học liệu"
                  autoComplete="off"
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
              </form>
              <NavLink
                className="navbar__icon-button navbar__mobile-search"
                to="/student/search"
                aria-label="Tra cứu học liệu"
                title="Tra cứu học liệu"
              >
                <Search aria-hidden="true" size={19} />
              </NavLink>
              <NavLink
                className="navbar__assistant"
                to="/student/chat"
                aria-label="Hỏi trợ giảng"
                title="Hỏi trợ giảng"
              >
                <Bot aria-hidden="true" size={17} />
                <span>Hỏi trợ giảng</span>
              </NavLink>
              <NavLink
                className="navbar__icon-button"
                to="/student/notifications"
                aria-label="Xem thông báo"
                title="Thông báo"
              >
                <Bell aria-hidden="true" size={19} />
              </NavLink>
            </>
          )}
          <div className="navbar__identity">
            <span className="navbar__username">{userName}</span>
            <span className="navbar__role">{roleLabel}</span>
          </div>
          <div className="navbar__avatar" aria-hidden="true">
            {initial}
          </div>
          <button
            className="navbar__icon-button navbar__switch"
            type="button"
            onClick={handleLogout}
            aria-label="Đăng xuất"
            title="Đăng xuất"
          >
            <LogOut aria-hidden="true" size={18} />
          </button>
          <button
            ref={menuToggleRef}
            className="navbar__icon-button navbar__menu-toggle"
            type="button"
            // aria-controls may only reference an element that exists, and the menu is
            // unmounted while closed.
            aria-controls={menuOpen ? 'mobile-navigation' : undefined}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? 'Đóng menu' : 'Mở menu'}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X aria-hidden="true" size={20} /> : <Menu aria-hidden="true" size={20} />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="navbar__mobile-menu" id="mobile-navigation" aria-label="Điều hướng nhỏ">
          <div className="navbar__mobile-links">
            {links.map((link) => {
              const Icon = link.icon
              return (
                <NavLink
                  end={link.end}
                  key={link.to}
                  to={link.to}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    `navbar__mobile-link ${isActive ? 'navbar__mobile-link--active' : ''}`
                  }
                >
                  <Icon aria-hidden="true" size={18} />
                  {link.label}
                </NavLink>
              )
            })}
            {role === 'student' && (
              <NavLink
                className="navbar__mobile-link navbar__mobile-link--assistant"
                to="/student/chat"
                onClick={() => setMenuOpen(false)}
              >
                <Bot aria-hidden="true" size={18} />
                Hỏi trợ giảng
              </NavLink>
            )}
          </div>
          <div className="navbar__mobile-account">
            <div>
              <strong>{userName}</strong>
              <span>{roleLabel}</span>
            </div>
            <button type="button" onClick={handleLogout}>
              <LogOut aria-hidden="true" size={18} />
              Đăng xuất
            </button>
          </div>
        </nav>
      )}
    </header>
  )
}
