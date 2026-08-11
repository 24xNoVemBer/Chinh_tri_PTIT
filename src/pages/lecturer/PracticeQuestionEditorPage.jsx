import { ArrowLeft, Check, Save } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ErrorState, LoadingState } from '../../components/common/AsyncState'
import PageHeader from '../../components/common/PageHeader'
import { useAuth } from '../../features/auth/useAuth'
import useAsyncData from '../../hooks/useAsyncData'
import {
  classContentRepository,
  classRepository,
  practiceQuestionRepository,
} from '../../services/appRepositories'
import './PracticeQuestionEditorPage.css'

const emptyForm = {
  subjectId: '',
  chapterId: '',
  lessonId: '',
  content: '',
  explanation: '',
  difficulty: 'medium',
  correctOptionKey: 'A',
  options: [
    { key: 'A', content: '' },
    { key: 'B', content: '' },
    { key: 'C', content: '' },
    { key: 'D', content: '' },
  ],
}

function validateQuestionForm(form) {
  if (!form.subjectId) return 'Vui lòng chọn học phần.'
  if (!form.chapterId) return 'Vui lòng chọn chương.'
  if (form.content.trim().length < 10) {
    return 'Nội dung câu hỏi cần có ít nhất 10 ký tự.'
  }
  if (form.options.some((option) => !option.content.trim())) {
    return 'Vui lòng nhập đầy đủ bốn phương án A, B, C và D.'
  }
  const normalizedOptions = form.options.map((option) => option.content.trim().toLocaleLowerCase())
  if (new Set(normalizedOptions).size !== form.options.length) {
    return 'Các phương án không được trùng nhau.'
  }
  if (!form.correctOptionKey) return 'Vui lòng chọn một đáp án đúng.'
  if (form.explanation.trim().length < 10) {
    return 'Phần giải thích đáp án cần có ít nhất 10 ký tự.'
  }
  return ''
}

export default function PracticeQuestionEditorPage() {
  const { questionId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [form, setForm] = useState(emptyForm)
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)
  const loader = useCallback(async () => {
    const classes = await classRepository.listForLecturer(user.id)
    const lessonsByClass = await Promise.all(
      classes.map(async (courseClass) => ({
        courseClass,
        lessons: await classContentRepository.listAvailableLessons(courseClass.id),
      })),
    )
    const question = questionId ? await practiceQuestionRepository.getForLecturer(questionId) : null
    return { classes, lessonsByClass, question }
  }, [questionId, user.id])
  const { data, loading, error, reload } = useAsyncData(loader)

  const subjects = useMemo(() => {
    if (!data) return []
    const seen = new Set()
    return data.classes.filter((courseClass) => {
      if (seen.has(courseClass.subject.id)) return false
      seen.add(courseClass.subject.id)
      return true
    })
  }, [data])

  const lessons = useMemo(() => {
    if (!data || !form.subjectId) return []
    const seen = new Set()
    return data.lessonsByClass
      .filter((item) => item.courseClass.subject.id === form.subjectId)
      .flatMap((item) => item.lessons)
      .filter((lesson) => {
        if (seen.has(lesson.id)) return false
        seen.add(lesson.id)
        return true
      })
  }, [data, form.subjectId])

  const chapters = useMemo(() => {
    const seen = new Set()
    return lessons
      .map((lesson) => lesson.chapter)
      .filter((chapter) => {
        if (!chapter || seen.has(chapter.id)) return false
        seen.add(chapter.id)
        return true
      })
  }, [lessons])

  useEffect(() => {
    if (!data) return
    if (data.question) {
      // The form is hydrated after the async question payload arrives.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm({
        subjectId: data.question.subjectId,
        chapterId: data.question.chapterId,
        lessonId: data.question.lessonId ?? '',
        content: data.question.content,
        explanation: data.question.explanation ?? '',
        difficulty: data.question.difficulty,
        correctOptionKey:
          data.question.options.find((option) => option.id === data.question.correctOptionId)
            ?.key ?? 'A',
        options: data.question.options.map((option) => ({
          key: option.key,
          content: option.content,
        })),
      })
      return
    }
    if (!form.subjectId && subjects[0]) {
      setForm((current) => ({ ...current, subjectId: subjects[0].subject.id }))
    }
  }, [data, subjects, form.subjectId])

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const updateOption = (key, value) => {
    setForm((current) => ({
      ...current,
      options: current.options.map((option) =>
        option.key === key ? { ...option, content: value } : option,
      ),
    }))
  }

  const handleSubmit = async (event, shouldPublish) => {
    event.preventDefault()
    if (saving) return

    const validationError = validateQuestionForm(form)
    if (validationError) {
      setSaveError(validationError)
      return
    }

    setSaving(true)
    setSaveError('')
    try {
      const payload = { ...form, lessonId: form.lessonId || undefined }
      const saved = questionId
        ? await practiceQuestionRepository.update(questionId, payload)
        : await practiceQuestionRepository.create(payload)
      if (shouldPublish && saved.status !== 'published') {
        await practiceQuestionRepository.publish(saved.id)
      } else if (!shouldPublish && saved.status !== 'draft') {
        await practiceQuestionRepository.saveDraft(saved.id)
      }
      navigate('/lecturer/practice-questions')
    } catch (requestError) {
      setSaveError(requestError.message ?? 'Không thể lưu câu hỏi. Vui lòng thử lại.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingState label="Đang tải biểu mẫu câu hỏi…" />
  if (error) return <ErrorState message={error.message} onRetry={reload} />

  return (
    <div className="page-stack practice-editor-page">
      <PageHeader
        eyebrow="Ngân hàng câu hỏi"
        title={questionId ? 'Chỉnh sửa câu hỏi' : 'Tạo câu hỏi luyện tập'}
        description="Câu hỏi xuất bản sẽ được dùng chung cho sinh viên đã đăng ký học phần."
        actions={
          <Link className="button button--ghost" to="/lecturer/practice-questions">
            <ArrowLeft aria-hidden="true" size={17} />
            Quay lại ngân hàng
          </Link>
        }
      />
      <form
        className="practice-editor-form"
        noValidate
        onSubmit={(event) => handleSubmit(event, false)}
      >
        <section className="practice-editor-card">
          <div className="practice-editor-grid">
            <label>
              <span>Học phần</span>
              <select
                value={form.subjectId}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    subjectId: event.target.value,
                    chapterId: '',
                    lessonId: '',
                  }))
                }
                required
              >
                <option value="">Chọn học phần</option>
                {subjects.map((courseClass) => (
                  <option key={courseClass.subject.id} value={courseClass.subject.id}>
                    {courseClass.subject.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Chương</span>
              <select
                value={form.chapterId}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    chapterId: event.target.value,
                    lessonId: '',
                  }))
                }
                required
                disabled={!form.subjectId}
              >
                <option value="">Chọn chương</option>
                {chapters.map((chapter) => (
                  <option key={chapter.id} value={chapter.id}>
                    {chapter.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Bài học (tùy chọn)</span>
              <select
                value={form.lessonId}
                onChange={(event) => updateField('lessonId', event.target.value)}
                disabled={!form.chapterId}
              >
                <option value="">Không gắn bài học cụ thể</option>
                {lessons
                  .filter((lesson) => lesson.chapterId === form.chapterId)
                  .map((lesson) => (
                    <option key={lesson.id} value={lesson.id}>
                      {lesson.title}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              <span>Độ khó</span>
              <select
                value={form.difficulty}
                onChange={(event) => updateField('difficulty', event.target.value)}
              >
                <option value="easy">Dễ</option>
                <option value="medium">Trung bình</option>
                <option value="hard">Khó</option>
              </select>
            </label>
          </div>
          <label>
            <span>Nội dung câu hỏi</span>
            <textarea
              value={form.content}
              onChange={(event) => updateField('content', event.target.value)}
              rows={4}
              minLength={10}
              required
              placeholder="Nhập nội dung câu hỏi…"
            />
          </label>
          <fieldset className="practice-options-fieldset">
            <legend>Lựa chọn và đáp án đúng</legend>
            {form.options.map((option) => (
              <div
                className={`practice-option-row ${form.correctOptionKey === option.key ? 'is-correct' : ''}`}
                key={option.key}
              >
                <label className="practice-option-radio">
                  <input
                    type="radio"
                    name="correctOptionKey"
                    value={option.key}
                    checked={form.correctOptionKey === option.key}
                    onChange={() => updateField('correctOptionKey', option.key)}
                  />
                  <b>{option.key}</b>
                </label>
                <input
                  type="text"
                  value={option.content}
                  onChange={(event) => updateOption(option.key, event.target.value)}
                  required
                  placeholder={`Nội dung lựa chọn ${option.key}`}
                />
              </div>
            ))}
          </fieldset>
          <label>
            <span>Giải thích đáp án</span>
            <textarea
              value={form.explanation}
              onChange={(event) => updateField('explanation', event.target.value)}
              rows={5}
              minLength={10}
              required
              placeholder="Giải thích ngắn gọn vì sao đáp án được chọn là đúng…"
            />
          </label>
        </section>
        {saveError && (
          <p className="practice-form-error" role="alert">
            {saveError}
          </p>
        )}
        <div className="practice-editor-actions">
          <Link className="button button--secondary" to="/lecturer/practice-questions">
            Hủy
          </Link>
          <button className="button button--secondary" type="submit" disabled={saving}>
            <Save aria-hidden="true" size={17} />
            {saving ? 'Đang lưu…' : 'Lưu nháp'}
          </button>
          <button
            className="button button--primary"
            type="button"
            disabled={saving}
            onClick={(event) => handleSubmit(event, true)}
          >
            <Check aria-hidden="true" size={17} />
            {saving ? 'Đang lưu…' : 'Lưu và xuất bản'}
          </button>
        </div>
      </form>
    </div>
  )
}
