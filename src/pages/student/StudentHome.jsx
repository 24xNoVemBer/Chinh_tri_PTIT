import { useCallback } from 'react'
import { ArrowRight, BookOpen, Bot, CircleHelp, Gauge, PlayCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ErrorState, LoadingState } from '../../components/common/AsyncState'
import PageHeader from '../../components/common/PageHeader'
import ProgressBar from '../../components/common/ProgressBar'
import { useAuth } from '../../features/auth/useAuth'
import useAsyncData from '../../hooks/useAsyncData'
import { learningRepository } from '../../services/appRepositories'
import { questionRepository } from '../../services/appRepositories'

export default function StudentHome() {
  const { user: currentStudent } = useAuth()
  const loader = useCallback(async () => {
    const [subjects, questions, dashboard] = await Promise.all([
      learningRepository.listSubjectProgress(currentStudent.id),
      questionRepository.listForStudent(currentStudent.id),
      learningRepository.getDashboard(currentStudent.id),
    ])
    return { subjects, questions, dashboard }
  }, [currentStudent.id])
  const { data, loading, error, reload } = useAsyncData(loader)

  if (loading) return <LoadingState label="Đang chuẩn bị không gian học tập…" />
  if (error) return <ErrorState message={error.message} onRetry={reload} />

  const recentSubject = data.dashboard.recentLesson
    ? data.subjects.find((subject) => subject.id === data.dashboard.recentLesson.chapter?.subjectId)
    : null

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Không gian sinh viên"
        title={`Chào ${currentStudent.name.split(' ').at(-1)}`}
        description="Tiếp tục bài học gần đây, tra cứu kiến thức hoặc theo dõi các câu hỏi của bạn."
        actions={
          <Link className="button button--primary" to="/student/chat">
            <Bot aria-hidden="true" size={18} />
            Hỏi trợ giảng
          </Link>
        }
      />

      <section className="stat-grid" aria-label="Tổng quan học tập">
        <article className="stat-card">
          <BookOpen aria-hidden="true" />
          <div>
            <strong>{data.subjects.length}</strong>
            <span>Môn đang học</span>
          </div>
        </article>
        <article className="stat-card">
          <CircleHelp aria-hidden="true" />
          <div>
            <strong>{data.questions.length}</strong>
            <span>Câu hỏi đã đặt</span>
          </div>
        </article>
        <article className="stat-card">
          <Gauge aria-hidden="true" />
          <div>
            <strong>{data.dashboard.overallProgress}%</strong>
            <span>Tiến độ tổng thể</span>
          </div>
        </article>
      </section>

      {data.dashboard.recentLesson && (
        <section className="continue-learning" aria-labelledby="continue-learning-title">
          <span className="continue-learning__icon">
            <PlayCircle aria-hidden="true" size={22} />
          </span>
          <div>
            <p className="section-heading__eyebrow">Tiếp tục học</p>
            <h2 id="continue-learning-title">{data.dashboard.recentLesson.title}</h2>
            <p>{recentSubject?.name ?? 'Môn học gần đây'}</p>
            <ProgressBar
              value={data.dashboard.recentLesson.progress}
              label={`Tiến độ bài học ${data.dashboard.recentLesson.progress}%`}
            />
          </div>
          <Link
            className="button button--secondary"
            to={`/student/lessons/${data.dashboard.recentLesson.id}`}
          >
            Mở bài học <ArrowRight aria-hidden="true" size={16} />
          </Link>
        </section>
      )}

      <section className="section-stack" aria-labelledby="student-subjects-title">
        <div className="section-heading">
          <div>
            <p className="section-heading__eyebrow">Học kỳ hiện tại</p>
            <h2 id="student-subjects-title">Môn học của bạn</h2>
          </div>
          <Link className="text-link" to="/student/subjects">
            Xem tất cả <ArrowRight aria-hidden="true" size={16} />
          </Link>
        </div>
        <div className="card-grid">
          {data.subjects.map((subject) => (
            <Link
              className="content-card content-card--interactive subject-card"
              key={subject.id}
              to={`/student/subjects/${subject.id}`}
            >
              <span className="content-card__meta">{subject.credits} tín chỉ</span>
              <h3>{subject.name}</h3>
              <div className="subject-card__progress">
                <ProgressBar value={subject.progress} label={`Tiến độ ${subject.progress}%`} />
                <span>{subject.progress}%</span>
              </div>
              <span className="content-card__action">
                Mở môn học <ArrowRight aria-hidden="true" size={16} />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
