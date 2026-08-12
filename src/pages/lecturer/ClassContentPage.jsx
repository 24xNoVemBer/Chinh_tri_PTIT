import { BookOpenText, ExternalLink, FileText, ShieldCheck } from 'lucide-react'
import { useCallback, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PermissionState,
} from '../../components/common/AsyncState'
import PageHeader from '../../components/common/PageHeader'
import ClassSubnav from '../../components/lecturer/ClassSubnav'
import useAsyncData from '../../hooks/useAsyncData'
import { classContentRepository, classRepository } from '../../services/appRepositories'
import './ClassContentPage.css'

export default function ClassContentPage() {
  const { classId } = useParams()
  const loader = useCallback(async () => {
    const [courseClass, scheduledLessons, availableLessons, classMaterials, availableMaterials] =
      await Promise.all([
        classRepository.getById(classId),
        classContentRepository.listLessons(classId),
        classContentRepository.listAvailableLessons(classId),
        classContentRepository.listMaterials(classId),
        classContentRepository.listAvailableMaterials(classId),
      ])
    return { courseClass, scheduledLessons, availableLessons, classMaterials, availableMaterials }
  }, [classId])
  const { data, loading, error, reload } = useAsyncData(loader)

  const lessons = useMemo(() => {
    if (!data) return []
    const byId = new Map()
    data.scheduledLessons.forEach((item) =>
      byId.set(item.lesson.id, { ...item.lesson, chapter: item.chapter }),
    )
    data.availableLessons.forEach((item) => byId.set(item.id, item))
    return [...byId.values()].sort(
      (a, b) => (a.chapter?.order ?? 0) - (b.chapter?.order ?? 0) || a.order - b.order,
    )
  }, [data])

  const materials = useMemo(() => {
    if (!data) return []
    const byId = new Map()
    data.classMaterials.forEach((item) =>
      byId.set(item.material.id, { ...item.material, versions: [item.version] }),
    )
    data.availableMaterials.forEach((item) => byId.set(item.id, item))
    return [...byId.values()]
  }, [data])

  if (loading) return <LoadingState label="Đang tải nội dung môn học…" />
  if (error?.code === 'FORBIDDEN') return <PermissionState message={error.message} />
  if (error) return <ErrorState message={error.message} onRetry={reload} />
  if (!data?.courseClass) return <EmptyState title="Không tìm thấy lớp tín chỉ" />

  return (
    <div className="page-stack class-content-page">
      <PageHeader
        eyebrow={data.courseClass.name}
        title="Nội dung môn học"
        description="Chương trình và học liệu dùng chung do quản trị viên phụ trách. Giảng viên có quyền xem để xây dựng câu hỏi ôn tập cho lớp."
      />
      <ClassSubnav classId={classId} />

      <div className="class-content-note" role="note">
        <ShieldCheck aria-hidden="true" size={20} />
        <div>
          <strong>Nội dung chính thống — chế độ chỉ đọc</strong>
          <span>Mọi thay đổi chương, bài học và học liệu được thực hiện bởi quản trị viên.</span>
        </div>
      </div>

      <div className="class-content-grid">
        <section className="class-content-panel" aria-labelledby="curriculum-title">
          <div className="class-content-panel__heading">
            <BookOpenText aria-hidden="true" size={21} />
            <div>
              <p className="section-heading__eyebrow">Chương trình chung</p>
              <h2 id="curriculum-title">{lessons.length} bài học</h2>
            </div>
          </div>
          {lessons.length ? (
            <div className="class-content-list">
              {lessons.map((lesson) => (
                <article key={lesson.id}>
                  <span>
                    Chương {lesson.chapter?.order ?? '—'} · Bài {lesson.order}
                  </span>
                  <strong>{lesson.title}</strong>
                  <small>{lesson.chapter?.title}</small>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Chưa có bài học"
              description="Quản trị viên chưa công bố nội dung cho môn này."
            />
          )}
        </section>

        <section className="class-content-panel" aria-labelledby="materials-title">
          <div className="class-content-panel__heading">
            <FileText aria-hidden="true" size={21} />
            <div>
              <p className="section-heading__eyebrow">Nguồn đã duyệt</p>
              <h2 id="materials-title">{materials.length} học liệu</h2>
            </div>
          </div>
          {materials.length ? (
            <div className="class-content-list">
              {materials.map((material) => {
                const version = material.versions?.[0]
                return (
                  <article key={material.id}>
                    <span>
                      {material.type} · {version?.year ?? 'Bản hiện hành'}
                    </span>
                    <strong>{material.title}</strong>
                    <small>{material.author}</small>
                    {version?.fileUrl && (
                      <a href={version.fileUrl} target="_blank" rel="noreferrer">
                        Mở học liệu <ExternalLink aria-hidden="true" size={14} />
                      </a>
                    )}
                  </article>
                )
              })}
            </div>
          ) : (
            <EmptyState
              title="Chưa có học liệu"
              description="Quản trị viên chưa duyệt nguồn cho môn này."
            />
          )}
        </section>
      </div>
    </div>
  )
}
