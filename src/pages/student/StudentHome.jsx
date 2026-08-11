import { useCallback } from 'react'
import {
  ArrowRight,
  BookOpenCheck,
  Clock3,
  FileSearch,
  Gauge,
  MessageCircleQuestion,
  Play,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import AnimatedNumber from '../../components/common/AnimatedNumber'
import CourseCover from '../../components/common/CourseCover'
import { ErrorState, LoadingState } from '../../components/common/AsyncState'
import ProgressBar from '../../components/common/ProgressBar'
import { useAuth } from '../../features/auth/useAuth'
import useAsyncData from '../../hooks/useAsyncData'
import {
  learningRepository,
  practiceSessionRepository,
  questionRepository,
} from '../../services/appRepositories'
import { formatDateTime } from '../../utils/format'
import '../common/DashboardHome.css'

export default function StudentHome() {
  const { user: currentStudent } = useAuth()
  const loader = useCallback(async () => {
    const [subjects, questions, dashboard, practice] = await Promise.all([
      learningRepository.listSubjectProgress(currentStudent.id),
      questionRepository.listForStudent(currentStudent.id),
      learningRepository.getDashboard(currentStudent.id),
      practiceSessionRepository.getOverview(),
    ])
    return { subjects, questions, dashboard, practice }
  }, [currentStudent.id])
  const { data, loading, error, reload } = useAsyncData(loader)

  if (loading) return <LoadingState label="Đang chuẩn bị không gian học tập…" />
  if (error) return <ErrorState message={error.message} onRetry={reload} />

  const recentLesson = data.dashboard.recentLesson
  const recentSubject = recentLesson
    ? data.subjects.find((subject) => subject.id === recentLesson.chapter?.subjectId)
    : null
  const recentQuestions = data.questions.slice(0, 3)
  const answeredQuestions = data.questions.filter((question) => question.status === 'answered')
  const recentSubjectPath = recentSubject
    ? `/student/subjects/${recentSubject.id}`
    : '/student/subjects'

  return (
    <div className="dashboard-home dashboard-home--student">
      <section
        className="student-resume dashboard-reveal"
        style={{ '--reveal-order': 0 }}
        aria-labelledby="student-resume-title"
      >
        <header className="student-resume__heading">
          <div>
            <p className="dashboard-home__role">Không gian sinh viên</p>
            <h1 id="student-resume-title">Tiếp tục học</h1>
          </div>
          <p>Tiến độ và nội dung gần nhất của bạn.</p>
        </header>

        {recentLesson ? (
          <div className="student-resume__main">
            <figure className="student-resume__visual">
              <CourseCover
                subjectId={recentSubject?.id}
                subjectName={recentSubject?.name}
                className="student-resume__cover"
              />
            </figure>

            <div className="student-resume__content">
              <span className="dashboard-status dashboard-status--success">Đang học</span>
              <p className="student-resume__subject">{recentSubject?.name}</p>
              <h2>{recentLesson.title}</h2>
              <p className="student-resume__chapter">{recentLesson.chapter?.title}</p>
              <div className="student-resume__progress">
                <div>
                  <span>Tiến độ bài học</span>
                  <strong>{recentLesson.progress}%</strong>
                </div>
                <ProgressBar
                  value={recentLesson.progress}
                  label={`Tiến độ bài học ${recentLesson.progress}%`}
                />
              </div>
              <p className="student-resume__meta">
                <Clock3 aria-hidden="true" size={15} />
                Mở gần nhất {formatDateTime(recentLesson.lastReadAt)}
              </p>
            </div>

            <div className="student-resume__actions">
              <Link className="button button--primary" to={`/student/lessons/${recentLesson.id}`}>
                <Play aria-hidden="true" size={18} />
                Tiếp tục học
              </Link>
              <Link className="button button--secondary" to={recentSubjectPath}>
                Xem học phần
                <ArrowRight aria-hidden="true" size={18} />
              </Link>
            </div>
          </div>
        ) : (
          <div className="student-resume__empty">
            <BookOpenCheck aria-hidden="true" size={24} />
            <div>
              <h2>Chọn một học phần để bắt đầu.</h2>
              <p>Nội dung đang học sẽ được tổng hợp tại đây.</p>
            </div>
            <Link className="button button--primary" to="/student/subjects">
              Xem học phần <ArrowRight aria-hidden="true" size={18} />
            </Link>
          </div>
        )}

        <div className="student-resume__stats" role="list" aria-label="Thống kê học tập">
          <article role="listitem">
            <span>Tiến độ tổng thể</span>
            <strong>
              <AnimatedNumber value={data.dashboard.overallProgress} suffix="%" />
            </strong>
          </article>
          <article role="listitem">
            <span>Bài hoàn thành</span>
            <strong>
              <AnimatedNumber value={data.dashboard.completedLessons} />/
              {data.dashboard.totalLessons}
            </strong>
          </article>
          <article role="listitem">
            <span>Học phần</span>
            <strong>
              <AnimatedNumber value={data.subjects.length} />
            </strong>
          </article>
          <article role="listitem">
            <span>Đã phản hồi</span>
            <strong>
              <AnimatedNumber value={answeredQuestions.length} />
            </strong>
          </article>
        </div>
      </section>

      <section
        className="student-practice-dashboard dashboard-reveal"
        style={{ '--reveal-order': 1 }}
        aria-labelledby="student-practice-title"
      >
        <div className="student-practice-dashboard__intro">
          <div>
            <p className="dashboard-home__role">Ôn tập theo học phần</p>
            <h2 id="student-practice-title">Luyện tập có hướng dẫn</h2>
            <p>Chọn một học phần, làm từng câu và xem giải thích ngay sau lựa chọn.</p>
          </div>
          <Link className="button button--primary" to="/student/practice">
            <Gauge aria-hidden="true" size={18} />
            Bắt đầu luyện tập
            <ArrowRight aria-hidden="true" size={17} />
          </Link>
        </div>
        <div
          className="student-practice-dashboard__stats"
          role="list"
          aria-label="Thống kê luyện tập"
        >
          <article role="listitem">
            <span>Độ chính xác</span>
            <strong>{data.practice.summary.accuracy}%</strong>
          </article>
          <article role="listitem">
            <span>Đã trả lời</span>
            <strong>{data.practice.summary.answered}</strong>
          </article>
          <article role="listitem">
            <span>Đang luyện</span>
            <strong>{data.practice.currentSessionId ? '1 phiên' : 'Chưa có'}</strong>
          </article>
        </div>
        {data.practice.subjects.length > 0 && (
          <div className="student-practice-dashboard__subjects">
            {data.practice.subjects.slice(0, 3).map((subject) => (
              <Link key={subject.id} to="/student/practice" className="student-practice-subject">
                <span>
                  <strong>{subject.name}</strong>
                  <small>{subject.answered} câu đã làm</small>
                </span>
                <span className="student-practice-subject__score">{subject.accuracy}%</span>
                <ArrowRight aria-hidden="true" size={16} />
              </Link>
            ))}
          </div>
        )}
        {data.practice.summary.weakTopics.length > 0 && (
          <Link className="student-practice-dashboard__retry" to="/student/practice">
            <RotateCcw aria-hidden="true" size={16} />
            Ôn lại các chủ đề cần củng cố
            <ArrowRight aria-hidden="true" size={16} />
          </Link>
        )}
      </section>

      <div
        className="dashboard-grid dashboard-grid--student dashboard-reveal"
        style={{ '--reveal-order': 2 }}
      >
        <section className="dashboard-panel" aria-labelledby="student-subjects-title">
          <div className="dashboard-panel__heading">
            <div>
              <h2 id="student-subjects-title">Học phần hiện tại</h2>
              <p>Theo dõi tiến độ theo từng môn học.</p>
            </div>
            <Link className="dashboard-text-link" to="/student/subjects">
              Xem tất cả <ArrowRight aria-hidden="true" size={16} />
            </Link>
          </div>
          <div className="dashboard-subject-list">
            {data.subjects.map((subject) => (
              <Link
                className="dashboard-subject-row"
                key={subject.id}
                to={`/student/subjects/${subject.id}`}
              >
                <CourseCover
                  subjectId={subject.id}
                  subjectName={subject.name}
                  className="dashboard-subject-row__cover"
                />
                <span className="dashboard-subject-row__copy">
                  <strong>{subject.name}</strong>
                  <small>
                    Chương {subject.completedLessons}/{subject.lessonCount} · {subject.credits} tín
                    chỉ
                  </small>
                  <ProgressBar
                    value={subject.progress}
                    size="sm"
                    label={`Tiến độ ${subject.progress}%`}
                  />
                </span>
                <span className="dashboard-subject-row__progress">{subject.progress}%</span>
                <ArrowRight className="dashboard-subject-row__arrow" aria-hidden="true" size={17} />
              </Link>
            ))}
          </div>
        </section>

        <section className="dashboard-panel" aria-labelledby="recent-questions-title">
          <div className="dashboard-panel__heading">
            <div>
              <h2 id="recent-questions-title">Câu hỏi gần đây</h2>
              <p>Phản hồi được gắn với đúng học phần.</p>
            </div>
            <Link className="dashboard-text-link" to="/student/questions">
              Lịch sử <ArrowRight aria-hidden="true" size={16} />
            </Link>
          </div>
          <div className="dashboard-question-list">
            {recentQuestions.map((question) => (
              <Link
                className="dashboard-question-row"
                key={question.id}
                to={`/student/questions/${question.id}`}
              >
                <span className="dashboard-question-row__topline">
                  <span
                    className={`dashboard-status dashboard-status--${question.status === 'answered' ? 'success' : 'pending'}`}
                  >
                    {question.status === 'answered' ? 'Đã trả lời' : 'Đang chờ'}
                  </span>
                  <small>{formatDateTime(question.createdAt)}</small>
                </span>
                <strong>{question.content}</strong>
                <span className="dashboard-question-row__meta">
                  <MessageCircleQuestion aria-hidden="true" size={14} />
                  {question.subject?.name ?? 'Học phần'}
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>

      <aside
        className="dashboard-trust dashboard-reveal"
        style={{ '--reveal-order': 3 }}
        aria-label="Nguyên tắc nguồn học liệu"
      >
        <ShieldCheck aria-hidden="true" size={22} />
        <div>
          <strong>Nội dung chính thống, học tập đúng định hướng.</strong>
          <p>Giáo trình và nguồn tham khảo luôn đi kèm nội dung tra cứu.</p>
        </div>
        <Link className="button button--secondary" to="/student/search">
          <FileSearch aria-hidden="true" size={18} />
          Tra cứu học liệu
        </Link>
      </aside>
    </div>
  )
}
