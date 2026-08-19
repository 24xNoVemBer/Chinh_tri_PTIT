import { useCallback } from 'react'
import {
  ArrowRight,
  ChartNoAxesCombined,
  CheckCircle2,
  CircleHelp,
  Clock3,
  MessageSquareText,
  School,
  Users,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import AnimatedNumber from '../../components/common/AnimatedNumber'
import CourseCover from '../../components/common/CourseCover'
import { ErrorState, LoadingState } from '../../components/common/AsyncState'
import ProgressBar from '../../components/common/ProgressBar'
import { useAuth } from '../../features/auth/useAuth'
import useAsyncData from '../../hooks/useAsyncData'
import { classRepository, questionRepository } from '../../services/appRepositories'
import { formatDateTime } from '../../utils/format'
import '../common/DashboardHome.css'

export default function LecturerHome() {
  const { user: currentLecturer } = useAuth()
  const loader = useCallback(async () => {
    const [classes, questions] = await Promise.all([
      classRepository.listForLecturer(currentLecturer.id),
      questionRepository.listForLecturer(currentLecturer.id),
    ])
    const classesWithMetrics = await Promise.all(
      classes.map(async (courseClass) => ({
        ...courseClass,
        metrics: await classRepository.getMetrics(courseClass.id, {
          lecturerId: currentLecturer.id,
        }),
      })),
    )
    return { classes: classesWithMetrics, questions }
  }, [currentLecturer.id])
  const { data, loading, error, reload } = useAsyncData(loader)

  if (loading) return <LoadingState label="Đang tổng hợp dữ liệu lớp…" />
  if (error) return <ErrorState onRetry={reload} />

  const totalStudents = data.classes.reduce((sum, item) => sum + item.studentCount, 0)
  const unansweredQuestions = data.questions.filter((question) => question.status === 'unanswered')
  const answeredQuestions = data.questions.filter((question) => question.status === 'answered')
  const attentionCount = data.classes.reduce(
    (sum, courseClass) => sum + courseClass.metrics.attentionCount,
    0,
  )
  const averageProgress = totalStudents
    ? Math.round(
        data.classes.reduce(
          (sum, courseClass) =>
            sum + courseClass.metrics.averageProgress * courseClass.studentCount,
          0,
        ) / totalStudents,
      )
    : 0

  return (
    <div className="dashboard-home dashboard-home--lecturer">
      <header className="dashboard-compact-head dashboard-reveal" style={{ '--reveal-order': 0 }}>
        <div>
          <p className="dashboard-home__role">Không gian giảng viên</p>
          <h1>Tổng quan lớp học</h1>
        </div>
        <div className="dashboard-compact-head__actions">
          <Link className="button button--secondary" to="/lecturer/questions">
            <MessageSquareText aria-hidden="true" size={18} />
            Xem hỏi đáp
          </Link>
          <Link className="button button--primary" to="/lecturer/classes">
            <School aria-hidden="true" size={18} />
            Quản lý lớp
          </Link>
        </div>
      </header>

      <div className="lecturer-overview-grid dashboard-reveal" style={{ '--reveal-order': 1 }}>
        <section
          className="dashboard-panel dashboard-panel--priority"
          aria-labelledby="priority-title"
        >
          <div className="dashboard-panel__heading dashboard-panel__heading--priority">
            <div>
              <h2 id="priority-title">Cần xử lý</h2>
              <p>Câu hỏi mới từ sinh viên.</p>
            </div>
            <span
              className="dashboard-count"
              aria-label={`${unansweredQuestions.length} câu hỏi chưa trả lời`}
            >
              {unansweredQuestions.length}
            </span>
          </div>

          {unansweredQuestions.length > 0 ? (
            <div className="lecturer-queue">
              {unansweredQuestions.slice(0, 3).map((question) => (
                <Link
                  className="lecturer-queue__row"
                  key={question.id}
                  to={`/lecturer/questions/${question.id}`}
                >
                  <span className="lecturer-queue__avatar" aria-hidden="true">
                    {question.student?.name?.charAt(0) ?? 'S'}
                  </span>
                  <span className="lecturer-queue__copy">
                    <span>
                      <strong>{question.student?.name ?? 'Sinh viên'}</strong>
                      <small>{formatDateTime(question.createdAt)}</small>
                    </span>
                    <b>{question.content}</b>
                    <small>
                      {question.courseClass?.name ?? question.subject?.name ?? 'Lớp học'}
                    </small>
                  </span>
                  <ArrowRight aria-hidden="true" size={18} />
                </Link>
              ))}
            </div>
          ) : (
            <div className="dashboard-empty">
              <CheckCircle2 aria-hidden="true" size={22} />
              <div>
                <strong>Không còn câu hỏi chờ xử lý.</strong>
                <p>Các câu hỏi mới sẽ xuất hiện tại đây.</p>
              </div>
            </div>
          )}

          <Link className="dashboard-panel__footer-link" to="/lecturer/questions">
            Xem tất cả công việc <ArrowRight aria-hidden="true" size={16} />
          </Link>
        </section>

        <aside className="dashboard-panel" aria-labelledby="class-snapshot-title">
          <div className="dashboard-panel__heading">
            <div>
              <h2 id="class-snapshot-title">Tình hình lớp học</h2>
              <p>Dữ liệu từ các lớp đang phụ trách.</p>
            </div>
          </div>
          <div className="lecturer-metric-grid" role="list" aria-label="Thống kê lớp học">
            <article role="listitem">
              <School aria-hidden="true" size={20} />
              <span>
                <strong>
                  <AnimatedNumber value={data.classes.length} />
                </strong>
                Lớp đang dạy
              </span>
            </article>
            <article role="listitem">
              <Users aria-hidden="true" size={20} />
              <span>
                <strong>
                  <AnimatedNumber value={totalStudents} />
                </strong>
                Sinh viên
              </span>
            </article>
            <article role="listitem">
              <ChartNoAxesCombined aria-hidden="true" size={20} />
              <span>
                <strong>
                  <AnimatedNumber value={averageProgress} suffix="%" />
                </strong>
                Tiến độ bình quân
              </span>
            </article>
            <article className="lecturer-metric-grid__attention" role="listitem">
              <CircleHelp aria-hidden="true" size={20} />
              <span>
                <strong>
                  <AnimatedNumber value={attentionCount} />
                </strong>
                Cần chú ý
              </span>
            </article>
          </div>
          <div className="lecturer-progress-summary">
            <span>
              <span>Mức hoàn thành học liệu</span>
              <strong>{averageProgress}%</strong>
            </span>
            <ProgressBar value={averageProgress} label={`Tiến độ bình quân ${averageProgress}%`} />
          </div>
        </aside>
      </div>

      <section
        className="dashboard-section dashboard-reveal"
        style={{ '--reveal-order': 2 }}
        aria-labelledby="lecturer-classes-title"
      >
        <div className="dashboard-panel__heading dashboard-panel__heading--outside">
          <div>
            <h2 id="lecturer-classes-title">Lớp đang giảng dạy</h2>
            <p>Mở lớp để theo dõi tiến độ và câu hỏi theo đúng học phần.</p>
          </div>
          <Link className="dashboard-text-link" to="/lecturer/classes">
            Xem tất cả <ArrowRight aria-hidden="true" size={16} />
          </Link>
        </div>
        <div className="lecturer-class-grid">
          {data.classes.map((courseClass) => (
            <Link
              className="lecturer-class-card"
              key={courseClass.id}
              to={`/lecturer/classes/${courseClass.id}`}
            >
              <figure className="lecturer-class-card__visual">
                <CourseCover
                  subjectId={courseClass.subject?.id}
                  subjectName={courseClass.subject?.name}
                  className="lecturer-class-card__cover"
                />
                <figcaption>{courseClass.semester}</figcaption>
              </figure>
              <span className="lecturer-class-card__body">
                <span className="lecturer-class-card__topline">
                  <span>{courseClass.subject?.name ?? 'Học phần'}</span>
                  <School aria-hidden="true" size={18} />
                </span>
                <h3>{courseClass.name}</h3>
                <span className="lecturer-class-card__progress">
                  <span>
                    <span>Tiến độ trung bình</span>
                    <strong>{courseClass.metrics.averageProgress}%</strong>
                  </span>
                  <ProgressBar
                    value={courseClass.metrics.averageProgress}
                    size="sm"
                    label={`Tiến độ trung bình ${courseClass.metrics.averageProgress}%`}
                  />
                </span>
                <span className="lecturer-class-card__facts">
                  <span>
                    <strong>{courseClass.studentCount}</strong> sinh viên
                  </span>
                  <span>
                    <strong>{courseClass.questionCount}</strong> câu hỏi
                  </span>
                  <span>
                    <strong>{courseClass.unansweredCount}</strong> chờ xử lý
                  </span>
                </span>
                <span className="lecturer-class-card__action">
                  Mở lớp <ArrowRight aria-hidden="true" size={16} />
                </span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section
        className="dashboard-panel dashboard-reveal"
        style={{ '--reveal-order': 3 }}
        aria-labelledby="recent-activity-title"
      >
        <div className="dashboard-panel__heading">
          <div>
            <h2 id="recent-activity-title">Hoạt động gần đây</h2>
            <p>Các phản hồi vừa hoàn tất.</p>
          </div>
          <Link className="dashboard-text-link" to="/lecturer/questions">
            Xem tất cả <ArrowRight aria-hidden="true" size={16} />
          </Link>
        </div>
        <div className="lecturer-activity-list">
          {answeredQuestions.slice(0, 3).map((question) => (
            <Link
              className="lecturer-activity-list__item"
              key={question.id}
              to={`/lecturer/questions/${question.id}`}
            >
              <CheckCircle2 aria-hidden="true" size={18} />
              <span>
                <strong>{question.student?.name ?? 'Sinh viên'}</strong>
                <small>{question.subject?.name ?? 'Học phần'}</small>
                <small>
                  <Clock3 aria-hidden="true" size={13} />
                  {formatDateTime(question.lecturerAnswer?.createdAt ?? question.createdAt)}
                </small>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
