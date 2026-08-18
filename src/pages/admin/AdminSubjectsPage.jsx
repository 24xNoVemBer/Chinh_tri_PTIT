import { useCallback, useState } from 'react'
import { ErrorState, LoadingState } from '../../components/common/AsyncState'
import useAsyncData from '../../hooks/useAsyncData'
import { adminRepository } from '../../services/appRepositories'
import './AdminPage.css'

export default function AdminSubjectsPage() {
  const loader = useCallback(() => adminRepository.listSubjects(), [])
  const { data: loadedSubjects, loading, error, reload } = useAsyncData(loader)
  const subjects = loadedSubjects ?? []
  const [selectedId, setSelectedId] = useState('')
  const [selectedChapterId, setSelectedChapterId] = useState('')
  const [feedback, setFeedback] = useState('')
  const [feedbackError, setFeedbackError] = useState(false)
  const [editing, setEditing] = useState('')
  const [busy, setBusy] = useState(false)

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
  const curriculumState = useAsyncData(curriculumLoader)
  const lessonLoader = useCallback(
    () =>
      selectedChapterId ? adminRepository.listLessons(selectedChapterId) : Promise.resolve([]),
    [selectedChapterId],
  )
  const lessonState = useAsyncData(lessonLoader)
  const { chapters = [], materials = [] } = curriculumState.data ?? {}
  const lessons = lessonState.data ?? []
  const reloadCurriculum = curriculumState.reload
  const reloadLessons = lessonState.reload

  async function submit(action, success) {
    if (busy) return false
    setBusy(true)
    setFeedback('')
    setFeedbackError(false)
    try {
      await action()
      setFeedback(success)
      await reload()
      await reloadCurriculum()
      setEditing('')
      return true
    } catch (cause) {
      setFeedback(cause.message ?? 'Không thể cập nhật nội dung môn học.')
      setFeedbackError(true)
      return false
    } finally {
      setBusy(false)
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
        <p
          className={`admin-feedback ${feedbackError ? 'admin-feedback--error' : ''}`}
          role={feedbackError ? 'alert' : 'status'}
        >
          {feedback}
        </p>
      )}
      {curriculumState.error && (
        <ErrorState message={curriculumState.error.message} onRetry={reloadCurriculum} />
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
                <div className="admin-inline-actions">
                  <button
                    className="button button--ghost"
                    type="button"
                    onClick={() => setEditing(`subject:${subject.id}`)}
                  >
                    Sửa
                  </button>
                  {subject.status === 'active' && (
                    <button
                      className="button button--ghost"
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        submit(
                          () => adminRepository.archiveSubject(subject.id),
                          'Đã lưu trữ môn học.',
                        )
                      }
                    >
                      Lưu trữ
                    </button>
                  )}
                </div>
                {editing === `subject:${subject.id}` && (
                  <form
                    className="admin-inline-editor"
                    onSubmit={(event) => {
                      event.preventDefault()
                      const form = new FormData(event.currentTarget)
                      submit(
                        () =>
                          adminRepository.updateSubject(subject.id, {
                            name: form.get('name'),
                            credits: Number(form.get('credits')),
                            status: subject.status,
                          }),
                        'Đã cập nhật môn học.',
                      )
                    }}
                  >
                    <input
                      name="name"
                      defaultValue={subject.name}
                      aria-label="Tên môn học"
                      required
                    />
                    <input
                      name="credits"
                      type="number"
                      min="1"
                      defaultValue={subject.credits}
                      aria-label="Số tín chỉ"
                      required
                    />
                    <button className="button button--secondary" type="submit" disabled={busy}>
                      Lưu
                    </button>
                    <button
                      className="button button--ghost"
                      type="button"
                      onClick={() => setEditing('')}
                    >
                      Hủy
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </section>
        <form
          className="admin-panel admin-form"
          onSubmit={async (event) => {
            event.preventDefault()
            const formElement = event.currentTarget
            const form = new FormData(formElement)
            const saved = await submit(
              () =>
                adminRepository.createSubject({
                  name: form.get('name'),
                  credits: Number(form.get('credits')),
                }),
              'Đã tạo môn học.',
            )
            if (saved) formElement.reset()
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
            <button className="button button--primary" type="submit" disabled={busy}>
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
                  <div className="admin-inline-actions">
                    <button
                      className="button button--ghost"
                      type="button"
                      onClick={() => setEditing(`chapter:${chapter.id}`)}
                    >
                      Sửa
                    </button>
                    <button
                      className="button button--ghost"
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        submit(() => adminRepository.deleteChapter(chapter.id), 'Đã xóa chương.')
                      }
                    >
                      Xóa
                    </button>
                  </div>
                  {editing === `chapter:${chapter.id}` && (
                    <form
                      className="admin-inline-editor"
                      onSubmit={(event) => {
                        event.preventDefault()
                        const form = new FormData(event.currentTarget)
                        submit(
                          () =>
                            adminRepository.updateChapter(chapter.id, {
                              title: form.get('title'),
                              order: Number(form.get('order')),
                            }),
                          'Đã cập nhật chương.',
                        )
                      }}
                    >
                      <input
                        name="order"
                        type="number"
                        min="1"
                        defaultValue={chapter.chapter_order}
                        aria-label="Thứ tự chương"
                        required
                      />
                      <input
                        name="title"
                        defaultValue={chapter.title}
                        aria-label="Tên chương"
                        required
                      />
                      <button className="button button--secondary" type="submit" disabled={busy}>
                        Lưu
                      </button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
            <form
              className="admin-form"
              onSubmit={async (event) => {
                event.preventDefault()
                const formElement = event.currentTarget
                const form = new FormData(formElement)
                const saved = await submit(
                  () =>
                    adminRepository.createChapter(selectedSubject.id, {
                      title: form.get('title'),
                      order: Number(form.get('order')),
                    }),
                  'Đã thêm chương.',
                )
                if (saved) formElement.reset()
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
                <button className="button button--secondary" type="submit" disabled={busy}>
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
                  <div className="admin-inline-actions">
                    <button
                      className="button button--ghost"
                      type="button"
                      onClick={() => setEditing(`material:${material.id}`)}
                    >
                      Sửa
                    </button>
                    <button
                      className="button button--ghost"
                      type="button"
                      onClick={() => setEditing(`version:${material.id}`)}
                    >
                      Thêm phiên bản
                    </button>
                    <button
                      className="button button--ghost"
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        submit(
                          () => adminRepository.deleteMaterial(material.id),
                          'Đã xóa học liệu.',
                        )
                      }
                    >
                      Xóa
                    </button>
                  </div>
                  {editing === `material:${material.id}` && (
                    <form
                      className="admin-inline-editor"
                      onSubmit={(event) => {
                        event.preventDefault()
                        const form = new FormData(event.currentTarget)
                        submit(
                          () =>
                            adminRepository.updateMaterial(material.id, {
                              title: form.get('title'),
                              author: form.get('author'),
                              type: form.get('type'),
                            }),
                          'Đã cập nhật học liệu.',
                        )
                      }}
                    >
                      <input
                        name="title"
                        defaultValue={material.title}
                        aria-label="Tên học liệu"
                        required
                      />
                      <input
                        name="author"
                        defaultValue={material.author}
                        aria-label="Tác giả"
                        required
                      />
                      <input
                        name="type"
                        defaultValue={material.type}
                        aria-label="Loại tệp"
                        required
                      />
                      <button className="button button--secondary" type="submit" disabled={busy}>
                        Lưu
                      </button>
                    </form>
                  )}
                  {editing === `version:${material.id}` && (
                    <form
                      className="admin-inline-editor"
                      onSubmit={(event) => {
                        event.preventDefault()
                        const form = new FormData(event.currentTarget)
                        submit(
                          () =>
                            adminRepository.createMaterialVersion(material.id, {
                              year: Number(form.get('year')),
                              fileUrl: form.get('fileUrl'),
                            }),
                          'Đã thêm phiên bản học liệu.',
                        )
                      }}
                    >
                      <input
                        name="year"
                        type="number"
                        min="1900"
                        defaultValue={new Date().getFullYear()}
                        aria-label="Năm phát hành"
                        required
                      />
                      <input
                        name="fileUrl"
                        type="url"
                        placeholder="https://..."
                        aria-label="Đường dẫn tệp"
                        required
                      />
                      <button className="button button--secondary" type="submit" disabled={busy}>
                        Thêm
                      </button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
            <form
              className="admin-form"
              onSubmit={async (event) => {
                event.preventDefault()
                const formElement = event.currentTarget
                const form = new FormData(formElement)
                const saved = await submit(
                  () =>
                    adminRepository.createMaterial(selectedSubject.id, {
                      title: form.get('title'),
                      author: form.get('author'),
                      type: form.get('type'),
                    }),
                  'Đã thêm học liệu.',
                )
                if (saved) formElement.reset()
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
                <button className="button button--secondary" type="submit" disabled={busy}>
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
                <div className="admin-inline-actions">
                  <button
                    className="button button--ghost"
                    type="button"
                    onClick={() => setEditing(`lesson:${lesson.id}`)}
                  >
                    Sửa
                  </button>
                  <button
                    className="button button--ghost"
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      const removed = await submit(
                        () => adminRepository.deleteLesson(lesson.id),
                        'Đã xóa bài học.',
                      )
                      if (removed) await reloadLessons()
                    }}
                  >
                    Xóa
                  </button>
                </div>
                {editing === `lesson:${lesson.id}` && (
                  <form
                    className="admin-inline-editor"
                    onSubmit={async (event) => {
                      event.preventDefault()
                      const form = new FormData(event.currentTarget)
                      const saved = await submit(
                        () =>
                          adminRepository.updateLesson(lesson.id, {
                            title: form.get('title'),
                            order: Number(form.get('order')),
                            contentHtml: form.get('contentHtml'),
                          }),
                        'Đã cập nhật bài học.',
                      )
                      if (saved) await reloadLessons()
                    }}
                  >
                    <input
                      name="order"
                      type="number"
                      min="1"
                      defaultValue={lesson.lesson_order}
                      aria-label="Thứ tự bài"
                      required
                    />
                    <input name="title" defaultValue={lesson.title} aria-label="Tên bài" required />
                    <textarea
                      name="contentHtml"
                      defaultValue={lesson.content_html}
                      aria-label="Nội dung HTML"
                      required
                    />
                    <button className="button button--secondary" type="submit" disabled={busy}>
                      Lưu
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
          <form
            className="admin-form"
            onSubmit={async (event) => {
              event.preventDefault()
              const formElement = event.currentTarget
              const form = new FormData(formElement)
              const saved = await submit(
                () =>
                  adminRepository.createLesson(selectedChapterId, {
                    title: form.get('title'),
                    order: Number(form.get('order')),
                    contentHtml: form.get('contentHtml'),
                  }),
                'Đã thêm bài học.',
              )
              if (saved) {
                await reloadLessons()
                formElement.reset()
              }
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
              <button className="button button--secondary" type="submit" disabled={busy}>
                Thêm bài học
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  )
}
