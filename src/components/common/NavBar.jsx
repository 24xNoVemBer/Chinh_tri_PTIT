import { Clock3, LogOut, Search } from 'lucide-react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../features/auth/useAuth'
import './NavBar.css'

const ROLE_LINKS = {
  student: [
    { label: 'Môn học', to: '/student/subjects' },
    { label: 'Tra cứu', to: '/student/search', icon: Search },
    { label: 'Lịch sử', to: '/student/questions', icon: Clock3 },
  ],
  lecturer: [],
}

export default function NavBar({ role, userName }) {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const links = ROLE_LINKS[role] ?? []
  const initial = userName ? userName.charAt(0).toUpperCase() : 'U'

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  return (
    <header className="navbar">
      <div className="navbar__brand-row">
        <NavLink className="navbar__logo" to={`/${role}`} aria-label="Trang chủ PTIT Chính Trị">
          <span className="navbar__mark" aria-hidden="true">
            P
          </span>
          <span>PTIT Chính Trị</span>
        </NavLink>
        {links.length > 0 && (
          <nav className="navbar__nav" aria-label="Điều hướng chính">
            {links.map((link) => {
              const Icon = link.icon
              return (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) =>
                    `navbar__link ${isActive ? 'navbar__link--active' : ''}`
                  }
                >
                  {Icon && <Icon aria-hidden="true" size={16} />}
                  {link.label}
                </NavLink>
              )
            })}
          </nav>
        )}
      </div>
      <div className="navbar__account">
        <div className="navbar__identity">
          <span className="navbar__username">{userName}</span>
          <span className="navbar__role">{role === 'student' ? 'Sinh viên' : 'Giảng viên'}</span>
        </div>
        <div className="navbar__avatar" aria-hidden="true">
          {initial}
        </div>
        <button
          className="navbar__switch"
          type="button"
          onClick={handleLogout}
          aria-label="Đăng xuất"
          title="Đăng xuất"
        >
          <LogOut aria-hidden="true" size={18} />
        </button>
      </div>
    </header>
  )
}
