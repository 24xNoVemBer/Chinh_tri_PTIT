import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Upload,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ErrorState, LoadingState } from '../../components/common/AsyncState'
import PageHeader from '../../components/common/PageHeader'
import { useAuth } from '../../features/auth/useAuth'
import useAsyncData from '../../hooks/useAsyncData'
import {
  classContentRepository,
  classRepository,
  practiceQuestionRepository,
} from '../../services/appRepositories'
import {
  createPracticeQuestionCsvTemplate,
  parsePracticeQuestionCsv,
  PRACTICE_CSV_HEADERS,
} from '../../utils/practiceQuestionCsv'
import './PracticeQuestionImportPage.css'

const MAX_FILE_SIZE = 1_000_000

export default function PracticeQuestionImportPage() {
  const [searchParams] = useSearchParams()
  const initialClassId = searchParams.get('classId') ?? ''
  const { user } = useAuth()
  const [scope, setScope] = useState({ subjectId: '', chapterId: '', lessonId: '', classIds: [] })
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState([])
  const [fileError, setFileError] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)
  const loader = useCallback(async () => {
    const classes = await classRepository.listForLecturer(user.id)
    const lessonsByClass = await Promise.all(
      classes.map(async (courseClass) => ({
        courseClass,
        lessons: await classContentRepository.listAvailableLessons(courseClass.id),
      })),
    )
    return { classes, lessonsByClass }
  }, [user.id])
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
    if (!data || !scope.subjectId) return []
    const seen = new Set()
    return data.lessonsByClass
      .filter((item) => item.courseClass.subject.id === scope.subjectId)
      .flatMap((item) => item.lessons)
      .filter((lesson) => {
        if (seen.has(lesson.id)) return false
        seen.add(lesson.id)
        return true
      })
  }, [data, scope.subjectId])

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
    () => data?.classes.filter((courseClass) => courseClass.subject.id === scope.subjectId) ?? [],
    [data, scope.subjectId],
  )

  const validRows = rows.filter((row) => row.valid)
  const invalidRows = rows.filter((row) => !row.valid)

  useEffect(() => {
    if (!scope.subjectId && subjects[0]) {
      // Initialize the scope once lecturer subjects have loaded.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setScope((current) => {
        const requestedClass = data.classes.find((courseClass) => courseClass.id === initialClassId)
        return {
          ...current,
          subjectId: requestedClass?.subject.id ?? subjects[0].subject.id,
          classIds: requestedClass ? [requestedClass.id] : [],
        }
      })
    }
  }, [data, initialClassId, scope.subjectId, subjects])

  const returnPath = initialClassId
    ? `/lecturer/classes/${initialClassId}/practice-questions`
    : '/lecturer/practice-questions'

  const downloadTemplate = () => {
    const blob = new Blob([createPracticeQuestionCsvTemplate()], {
      type: 'text/csv;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'mau-cau-hoi-trac-nghiem-ptit.csv'
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  const handleFile = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setRows([])
    setResult(null)
    setFileError('')
    setFileName(file.name)
    if (!file.name.toLocaleLowerCase().endsWith('.csv')) {
      setFileError('Chỉ chấp nhận file có định dạng .csv.')
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setFileError('File CSV không được lớn hơn 1 MB.')
      return
    }

    try {
      setRows(parsePracticeQuestionCsv(await file.text()))
    } catch (parseError) {
      setFileError(parseError.message ?? 'Không thể đọc file CSV.')
    }
  }

  const importQuestions = async () => {
    setFileError('')
    setResult(null)
    if (!scope.subjectId || !scope.chapterId || !scope.classIds.length) {
      setFileError('Vui lòng chọn học phần, chương và ít nhất một lớp tín chỉ trước khi nhập.')
      return
    }
    if (!rows.length) {
      setFileError('Vui lòng chọn file CSV và kiểm tra dữ liệu trước khi nhập.')
      return
    }
    if (invalidRows.length) {
      setFileError('File vẫn còn dòng lỗi. Hãy sửa CSV rồi tải lên lại.')
      return
    }

    setImporting(true)
    try {
      const imported = await practiceQuestionRepository.importDrafts({
        ...scope,
        lessonId: scope.lessonId || undefined,
        questions: validRows.map((row) => row.question),
      })
      setResult(imported)
      setRows([])
      setFileName('')
    } catch (requestError) {
      setFileError(requestError.message ?? 'Không thể nhập câu hỏi từ CSV.')
    } finally {
      setImporting(false)
    }
  }

  if (loading) return <LoadingState label="Đang tải dữ liệu học phần…" />
  if (error) return <ErrorState message={error.message} onRetry={reload} />

  return (
    <div className="page-stack practice-import-page">
      <PageHeader
        eyebrow="Ngân hàng câu hỏi"
        title="Nhập câu hỏi từ CSV"
        description="Tải file mẫu, điền câu hỏi theo đúng cột và kiểm tra dữ liệu trước khi lưu vào bản nháp."
        actions={
          <Link className="button button--ghost" to={returnPath}>
            <ArrowLeft aria-hidden="true" size={17} />
            Quay lại ngân hàng
          </Link>
        }
      />

      <section className="practice-import-steps" aria-label="Quy trình nhập câu hỏi CSV">
        <article>
          <span>01</span>
          <div>
            <strong>Tải file mẫu</strong>
            <p>Giữ nguyên tên và thứ tự các cột.</p>
          </div>
        </article>
        <article>
          <span>02</span>
          <div>
            <strong>Điền câu hỏi</strong>
            <p>Mỗi dòng tương ứng một câu trắc nghiệm.</p>
          </div>
        </article>
        <article>
          <span>03</span>
          <div>
            <strong>Kiểm tra và nhập</strong>
            <p>Câu hợp lệ được lưu dưới dạng bản nháp.</p>
          </div>
        </article>
      </section>

      <section className="practice-import-panel" aria-labelledby="csv-template-title">
        <div className="practice-import-panel__heading">
          <div className="practice-import-panel__icon">
            <FileSpreadsheet aria-hidden="true" size={22} />
          </div>
          <div>
            <h2 id="csv-template-title">File CSV mẫu</h2>
            <p>File có sẵn một câu minh họa và mở đúng tiếng Việt trong Excel.</p>
          </div>
          <button className="button button--secondary" type="button" onClick={downloadTemplate}>
            <Download aria-hidden="true" size={17} />
            Tải file mẫu
          </button>
        </div>
        <div className="practice-import-columns" aria-label="Các cột trong file CSV">
          {PRACTICE_CSV_HEADERS.map((header) => (
            <code key={header}>{header}</code>
          ))}
        </div>
        <p className="practice-import-note">
          <strong>Quy ước:</strong> <code>dap_an_dung</code> dùng A/B/C/D. Tối đa 200 câu và 1 MB
          mỗi lần nhập.
        </p>
      </section>

      <section className="practice-import-panel" aria-labelledby="csv-scope-title">
        <div className="practice-import-panel__heading practice-import-panel__heading--compact">
          <div>
            <h2 id="csv-scope-title">Phạm vi áp dụng</h2>
            <p>Toàn bộ câu hỏi trong file sẽ được gắn vào phạm vi này.</p>
          </div>
        </div>
        <div className="practice-import-scope">
          <label>
            <span>Học phần</span>
            <select
              value={scope.subjectId}
              onChange={(event) =>
                setScope({
                  subjectId: event.target.value,
                  chapterId: '',
                  lessonId: '',
                  classIds: [],
                })
              }
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
              value={scope.chapterId}
              disabled={!scope.subjectId}
              onChange={(event) =>
                setScope((current) => ({
                  ...current,
                  chapterId: event.target.value,
                  lessonId: '',
                }))
              }
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
              value={scope.lessonId}
              disabled={!scope.chapterId}
              onChange={(event) =>
                setScope((current) => ({ ...current, lessonId: event.target.value }))
              }
            >
              <option value="">Không gắn bài học cụ thể</option>
              {lessons
                .filter((lesson) => lesson.chapterId === scope.chapterId)
                .map((lesson) => (
                  <option key={lesson.id} value={lesson.id}>
                    {lesson.title}
                  </option>
                ))}
            </select>
          </label>
        </div>
        <fieldset className="practice-import-class-scope">
          <legend>Lớp tín chỉ áp dụng</legend>
          <div>
            {availableClasses.map((courseClass) => {
              const checked = scope.classIds.includes(courseClass.id)
              return (
                <label className={checked ? 'is-selected' : ''} key={courseClass.id}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setScope((current) => ({
                        ...current,
                        classIds: checked
                          ? current.classIds.filter((classId) => classId !== courseClass.id)
                          : [...current.classIds, courseClass.id],
                      }))
                    }
                  />
                  <span>{courseClass.classCode ?? courseClass.name}</span>
                  <small>{courseClass.name}</small>
                </label>
              )
            })}
          </div>
        </fieldset>
      </section>

      <section className="practice-import-panel" aria-labelledby="csv-upload-title">
        <div className="practice-import-panel__heading practice-import-panel__heading--compact">
          <div>
            <h2 id="csv-upload-title">Tải file lên và kiểm tra</h2>
            <p>Hệ thống chưa ghi dữ liệu cho đến khi bạn xác nhận nhập.</p>
          </div>
        </div>
        <label className="practice-import-dropzone" htmlFor="practice-csv-file">
          <Upload aria-hidden="true" size={24} />
          <strong>{fileName || 'Chọn file CSV từ máy tính'}</strong>
          <span>Nhấn để chọn file .csv, tối đa 1 MB</span>
          <input id="practice-csv-file" type="file" accept=".csv,text/csv" onChange={handleFile} />
        </label>

        {fileError && (
          <p className="practice-import-feedback practice-import-feedback--error" role="alert">
            <AlertCircle aria-hidden="true" size={18} />
            {fileError}
          </p>
        )}
        {result && (
          <div className="practice-import-feedback practice-import-feedback--success" role="status">
            <CheckCircle2 aria-hidden="true" size={18} />
            <span>Đã nhập {result.importedCount} câu hỏi vào bản nháp.</span>
            <Link to={returnPath}>Xem ngân hàng câu hỏi</Link>
          </div>
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
                    <th>Nội dung câu hỏi</th>
                    <th>Đáp án đúng</th>
                    <th>Kiểm tra</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr className={row.valid ? '' : 'has-errors'} key={row.rowNumber}>
                      <td>{row.rowNumber}</td>
                      <td>{row.question.content || '—'}</td>
                      <td>{row.question.correctOptionKey || '—'}</td>
                      <td>
                        {row.valid ? (
                          <span className="practice-import-row-status is-valid">
                            <CheckCircle2 aria-hidden="true" size={15} /> Hợp lệ
                          </span>
                        ) : (
                          <ul>
                            {row.errors.map((rowError) => (
                              <li key={rowError}>{rowError}</li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="practice-import-actions">
              <span>
                {invalidRows.length
                  ? 'Sửa các dòng lỗi trong CSV rồi tải lên lại.'
                  : `${validRows.length} câu hỏi đã sẵn sàng để nhập.`}
              </span>
              <button
                className="button button--primary"
                type="button"
                disabled={
                  importing ||
                  invalidRows.length > 0 ||
                  !scope.subjectId ||
                  !scope.chapterId ||
                  !scope.classIds.length
                }
                onClick={importQuestions}
              >
                <Upload aria-hidden="true" size={17} />
                {importing ? 'Đang nhập…' : `Nhập ${validRows.length} câu vào bản nháp`}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
