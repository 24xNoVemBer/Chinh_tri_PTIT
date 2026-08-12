import { useCallback } from 'react'
import { BookOpenText, CircleHelp, School, UsersRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ErrorState, LoadingState } from '../../components/common/AsyncState'
import useAsyncData from '../../hooks/useAsyncData'
import { adminRepository } from '../../services/appRepositories'
import './AdminPage.css'

export default function AdminOverviewPage() {
  const loader = useCallback(async () => {
    const [users, subjects, terms, classes, unrouted] = await Promise.all([
      adminRepository.listUsers(),
      adminRepository.listSubjects(),
      adminRepository.listTerms(),
      adminRepository.listClasses(),
      adminRepository.listUnroutedQuestions(),
    ])
    return { users, subjects, terms, classes, unrouted }
  }, [])
  const { data, loading, error, reload } = useAsyncData(loader)
  if (loading) return <LoadingState label="Đang tổng hợp dữ liệu quản trị…" />
  if (error) return <ErrorState onRetry={reload} />

  const activeClasses = data.classes.filter((item) => item.status === 'active')
  const activeLecturers = data.users.filter(
    (item) => item.role === 'lecturer' && item.status === 'active',
  )
  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <div>
          <p className="admin-page__eyebrow">Trung tâm quản trị</p>
          <h1>Toàn cảnh hệ thống</h1>
          <p>Kiểm soát tài khoản, nội dung dùng chung và phân công giảng dạy tại một nơi.</p>
        </div>
        <Link className="button button--primary" to="/admin/classes">
          Quản lý lớp tín chỉ
        </Link>
      </header>

      <section className="admin-stats" aria-label="Chỉ số hệ thống">
        {[
          [UsersRound, data.users.length, 'Tài khoản'],
          [
            BookOpenText,
            data.subjects.filter((item) => item.status === 'active').length,
            'Môn đang hoạt động',
          ],
          [School, activeClasses.length, 'Lớp tín chỉ'],
          [CircleHelp, data.unrouted.length, 'Câu hỏi chưa điều phối'],
        ].map(([Icon, value, label]) => (
          <article className="admin-stat" key={label}>
            <span className="admin-stat__icon">
              <Icon aria-hidden="true" size={21} />
            </span>
            <span>
              <strong>{value}</strong>
              <span>{label}</span>
            </span>
          </article>
        ))}
      </section>

      <div className="admin-grid admin-grid--equal">
        <section className="admin-panel">
          <div className="admin-panel__header">
            <div>
              <h2>Vận hành học kỳ</h2>
              <p>{data.terms.length} học kỳ đã khai báo.</p>
            </div>
            <Link to="/admin/terms">Mở quản lý</Link>
          </div>
          <ul className="admin-list">
            {data.terms.slice(0, 4).map((term) => (
              <li className="admin-list__item" key={term.id}>
                <div>
                  <strong>{term.name}</strong>
                  <small>{term.code}</small>
                </div>
                <span
                  className={`admin-status ${term.status === 'archived' ? 'admin-status--muted' : ''}`}
                >
                  {term.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
        <section className="admin-panel">
          <div className="admin-panel__header">
            <div>
              <h2>Nguồn lực giảng dạy</h2>
              <p>{activeLecturers.length} giảng viên đang hoạt động.</p>
            </div>
            <Link to="/admin/users">Xem tài khoản</Link>
          </div>
          <ul className="admin-list">
            {activeLecturers.slice(0, 4).map((lecturer) => (
              <li className="admin-list__item" key={lecturer.id}>
                <div>
                  <strong>{lecturer.name}</strong>
                  <small>{lecturer.email}</small>
                </div>
                <span className="admin-status">Hoạt động</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
