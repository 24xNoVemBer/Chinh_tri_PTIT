import { Outlet } from 'react-router-dom'
import NavBar from '../components/common/NavBar'
import Sidebar from '../components/common/Sidebar'
import { useAuth } from '../features/auth/useAuth'
import './LecturerLayout.css'

const sidebarItems = [
  {
    id: 'overview',
    label: 'Tổng quan',
    icon: 'LayoutDashboard',
    to: '/lecturer',
    end: true,
  },
  { id: 'classes', label: 'Lớp học', icon: 'School', to: '/lecturer/classes' },
  { id: 'questions', label: 'Hỏi đáp', icon: 'MessageCircleQuestion', to: '/lecturer/questions' },
  { id: 'review', label: 'Chờ duyệt', icon: 'BadgeCheck', to: '/lecturer/review-queue' },
]

export default function LecturerLayout() {
  const { user } = useAuth()

  return (
    <div className="lecturer-layout">
      <a className="skip-link" href="#main-content">
        Bỏ qua điều hướng
      </a>
      <NavBar role="lecturer" userName={user?.name} />
      <div className="lecturer-layout__body">
        <Sidebar items={sidebarItems} />
        <main className="lecturer-layout__main" id="main-content" tabIndex={-1}>
          <div className="app-content app-content--wide">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
