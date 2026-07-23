import { BookOpen, Eye, EyeOff, GraduationCap, LoaderCircle, ShieldCheck } from 'lucide-react'
import { useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ROLES } from '../../features/auth/auth'
import { useAuth } from '../../features/auth/useAuth'
import './RoleSelector.css'

const ROLE_OPTIONS = [
  {
    role: ROLES.STUDENT,
    title: 'Sinh viên',
    description: 'Tra cứu kiến thức, theo dõi bài học và gửi câu hỏi cho giảng viên.',
    icon: BookOpen,
  },
  {
    role: ROLES.LECTURER,
    title: 'Giảng viên',
    description: 'Quản lý lớp, học liệu, sinh viên và các câu hỏi cần xử lý.',
    icon: GraduationCap,
  },
]

const DEMO_ACCOUNTS = {
  student: { email: 'tuananh@ptit.edu.vn', password: 'Student@123' },
  lecturer: { email: 'ductu@ptit.edu.vn', password: 'Lecturer@123' },
}

function validate(values) {
  const nextErrors = {}
  if (!values.email.trim()) nextErrors.email = 'Vui lòng nhập email PTIT.'
  else if (!/^\S+@\S+\.\S+$/.test(values.email)) nextErrors.email = 'Email chưa đúng định dạng.'
  if (!values.password) nextErrors.password = 'Vui lòng nhập mật khẩu.'
  return nextErrors
}

export default function RoleSelector() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isLoading, login, user } = useAuth()
  const [role, setRole] = useState(ROLES.STUDENT)
  const [values, setValues] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [serverError, setServerError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const emailRef = useRef(null)
  const passwordRef = useRef(null)

  if (!isLoading && user) return <Navigate to={`/${user.role}`} replace />

  const updateField = (event) => {
    const { name, value } = event.target
    const nextValues = { ...values, [name]: value }
    setValues(nextValues)
    setServerError('')
    if (touched[name]) setErrors(validate(nextValues))
  }

  const handleBlur = (event) => {
    const nextTouched = { ...touched, [event.target.name]: true }
    setTouched(nextTouched)
    setErrors(validate(values))
  }

  const selectRole = (nextRole) => {
    setRole(nextRole)
    setServerError('')
  }

  const useDemoAccount = () => {
    setValues(DEMO_ACCOUNTS[role])
    setErrors({})
    setTouched({})
    setServerError('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const nextErrors = validate(values)
    setTouched({ email: true, password: true })
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) {
      if (nextErrors.email) emailRef.current?.focus()
      else passwordRef.current?.focus()
      return
    }

    setIsSubmitting(true)
    setServerError('')
    try {
      const authenticatedUser = await login({ ...values, role })
      const requestedPath = location.state?.from
      const destination = requestedPath?.startsWith(`/${authenticatedUser.role}`)
        ? requestedPath
        : `/${authenticatedUser.role}`
      navigate(destination, { replace: true })
    } catch (error) {
      setServerError(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="role-selector-container">
      <section className="role-selector-shell" aria-labelledby="login-title">
        <div className="role-selector-intro">
          <div className="role-selector-brand">
            <span>PTIT</span> Trợ giảng
          </div>
          <div className="role-selector-intro__copy">
            <p className="role-selector-kicker">Không gian học tập có kiểm chứng</p>
            <h1 id="login-title" className="role-selector-title">
              Quản lý lớp rõ ràng. Tra cứu kiến thức đúng ngữ cảnh.
            </h1>
            <p className="role-selector-subtitle">
              Một cổng chung để giảng viên vận hành lớp học và sinh viên tiếp cận bài giảng, hỏi
              đáp, lịch sử học tập.
            </p>
          </div>
          <div className="role-selector-trust">
            <ShieldCheck aria-hidden="true" size={20} />
            <span>
              Phiên đăng nhập được bảo vệ bằng cookie HttpOnly và phân quyền theo vai trò.
            </span>
          </div>
        </div>

        <div className="login-panel">
          <div className="login-panel__header">
            <p className="role-selector-kicker">Đăng nhập hệ thống</p>
            <h2>Chào mừng bạn trở lại</h2>
            <p>Chọn đúng vai trò và dùng tài khoản PTIT của bạn.</p>
          </div>

          <div className="role-choice" aria-label="Chọn vai trò">
            {ROLE_OPTIONS.map((option) => {
              const Icon = option.icon
              const selected = role === option.role
              return (
                <button
                  key={option.role}
                  className={`role-choice__item ${selected ? 'role-choice__item--active' : ''}`}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => selectRole(option.role)}
                >
                  <Icon aria-hidden="true" size={19} />
                  <span>
                    <strong>{option.title}</strong>
                    <small>{option.description}</small>
                  </span>
                </button>
              )
            })}
          </div>

          <form className="login-form" noValidate onSubmit={handleSubmit}>
            <div className="form-field">
              <label htmlFor="login-email">Email PTIT</label>
              <input
                id="login-email"
                ref={emailRef}
                name="email"
                type="email"
                autoComplete="username"
                placeholder="tenban@ptit.edu.vn"
                value={values.email}
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? 'login-email-error' : undefined}
                onBlur={handleBlur}
                onChange={updateField}
              />
              {errors.email && (
                <span className="form-field__error" id="login-email-error" role="alert">
                  {errors.email}
                </span>
              )}
            </div>

            <div className="form-field">
              <label htmlFor="login-password">Mật khẩu</label>
              <div className="password-field">
                <input
                  id="login-password"
                  ref={passwordRef}
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={values.password}
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={errors.password ? 'login-password-error' : undefined}
                  onBlur={handleBlur}
                  onChange={updateField}
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                </button>
              </div>
              {errors.password && (
                <span className="form-field__error" id="login-password-error" role="alert">
                  {errors.password}
                </span>
              )}
            </div>

            {serverError && (
              <div className="login-form__error" role="alert">
                {serverError}
              </div>
            )}

            <button
              className="login-form__submit"
              type="submit"
              disabled={isSubmitting || isLoading}
            >
              {isSubmitting || isLoading ? (
                <>
                  <LoaderCircle className="login-form__spinner" aria-hidden="true" size={18} />
                  Đang xác thực…
                </>
              ) : (
                `Đăng nhập với vai trò ${role === ROLES.STUDENT ? 'sinh viên' : 'giảng viên'}`
              )}
            </button>
          </form>

          <div className="demo-account">
            <div>
              <strong>Tài khoản demo cục bộ</strong>
              <span>{DEMO_ACCOUNTS[role].email}</span>
            </div>
            <button type="button" onClick={useDemoAccount}>
              Điền tài khoản mẫu
            </button>
          </div>
        </div>
      </section>
    </main>
  )
}
