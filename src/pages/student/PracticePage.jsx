import { ArrowRight, CheckCircle2, RotateCcw, XCircle } from 'lucide-react'
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
        title="Luyện tập trắc nghiệm"
        description="Ôn lại kiến thức theo từng học phần và nhận giải thích ngay sau mỗi lựa chọn."
      />
      <section className="practice-setup-card" aria-labelledby="practice-setup-title">
        <div>
          <p className="practice-eyebrow">Bắt đầu phiên mới</p>
          <h2 id="practice-setup-title">Chọn phạm vi ôn tập</h2>
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
        <div className="practice-setup-footer">
          <span>{availableCount} câu đã xuất bản trong phạm vi này</span>
          <button
            className="button button--primary"
            type="button"
            disabled={configState.loading || availableCount === 0}
            onClick={startSession}
          >
            Bắt đầu luyện tập <ArrowRight aria-hidden="true" size={17} />
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
              <strong>{item.subjectName}</strong>
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
  const [answerError, setAnswerError] = useState('')
  const [feedback, setFeedback] = useState(null)
  const [activePosition, setActivePosition] = useState(
    () => session.questions.find((item) => !item.isAnswered)?.position ?? 1,
  )
  const current =
    session.questions.find((item) => item.position === activePosition) ??
    session.questions.find((item) => !item.isAnswered)
  const completed = session.status === 'completed'
  const finish = async () => {
    try {
      const result = await practiceSessionRepository.complete(session.id)
      onSessionChange(result)
    } catch (error) {
      setAnswerError(error.message)
    }
  }
  const answer = async (optionId) => {
    if (!current || current.isAnswered || answering) return
    setAnswering(true)
    setAnswerError('')
    try {
      const result = await practiceSessionRepository.answer(session.id, {
        questionId: current.question.id,
        optionId,
      })
      setFeedback(result)
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
          eyebrow="Kết quả luyện tập"
          title={`${session.correctCount}/${session.questionCount} câu đúng`}
          description="Bạn có thể xem lại từng câu hoặc bắt đầu một phiên mới."
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
            <button className="button button--primary" type="button" onClick={onReset}>
              <RotateCcw aria-hidden="true" size={17} />
              Luyện lại
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
        eyebrow="Luyện tập"
        title={question.subject?.name ?? 'Học phần'}
        description={`Câu ${current.position}/${session.questionCount} · ${session.correctCount} câu đúng`}
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
                disabled={answering || Boolean(answeredCurrent)}
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
        {displayFeedback && (
          <div
            className={`practice-feedback ${displayFeedback.isCorrect ? 'is-correct' : 'is-wrong'}`}
          >
            <strong>{feedback.isCorrect ? 'Chính xác' : 'Chưa chính xác'}</strong>
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
            Xem kết quả <ArrowRight aria-hidden="true" size={17} />
          </button>
        ) : (
          displayFeedback && (
            <button
              className="button button--primary practice-next-button"
              type="button"
              onClick={() => {
                setFeedback(null)
                setActivePosition(
                  session.questions.find(
                    (item) => !item.isAnswered && item.position > current.position,
                  )?.position ?? null,
                )
              }}
            >
              Câu tiếp theo <ArrowRight aria-hidden="true" size={17} />
            </button>
          )
        )}
      </section>
      <div className="practice-mini-nav" aria-label="Danh sách câu hỏi trong phiên">
        {session.questions.map((item) => (
          <span
            className={
              item.isAnswered
                ? item.isCorrect
                  ? 'is-correct'
                  : 'is-wrong'
                : item.id === current.id
                  ? 'is-current'
                  : ''
            }
            key={item.id}
          >
            {item.position}
          </span>
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
