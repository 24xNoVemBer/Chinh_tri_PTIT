import { BookOpen, FileText, LayoutDashboard, MessageCircleQuestion, Users } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import './ClassSubnav.css'

const ITEMS = [
  { label: 'Tổng quan', path: '', icon: LayoutDashboard, end: true },
  { label: 'Sinh viên', path: '/students', icon: Users },
  { label: 'Bài học', path: '/lessons', icon: BookOpen },
  { label: 'Học liệu', path: '/materials', icon: FileText },
  { label: 'Câu hỏi', path: '/questions', icon: MessageCircleQuestion },
]

export default function ClassSubnav({ classId }) {
  const basePath = `/lecturer/classes/${classId}`

  return (
    <nav className="class-subnav" aria-label="Quản lý lớp học">
      {ITEMS.map((item) => {
        const Icon = item.icon
        return (
          <NavLink
            className={({ isActive }) =>
              `class-subnav__link ${isActive ? 'class-subnav__link--active' : ''}`
            }
            end={item.end}
            key={item.path}
            to={`${basePath}${item.path}`}
          >
            <Icon aria-hidden="true" size={17} />
            {item.label}
          </NavLink>
        )
      })}
    </nav>
  )
}
