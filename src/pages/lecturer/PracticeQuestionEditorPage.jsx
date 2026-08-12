import { ArrowLeft, Check, Save } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
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
  classIds: [],
  content: '',
  explanation: '',
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
  if (!form.classIds.length) return 'Vui lòng chọn ít nhất một lớp tín chỉ áp dụng.'
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
  const [searchParams] = useSearchParams()
  const initialClassId = searchParams.get('classId') ?? ''
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

  const availableClasses = useMemo(
    () => data?.classes.filter((courseClass) => courseClass.subject.id === form.subjectId) ?? [],
    [data, form.subjectId],
  )

  useEffect(() => {
    if (!data) return
    if (data.question) {
      // The form is hydrated after the async question payload arrives.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm({
        subjectId: data.question.subjectId,
        chapterId: data.question.chapterId,
        lessonId: data.question.lessonId ?? '',
        classIds: data.question.classAssignments.map((assignment) => assignment.classId),
        content: data.question.content,
        explanation: data.question.explanation ?? '',
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
      const requestedClass = data.classes.find((courseClass) => courseClass.id === initialClassId)
      setForm((current) => ({
        ...current,
        subjectId: requestedClass?.subject.id ?? subjects[0].subject.id,
        classIds: requestedClass ? [requestedClass.id] : [],
      }))
    }
  }, [data, subjects, form.subjectId, initialClassId])

  const returnPath = initialClassId
    ? `/lecturer/classes/${initialClassId}/practice-questions`
    : '/lecturer/practice-questions'

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
      navigate(returnPath)
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
        description="Câu hỏi riêng của bạn chỉ hiển thị trong các lớp tín chỉ được chọn."
        actions={
          <Link className="button button--ghost" to={returnPath}>
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
                    classIds: [],
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
          </div>
          <fieldset className="practice-class-scope">
            <legend>Lớp tín chỉ áp dụng</legend>
            <p>Chọn một hoặc nhiều lớp bạn đang được phân công giảng dạy.</p>
            <div className="practice-class-scope__grid">
              {availableClasses.map((courseClass) => {
                const checked = form.classIds.includes(courseClass.id)
                return (
                  <label className={checked ? 'is-selected' : ''} key={courseClass.id}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        updateField(
                          'classIds',
                          checked
                            ? form.classIds.filter((classId) => classId !== courseClass.id)
                            : [...form.classIds, courseClass.id],
                        )
                      }
                    />
                    <span>
                      <strong>{courseClass.classCode ?? courseClass.name}</strong>
                      <small>{courseClass.name}</small>
                    </span>
                  </label>
                )
              })}
            </div>
          </fieldset>
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
          <Link className="button button--secondary" to={returnPath}>
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
