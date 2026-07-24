import {
  ArrowRight,
  BookOpen,
  BookOpenCheck,
  CheckCircle2,
  ExternalLink,
  FileText,
  GraduationCap,
  Mail,
  MapPin,
  MessageCircleQuestion,
  Pause,
  Phone,
  Play,
  Search,
  Sparkles,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import courseHoChiMinhImage from '../../assets/course-ho-chi-minh-unsplash.jpg'
import coursePartyHistoryImage from '../../assets/course-party-history-unsplash.jpg'
import coursePhilosophyImage from '../../assets/course-philosophy-unsplash.jpg'
import ptitReadingDayImage from '../../assets/ptit-reading-day.jpg'
import { useAuth } from '../../features/auth/useAuth'
import './HomePage.css'

const COURSE_SHOWCASE = [
  {
    alt: 'Không gian thư viện với kệ sách và đèn đọc dành cho học phần Triết học Mác - Lênin',
    description: 'Nắm vững thế giới quan và phương pháp luận khoa học của chủ nghĩa Mác - Lênin.',
    image: coursePhilosophyImage,
    imageHeight: 924,
    imagePosition: 'center',
    imageWidth: 1000,
    tags: ['Chủ nghĩa duy vật biện chứng', 'Chủ nghĩa duy vật lịch sử', 'Phép biện chứng duy vật'],
    title: 'Triết học Mác - Lênin',
  },
  {
    alt: 'Kệ sách cổ trong thư viện dành cho học phần Tư tưởng Hồ Chí Minh',
    description: 'Hệ thống quan điểm toàn diện và sâu sắc về cách mạng Việt Nam.',
    image: courseHoChiMinhImage,
    imageHeight: 667,
    imagePosition: 'center',
    imageWidth: 1000,
    tags: ['Độc lập dân tộc', 'Đại đoàn kết toàn dân tộc', 'Đạo đức cách mạng'],
    title: 'Tư tưởng Hồ Chí Minh',
  },
  {
    alt: 'Không gian thư viện nhiều tầng dành cho học phần Lịch sử Đảng và Chủ nghĩa xã hội khoa học',
    description: 'Đường lối cách mạng của Đảng và con đường đi lên chủ nghĩa xã hội.',
    image: coursePartyHistoryImage,
    imageHeight: 667,
    imagePosition: 'center',
    imageWidth: 1000,
    tags: [
      'Lịch sử Đảng Cộng sản Việt Nam',
      'Chủ nghĩa xã hội khoa học',
      'Kinh tế chính trị Mác - Lênin',
    ],
    title: 'Lịch sử Đảng và Chủ nghĩa xã hội khoa học',
  },
]

const HERO_MESSAGES = ['hiểu bài sâu hơn.', 'hỏi đúng trọng tâm.', 'ôn thi có hệ thống.']

const HERO_BENEFITS = [
  {
    title: 'Hỏi theo môn đang học',
    description: 'Giữ câu hỏi đúng học phần, chương và khái niệm.',
  },
  {
    title: 'Đọc đúng nguồn',
    description: 'Đối chiếu giáo trình, văn kiện và vị trí trích dẫn.',
  },
  {
    title: 'Ôn theo tiến độ',
    description: 'Tiếp tục từ phần còn vướng thay vì học lại từ đầu.',
  },
]
const STUDENT_MOMENTS = [
  {
    context: 'Khi đang học',
    description:
      'Chọn đúng môn và chương trước khi hỏi để cuộc hội thoại luôn bám vào phần kiến thức bạn đang học.',
    highlights: ['Giữ ngữ cảnh theo học phần', 'Gợi ý cách đặt câu hỏi rõ hơn'],
    icon: MessageCircleQuestion,
    preview: 'question',
    title: 'Gỡ đúng phần đang vướng, không phải tìm lại từ đầu',
  },
  {
    context: 'Khi cần tra cứu',
    description:
      'Đi từ phần giải thích tới giáo trình, văn kiện hoặc tác phẩm liên quan trong cùng một mạch đọc.',
    highlights: ['Phân loại nguồn theo tài liệu', 'Hiển thị chương và mục cần đọc'],
    icon: BookOpenCheck,
    preview: 'source',
    title: 'Biết nội dung đến từ đâu và nên đọc tiếp ở chỗ nào',
  },
  {
    context: 'Khi chuẩn bị kiểm tra',
    description:
      'Gom các khái niệm, luận điểm và câu hỏi tự kiểm tra thành một lộ trình ôn tập theo từng chuyên đề.',
    highlights: ['Ôn theo phần chưa nắm chắc', 'So sánh luận điểm trước vấn đáp'],
    icon: GraduationCap,
    preview: 'review',
    title: 'Ôn có trọng tâm theo tiến độ của riêng bạn',
  },
]

function StudentMomentPreview({ type }) {
  if (type === 'question') {
    return (
      <figure
        className="home-use-case__preview home-use-case__preview--question"
        aria-label="Minh họa giao diện hỏi đáp theo học phần"
      >
        <div className="home-demo home-demo--question">
          <div className="home-demo__context">
            <span>Triết học Mác - Lênin</span>
            <span>Chương 2</span>
          </div>
          <div className="home-demo__question">
            <MessageCircleQuestion size={20} aria-hidden="true" />
            <p>Vì sao thực tiễn là cơ sở của nhận thức?</p>
          </div>
          <div className="home-demo__answer">
            <div>
              <Sparkles size={18} aria-hidden="true" />
              <strong>AI trợ giảng · Mẫu giao diện</strong>
            </div>
            <p>
              Thực tiễn đặt ra nhu cầu, cung cấp đối tượng và phương tiện để con người nhận thức thế
              giới.
            </p>
            <span>Đối chiếu: Giáo trình · Chương 2</span>
          </div>
        </div>
        <figcaption className="sr-only">
          Mẫu giao diện cuộc hội thoại có ngữ cảnh môn học và phần đối chiếu tài liệu.
        </figcaption>
      </figure>
    )
  }

  if (type === 'source') {
    return (
      <figure
        className="home-use-case__preview home-use-case__preview--source"
        aria-label="Minh họa giao diện tra cứu nguồn học liệu"
      >
        <img
          src={coursePhilosophyImage}
          width="1000"
          height="924"
          loading="lazy"
          decoding="async"
          alt="Kệ sách trong thư viện minh họa không gian tra cứu giáo trình"
        />
        <div className="home-source-demo">
          <div className="home-source-demo__search">
            <Search size={18} aria-hidden="true" />
            <span>Mối quan hệ giữa vật chất và ý thức</span>
          </div>
          <div className="home-source-demo__result">
            <BookOpenCheck size={22} aria-hidden="true" />
            <div>
              <strong>Giáo trình Triết học Mác - Lênin</strong>
              <span>Chương 2 · Mục 1.2</span>
            </div>
          </div>
          <div className="home-source-demo__tags" aria-label="Nhóm nguồn có thể tra cứu">
            <span>Giáo trình</span>
            <span>Văn kiện</span>
            <span>Tác phẩm kinh điển</span>
          </div>
        </div>
        <figcaption className="sr-only">
          Mẫu tra cứu hiển thị đúng loại tài liệu, chương và mục cần đọc.
        </figcaption>
      </figure>
    )
  }

  return (
    <figure
      className="home-use-case__preview home-use-case__preview--review"
      aria-label="Minh họa giao diện ôn tập theo chuyên đề"
    >
      <div className="home-review-demo">
        <div className="home-review-demo__heading">
          <div>
            <span>Chuyên đề đang ôn</span>
            <strong>Phép biện chứng duy vật</strong>
          </div>
          <span>3 nội dung</span>
        </div>
        <ul>
          <li>
            <CheckCircle2 size={20} aria-hidden="true" />
            <span>
              <strong>Hai nguyên lý</strong>
              <small>Đã xem lại</small>
            </span>
          </li>
          <li>
            <BookOpen size={20} aria-hidden="true" />
            <span>
              <strong>Các cặp phạm trù</strong>
              <small>Đang học</small>
            </span>
          </li>
          <li>
            <GraduationCap size={20} aria-hidden="true" />
            <span>
              <strong>Ba quy luật</strong>
              <small>Học tiếp</small>
            </span>
          </li>
        </ul>
        <div className="home-review-demo__prompt">
          <span>Câu tự kiểm tra</span>
          <strong>Phân biệt mâu thuẫn biện chứng và mâu thuẫn thông thường.</strong>
        </div>
      </div>
      <figcaption className="sr-only">
        Mẫu lộ trình ôn tập chia theo chuyên đề và trạng thái học.
      </figcaption>
    </figure>
  )
}

export default function HomePage() {
  const pageRef = useRef(null)
  const { isLoading, user } = useAuth()
  const [activeCourseIndex, setActiveCourseIndex] = useState(0)
  const [isCarouselPaused, setIsCarouselPaused] = useState(false)
  const [isCarouselInteracting, setIsCarouselInteracting] = useState(false)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const [activeHeroMessageIndex, setActiveHeroMessageIndex] = useState(0)
  const [isHeroInteracting, setIsHeroInteracting] = useState(false)

  const workspacePath = user ? `/${user.role}` : '/login'
  const workspaceLabel = user ? 'Vào không gian học tập' : 'Đăng nhập'

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updateMotionPreference = () => setPrefersReducedMotion(mediaQuery.matches)

    updateMotionPreference()
    mediaQuery.addEventListener('change', updateMotionPreference)

    return () => mediaQuery.removeEventListener('change', updateMotionPreference)
  }, [])

  useEffect(() => {
    if (prefersReducedMotion || isHeroInteracting) {
      return undefined
    }

    const timer = window.setInterval(() => {
      setActiveHeroMessageIndex((currentIndex) => (currentIndex + 1) % HERO_MESSAGES.length)
    }, 2800)

    return () => window.clearInterval(timer)
  }, [isHeroInteracting, prefersReducedMotion])

  useEffect(() => {
    if (isCarouselPaused || isCarouselInteracting || prefersReducedMotion) {
      return undefined
    }

    const timer = window.setTimeout(() => {
      setActiveCourseIndex((currentIndex) => (currentIndex + 1) % COURSE_SHOWCASE.length)
    }, 5200)

    return () => window.clearTimeout(timer)
  }, [activeCourseIndex, isCarouselInteracting, isCarouselPaused, prefersReducedMotion])

  useEffect(() => {
    const page = pageRef.current
    const revealItems = page?.querySelectorAll('[data-home-reveal]')

    if (!revealItems?.length) {
      return undefined
    }

    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
      revealItems.forEach((item) => item.classList.add('is-revealed'))
      return undefined
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed')
            observer.unobserve(entry.target)
          }
        })
      },
      {
        rootMargin: '0px 0px -8% 0px',
        threshold: 0.12,
      },
    )

    revealItems.forEach((item) => observer.observe(item))

    return () => observer.disconnect()
  }, [prefersReducedMotion])

  const handleHeroBlur = (event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setIsHeroInteracting(false)
    }
  }
  const handleCarouselBlur = (event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setIsCarouselInteracting(false)
    }
  }

  const handleCarouselToggle = () => {
    const nextPausedState = !isCarouselPaused
    setIsCarouselPaused(nextPausedState)

    if (!nextPausedState) {
      setIsCarouselInteracting(false)
    }
  }

  return (
    <div className="home-page" ref={pageRef}>
      <a className="skip-link" href="#main-content">
        Bỏ qua điều hướng
      </a>

      <header className="home-nav">
        <Link className="home-wordmark" to="/" aria-label="Trang chủ PTIT Chính Trị">
          <span className="home-wordmark__mark" aria-hidden="true">
            P
          </span>
          <span>PTIT Chính Trị</span>
        </Link>
        <nav className="home-nav__links" aria-label="Điều hướng trang giới thiệu">
          <a href="#tinh-nang">Tính năng</a>
          <Link to={workspacePath}>{isLoading ? 'Đang kiểm tra' : workspaceLabel}</Link>
        </nav>
      </header>

      <main id="main-content" tabIndex={-1}>
        <section
          className="home-hero"
          aria-labelledby="home-title"
          onMouseEnter={() => setIsHeroInteracting(true)}
          onMouseLeave={() => setIsHeroInteracting(false)}
          onFocusCapture={() => setIsHeroInteracting(true)}
          onBlurCapture={handleHeroBlur}
        >
          <div className="home-hero__copy">
            <p className="home-kicker">AI trợ giảng cho sinh viên PTIT</p>
            <h1 id="home-title">
              <span>PTIT Chính Trị giúp bạn</span>
              <span className="home-title-message-stage">
                {HERO_MESSAGES.map((message, index) => (
                  <span
                    className={`home-title-message ${
                      index === activeHeroMessageIndex ? 'is-active' : ''
                    }`.trim()}
                    aria-hidden={index !== activeHeroMessageIndex}
                    key={message}
                  >
                    {message}
                  </span>
                ))}
              </span>
            </h1>
            <p className="home-hero__lede">
              Tra cứu giáo trình, đặt câu hỏi và ôn tập năm học phần chính trị cùng AI trợ giảng.
            </p>
            <div className="home-hero__actions">
              <Link className="home-button home-button--primary" to={workspacePath}>
                <span>{workspaceLabel}</span>
                <span className="home-button__icon" aria-hidden="true">
                  <ArrowRight size={20} />
                </span>
              </Link>
              <a className="home-button home-button--quiet" href="#tinh-nang">
                <span>Xem tính năng</span>
                <span className="home-button__icon" aria-hidden="true">
                  <ArrowRight size={20} />
                </span>
              </a>
            </div>
          </div>

          <div
            className="home-learning-scene"
            aria-label="Minh họa sinh viên học cùng AI trợ giảng"
          >
            <span className="home-learning-scene__track" aria-hidden="true" />

            <figure className="home-scene-photo home-scene-photo--left">
              <img
                src={coursePhilosophyImage}
                width="1000"
                height="924"
                alt="Không gian thư viện cho học phần Triết học Mác - Lênin"
              />
              <figcaption>Triết học Mác - Lênin</figcaption>
            </figure>

            <p className="home-scene-bubble home-scene-bubble--left">
              Khái niệm này nằm ở chương nào?
            </p>

            <article className="home-scene-answer">
              <div className="home-scene-answer__heading">
                <span aria-hidden="true">
                  <BookOpenCheck size={22} />
                </span>
                <strong>AI trợ giảng PTIT</strong>
              </div>
              <p>Mình sẽ giải thích theo đúng học phần và chỉ rõ nguồn để bạn đọc tiếp.</p>
              <span className="home-scene-answer__source">Giáo trình và văn kiện chính thống</span>
            </article>

            <p className="home-scene-bubble home-scene-bubble--right">
              Gợi ý giúp mình ôn phần này.
            </p>

            <figure className="home-scene-photo home-scene-photo--right">
              <img
                src={courseHoChiMinhImage}
                width="1000"
                height="667"
                alt="Kệ sách cho học phần Tư tưởng Hồ Chí Minh"
              />
              <figcaption>Tư tưởng Hồ Chí Minh</figcaption>
            </figure>

            <span className="home-scene-token home-scene-token--question" aria-hidden="true">
              <MessageCircleQuestion size={24} />
            </span>
            <span className="home-scene-token home-scene-token--source" aria-hidden="true">
              <FileText size={24} />
            </span>
          </div>

          <ul className="home-hero-benefits" aria-label="Lợi ích chính">
            {HERO_BENEFITS.map((benefit) => (
              <li key={benefit.title}>
                <strong>{benefit.title}</strong>
                <span>{benefit.description}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="home-courses" aria-labelledby="courses-title">
          <div className="home-section-heading home-reveal" data-home-reveal>
            <h2 id="courses-title">Học theo đúng học phần của bạn.</h2>
            <p>
              Mỗi không gian học tập giữ nguyên ngữ cảnh môn học để câu hỏi, nguồn đọc và phần ôn
              tập luôn đi cùng nhau.
            </p>
          </div>
          <div
            className="home-course-showcase home-reveal"
            data-home-reveal
            aria-label="Các học phần chính trị tiêu biểu"
            aria-roledescription="băng chuyền"
            onMouseEnter={() => setIsCarouselInteracting(true)}
            onMouseLeave={() => setIsCarouselInteracting(false)}
            onFocusCapture={() => setIsCarouselInteracting(true)}
            onBlurCapture={handleCarouselBlur}
          >
            <div className="home-course-showcase__back" aria-hidden="true" />
            <div className="home-course-viewport">
              <div
                className="home-course-track"
                style={{ '--home-active-course': activeCourseIndex }}
              >
                {COURSE_SHOWCASE.map((course, index) => (
                  <article
                    className={`home-course-card ${
                      index === activeCourseIndex ? 'is-active' : ''
                    }`.trim()}
                    key={course.title}
                    aria-hidden={index !== activeCourseIndex}
                  >
                    <img
                      src={course.image}
                      width={course.imageWidth}
                      height={course.imageHeight}
                      fetchPriority={index === 0 ? 'high' : 'auto'}
                      loading={index === 0 ? 'eager' : 'lazy'}
                      alt={course.alt}
                      style={{ objectPosition: course.imagePosition }}
                    />
                    <span className="home-course-card__icon" aria-hidden="true">
                      <BookOpenCheck size={20} />
                    </span>
                    <div className="home-course-card__content">
                      <h2>{course.title}</h2>
                      <p>{course.description}</p>
                      <ul aria-label={`Chủ đề trong học phần ${course.title}`}>
                        {course.tags.map((tag) => (
                          <li key={tag}>{tag}</li>
                        ))}
                      </ul>
                    </div>
                  </article>
                ))}
              </div>

              <button
                type="button"
                className="home-course-showcase__toggle"
                aria-label={
                  prefersReducedMotion
                    ? 'Trình chiếu tự động đã tắt theo cài đặt chuyển động'
                    : isCarouselPaused
                      ? 'Tiếp tục trình chiếu tự động'
                      : 'Tạm dừng trình chiếu tự động'
                }
                title={
                  prefersReducedMotion
                    ? 'Đã tắt theo cài đặt chuyển động'
                    : isCarouselPaused
                      ? 'Tiếp tục trình chiếu'
                      : 'Tạm dừng trình chiếu'
                }
                disabled={prefersReducedMotion}
                onClick={handleCarouselToggle}
              >
                {isCarouselPaused || prefersReducedMotion ? (
                  <Play size={18} aria-hidden="true" />
                ) : (
                  <Pause size={18} aria-hidden="true" />
                )}
              </button>

              <div
                className="home-course-showcase__controls"
                role="group"
                aria-label="Chọn học phần đang hiển thị"
              >
                {COURSE_SHOWCASE.map((course, index) => (
                  <button
                    type="button"
                    className="home-course-showcase__selector"
                    aria-label={`Hiển thị học phần ${course.title}`}
                    aria-pressed={index === activeCourseIndex}
                    key={course.title}
                    onClick={() => setActiveCourseIndex(index)}
                  >
                    <span aria-hidden="true" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="home-features" id="tinh-nang" aria-labelledby="features-title">
          <div className="home-feature-intro home-reveal" data-home-reveal>
            <div>
              <h2 id="features-title">Bạn đang học ở bước nào?</h2>
              <p>
                PTIT Chính Trị đi cùng ba việc sinh viên thường phải tách ra nhiều nơi: hỏi phần còn
                vướng, kiểm tra nguồn và ôn lại theo chuyên đề.
              </p>
            </div>
            <p className="home-feature-intro__note">
              Mỗi không gian được thiết kế theo đúng việc cần làm, để bạn không phải bắt đầu lại ngữ
              cảnh sau mỗi lần chuyển công cụ.
            </p>
          </div>

          <div className="home-use-case-list">
            {STUDENT_MOMENTS.map((moment, momentIndex) => {
              const Icon = moment.icon
              return (
                <article
                  className={`home-use-case home-use-case--${moment.preview} home-reveal`}
                  data-home-reveal
                  style={{ '--home-reveal-order': momentIndex }}
                  key={moment.title}
                >
                  <div className="home-use-case__copy">
                    <div className="home-use-case__label">
                      <span aria-hidden="true">
                        <Icon size={22} />
                      </span>
                      <strong>{moment.context}</strong>
                    </div>
                    <h3>{moment.title}</h3>
                    <p>{moment.description}</p>
                    <ul>
                      {moment.highlights.map((highlight) => (
                        <li key={highlight}>
                          <CheckCircle2 size={19} aria-hidden="true" />
                          <span>{highlight}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <StudentMomentPreview type={moment.preview} />
                </article>
              )
            })}
          </div>
        </section>

        <section
          className="home-learning-cta home-reveal"
          aria-labelledby="learning-title"
          data-home-reveal
        >
          <div className="home-learning-cta__content">
            <span className="home-learning-cta__mark" aria-hidden="true">
              <GraduationCap size={24} />
            </span>
            <h2 id="learning-title">Sẵn sàng học chính trị rõ ràng hơn?</h2>
            <p>
              Đăng nhập để tiếp tục đúng học phần, lưu mạch câu hỏi và quay lại phần kiến thức bạn
              đang ôn.
            </p>
            <Link className="home-button home-button--poster" to={workspacePath}>
              <span>{workspaceLabel}</span>
              <span className="home-button__icon" aria-hidden="true">
                <ArrowRight size={20} />
              </span>
            </Link>
          </div>

          <figure className="home-learning-cta__media">
            <img
              src={ptitReadingDayImage}
              width="900"
              height="600"
              loading="lazy"
              decoding="async"
              alt="Sinh viên và giảng viên tham gia hoạt động đọc sách tại PTIT"
            />
            <figcaption>
              <BookOpenCheck size={18} aria-hidden="true" />
              Không gian học tập tại PTIT
            </figcaption>
          </figure>
        </section>
      </main>

      <footer className="home-footer">
        <div className="home-footer__brand">
          <Link className="home-wordmark" to="/" aria-label="Trang chủ PTIT Chính Trị">
            <span className="home-wordmark__mark" aria-hidden="true">
              P
            </span>
            <span>PTIT Chính Trị</span>
          </Link>
          <p>
            Nền tảng học tập giúp sinh viên PTIT tiếp cận các học phần chính trị, giáo trình và công
            cụ AI trợ giảng trong một không gian thống nhất.
          </p>
        </div>

        <div className="home-footer__column">
          <h2>Liên hệ</h2>
          <address>
            <span>
              <MapPin size={20} aria-hidden="true" />
              Km10, Đường Nguyễn Trãi, Q. Hà Đông, Hà Nội
            </span>
            <a href="tel:02437562186">
              <Phone size={20} aria-hidden="true" />
              024 3756 2186
            </a>
            <a href="mailto:ctsv@ptit.edu.vn">
              <Mail size={20} aria-hidden="true" />
              ctsv@ptit.edu.vn
            </a>
          </address>
        </div>

        <div className="home-footer__column">
          <h2>Kết nối</h2>
          <a
            className="home-footer__social"
            href="https://www.facebook.com/HocvienPTIT"
            target="_blank"
            rel="noreferrer"
          >
            Facebook Học viện PTIT
            <ExternalLink size={18} aria-hidden="true" />
          </a>
          <p>Theo dõi kênh chính thức để cập nhật thông tin mới nhất.</p>
        </div>

        <p className="home-footer__credit">
          © 2026 Trợ giảng Chính trị PTIT. Phục vụ hoạt động học tập các học phần chính trị tại Học
          viện.
        </p>
      </footer>
    </div>
  )
}
