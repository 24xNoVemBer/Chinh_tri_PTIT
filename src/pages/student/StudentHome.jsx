import { useCallback, useState } from 'react'
import {
  ArrowRight,
  BookOpenCheck,
  Bot,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileSearch,
  History,
  MessageCircleQuestion,
  MessageSquareReply,
  Play,
  ShieldCheck,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import AnimatedNumber from '../../components/common/AnimatedNumber'
import CourseCover from '../../components/common/CourseCover'
import { ErrorState, LoadingState } from '../../components/common/AsyncState'
import ProgressBar from '../../components/common/ProgressBar'
import StatusLabel from '../../components/common/StatusLabel'
import { useAuth } from '../../features/auth/useAuth'
import useAsyncData from '../../hooks/useAsyncData'
import { learningRepository, questionRepository } from '../../services/appRepositories'
import { formatDateTime } from '../../utils/format'
import '../common/DashboardHome.css'
import './StudentHome.css'

function getShortName(fullName) {
  const parts = String(fullName ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  return parts.slice(-2).join(' ') || 'bạn'
}

function getOfficialResponse(question) {
  if (question.lecturerAnswer) {
    return {
      content: question.lecturerAnswer.content,
      source: 'Phản hồi của giảng viên',
      status: 'answered',
      timestamp: question.lecturerAnswer.updatedAt ?? question.lecturerAnswer.createdAt,
    }
  }

  if (question.ragResponse?.reviewStatus === 'approved') {
    return {
      content: question.ragResponse.content,
      source: 'Nội dung đã được duyệt',
      status: 'approved',
      timestamp:
        question.ragResponse.reviewedAt ??
        question.ragResponse.updatedAt ??
        question.ragResponse.createdAt,
    }
  }

  return null
}

function buildRecentActivity(recentLesson, questions) {
  const items = []

  if (recentLesson?.lastReadAt) {
    items.push({
      id: `lesson-${recentLesson.id}`,
      icon: BookOpenCheck,
      title: 'Đã mở bài học gần nhất',
      detail: recentLesson.title,
      timestamp: recentLesson.lastReadAt,
      to: `/student/lessons/${recentLesson.id}`,
    })
  }

  questions.forEach((question) => {
    if (question.createdAt) {
      items.push({
        id: `question-${question.id}`,
        icon: MessageCircleQuestion,
        title: `Đã gửi câu hỏi${question.subject?.name ? ` trong ${question.subject.name}` : ''}`,
        detail: question.content,
        timestamp: question.createdAt,
        to: `/student/questions/${question.id}`,
      })
    }

    const response = getOfficialResponse(question)
    if (response?.timestamp) {
      items.push({
        id: `response-${question.id}`,
        icon: MessageSquareReply,
        title: `Đã nhận phản hồi${question.subject?.name ? ` từ ${question.subject.name}` : ''}`,
        detail: question.content,
        timestamp: response.timestamp,
        to: `/student/questions/${question.id}`,
      })
    }
  })

  return items
    .sort((first, second) => new Date(second.timestamp) - new Date(first.timestamp))
    .slice(0, 4)
}

export default function StudentHome() {
  const { user: currentStudent } = useAuth()
  const [activityExpanded, setActivityExpanded] = useState(false)
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

  const recentLesson = data.dashboard.recentLesson
  const recentSubject = recentLesson
    ? data.subjects.find((subject) => subject.id === recentLesson.chapter?.subjectId)
    : null
  const recentSubjectPath = recentSubject
    ? `/student/subjects/${recentSubject.id}`
    : '/student/subjects'
  const recentLessonState = !recentLesson
    ? null
    : recentLesson.progress >= 100
      ? 'complete'
      : recentLesson.progress > 0 || recentLesson.lastReadAt
        ? 'active'
        : 'not-started'
  const recentLessonStatus =
    recentLessonState === 'complete'
      ? 'Đã hoàn thành'
      : recentLessonState === 'not-started'
        ? 'Sẵn sàng'
        : 'Đang học'
  const recentLessonAction =
    recentLessonState === 'complete'
      ? 'Xem lại bài'
      : recentLessonState === 'not-started'
        ? 'Bắt đầu học'
        : 'Tiếp tục học'
  const pendingQuestions = data.questions.filter((question) => question.status === 'unanswered')
  const responseItems = data.questions
    .map((question) => ({ question, response: getOfficialResponse(question) }))
    .filter((item) => item.response)
    .sort(
      (first, second) =>
        new Date(second.response.timestamp ?? 0) - new Date(first.response.timestamp ?? 0),
    )
  const answeredCount = responseItems.length
  const nextSubject =
    data.subjects.find((subject) => subject.nextLesson && subject.id !== recentSubject?.id) ??
    data.subjects.find((subject) => subject.nextLesson)
  const assistantSubject = recentSubject ?? nextSubject ?? data.subjects[0]
  const assistantPath = assistantSubject
    ? `/student/chat?subject=${encodeURIComponent(assistantSubject.name)}`
    : '/student/chat'
  const activityItems = buildRecentActivity(recentLesson, data.questions)
  const visibleActivityItems = activityExpanded ? activityItems : activityItems.slice(0, 2)

  const todayItems = []
  if (recentLesson) {
    todayItems.push({
      id: 'continue',
      icon: Play,
      label: recentLessonState === 'complete' ? 'Ôn lại' : 'Ưu tiên',
      title:
        recentLessonState === 'complete'
          ? 'Xem lại bài đã hoàn thành'
          : recentLessonState === 'not-started'
            ? 'Bắt đầu bài học'
            : 'Tiếp tục bài đang học',
      detail: recentLesson.title,
      to: `/student/lessons/${recentLesson.id}`,
    })
  }
  if (pendingQuestions.length) {
    todayItems.push({
      id: 'pending',
      icon: MessageCircleQuestion,
      label: 'Theo dõi',
      title: `${pendingQuestions.length} câu hỏi đang chờ phản hồi`,
      detail: 'Xem trạng thái trong lịch sử hỏi đáp.',
      to: '/student/questions',
    })
  } else if (responseItems[0]) {
    todayItems.push({
      id: 'response',
      icon: MessageSquareReply,
      label: 'Phản hồi gần đây',
      title: responseItems[0].question.subject?.name ?? 'Câu hỏi của bạn',
      detail: responseItems[0].question.content,
      to: `/student/questions/${responseItems[0].question.id}`,
    })
  }
  if (nextSubject) {
    todayItems.push({
      id: 'next-subject',
      icon: BookOpenCheck,
      label: 'Học phần gợi ý',
      title: nextSubject.name,
      detail: nextSubject.nextLesson?.title ?? 'Mở học phần để xem nội dung.',
      to: `/student/subjects/${nextSubject.id}`,
    })
  }

  return (
    <div className="dashboard-home dashboard-home--student student-dashboard">
      <section
        className="student-overview dashboard-reveal"
        style={{ '--reveal-order': 0 }}
        aria-labelledby="student-overview-title"
      >
        <div className="student-overview__copy">
          <p className="dashboard-home__role">Không gian học tập cá nhân</p>
          <h1 id="student-overview-title">Chào {getShortName(currentStudent.name)}</h1>
          <p>Tiếp tục nội dung đang học, theo dõi tiến độ và xem các phản hồi gần đây.</p>
        </div>

        <dl className="student-overview__metrics" aria-label="Tóm tắt tiến độ học tập">
          <div>
            <dt>Tiến độ</dt>
            <dd>
              <AnimatedNumber value={data.dashboard.overallProgress} suffix="%" />
            </dd>
          </div>
          <div>
            <dt>Đã hoàn thành</dt>
            <dd>
              <AnimatedNumber value={data.dashboard.completedLessons} />
              <span>/{data.dashboard.totalLessons} bài</span>
            </dd>
          </div>
          <div>
            <dt>Phản hồi</dt>
            <dd>
              <AnimatedNumber value={answeredCount} />
            </dd>
          </div>
        </dl>
      </section>

      <div className="student-focus-grid dashboard-reveal" style={{ '--reveal-order': 1 }}>
        <section
          className="student-focus-card student-focus-card--continue"
          aria-labelledby="student-continue-title"
        >
          <header className="student-section-heading student-section-heading--inside">
            <div>
              <h2 id="student-continue-title">Tiếp tục học</h2>
            </div>
            {recentLesson && (
              <span
                className={`dashboard-status dashboard-status--${recentLessonState === 'not-started' ? 'pending' : 'success'}`}
              >
                {recentLessonStatus}
              </span>
            )}
          </header>

          {recentLesson ? (
            <div className="student-continue">
              <figure className="student-continue__visual">
                <CourseCover
                  subjectId={recentSubject?.id}
                  subjectName={recentSubject?.name}
                  className="student-continue__cover"
                />
              </figure>

              <div className="student-continue__content">
                <p className="student-continue__subject">
                  {recentSubject?.name ?? 'Học phần đang học'}
                </p>
                <h3>{recentLesson.title}</h3>
                <p className="student-continue__chapter">{recentLesson.chapter?.title}</p>

                <div className="student-continue__progress">
                  <div>
                    <span>Tiến độ bài học</span>
                    <strong>{recentLesson.progress}%</strong>
                  </div>
                  <ProgressBar
                    value={recentLesson.progress}
                    label={`Tiến độ bài học ${recentLesson.progress}%`}
                  />
                </div>

                <p className="student-continue__meta">
                  <Clock3 aria-hidden="true" size={16} />
                  {recentLesson.lastReadAt
                    ? `Mở gần nhất ${formatDateTime(recentLesson.lastReadAt)}`
                    : 'Chưa mở bài học'}
                </p>
              </div>

              <div className="student-continue__actions">
                <Link className="button button--primary" to={`/student/lessons/${recentLesson.id}`}>
                  <Play aria-hidden="true" size={18} />
                  {recentLessonAction}
                </Link>
                <Link className="dashboard-text-link" to={recentSubjectPath}>
                  Xem học phần
                  <ArrowRight aria-hidden="true" size={17} />
                </Link>
              </div>
            </div>
          ) : (
            <div className="student-focus-empty">
              <BookOpenCheck aria-hidden="true" size={24} />
              <div>
                <h3>Chọn một học phần để bắt đầu</h3>
                <p>Nội dung đang học sẽ được tổng hợp tại đây.</p>
              </div>
              <Link className="button button--primary" to="/student/subjects">
                Xem học phần
                <ArrowRight aria-hidden="true" size={18} />
              </Link>
            </div>
          )}
        </section>

        <section className="student-today" aria-labelledby="student-today-title">
          <header className="student-section-heading student-section-heading--inside">
            <div>
              <p>Gợi ý theo tiến độ</p>
              <h2 id="student-today-title">Việc hôm nay</h2>
            </div>
            <span className="student-today__count">{todayItems.length}</span>
          </header>

          {todayItems.length ? (
            <ol className="student-today__list">
              {todayItems.slice(0, 3).map((item) => {
                const Icon = item.icon
                return (
                  <li key={item.id}>
                    <Link to={item.to}>
                      <span className="student-today__icon">
                        <Icon aria-hidden="true" size={18} />
                      </span>
                      <span className="student-today__copy">
                        <small>{item.label}</small>
                        <strong>{item.title}</strong>
                        <span>{item.detail}</span>
                      </span>
                      <ArrowRight aria-hidden="true" size={17} />
                    </Link>
                  </li>
                )
              })}
            </ol>
          ) : (
            <div className="student-today__empty">
              <CheckCircle2 aria-hidden="true" size={24} />
              <strong>Chưa có việc cần ưu tiên</strong>
              <p>Bạn có thể chọn một học phần để bắt đầu.</p>
            </div>
          )}
        </section>
      </div>

      <section
        className="student-courses dashboard-reveal"
        style={{ '--reveal-order': 2 }}
        aria-labelledby="student-courses-title"
      >
        <header className="student-section-heading">
          <div>
            <h2 id="student-courses-title">Học phần của tôi</h2>
          </div>
          <Link className="dashboard-text-link" to="/student/subjects">
            Xem tất cả
            <ArrowRight aria-hidden="true" size={17} />
          </Link>
        </header>

        {data.subjects.length ? (
          <div className="student-course-grid" role="list">
            {data.subjects.map((subject) => (
              <article className="student-course-card" key={subject.id} role="listitem">
                <Link to={`/student/subjects/${subject.id}`}>
                  <CourseCover
                    subjectId={subject.id}
                    subjectName={subject.name}
                    className="student-course-card__cover"
                  />
                  <span className="student-course-card__body">
                    <span className="student-course-card__meta">
                      <span>{subject.credits} tín chỉ</span>
                      <strong>{subject.progress}%</strong>
                    </span>
                    <strong className="student-course-card__title">{subject.name}</strong>
                    <span className="student-course-card__progress">
                      <ProgressBar
                        value={subject.progress}
                        size="sm"
                        label={`Tiến độ ${subject.name} ${subject.progress}%`}
                      />
                      <small>
                        {subject.completedLessons}/{subject.lessonCount} bài hoàn thành
                      </small>
                    </span>
                    <span className="student-course-card__next">
                      <small>{subject.nextLesson ? 'Bài tiếp theo' : 'Trạng thái'}</small>
                      <span>
                        {subject.nextLesson?.title ??
                          (subject.lessonCount
                            ? 'Đã hoàn thành nội dung hiện có'
                            : 'Chưa có nội dung được mở')}
                      </span>
                    </span>
                  </span>
                  <ArrowRight className="student-course-card__arrow" aria-hidden="true" size={18} />
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <p className="dashboard-empty-note">
            Bạn chưa được ghi danh vào học phần nào. Liên hệ giảng viên hoặc phòng đào tạo để được
            thêm vào lớp.
          </p>
        )}
      </section>

      <div className="student-support-grid dashboard-reveal" style={{ '--reveal-order': 3 }}>
        <section className="student-feedback" aria-labelledby="student-feedback-title">
          <header className="student-section-heading student-section-heading--inside">
            <div>
              <h2 id="student-feedback-title">Phản hồi gần đây</h2>
            </div>
            <Link className="dashboard-text-link" to="/student/questions">
              Lịch sử
              <ArrowRight aria-hidden="true" size={16} />
            </Link>
          </header>

          {responseItems.length ? (
            <ul className="student-feedback__list">
              {responseItems.slice(0, 2).map(({ question, response }) => (
                <li key={question.id}>
                  <Link className="student-feedback__item" to={`/student/questions/${question.id}`}>
                    <span className="student-feedback__topline">
                      <StatusLabel type={response.status} />
                      <small>{formatDateTime(response.timestamp)}</small>
                    </span>
                    <strong>{question.content}</strong>
                    <span className="student-feedback__answer">{response.content}</span>
                    <span className="student-feedback__source">
                      <MessageSquareReply aria-hidden="true" size={15} />
                      {response.source}
                      {question.subject?.name ? ` · ${question.subject.name}` : ''}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="dashboard-empty-note">
              Chưa có phản hồi chính thức. Các câu hỏi đang chờ vẫn được lưu trong lịch sử.
            </p>
          )}
        </section>

        <aside className="student-assistant" aria-labelledby="student-assistant-title">
          <span className="student-assistant__icon">
            <Bot aria-hidden="true" size={24} />
          </span>
          <div>
            <p className="dashboard-home__role">Trợ giảng theo học phần</p>
            <h2 id="student-assistant-title">Hỏi trong đúng ngữ cảnh</h2>
            <p>
              Mở cuộc trò chuyện từ học phần đang học, sau đó nêu rõ chương hoặc nội dung cần tra
              cứu.
            </p>
          </div>

          {assistantSubject && (
            <div className="student-assistant__context">
              <BookOpenCheck aria-hidden="true" size={18} />
              <span>
                <small>Ngữ cảnh đề xuất</small>
                <strong>{assistantSubject.name}</strong>
              </span>
            </div>
          )}

          <div className="student-assistant__actions">
            <Link className="button button--secondary" to={assistantPath}>
              <Bot aria-hidden="true" size={18} />
              Hỏi trợ giảng
            </Link>
            <Link className="dashboard-text-link" to="/student/search">
              <FileSearch aria-hidden="true" size={17} />
              Tra cứu học liệu
            </Link>
          </div>

          <p className="student-assistant__note">
            <ShieldCheck aria-hidden="true" size={16} />
            AI hiện sử dụng dữ liệu minh họa; model RAG sẽ được tích hợp sau.
          </p>
        </aside>
      </div>

      <section
        className="student-activity dashboard-reveal"
        style={{ '--reveal-order': 4 }}
        aria-labelledby="student-activity-title"
      >
        <header className="student-section-heading student-section-heading--inside">
          <div>
            <h2 id="student-activity-title">Hoạt động gần đây</h2>
          </div>
          {activityItems.length > 2 ? (
            <button
              className="student-activity__toggle"
              type="button"
              aria-expanded={activityExpanded}
              aria-controls="student-activity-list"
              onClick={() => setActivityExpanded((expanded) => !expanded)}
            >
              {activityExpanded ? 'Thu gọn' : 'Xem tất cả'}
              <ChevronDown aria-hidden="true" size={17} />
            </button>
          ) : (
            <History aria-hidden="true" size={20} />
          )}
        </header>

        {activityItems.length ? (
          <ol className="student-activity__list" id="student-activity-list">
            {visibleActivityItems.map((item) => {
              const Icon = item.icon
              return (
                <li key={item.id}>
                  <Link to={item.to}>
                    <span className="student-activity__icon">
                      <Icon aria-hidden="true" size={17} />
                    </span>
                    <span className="student-activity__copy">
                      <strong>{item.title}</strong>
                      <span>{item.detail}</span>
                    </span>
                    <time dateTime={item.timestamp}>{formatDateTime(item.timestamp)}</time>
                  </Link>
                </li>
              )
            })}
          </ol>
        ) : (
          <p className="dashboard-empty-note">
            Hoạt động học tập sẽ xuất hiện sau khi bạn mở bài học hoặc đặt câu hỏi.
          </p>
        )}
      </section>
    </div>
  )
}
