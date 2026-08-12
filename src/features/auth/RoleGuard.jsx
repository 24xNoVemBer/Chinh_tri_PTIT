import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'

export default function RoleGuard({ role, roles }) {
  const location = useLocation()
  const { isLoading, user } = useAuth()

  if (isLoading) {
    return (
      <div className="route-loader" role="status">
        Đang xác thực phiên đăng nhập…
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  const allowedRoles = roles ?? [role]
  if (!allowedRoles.includes(user.role)) return <Navigate to={`/${user.role}`} replace />

  return <Outlet />
}
