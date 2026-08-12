import { useCallback, useMemo, useState } from 'react'
import { ErrorState, LoadingState } from '../../components/common/AsyncState'
import useAsyncData from '../../hooks/useAsyncData'
import { adminRepository } from '../../services/appRepositories'
import './AdminPage.css'

const ROLE_LABELS = { admin: 'Quản trị', lecturer: 'Giảng viên', student: 'Sinh viên' }

export default function AdminUsersPage() {
  const [query, setQuery] = useState('')
  const [role, setRole] = useState('all')
  const [feedback, setFeedback] = useState('')
  const loader = useCallback(() => adminRepository.listUsers(), [])
  const { data = [], loading, error, reload } = useAsyncData(loader)
  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('vi')
    return data.filter((user) => {
      if (role !== 'all' && user.role !== role) return false
      return (
        !normalized || `${user.name} ${user.email}`.toLocaleLowerCase('vi').includes(normalized)
      )
    })
  }, [data, query, role])

  async function updateUser(userId, input) {
    setFeedback('')
    try {
      await adminRepository.updateUser(userId, input)
      setFeedback('Đã cập nhật tài khoản và thu hồi các phiên cũ.')
      reload()
    } catch (cause) {
      setFeedback(cause.message)
    }
  }

  if (loading) return <LoadingState label="Đang tải danh sách tài khoản…" />
  if (error) return <ErrorState onRetry={reload} />
  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <div>
          <p className="admin-page__eyebrow">Phân quyền</p>
          <h1>Tài khoản & vai trò</h1>
          <p>Gán vai trò theo tài khoản PTIT và khóa truy cập khi cần.</p>
        </div>
      </header>
      {feedback && (
        <p className="admin-feedback" role="status">
          {feedback}
        </p>
      )}
      <section className="admin-panel">
        <div className="admin-toolbar">
          <div className="admin-field admin-field--grow">
            <label htmlFor="user-search">Tìm tài khoản</label>
            <input
              id="user-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Họ tên hoặc email PTIT"
            />
          </div>
          <div className="admin-field">
            <label htmlFor="role-filter">Vai trò</label>
            <select id="role-filter" value={role} onChange={(event) => setRole(event.target.value)}>
              <option value="all">Tất cả</option>
              <option value="admin">Quản trị</option>
              <option value="lecturer">Giảng viên</option>
              <option value="student">Sinh viên</option>
            </select>
          </div>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Tài khoản</th>
                <th scope="col">Vai trò</th>
                <th scope="col">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((user) => (
                <tr key={user.id}>
                  <td>
                    <strong>{user.name}</strong>
                    <small>{user.email}</small>
                  </td>
                  <td>
                    <select
                      aria-label={`Vai trò của ${user.name}`}
                      value={user.role}
                      onChange={(event) => updateUser(user.id, { role: event.target.value })}
                    >
                      {Object.entries(ROLE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      aria-label={`Trạng thái của ${user.name}`}
                      value={user.status}
                      onChange={(event) => updateUser(user.id, { status: event.target.value })}
                    >
                      <option value="active">Hoạt động</option>
                      <option value="inactive">Tạm khóa</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!visible.length && <p className="admin-empty">Không có tài khoản phù hợp.</p>}
      </section>
    </div>
  )
}
