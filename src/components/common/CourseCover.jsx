import engelsPortrait from '../../assets/courses/friedrich-engels-portrait.jpg'
import marxPortrait from '../../assets/courses/karl-marx-portrait.jpg'
import './CourseCover.css'

// Only sub1 and sub2 have a portrait that actually belongs to the subject. The rest get a
// typographic cover: borrowing Marx's portrait and the "Triết học Mác – Lênin" wordmark for
// Tư tưởng Hồ Chí Minh or Lịch sử Đảng mislabels the course on every card that shows it.
const courseCovers = {
  sub1: { portrait: marxPortrait, tone: 'crimson', lines: ['Triết học', 'Mác – Lênin'] },
  sub2: { portrait: engelsPortrait, tone: 'emerald', lines: ['Kinh tế chính trị', 'Mác – Lênin'] },
  sub3: { portrait: null, tone: 'indigo', lines: ['Chủ nghĩa', 'Xã hội Khoa học'] },
  sub4: { portrait: null, tone: 'amber', lines: ['Tư tưởng', 'Hồ Chí Minh'] },
  sub5: { portrait: null, tone: 'slate', lines: ['Lịch sử', 'Đảng CSVN'] },
}

// Split an unknown subject name into at most two balanced lines so the fallback never
// prints another subject's title.
function deriveLines(subjectName) {
  const words = String(subjectName ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!words.length) return ['Học phần']
  if (words.length === 1) return words
  const middle = Math.ceil(words.length / 2)
  return [words.slice(0, middle).join(' '), words.slice(middle).join(' ')]
}

export default function CourseCover({ subjectId, subjectName, className = '' }) {
  const known = courseCovers[subjectId]
  const cover = known ?? { portrait: null, tone: 'slate', lines: deriveLines(subjectName) }

  return (
    <span
      className={`course-cover course-cover--${cover.tone} ${className}`.trim()}
      role="img"
      aria-label={`Bìa học phần ${subjectName ?? cover.lines.join(' ')}`}
    >
      <span className="course-cover__title" aria-hidden="true">
        {cover.lines.map((line) => (
          <span key={line}>{line}</span>
        ))}
      </span>
      {cover.portrait && (
        <img src={cover.portrait} alt="" width="640" height="918" loading="lazy" decoding="async" />
      )}
    </span>
  )
}
