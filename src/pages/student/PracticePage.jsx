import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  EyeOff,
  RotateCcw,
  Shuffle,
  XCircle,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../../components/common/AsyncState'
import PageHeader from '../../components/common/PageHeader'
import { useAuth } from '../../features/auth/useAuth'
import useAsyncData from '../../hooks/useAsyncData'
import { learningRepository, practiceSessionRepository } from '../../services/appRepositories'
import './PracticePage.css'

export default function PracticePage() {
  const { user } = useAuth()
  const { sessionId } = useParams()
  const [selectedSubjectId, setSelectedSubjectId] = useState('')
  const [selectedClassId, setSelectedClassId] = useState('')
  const [selectedChapterId, setSelectedChapterId] = useState('')
  const [questionCount, setQuestionCount] = useState(10)
  const [sessionType, setSessionType] = useState('practice')
  const [randomize, setRandomize] = useState(true)
  const [session, setSession] = useState(null)
  const [pageError, setPageError] = useState('')

  const subjectsLoader = useCallback(
    () => learningRepository.listSubjectProgress(user.id),
    [user.id],
  )
  const subjectsState = useAsyncData(subjectsLoader)

  const effectiveSubjectId = selectedSubjectId || subjectsState.data?.[0]?.id || ''

  const configLoader = useCallback(
    () =>
      effectiveSubjectId
        ? practiceSessionRepository.getConfig(effectiveSubjectId)
        : Promise.resolve(null),
    [effectiveSubjectId],
  )
  const configState = useAsyncData(configLoader)

  const loadSession = useCallback(async () => {
    if (!sessionId) return
    setPageError('')
    try {
      setSession(await practiceSessionRepository.get(sessionId))
    } catch (error) {
      setPageError(error.message)
    }
  }, [sessionId])

  useEffect(() => {
    if (sessionId) {
      // Load a persisted session when entering a deep link.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void loadSession()
    }
  }, [loadSession, sessionId])

  const selectedConfig = configState.data
  const effectiveClassId = selectedClassId || selectedConfig?.classes?.[0]?.id || ''
  const availableCount = useMemo(() => {
    if (!selectedConfig) return 0
    if (!selectedChapterId)
      return selectedConfig.chapters.reduce((sum, chapter) => sum + chapter.questionCount, 0)
    return (
      selectedConfig.chapters.find((chapter) => chapter.id === selectedChapterId)?.questionCount ??
      0
    )
  }, [selectedChapterId, selectedConfig])

  const startSession = async () => {
    setPageError('')
    try {
      const created = await practiceSessionRepository.create({
        subjectId: effectiveSubjectId,
        classId: effectiveClassId || undefined,
        chapterId: selectedChapterId || undefined,
        questionCount: Math.min(questionCount, availableCount),
        sessionType,
        randomize,
      })
      setSession(created)
    } catch (error) {
      setPageError(error.message)
    }
  }

  const reset = () => {
    setSession(null)
    setPageError('')
  }

  if (sessionId && !session && !pageError)
    return <LoadingState label="Đang khôi phục phiên luyện tập…" />
  if (subjectsState.loading && !sessionId) return <LoadingState label="Đang tải học phần…" />
  if (subjectsState.error)
    return <ErrorState message={subjectsState.error.message} onRetry={subjectsState.reload} />
  if (pageError) return <ErrorState message={pageError} onRetry={sessionId ? loadSession : reset} />
  if (session)
    return <PracticeSessionView session={session} onSessionChange={setSession} onReset={reset} />
  if (!subjectsState.data?.length) {
    return (
      <EmptyState
        title="Chưa có học phần để luyện tập"
        description="Bạn cần được ghi danh vào học phần trước khi bắt đầu."
      />
    )
  }

  return (
    <div className="page-stack practice-page">
      <PageHeader
        eyebrow="Sinh viên"
        title="Luyện tập và thi thử"
        description="Chọn cách học phù hợp: củng cố kiến thức với phản hồi tức thì hoặc tự đánh giá như một bài thi."
      />
      <section className="practice-mode-grid" aria-label="Chọn hình thức làm bài">
        <button
          className={`practice-mode-card ${sessionType === 'practice' ? 'is-active' : ''}`}
          type="button"
          aria-pressed={sessionType === 'practice'}
          onClick={() => setSessionType('practice')}
        >
          <span className="practice-mode-card__icon">
            <BookOpenCheck aria-hidden="true" size={22} />
          </span>
          <span>
            <strong>Luyện tập</strong>
            <small>Xem đáp án và giải thích ngay sau mỗi câu.</small>
          </span>
          <Eye aria-hidden="true" size={20} />
        </button>
        <button
          className={`practice-mode-card ${sessionType === 'mock_exam' ? 'is-active' : ''}`}
          type="button"
          aria-pressed={sessionType === 'mock_exam'}
          onClick={() => setSessionType('mock_exam')}
        >
          <span className="practice-mode-card__icon">
            <ClipboardCheck aria-hidden="true" size={22} />
          </span>
          <span>
            <strong>Thi thử</strong>
            <small>Giữ kín đáp án và chấm điểm sau khi nộp bài.</small>
          </span>
          <EyeOff aria-hidden="true" size={20} />
        </button>
      </section>
      <section className="practice-setup-card" aria-labelledby="practice-setup-title">
        <div>
          <p className="practice-eyebrow">Bắt đầu phiên mới</p>
          <h2 id="practice-setup-title">
            {sessionType === 'practice' ? 'Chọn phạm vi ôn tập' : 'Thiết lập đề thi thử'}
          </h2>
        </div>
        <div className="practice-setup-grid">
          <label>
            <span>Học phần</span>
            <select
              value={effectiveSubjectId}
              onChange={(event) => {
                setSelectedSubjectId(event.target.value)
                setSelectedChapterId('')
              }}
            >
              {subjectsState.data.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Chương</span>
            <select
              value={selectedChapterId}
              onChange={(event) => setSelectedChapterId(event.target.value)}
              disabled={configState.loading}
            >
              <option value="">Toàn bộ học phần</option>
              {selectedConfig?.chapters.map((chapter) => (
                <option key={chapter.id} value={chapter.id} disabled={chapter.questionCount === 0}>
                  {chapter.title} ({chapter.questionCount} câu)
                </option>
              ))}
            </select>
          </label>
          {selectedConfig?.classes?.length > 1 && (
            <label>
              <span>Lớp học</span>
              <select
                value={effectiveClassId}
                onChange={(event) => setSelectedClassId(event.target.value)}
                disabled={configState.loading}
              >
                {selectedConfig.classes.map((courseClass) => (
                  <option key={courseClass.id} value={courseClass.id}>
                    {courseClass.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            <span>Số câu</span>
            <select
              value={questionCount}
              onChange={(event) => setQuestionCount(Number(event.target.value))}
            >
              {[5, 10, 20].map((count) => (
                <option key={count} value={count} disabled={availableCount < count}>
                  {count} câu
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="practice-random-option">
          <input
            type="checkbox"
            checked={randomize}
            onChange={(event) => setRandomize(event.target.checked)}
          />
          <span className="practice-random-option__icon">
            <Shuffle aria-hidden="true" size={19} />
          </span>
          <span>
            <strong>Trộn ngẫu nhiên câu hỏi</strong>
            <small>Mỗi phiên lấy một bộ câu khác nhau trong phạm vi đã chọn.</small>
          </span>
        </label>
        <div className="practice-setup-footer">
          <span>{availableCount} câu đã xuất bản trong phạm vi này</span>
          <button
            className="button button--primary"
            type="button"
            disabled={configState.loading || availableCount === 0}
            onClick={startSession}
          >
            {sessionType === 'practice' ? 'Bắt đầu luyện tập' : 'Bắt đầu thi thử'}{' '}
            <ArrowRight aria-hidden="true" size={17} />
          </button>
        </div>
      </section>
      <PracticeHistory />
    </div>
  )
}

function PracticeHistory() {
  const historyState = useAsyncData(() => practiceSessionRepository.listHistory())
  if (historyState.loading || historyState.error || !historyState.data?.length) return null
  return (
    <section className="practice-history" aria-labelledby="practice-history-title">
      <div className="section-heading">
        <div>
          <p className="section-heading__eyebrow">Gần đây</p>
          <h2 id="practice-history-title">Phiên luyện tập</h2>
        </div>
      </div>
      <div className="practice-history-list">
        {historyState.data.slice(0, 5).map((item) => (
          <Link className="practice-history-item" key={item.id} to={`/student/practice/${item.id}`}>
            <span>
              <span className="practice-history-item__title">
                <strong>{item.subjectName}</strong>
                <small>{item.sessionType === 'mock_exam' ? 'Thi thử' : 'Luyện tập'}</small>
              </span>
              <small>{item.chapterTitle ?? 'Toàn bộ học phần'}</small>
            </span>
            <span>
              {item.status === 'completed'
                ? `${item.accuracy}% đúng`
                : `${item.answeredCount}/${item.questionCount} câu`}
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}

function PracticeSessionView({ session, onSessionChange, onReset }) {
  const [answering, setAnswering] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [answerError, setAnswerError] = useState('')
  const [feedback, setFeedback] = useState(null)
  const [activePosition, setActivePosition] = useState(
    () => session.questions.find((item) => !item.isAnswered)?.position ?? 1,
  )
  const current =
    session.questions.find((item) => item.position === activePosition) ??
    session.questions.find((item) => !item.isAnswered)
  const completed = session.status === 'completed'
  const isMockExam = session.sessionType === 'mock_exam'
  const finish = async () => {
    try {
      const result = await practiceSessionRepository.complete(session.id)
      onSessionChange(result)
    } catch (error) {
      setAnswerError(error.message)
    }
  }
  const retryWrong = async () => {
    setRetrying(true)
    setAnswerError('')
    try {
      const retrySession = await practiceSessionRepository.create({
        subjectId: session.subjectId,
        classId: session.classId || undefined,
        mode: 'retry_wrong',
        sessionType: 'practice',
        sourceSessionId: session.id,
        questionCount: session.questions.filter((item) => item.isCorrect === false).length,
      })
      onSessionChange(retrySession)
    } catch (error) {
      setAnswerError(error.message)
    } finally {
      setRetrying(false)
    }
  }
  const answer = async (optionId) => {
    if (!current || (!isMockExam && current.isAnswered) || answering) return
    setAnswering(true)
    setAnswerError('')
    try {
      const result = await practiceSessionRepository.answer(session.id, {
        questionId: current.question.id,
        optionId,
      })
      setFeedback(isMockExam ? null : result)
      onSessionChange(await practiceSessionRepository.get(session.id))
    } catch (error) {
      setAnswerError(error.message)
    } finally {
      setAnswering(false)
    }
  }
  if (completed) {
    return (
      <div className="page-stack practice-page">
        <PageHeader
          eyebrow={isMockExam ? 'Kết quả thi thử' : 'Kết quả luyện tập'}
          title={`${session.correctCount}/${session.questionCount} câu đúng`}
          description={
            isMockExam
              ? 'Đáp án và giải thích được mở sau khi bạn đã nộp bài.'
              : 'Bạn có thể xem lại từng câu hoặc bắt đầu một phiên mới.'
          }
        />
        <section className="practice-result-card">
          <strong>
            {session.questionCount
              ? Math.round((session.correctCount / session.questionCount) * 100)
              : 0}
            %
          </strong>
          <span>độ chính xác</span>
          <div className="practice-result-actions">
            {session.questions.some((item) => item.isCorrect === false) && (
              <button
                className="button button--primary"
                type="button"
                onClick={retryWrong}
                disabled={retrying}
              >
                <RotateCcw aria-hidden="true" size={17} />
                {retrying ? 'Đang tạo phiên…' : 'Luyện lại câu sai'}
              </button>
            )}
            <button className="button button--secondary" type="button" onClick={onReset}>
              Phiên mới
            </button>
            <Link className="button button--secondary" to="/student/subjects">
              Về học phần
            </Link>
          </div>
        </section>
        <PracticeReview session={session} />
      </div>
    )
  }
  if (!current) {
    return (
      <div className="page-stack practice-page">
        <ErrorState message={answerError || 'Không tìm thấy câu hỏi hiện tại.'} onRetry={finish} />
      </div>
    )
  }
  const question = current.question
  const answeredCurrent = session.questions.find(
    (item) => item.question.id === question.id && item.isAnswered,
  )
  const displayFeedback =
    feedback?.questionId === question.id
      ? feedback
      : answeredCurrent
        ? {
            questionId: question.id,
            isCorrect: answeredCurrent.isCorrect,
            explanation: question.explanation,
          }
        : null
  return (
    <div className="page-stack practice-page practice-session-page">
      <PageHeader
        eyebrow={isMockExam ? 'Thi thử' : 'Luyện tập'}
        title={question.subject?.name ?? 'Học phần'}
        description={
          isMockExam
            ? `Câu ${current.position}/${session.questionCount} · ${session.answeredCount} câu đã chọn`
            : `Câu ${current.position}/${session.questionCount} · ${session.correctCount} câu đúng`
        }
      />
      <section className="practice-session-card" aria-labelledby="practice-question-title">
        <div className="practice-session-progress">
          <span style={{ width: `${(session.answeredCount / session.questionCount) * 100}%` }} />
        </div>
        <p className="practice-eyebrow">{question.chapter?.title}</p>
        <h2 id="practice-question-title">{question.content}</h2>
        <div className="practice-answer-list">
          {question.options.map((option) => {
            const isSelected = answeredCurrent?.selectedOptionId === option.id
            const isCorrect = answeredCurrent && option.id === question.correctOptionId
            return (
              <button
                className={`practice-answer ${isSelected ? 'is-selected' : ''} ${isCorrect ? 'is-correct' : ''}`}
                key={option.id}
                type="button"
                disabled={answering || (!isMockExam && Boolean(answeredCurrent))}
                onClick={() => answer(option.id)}
              >
                <b>{option.key}</b>
                <span>{option.content}</span>
                {isCorrect && <CheckCircle2 aria-hidden="true" size={20} />}
                {isSelected && !isCorrect && <XCircle aria-hidden="true" size={20} />}
              </button>
            )
          })}
        </div>
        {!isMockExam && displayFeedback && (
          <div
            className={`practice-feedback ${displayFeedback.isCorrect ? 'is-correct' : 'is-wrong'}`}
          >
            <strong>{displayFeedback.isCorrect ? 'Chính xác' : 'Chưa chính xác'}</strong>
            <p>{displayFeedback.explanation}</p>
          </div>
        )}
        {answerError && (
          <p className="practice-form-error" role="alert">
            {answerError}
          </p>
        )}
        {session.answeredCount >= session.questionCount ? (
          <button
            className="button button--primary practice-next-button"
            type="button"
            onClick={finish}
          >
            {isMockExam ? 'Nộp bài' : 'Xem kết quả'} <ArrowRight aria-hidden="true" size={17} />
          </button>
        ) : (
          (displayFeedback || isMockExam) && (
            <button
              className={`button ${isMockExam && !answeredCurrent ? 'button--secondary' : 'button--primary'} practice-next-button`}
              type="button"
              onClick={() => {
                setFeedback(null)
                const nextQuestion =
                  session.questions.find(
                    (item) => !item.isAnswered && item.position > current.position,
                  ) ??
                  session.questions.find(
                    (item) => !item.isAnswered && item.position !== current.position,
                  )
                setActivePosition(nextQuestion?.position ?? current.position)
              }}
            >
              {isMockExam && !answeredCurrent ? 'Bỏ qua câu này' : 'Câu tiếp theo'}{' '}
              <ArrowRight aria-hidden="true" size={17} />
            </button>
          )
        )}
      </section>
      <div className="practice-mini-nav" aria-label="Danh sách câu hỏi trong phiên">
        {session.questions.map((item) => (
          <button
            type="button"
            aria-label={`Mở câu ${item.position}${item.isAnswered ? ', đã chọn đáp án' : ''}`}
            aria-current={item.id === current.id ? 'step' : undefined}
            className={
              item.isAnswered
                ? item.isCorrect === null
                  ? 'is-answered'
                  : item.isCorrect
                    ? 'is-correct'
                    : 'is-wrong'
                : item.id === current.id
                  ? 'is-current'
                  : ''
            }
            key={item.id}
            onClick={() => {
              setFeedback(null)
              setActivePosition(item.position)
            }}
          >
            {item.position}
          </button>
        ))}
      </div>
    </div>
  )
}

function PracticeReview({ session }) {
  return (
    <section className="practice-review">
      <div className="section-heading">
        <div>
          <p className="section-heading__eyebrow">Xem lại</p>
          <h2>Đáp án và giải thích</h2>
        </div>
      </div>
      {session.questions.map((item) => (
        <article className="practice-review-item" key={item.id}>
          <span className={item.isCorrect ? 'is-correct' : 'is-wrong'}>
            {item.isCorrect ? 'Đúng' : 'Sai'} · Câu {item.position}
          </span>
          <h3>{item.question.content}</h3>
          <p>{item.question.explanation}</p>
        </article>
      ))}
    </section>
  )
}
