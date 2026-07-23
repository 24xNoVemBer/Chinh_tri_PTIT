import { classMaterials } from '../../data/mock-class-management'
import { chapters, courseClasses } from '../../data/mock-classes'
import { classLessons, curriculumLessons } from '../../data/mock-lessons'
import { approvedSources, materials, materialVersions } from '../../data/mock-sources'
import { clone, createRepositoryError } from '../mock/helpers'

let runtimeClassLessons = clone(classLessons)
let runtimeClassMaterials = clone(classMaterials)

function getClass(classId) {
  return courseClasses.find((item) => item.id === classId) ?? null
}

function enrichLesson(scheduledLesson) {
  const lesson = curriculumLessons.find((item) => item.id === scheduledLesson.lessonId) ?? null
  const chapter = chapters.find((item) => item.id === lesson?.chapterId) ?? null
  return { ...scheduledLesson, lesson, chapter }
}

function enrichMaterial(classMaterial) {
  const material = materials.find((item) => item.id === classMaterial.materialId) ?? null
  const version = materialVersions.find((item) => item.id === classMaterial.versionId) ?? null
  return { ...classMaterial, material, version }
}

function ensureStatus(status) {
  if (!['draft', 'published'].includes(status)) {
    throw createRepositoryError('VALIDATION', 'Trạng thái nội dung không hợp lệ.')
  }
}

export const classContentRepository = {
  async listLessons(classId) {
    return clone(
      runtimeClassLessons
        .filter((item) => item.classId === classId)
        .map(enrichLesson)
        .sort((a, b) => a.date.localeCompare(b.date)),
    )
  },

  async listAvailableLessons(classId) {
    const courseClass = getClass(classId)
    if (!courseClass) return []

    const chapterIds = chapters
      .filter((item) => item.subjectId === courseClass.subjectId)
      .map((item) => item.id)
    const scheduledIds = runtimeClassLessons
      .filter((item) => item.classId === classId)
      .map((item) => item.lessonId)

    return clone(
      curriculumLessons
        .filter((item) => chapterIds.includes(item.chapterId) && !scheduledIds.includes(item.id))
        .map((lesson) => ({
          ...lesson,
          chapter: chapters.find((item) => item.id === lesson.chapterId) ?? null,
        })),
    )
  },

  async scheduleLesson(classId, input) {
    const courseClass = getClass(classId)
    const lesson = curriculumLessons.find((item) => item.id === input.lessonId)
    if (!courseClass || !lesson) {
      throw createRepositoryError('NOT_FOUND', 'Không tìm thấy lớp hoặc bài học.')
    }

    const chapter = chapters.find((item) => item.id === lesson.chapterId)
    if (chapter?.subjectId !== courseClass.subjectId) {
      throw createRepositoryError('VALIDATION', 'Bài học không thuộc môn của lớp này.')
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date ?? '')) {
      throw createRepositoryError('VALIDATION', 'Ngày học không hợp lệ.')
    }
    if (
      runtimeClassLessons.some((item) => item.classId === classId && item.lessonId === lesson.id)
    ) {
      throw createRepositoryError('CONFLICT', 'Bài học đã có trong lớp.')
    }

    const scheduledLesson = {
      id: `cl${runtimeClassLessons.length + 1}`,
      classId,
      lessonId: lesson.id,
      date: input.date,
      status: 'draft',
    }
    runtimeClassLessons = [...runtimeClassLessons, scheduledLesson]
    return clone(enrichLesson(scheduledLesson))
  },

  async updateLessonStatus(classId, scheduledLessonId, status) {
    ensureStatus(status)
    runtimeClassLessons = runtimeClassLessons.map((item) =>
      item.id === scheduledLessonId && item.classId === classId ? { ...item, status } : item,
    )
    const updated = runtimeClassLessons.find(
      (item) => item.id === scheduledLessonId && item.classId === classId,
    )
    return updated ? clone(enrichLesson(updated)) : null
  },

  async listMaterials(classId) {
    return clone(
      runtimeClassMaterials.filter((item) => item.classId === classId).map(enrichMaterial),
    )
  },

  async listAvailableMaterials(classId) {
    const courseClass = getClass(classId)
    if (!courseClass) return []

    const approvedIds = approvedSources
      .filter((item) => item.isApproved)
      .map((item) => item.materialId)
    const attachedIds = runtimeClassMaterials
      .filter((item) => item.classId === classId)
      .map((item) => item.materialId)

    return clone(
      materials
        .filter(
          (item) =>
            item.subjectId === courseClass.subjectId &&
            approvedIds.includes(item.id) &&
            !attachedIds.includes(item.id),
        )
        .map((material) => ({
          ...material,
          versions: materialVersions.filter((item) => item.materialId === material.id),
        })),
    )
  },

  async attachMaterial(classId, input) {
    const courseClass = getClass(classId)
    const material = materials.find((item) => item.id === input.materialId)
    if (!courseClass || !material) {
      throw createRepositoryError('NOT_FOUND', 'Không tìm thấy lớp hoặc học liệu.')
    }
    if (material.subjectId !== courseClass.subjectId) {
      throw createRepositoryError('VALIDATION', 'Học liệu không thuộc môn của lớp này.')
    }
    if (!approvedSources.some((item) => item.materialId === material.id && item.isApproved)) {
      throw createRepositoryError('VALIDATION', 'Học liệu chưa được duyệt để sử dụng.')
    }
    if (
      runtimeClassMaterials.some(
        (item) => item.classId === classId && item.materialId === material.id,
      )
    ) {
      throw createRepositoryError('CONFLICT', 'Học liệu đã được gắn vào lớp.')
    }

    const version =
      materialVersions
        .filter((item) => item.materialId === material.id)
        .sort((a, b) => b.year - a.year)[0] ?? null
    if (!version) {
      throw createRepositoryError('NOT_FOUND', 'Học liệu chưa có phiên bản khả dụng.')
    }

    const classMaterial = {
      id: `cm${runtimeClassMaterials.length + 1}`,
      classId,
      materialId: material.id,
      versionId: version.id,
      status: 'draft',
      addedAt: new Date().toISOString(),
    }
    runtimeClassMaterials = [...runtimeClassMaterials, classMaterial]
    return clone(enrichMaterial(classMaterial))
  },

  async updateMaterialStatus(classId, classMaterialId, status) {
    ensureStatus(status)
    runtimeClassMaterials = runtimeClassMaterials.map((item) =>
      item.id === classMaterialId && item.classId === classId ? { ...item, status } : item,
    )
    const updated = runtimeClassMaterials.find(
      (item) => item.id === classMaterialId && item.classId === classId,
    )
    return updated ? clone(enrichMaterial(updated)) : null
  },

  reset() {
    runtimeClassLessons = clone(classLessons)
    runtimeClassMaterials = clone(classMaterials)
  },
}
