import { useCallback, useDeferredValue, useState } from 'react'
import { Gauge, Search, TriangleAlert, Users } from 'lucide-react'
import { useParams } from 'react-router-dom'
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PermissionState,
} from '../../components/common/AsyncState'
import PageHeader from '../../components/common/PageHeader'
import StatusLabel from '../../components/common/StatusLabel'
import ClassSubnav from '../../components/lecturer/ClassSubnav'
import { useAuth } from '../../features/auth/useAuth'
import useAsyncData from '../../hooks/useAsyncData'
import { classRepository } from '../../services/appRepositories'
import { formatDateTime, formatPercent } from '../../utils/format'
import { includesNormalized } from '../../utils/text'

const STATUS_OPTIONS = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: 'active', label: 'Đang học' },
  { value: 'attention', label: 'Cần chú ý' },
  { value: 'inactive', label: 'Ít hoạt động' },
]

export default function ClassStudentsPage() {
  const { user: currentLecturer } = useAuth()
  const { classId } = useParams()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [updatingId, setUpdatingId] = useState(null)
  const [feedback, setFeedback] = useState('')
  const deferredQuery = useDeferredValue(query)

  const loader = useCallback(async () => {
    const [courseClass, students, metrics] = await Promise.all([
      classRepository.getById(classId, { lecturerId: currentLecturer.id }),
      classRepository.listStudents(classId, { lecturerId: currentLecturer.id }),
      classRepository.getMetrics(classId, { lecturerId: currentLecturer.id }),
    ])
    return { courseClass, students, metrics }
  }, [classId, currentLecturer.id])
  const { data, loading, error, reload } = useAsyncData(loader)

  if (loading) return <LoadingState label="Đang tải danh sách sinh viên…" />
  if (error?.code === 'FORBIDDEN') return <PermissionState message={error.message} />
  if (error) return <ErrorState message={error.message} onRetry={reload} />
  if (!data.courseClass) return <EmptyState title="Không tìm thấy lớp học" />

  const visibleStudents = data.students.filter((student) => {
    if (status !== 'all' && student.status !== status) return false
    if (
      deferredQuery &&
      !includesNormalized(student.name, deferredQuery) &&
      !includesNormalized(student.email, deferredQuery)
    ) {
      return false
    }
    return true
  })

  const handleStatusChange = async (student, nextStatus) => {
    setUpdatingId(student.id)
    setFeedback('')
    try {
      await classRepository.updateStudentStatus(classId, student.id, nextStatus, {
        lecturerId: currentLecturer.id,
      })
      setFeedback(`Đã cập nhật trạng thái của ${student.name}.`)
      await reload()
    } catch (updateError) {
      setFeedback(updateError.message)
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow={data.courseClass.name}
        title="Sinh viên trong lớp"
        description="Tìm kiếm, theo dõi tiến độ và đánh dấu những sinh viên cần được hỗ trợ."
      />
      <ClassSubnav classId={classId} />

      <section className="stat-grid" aria-label="Tình hình sinh viên">
        <article className="stat-card">
          <Users aria-hidden="true" />
          <div>
            <strong>{data.students.length}</strong>
            <span>Tổng sinh viên</span>
          </div>
        </article>
        <article className="stat-card">
          <Gauge aria-hidden="true" />
          <div>
            <strong>{data.metrics.averageProgress}%</strong>
            <span>Tiến độ trung bình</span>
          </div>
        </article>
        <article className="stat-card stat-card--attention">
          <TriangleAlert aria-hidden="true" />
          <div>
            <strong>{data.metrics.attentionCount + data.metrics.inactiveCount}</strong>
            <span>Cần theo dõi</span>
          </div>
        </article>
      </section>

      {feedback && (
        <div className="feedback-banner" role="status" aria-live="polite">
          {feedback}
        </div>
      )}

      <section className="section-stack" aria-labelledby="student-list-title">
        <div className="section-heading">
          <div>
            <p className="section-heading__eyebrow">Danh sách lớp</p>
            <h2 id="student-list-title">{visibleStudents.length} sinh viên</h2>
          </div>
        </div>
        <div className="filter-toolbar">
          <div className="filter-field filter-field--search">
            <label htmlFor="student-query">Tìm sinh viên</label>
            <div className="filter-field__control">
              <Search aria-hidden="true" size={18} />
              <input
                id="student-query"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tên hoặc email"
              />
            </div>
          </div>
          <div className="filter-field">
            <label htmlFor="student-status">Trạng thái</label>
            <select
              id="student-status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {visibleStudents.length === 0 ? (
          <EmptyState
            title="Không có sinh viên phù hợp"
            description="Hãy thử từ khóa hoặc trạng thái khác."
          />
        ) : (
          <div className="table-surface">
            <table>
              <thead>
                <tr>
                  <th scope="col">Sinh viên</th>
                  <th scope="col">Tiến độ</th>
                  <th scope="col">Hoạt động gần nhất</th>
                  <th scope="col">Trạng thái</th>
                  <th scope="col">Cập nhật</th>
                </tr>
              </thead>
              <tbody>
                {visibleStudents.map((student) => (
                  <tr key={student.id}>
                    <td>
                      <strong>{student.name}</strong>
                      <span className="table-secondary">{student.email}</span>
                    </td>
                    <td>
                      <div className="progress-cell">
                        <progress max="100" value={student.progress}>
                          {formatPercent(student.progress)}
                        </progress>
                        <span>{student.progress}%</span>
                      </div>
                    </td>
                    <td>{formatDateTime(student.lastActiveAt)}</td>
                    <td>
                      <StatusLabel type={student.status} />
                    </td>
                    <td>
                      <label className="sr-only" htmlFor={`status-${student.id}`}>
                        Trạng thái của {student.name}
                      </label>
                      <select
                        className="table-select"
                        id={`status-${student.id}`}
                        value={student.status}
                        disabled={updatingId === student.id}
                        onChange={(event) => handleStatusChange(student, event.target.value)}
                      >
                        {STATUS_OPTIONS.slice(1).map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
