import engelsPortrait from '../../assets/courses/friedrich-engels-portrait.jpg'
import marxPortrait from '../../assets/courses/karl-marx-portrait.jpg'
import './CourseCover.css'

const courseCovers = {
  sub1: {
    portrait: marxPortrait,
    tone: 'crimson',
    lines: ['Triết học', 'Mác – Lênin'],
  },
  sub2: {
    portrait: engelsPortrait,
    tone: 'emerald',
    lines: ['Kinh tế chính trị', 'Mác – Lênin'],
  },
}

export default function CourseCover({ subjectId, subjectName, className = '' }) {
  const cover = courseCovers[subjectId] ?? courseCovers.sub1

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
      <img src={cover.portrait} alt="" width="640" height="918" loading="lazy" decoding="async" />
    </span>
  )
}
