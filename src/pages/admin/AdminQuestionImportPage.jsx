import { AlertCircle, ArrowLeft, CheckCircle2, Download, Upload } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ErrorState, LoadingState } from '../../components/common/AsyncState'
import PageHeader from '../../components/common/PageHeader'
import useAsyncData from '../../hooks/useAsyncData'
import { adminRepository } from '../../services/appRepositories'
import {
  createPracticeQuestionCsvTemplate,
  parsePracticeQuestionCsv,
  PRACTICE_CSV_HEADERS,
} from '../../utils/practiceQuestionCsv'
import '../lecturer/PracticeQuestionImportPage.css'

const MAX_FILE_SIZE = 1_000_000

export default function AdminQuestionImportPage() {
  const loader = useCallback(() => adminRepository.listSubjects({ status: 'active' }), [])
  const { data: loadedSubjects, loading, error, reload } = useAsyncData(loader)
  const subjects = loadedSubjects ?? []
  const [scope, setScope] = useState({ subjectId: '', chapterId: '', lessonId: '' })
  const [chapters, setChapters] = useState([])
  const [lessons, setLessons] = useState([])
  const [rows, setRows] = useState([])
  const [fileName, setFileName] = useState('')
  const [feedback, setFeedback] = useState('')
  const [result, setResult] = useState(null)
  const [importing, setImporting] = useState(false)
  const validRows = useMemo(() => rows.filter((row) => row.valid), [rows])
  const invalidRows = useMemo(() => rows.filter((row) => !row.valid), [rows])

  async function selectSubject(subjectId) {
    setScope({ subjectId, chapterId: '', lessonId: '' })
    setLessons([])
    setFeedback('')
    try {
      setChapters(subjectId ? await adminRepository.listChapters(subjectId) : [])
    } catch (cause) {
      setChapters([])
      setFeedback(cause.message)
    }
  }

  async function selectChapter(chapterId) {
    setScope((current) => ({ ...current, chapterId, lessonId: '' }))
    setFeedback('')
    try {
      setLessons(chapterId ? await adminRepository.listLessons(chapterId) : [])
    } catch (cause) {
      setLessons([])
      setFeedback(cause.message)
    }
  }

  function downloadTemplate() {
    const url = URL.createObjectURL(
      new Blob([createPracticeQuestionCsvTemplate()], { type: 'text/csv;charset=utf-8' }),
    )
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'mau-cau-hoi-dung-chung-ptit.csv'
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  async function handleFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setRows([])
    setResult(null)
    setFeedback('')
    setFileName(file.name)
    if (!file.name.toLocaleLowerCase().endsWith('.csv')) {
      setFeedback('Chỉ chấp nhận file .csv.')
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setFeedback('File CSV không được lớn hơn 1 MB.')
      return
    }
    try {
      setRows(parsePracticeQuestionCsv(await file.text()))
    } catch (cause) {
      setFeedback(cause.message ?? 'Không thể đọc file CSV.')
    }
  }

  async function importQuestions() {
    setFeedback('')
    setResult(null)
    if (!scope.subjectId || !scope.chapterId) {
      setFeedback('Vui lòng chọn môn học và chương.')
      return
    }
    if (!rows.length || invalidRows.length) {
      setFeedback('Hãy chọn file CSV hợp lệ và sửa toàn bộ dòng lỗi trước khi nhập.')
      return
    }
    setImporting(true)
    try {
      const imported = await adminRepository.importSharedQuestions({
        ...scope,
        lessonId: scope.lessonId || undefined,
        questions: validRows.map((row) => row.question),
      })
      setResult(imported)
      setRows([])
      setFileName('')
    } catch (cause) {
      setFeedback(cause.message ?? 'Không thể nhập câu hỏi từ CSV.')
    } finally {
      setImporting(false)
    }
  }

  if (loading) return <LoadingState label="Đang tải danh mục môn học…" />
  if (error) return <ErrorState message={error.message} onRetry={reload} />

  return (
    <div className="page-stack practice-import-page">
      <PageHeader
        eyebrow="Quản trị · Ngân hàng dùng chung"
        title="Nhập câu hỏi từ CSV"
        description="Mọi câu hỏi hợp lệ được lưu dưới dạng nháp và dùng chung cho toàn môn sau khi xuất bản."
        actions={
          <Link className="button button--ghost" to="/admin/question-bank">
            <ArrowLeft aria-hidden="true" size={17} /> Quay lại
          </Link>
        }
      />

      <section className="practice-import-panel">
        <div className="practice-import-panel__heading">
          <div>
            <h2>File CSV mẫu</h2>
            <p>Giữ nguyên tên cột, mỗi dòng là một câu trắc nghiệm.</p>
          </div>
          <button className="button button--secondary" type="button" onClick={downloadTemplate}>
            <Download aria-hidden="true" size={17} /> Tải file mẫu
          </button>
        </div>
        <div className="practice-import-columns">
          {PRACTICE_CSV_HEADERS.map((header) => (
            <code key={header}>{header}</code>
          ))}
        </div>
      </section>

      <section className="practice-import-panel">
        <div className="practice-import-scope">
          <label>
            <span>Môn học</span>
            <select value={scope.subjectId} onChange={(event) => selectSubject(event.target.value)}>
              <option value="">Chọn môn học</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Chương</span>
            <select
              value={scope.chapterId}
              disabled={!scope.subjectId}
              onChange={(event) => selectChapter(event.target.value)}
            >
              <option value="">Chọn chương</option>
              {chapters.map((chapter) => (
                <option key={chapter.id} value={chapter.id}>
                  {chapter.chapter_order}. {chapter.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Bài học (tùy chọn)</span>
            <select
              value={scope.lessonId}
              disabled={!scope.chapterId}
              onChange={(event) =>
                setScope((current) => ({ ...current, lessonId: event.target.value }))
              }
            >
              <option value="">Không gắn bài cụ thể</option>
              {lessons.map((lesson) => (
                <option key={lesson.id} value={lesson.id}>
                  {lesson.lesson_order}. {lesson.title}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="practice-import-dropzone" htmlFor="admin-practice-csv">
          <Upload aria-hidden="true" size={24} />
          <strong>{fileName || 'Chọn file CSV từ máy tính'}</strong>
          <span>Tối đa 200 câu, dung lượng 1 MB</span>
          <input id="admin-practice-csv" type="file" accept=".csv,text/csv" onChange={handleFile} />
        </label>

        {feedback && (
          <p className="practice-import-feedback practice-import-feedback--error" role="alert">
            <AlertCircle aria-hidden="true" size={18} />
            {feedback}
          </p>
        )}
        {result && (
          <p className="practice-import-feedback practice-import-feedback--success" role="status">
            <CheckCircle2 aria-hidden="true" size={18} />
            Đã nhập {result.importedCount} câu hỏi vào bản nháp.
          </p>
        )}

        {rows.length > 0 && (
          <div className="practice-import-preview">
            <div className="practice-import-preview__summary">
              <div>
                <span>Tổng số dòng</span>
                <strong>{rows.length}</strong>
              </div>
              <div className="is-valid">
                <span>Hợp lệ</span>
                <strong>{validRows.length}</strong>
              </div>
              <div className={invalidRows.length ? 'has-errors' : ''}>
                <span>Cần sửa</span>
                <strong>{invalidRows.length}</strong>
              </div>
            </div>
            <div className="practice-import-table-wrap">
              <table className="practice-import-table">
                <thead>
                  <tr>
                    <th>Dòng</th>
                    <th>Nội dung</th>
                    <th>Đáp án</th>
                    <th>Kiểm tra</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr className={row.valid ? '' : 'has-errors'} key={row.rowNumber}>
                      <td>{row.rowNumber}</td>
                      <td>{row.question.content || '—'}</td>
                      <td>{row.question.correctOptionKey || '—'}</td>
                      <td>{row.valid ? 'Hợp lệ' : row.errors.join(' ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="practice-import-actions">
              <span>
                {invalidRows.length
                  ? 'Sửa các dòng lỗi rồi tải file lên lại.'
                  : `${validRows.length} câu sẵn sàng để nhập.`}
              </span>
              <button
                className="button button--primary"
                type="button"
                disabled={importing || invalidRows.length > 0 || !scope.chapterId}
                onClick={importQuestions}
              >
                <Upload aria-hidden="true" size={17} />{' '}
                {importing ? 'Đang nhập…' : `Nhập ${validRows.length} câu vào bản nháp`}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
