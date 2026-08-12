import { useCallback, useState } from 'react'
import { ErrorState, LoadingState } from '../../components/common/AsyncState'
import useAsyncData from '../../hooks/useAsyncData'
import { adminRepository } from '../../services/appRepositories'
import './AdminPage.css'

export default function AdminSubjectsPage() {
  const loader = useCallback(() => adminRepository.listSubjects(), [])
  const { data: subjects = [], loading, error, reload } = useAsyncData(loader)
  const [selectedId, setSelectedId] = useState('')
  const [selectedChapterId, setSelectedChapterId] = useState('')
  const [feedback, setFeedback] = useState('')

  const selectedSubject = subjects.find((subject) => subject.id === selectedId) ?? subjects[0]
  const selectedSubjectId = selectedSubject?.id ?? ''
  const curriculumLoader = useCallback(async () => {
    if (!selectedSubjectId) return { chapters: [], materials: [] }
    const [chapters, materials] = await Promise.all([
      adminRepository.listChapters(selectedSubjectId),
      adminRepository.listMaterials(selectedSubjectId),
    ])
    return { chapters, materials }
  }, [selectedSubjectId])
  const { data: curriculum = { chapters: [], materials: [] }, reload: reloadCurriculum } =
    useAsyncData(curriculumLoader)
  const lessonLoader = useCallback(
    () =>
      selectedChapterId ? adminRepository.listLessons(selectedChapterId) : Promise.resolve([]),
    [selectedChapterId],
  )
  const { data: lessons = [], reload: reloadLessons } = useAsyncData(lessonLoader)
  const { chapters, materials } = curriculum

  async function submit(action, success) {
    setFeedback('')
    try {
      await action()
      setFeedback(success)
      await reload()
      await reloadCurriculum()
    } catch (cause) {
      setFeedback(cause.message)
    }
  }

  if (loading) return <LoadingState label="Đang tải chương trình môn học…" />
  if (error) return <ErrorState onRetry={reload} />
  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <div>
          <p className="admin-page__eyebrow">Nội dung dùng chung</p>
          <h1>Môn học & giáo trình</h1>
          <p>Admin duy trì chương, bài học và học liệu; giảng viên sử dụng dưới dạng chỉ đọc.</p>
        </div>
      </header>
      {feedback && (
        <p className="admin-feedback" role="status">
          {feedback}
        </p>
      )}
      <div className="admin-grid">
        <section className="admin-panel">
          <div className="admin-panel__header">
            <div>
              <h2>Danh mục môn</h2>
              <p>Chọn một môn để quản lý nội dung.</p>
            </div>
          </div>
          <ul className="admin-list">
            {subjects.map((subject) => (
              <li className="admin-list__item" key={subject.id}>
                <button
                  className="button button--ghost"
                  type="button"
                  onClick={() => {
                    setSelectedId(subject.id)
                    setSelectedChapterId('')
                  }}
                >
                  <span>
                    <strong>{subject.name}</strong>
                    <small>
                      {subject.credits} tín chỉ · {subject.chapter_count} chương ·{' '}
                      {subject.class_count} lớp
                    </small>
                  </span>
                </button>
                <span
                  className={`admin-status ${subject.status === 'archived' ? 'admin-status--muted' : ''}`}
                >
                  {subject.status === 'active' ? 'Đang dùng' : 'Lưu trữ'}
                </span>
              </li>
            ))}
          </ul>
        </section>
        <form
          className="admin-panel admin-form"
          onSubmit={(event) => {
            event.preventDefault()
            const form = new FormData(event.currentTarget)
            submit(
              () =>
                adminRepository.createSubject({
                  name: form.get('name'),
                  credits: Number(form.get('credits')),
                }),
              'Đã tạo môn học.',
            )
            event.currentTarget.reset()
          }}
        >
          <h2>Thêm môn học</h2>
          <div className="admin-field">
            <label htmlFor="subject-name">Tên môn</label>
            <input id="subject-name" name="name" required />
          </div>
          <div className="admin-field">
            <label htmlFor="subject-credits">Số tín chỉ</label>
            <input id="subject-credits" name="credits" type="number" min="1" required />
          </div>
          <div className="admin-actions">
            <button className="button button--primary" type="submit">
              Tạo môn
            </button>
          </div>
        </form>
      </div>

      {selectedSubject && (
        <div className="admin-grid admin-grid--equal">
          <section className="admin-panel">
            <div className="admin-panel__header">
              <div>
                <h2>Chương · {selectedSubject.name}</h2>
                <p>{chapters.length} chương đã khai báo.</p>
              </div>
            </div>
            <ul className="admin-list">
              {chapters.map((chapter) => (
                <li className="admin-list__item" key={chapter.id}>
                  <div>
                    <strong>
                      {chapter.chapter_order}. {chapter.title}
                    </strong>
                    <small>{chapter.lesson_count} bài học</small>
                  </div>
                  <button
                    className="button button--ghost"
                    type="button"
                    onClick={() => setSelectedChapterId(chapter.id)}
                  >
                    Quản lý bài
                  </button>
                </li>
              ))}
            </ul>
            <form
              className="admin-form"
              onSubmit={(event) => {
                event.preventDefault()
                const form = new FormData(event.currentTarget)
                submit(
                  () =>
                    adminRepository.createChapter(selectedSubject.id, {
                      title: form.get('title'),
                      order: Number(form.get('order')),
                    }),
                  'Đã thêm chương.',
                )
                event.currentTarget.reset()
              }}
            >
              <div className="admin-form__row">
                <div className="admin-field">
                  <label htmlFor="chapter-order">Thứ tự</label>
                  <input id="chapter-order" name="order" type="number" min="1" required />
                </div>
                <div className="admin-field">
                  <label htmlFor="chapter-title">Tên chương</label>
                  <input id="chapter-title" name="title" required />
                </div>
              </div>
              <div className="admin-actions">
                <button className="button button--secondary" type="submit">
                  Thêm chương
                </button>
              </div>
            </form>
          </section>
          <section className="admin-panel">
            <div className="admin-panel__header">
              <div>
                <h2>Học liệu chính thống</h2>
                <p>{materials.length} tài liệu dùng chung.</p>
              </div>
            </div>
            <ul className="admin-list">
              {materials.map((material) => (
                <li className="admin-list__item" key={material.id}>
                  <div>
                    <strong>{material.title}</strong>
                    <small>
                      {material.author} · {material.type} · {material.version_count} phiên bản
                    </small>
                  </div>
                </li>
              ))}
            </ul>
            <form
              className="admin-form"
              onSubmit={(event) => {
                event.preventDefault()
                const form = new FormData(event.currentTarget)
                submit(
                  () =>
                    adminRepository.createMaterial(selectedSubject.id, {
                      title: form.get('title'),
                      author: form.get('author'),
                      type: form.get('type'),
                    }),
                  'Đã thêm học liệu.',
                )
                event.currentTarget.reset()
              }}
            >
              <div className="admin-field">
                <label htmlFor="material-title">Tên học liệu</label>
                <input id="material-title" name="title" required />
              </div>
              <div className="admin-form__row">
                <div className="admin-field">
                  <label htmlFor="material-author">Tác giả</label>
                  <input id="material-author" name="author" required />
                </div>
                <div className="admin-field">
                  <label htmlFor="material-type">Loại tệp</label>
                  <input id="material-type" name="type" placeholder="PDF" required />
                </div>
              </div>
              <div className="admin-actions">
                <button className="button button--secondary" type="submit">
                  Thêm học liệu
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      {selectedChapterId && (
        <section className="admin-panel">
          <div className="admin-panel__header">
            <div>
              <h2>Bài học trong chương</h2>
              <p>Nội dung chuẩn được chia sẻ cho mọi lớp của môn.</p>
            </div>
          </div>
          <ul className="admin-list">
            {lessons.map((lesson) => (
              <li className="admin-list__item" key={lesson.id}>
                <div>
                  <strong>
                    {lesson.lesson_order}. {lesson.title}
                  </strong>
                  <small>Nội dung dùng chung</small>
                </div>
              </li>
            ))}
          </ul>
          <form
            className="admin-form"
            onSubmit={async (event) => {
              event.preventDefault()
              const form = new FormData(event.currentTarget)
              await submit(
                () =>
                  adminRepository.createLesson(selectedChapterId, {
                    title: form.get('title'),
                    order: Number(form.get('order')),
                    contentHtml: form.get('contentHtml'),
                  }),
                'Đã thêm bài học.',
              )
              await reloadLessons()
              event.currentTarget.reset()
            }}
          >
            <div className="admin-form__row">
              <div className="admin-field">
                <label htmlFor="lesson-order">Thứ tự bài</label>
                <input id="lesson-order" name="order" type="number" min="1" required />
              </div>
              <div className="admin-field">
                <label htmlFor="lesson-title">Tên bài học</label>
                <input id="lesson-title" name="title" required />
              </div>
            </div>
            <div className="admin-field">
              <label htmlFor="lesson-content">Nội dung HTML</label>
              <textarea id="lesson-content" name="contentHtml" required />
            </div>
            <div className="admin-actions">
              <button className="button button--secondary" type="submit">
                Thêm bài học
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  )
}
