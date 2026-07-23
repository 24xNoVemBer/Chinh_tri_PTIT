import { useCallback } from 'react'
import { ArrowRight, CircleHelp, School, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ErrorState, LoadingState } from '../../components/common/AsyncState'
import PageHeader from '../../components/common/PageHeader'
import { useAuth } from '../../features/auth/useAuth'
import useAsyncData from '../../hooks/useAsyncData'
import { classRepository } from '../../services/appRepositories'
import { questionRepository } from '../../services/appRepositories'

export default function LecturerHome() {
  const { user: currentLecturer } = useAuth()
  const loader = useCallback(async () => {
    const [classes, questions] = await Promise.all([
      classRepository.listForLecturer(currentLecturer.id),
      questionRepository.listForLecturer(currentLecturer.id),
    ])
    return { classes, questions }
  }, [currentLecturer.id])
  const { data, loading, error, reload } = useAsyncData(loader)

  if (loading) return <LoadingState label="Đang tổng hợp dữ liệu lớp…" />
  if (error) return <ErrorState onRetry={reload} />

  const totalStudents = data.classes.reduce((sum, item) => sum + item.studentCount, 0)
  const unanswered = data.questions.filter((question) => question.status === 'unanswered').length

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Không gian giảng viên"
        title="Tổng quan lớp học"
        description="Theo dõi các lớp đang phụ trách và ưu tiên những câu hỏi cần xử lý."
        actions={
          <Link className="button button--primary" to="/lecturer/classes">
            <School aria-hidden="true" size={18} />
            Quản lý lớp
          </Link>
        }
      />
      <section className="stat-grid" aria-label="Tổng quan giảng viên">
        <article className="stat-card">
          <School aria-hidden="true" />
          <div>
            <strong>{data.classes.length}</strong>
            <span>Lớp phụ trách</span>
          </div>
        </article>
        <article className="stat-card">
          <Users aria-hidden="true" />
          <div>
            <strong>{totalStudents}</strong>
            <span>Sinh viên</span>
          </div>
        </article>
        <article className="stat-card stat-card--attention">
          <CircleHelp aria-hidden="true" />
          <div>
            <strong>{unanswered}</strong>
            <span>Câu hỏi chờ trả lời</span>
          </div>
        </article>
      </section>
      <section className="section-stack" aria-labelledby="lecturer-classes-title">
        <div className="section-heading">
          <div>
            <p className="section-heading__eyebrow">Đang giảng dạy</p>
            <h2 id="lecturer-classes-title">Lớp học</h2>
          </div>
          <Link className="text-link" to="/lecturer/classes">
            Xem tất cả <ArrowRight aria-hidden="true" size={16} />
          </Link>
        </div>
        <div className="card-grid">
          {data.classes.map((courseClass) => (
            <Link
              className="content-card content-card--interactive"
              key={courseClass.id}
              to={`/lecturer/classes/${courseClass.id}`}
            >
              <span className="content-card__meta">{courseClass.semester}</span>
              <h3>{courseClass.name}</h3>
              <p>
                {courseClass.studentCount} sinh viên · {courseClass.questionCount} câu hỏi
              </p>
              <span className="content-card__action">
                Mở lớp <ArrowRight aria-hidden="true" size={16} />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
