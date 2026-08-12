import { Outlet } from 'react-router-dom'
import NavBar from '../components/common/NavBar'
import { useAuth } from '../features/auth/useAuth'
import './AdminLayout.css'

export default function AdminLayout() {
  const { user } = useAuth()
  return (
    <div className="admin-layout">
      <a className="skip-link" href="#admin-main">
        Bỏ qua điều hướng
      </a>
      <NavBar role="admin" userName={user?.name} />
      <main className="admin-layout__main" id="admin-main" tabIndex={-1}>
        <div className="app-content app-content--dashboard">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
