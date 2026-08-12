import {
  BadgeCheck,
  BarChart3,
  Bell,
  BookOpenText,
  Bot,
  ClipboardList,
  FileClock,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircleQuestion,
  ListChecks,
  School,
  Search,
  Settings2,
  UsersRound,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../features/auth/useAuth'
import './NavBar.css'

const ROLE_LINKS = {
  student: [
    { label: 'Tổng quan', to: '/student', icon: LayoutDashboard, end: true },
    { label: 'Học phần', to: '/student/subjects', icon: BookOpenText },
    { label: 'Luyện tập', to: '/student/practice', icon: ListChecks },
    { label: 'Hỏi đáp', to: '/student/questions', icon: MessageCircleQuestion },
    { label: 'Tra cứu', to: '/student/search', icon: Search },
  ],
  lecturer: [
    { label: 'Tổng quan', to: '/lecturer', icon: LayoutDashboard, end: true },
    { label: 'Lớp học', to: '/lecturer/classes', icon: School },
    { label: 'Ngân hàng câu hỏi', to: '/lecturer/practice-questions', icon: ListChecks },
    { label: 'Phân tích luyện tập', to: '/lecturer/practice-analytics', icon: BarChart3 },
    { label: 'Hỏi đáp', to: '/lecturer/questions', icon: MessageCircleQuestion },
    { label: 'Chờ duyệt', to: '/lecturer/review-queue', icon: BadgeCheck },
  ],
  admin: [
    { label: 'Tổng quan', to: '/admin', icon: LayoutDashboard, end: true },
    { label: 'Tài khoản', to: '/admin/users', icon: UsersRound },
    { label: 'Môn & nội dung', to: '/admin/subjects', icon: BookOpenText },
    { label: 'Học kỳ', to: '/admin/terms', icon: FileClock },
    { label: 'Lớp tín chỉ', to: '/admin/classes', icon: School },
    { label: 'Câu hỏi chung', to: '/admin/question-bank', icon: ClipboardList },
    { label: 'Vận hành', to: '/admin/operations', icon: Settings2 },
  ],
}

export default function NavBar({ role, userName }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = useNavigate()
  const { logout } = useAuth()
  const links = ROLE_LINKS[role] ?? []
  const initial = userName ? userName.charAt(0).toUpperCase() : 'U'
  const roleLabel =
    role === 'student' ? 'Sinh viên' : role === 'lecturer' ? 'Giảng viên' : 'Quản trị viên'

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  return (
    <header className={`navbar navbar--${role} ${menuOpen ? 'navbar--open' : ''}`}>
      <div className="navbar__inner">
        <NavLink className="navbar__logo" to={`/${role}`} aria-label="Trang chủ PTIT Chính Trị">
          <span className="navbar__mark" aria-hidden="true">
            P
          </span>
          <span className="navbar__brand-name">PTIT Chính Trị</span>
        </NavLink>

        <nav className="navbar__nav" aria-label="Điều hướng chính">
          {links.map((link) => (
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
              <NavLink className="navbar__assistant" to="/student/chat">
                <Bot aria-hidden="true" size={17} />
                Hỏi trợ giảng
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
            className="navbar__icon-button navbar__menu-toggle"
            type="button"
            aria-controls="mobile-navigation"
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
