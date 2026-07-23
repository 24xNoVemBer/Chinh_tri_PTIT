import { Outlet } from 'react-router-dom'
import NavBar from '../components/common/NavBar'
import { useAuth } from '../features/auth/useAuth'
import './StudentLayout.css'

export default function StudentLayout() {
  const { user } = useAuth()

  return (
    <div className="student-layout">
      <a className="skip-link" href="#main-content">
        Bỏ qua điều hướng
      </a>
      <NavBar role="student" userName={user?.name} />
      <main className="student-layout__main" id="main-content" tabIndex={-1}>
        <div className="app-content">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
