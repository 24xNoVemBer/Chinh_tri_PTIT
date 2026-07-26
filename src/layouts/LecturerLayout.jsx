import { Outlet } from 'react-router-dom'
import NavBar from '../components/common/NavBar'
import { useAuth } from '../features/auth/useAuth'
import './LecturerLayout.css'

export default function LecturerLayout() {
  const { user } = useAuth()

  return (
    <div className="lecturer-layout">
      <a className="skip-link" href="#main-content">
        Bỏ qua điều hướng
      </a>
      <NavBar role="lecturer" userName={user?.name} />
      <main className="lecturer-layout__main" id="main-content" tabIndex={-1}>
        <div className="app-content app-content--dashboard">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
