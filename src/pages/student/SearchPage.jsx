import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, Clock3, FileText, MessageCircle, Search } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../../components/common/AsyncState'
import PageHeader from '../../components/common/PageHeader'
import { useAuth } from '../../features/auth/useAuth'
import useAsyncData from '../../hooks/useAsyncData'
import { searchRepository } from '../../services/appRepositories'
import { subjectRepository } from '../../services/appRepositories'

const RESULT_CONFIG = {
  lesson: { icon: BookOpen, label: 'Bài học' },
  material: { icon: FileText, label: 'Học liệu' },
  answer: { icon: MessageCircle, label: 'Giảng viên trả lời' },
}

export default function SearchPage() {
  const { user: currentStudent } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '')
  const [subjectId, setSubjectId] = useState(() => searchParams.get('subject') ?? '')
  const [lessonId, setLessonId] = useState(() => searchParams.get('lesson') ?? '')
  const [results, setResults] = useState([])
  const [status, setStatus] = useState('idle')
  const [searchError, setSearchError] = useState('')
  const lastDeepLinkRef = useRef('')
  const searchRequestRef = useRef(0)

  const loader = useCallback(async () => {
    const subjects = await subjectRepository.listForStudent(currentStudent.id)
    const lessonsBySubject = await Promise.all(
      subjects.map(async (subject) => {
        const chapters = await subjectRepository.listChapters(subject.id)
        const lessons = await Promise.all(
          chapters.map(async (chapter) => {
            const chapterLessons = await subjectRepository.listLessons(chapter.id)
            return chapterLessons.map((lesson) => ({ ...lesson, chapter, subject }))
          }),
        )
        return lessons.flat()
      }),
    )
    return { subjects, lessons: lessonsBySubject.flat() }
  }, [currentStudent.id])
  const { data, loading, error, reload } = useAsyncData(loader)

  const availableLessons = useMemo(() => {
    if (!data) return []
    return subjectId
      ? data.lessons.filter((lesson) => lesson.subject.id === subjectId)
      : data.lessons
  }, [data, subjectId])

  const executeSearch = useCallback(
    async (recordHistory = true, criteria = {}) => {
      const effectiveQuery = String(criteria.query ?? query).trim()
      const effectiveSubjectId = criteria.subjectId ?? subjectId
      const effectiveLessonId = criteria.lessonId ?? lessonId
      const requestId = searchRequestRef.current + 1
      searchRequestRef.current = requestId

      if (!effectiveQuery) {
        setResults([])
        setSearchError('')
        setStatus('idle')
        if (recordHistory) {
          setSearchParams((current) => {
            const next = new URLSearchParams(current)
            next.delete('q')
            lastDeepLinkRef.current = next.toString()
            return next
          })
        }
        return
      }

      setStatus('loading')
      setSearchError('')
      try {
        const nextResults = await searchRepository.search({
          query: effectiveQuery,
          studentId: currentStudent.id,
          subjectId: effectiveSubjectId || undefined,
          lessonId: effectiveLessonId || undefined,
          recordHistory,
        })
        if (searchRequestRef.current !== requestId) return

        setResults(nextResults)
        if (recordHistory) {
          setSearchParams((current) => {
            const next = new URLSearchParams(current)
            next.set('q', effectiveQuery)
            effectiveSubjectId ? next.set('subject', effectiveSubjectId) : next.delete('subject')
            effectiveLessonId ? next.set('lesson', effectiveLessonId) : next.delete('lesson')
            lastDeepLinkRef.current = next.toString()
            return next
          })
        }
        setStatus('done')
      } catch (nextError) {
        if (searchRequestRef.current !== requestId) return
        setSearchError(nextError.message)
        setStatus('error')
      }
    },
    [lessonId, query, setSearchParams, subjectId, currentStudent.id],
  )
  // Keep the form and result set synchronized with every deep-link change. This also
  // handles a second navbar search while SearchPage is already mounted.
  useEffect(() => {
    if (loading || error) return
    const deepLinkKey = searchParams.toString()
    if (lastDeepLinkRef.current === deepLinkKey) return
    lastDeepLinkRef.current = deepLinkKey

    const nextQuery = searchParams.get('q') ?? ''
    const nextSubjectId = searchParams.get('subject') ?? ''
    const nextLessonId = searchParams.get('lesson') ?? ''

    /* eslint-disable react-hooks/set-state-in-effect */
    setQuery(nextQuery)
    setSubjectId(nextSubjectId)
    setLessonId(nextLessonId)
    if (!nextQuery.trim()) {
      setResults([])
      setStatus('idle')
      return
    }
    /* eslint-enable react-hooks/set-state-in-effect */

    void executeSearch(false, {
      query: nextQuery,
      subjectId: nextSubjectId,
      lessonId: nextLessonId,
    })
  }, [loading, error, searchParams, executeSearch])

  if (loading) return <LoadingState label="Đang chuẩn bị bộ lọc tra cứu…" />
  if (error) return <ErrorState message={error.message} onRetry={reload} />

  const handleSubmit = (event) => {
    event.preventDefault()
    void executeSearch(true)
  }

  const handleQueryChange = (event) => {
    const nextQuery = event.target.value
    setQuery(nextQuery)
    if (nextQuery.trim()) return

    searchRequestRef.current += 1
    setResults([])
    setSearchError('')
    setStatus('idle')
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      next.delete('q')
      lastDeepLinkRef.current = next.toString()
      return next
    })
  }

  const handleSubjectChange = (event) => {
    const nextSubjectId = event.target.value
    setSubjectId(nextSubjectId)
    const selectedLesson = data.lessons.find((lesson) => lesson.id === lessonId)
    if (selectedLesson && selectedLesson.subject.id !== nextSubjectId) setLessonId('')
  }

  const questionPath = subjectId
    ? `/student/subjects/${subjectId}/qna${lessonId ? `?lesson=${lessonId}` : ''}`
    : '/student/subjects'

  return (
    <div className="page-stack page-stack--search">
      <PageHeader
        eyebrow="Kho kiến thức"
        title="Tra cứu nội dung môn học"
        description="Tìm trong bài học, học liệu đã duyệt và câu trả lời của giảng viên. Bộ lọc hoạt động độc lập với RAG."
        actions={
          <Link className="button button--secondary" to="/student/questions?view=searches">
            <Clock3 aria-hidden="true" size={18} />
            Lịch sử tra cứu
          </Link>
        }
      />

      <form
        className="knowledge-search-form"
        onSubmit={handleSubmit}
        role="search"
        aria-label="Tra cứu học liệu"
      >
        <div className="field-group knowledge-search-form__query">
          <label htmlFor="knowledge-query">Từ khóa tra cứu</label>
          <div className="filter-field__control">
            <Search aria-hidden="true" size={19} />
            <input
              id="knowledge-query"
              type="search"
              value={query}
              onChange={handleQueryChange}
              placeholder="Ví dụ: chủ nghĩa duy vật biện chứng"
            />
          </div>
        </div>
        <div className="field-group">
          <label htmlFor="knowledge-subject">Môn học</label>
          <select id="knowledge-subject" value={subjectId} onChange={handleSubjectChange}>
            <option value="">Tất cả môn đang học</option>
            {data.subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field-group">
          <label htmlFor="knowledge-lesson">Bài học</label>
          <select
            id="knowledge-lesson"
            value={lessonId}
            onChange={(event) => setLessonId(event.target.value)}
          >
            <option value="">Tất cả bài học</option>
            {availableLessons.map((lesson) => (
              <option key={lesson.id} value={lesson.id}>
                {subjectId ? lesson.title : `${lesson.subject.name} · ${lesson.title}`}
              </option>
            ))}
          </select>
        </div>
        <button
          className="button button--primary knowledge-search-form__submit"
          type="submit"
          disabled={!query.trim() || status === 'loading'}
        >
          <Search aria-hidden="true" size={18} />
          {status === 'loading' ? 'Đang tìm…' : 'Tra cứu'}
        </button>
        <p className="field-hint knowledge-search-form__hint">
          Kết quả chỉ dùng bài học, học liệu đã duyệt và câu trả lời thuộc các môn bạn đang học.
        </p>
      </form>

      {status === 'idle' && (
        <div className="search-suggestions">
          <p>Gợi ý tra cứu</p>
          {['triết học', 'mối liên hệ', 'ý thức', 'hàng hóa sức lao động'].map((suggestion) => (
            <button key={suggestion} type="button" onClick={() => setQuery(suggestion)}>
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {searchError && (
        <div className="state-panel state-panel--error" role="alert">
          <h2>Không thể tra cứu</h2>
          <p>{searchError}</p>
        </div>
      )}

      {/* Results replace themselves in place, so a screen reader gets no signal that the
          page changed unless the outcome is announced explicitly. */}
      <p className="sr-only" role="status" aria-live="polite">
        {status === 'loading'
          ? 'Đang tra cứu…'
          : status === 'done'
            ? results.length === 0
              ? 'Không tìm thấy kết quả nào.'
              : `Tìm thấy ${results.length} kết quả.`
            : ''}
      </p>

      {status === 'done' && results.length === 0 && (
        <EmptyState
          title="Chưa tìm thấy kết quả"
          description="Hãy thử từ khóa ngắn hơn, đổi phạm vi hoặc đặt câu hỏi cho giảng viên."
          action={
            <Link className="button button--primary" to={questionPath}>
              Đặt câu hỏi
            </Link>
          }
        />
      )}

      {results.length > 0 && (
        <section className="section-stack" aria-labelledby="search-results-title">
          <div className="section-heading">
            <div>
              <p className="section-heading__eyebrow">Kết quả đã phân loại</p>
              <h2 id="search-results-title">{results.length} kết quả</h2>
            </div>
            <Link className="text-link" to={questionPath}>
              Chưa rõ? Đặt câu hỏi
            </Link>
          </div>
          <div className="result-list">
            {results.map((result) => {
              const config = RESULT_CONFIG[result.sourceType] ?? RESULT_CONFIG.material
              const Icon = config.icon
              const destination = result.lessonId ? `/student/lessons/${result.lessonId}` : null
              return (
                <article className="result-item result-item--sourced" key={result.id}>
                  <span className="result-item__icon">
                    <Icon aria-hidden="true" size={20} />
                  </span>
                  <div className="result-item__copy">
                    <div className="result-item__classification">
                      <span>{config.label}</span>
                      {result.subject && <span>{result.subject.name}</span>}
                    </div>
                    <h3>
                      {destination ? <Link to={destination}>{result.title}</Link> : result.title}
                    </h3>
                    <p>{result.excerpt}</p>
                    <div className="source-reference source-reference--inline">
                      <strong>Nguồn</strong>
                      <span>{result.sourceLabel}</span>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
