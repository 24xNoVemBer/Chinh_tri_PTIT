import {
  ArrowLeft,
  BookOpenCheck,
  Eye,
  EyeOff,
  GraduationCap,
  LoaderCircle,
  ShieldCheck,
} from 'lucide-react'
import { useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../features/auth/useAuth'
import './RoleSelector.css'

const DEMO_ACCOUNTS = [
  {
    label: 'Dùng tài khoản sinh viên',
    description: 'Nguyễn Tuấn Anh',
    email: 'tuananh@ptit.edu.vn',
    password: 'Student@123',
    icon: BookOpenCheck,
  },
  {
    label: 'Dùng tài khoản giảng viên',
    description: 'TS. Đào Đức Tú',
    email: 'ductu@ptit.edu.vn',
    password: 'Lecturer@123',
    icon: GraduationCap,
  },
]

function validate(values) {
  const nextErrors = {}
  if (!values.email.trim()) nextErrors.email = 'Vui lòng nhập email PTIT.'
  else if (!/^\S+@\S+\.\S+$/.test(values.email)) nextErrors.email = 'Email chưa đúng định dạng.'
  if (!values.password) nextErrors.password = 'Vui lòng nhập mật khẩu.'
  return nextErrors
}

function getDestination(user, requestedPath) {
  return requestedPath?.startsWith(`/${user.role}`) ? requestedPath : `/${user.role}`
}

export default function RoleSelector() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isLoading, login, user } = useAuth()
  const [values, setValues] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [serverError, setServerError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const emailRef = useRef(null)
  const passwordRef = useRef(null)

  if (!isLoading && user) {
    return <Navigate to={getDestination(user, location.state?.from)} replace />
  }

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

  const fillDemoAccount = (account) => {
    setValues({ email: account.email, password: account.password })
    setErrors({})
    setTouched({})
    setServerError('')
    emailRef.current?.focus()
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
      const authenticatedUser = await login(values)
      navigate(getDestination(authenticatedUser, location.state?.from), { replace: true })
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
          <Link className="role-selector-brand" to="/">
            <span>PTIT</span> Chính Trị
          </Link>
          <div className="role-selector-intro__copy">
            <p className="role-selector-kicker">Một tài khoản, đúng không gian</p>
            <h1 id="login-title" className="role-selector-title">
              Đăng nhập rồi bắt đầu đúng vai trò của bạn.
            </h1>
            <p className="role-selector-subtitle">
              Hệ thống tự nhận diện tài khoản sinh viên hoặc giảng viên và chuyển bạn đến đúng luồng
              làm việc.
            </p>
          </div>
          <div className="role-selector-trust">
            <ShieldCheck aria-hidden="true" size={20} />
            <span>
              Quyền truy cập được lấy từ tài khoản, không phụ thuộc vào lựa chọn trên giao diện.
            </span>
          </div>
        </div>

        <div className="login-panel">
          <Link className="login-panel__back" to="/">
            <ArrowLeft aria-hidden="true" size={16} />
            Trang giới thiệu
          </Link>

          <div className="login-panel__header">
            <h2>Đăng nhập PTIT</h2>
            <p>Dùng email và mật khẩu của bạn. Hệ thống sẽ tự mở đúng không gian.</p>
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
                required
                placeholder="tenban@ptit.edu.vn"
                value={values.email}
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? 'login-email-error' : 'login-email-hint'}
                onBlur={handleBlur}
                onChange={updateField}
              />
              {errors.email ? (
                <span className="form-field__error" id="login-email-error" role="alert">
                  {errors.email}
                </span>
              ) : (
                <span className="form-field__hint" id="login-email-hint">
                  Tài khoản sẽ quyết định quyền sinh viên hoặc giảng viên.
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
                  required
                  value={values.password}
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={
                    errors.password ? 'login-password-error' : 'login-password-hint'
                  }
                  onBlur={handleBlur}
                  onChange={updateField}
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                </button>
              </div>
              {errors.password ? (
                <span className="form-field__error" id="login-password-error" role="alert">
                  {errors.password}
                </span>
              ) : (
                <span className="form-field__hint" id="login-password-hint">
                  Nhập mật khẩu của tài khoản PTIT.
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
                'Đăng nhập'
              )}
            </button>
          </form>

          <section className="demo-accounts" aria-labelledby="demo-accounts-title">
            <div>
              <h3 id="demo-accounts-title">Tài khoản demo</h3>
              <p>
                Chọn một tài khoản mẫu để điền thông tin. Vai trò vẫn được xác định sau đăng nhập.
              </p>
            </div>
            <div className="demo-accounts__grid">
              {DEMO_ACCOUNTS.map((account) => {
                const Icon = account.icon
                return (
                  <button
                    key={account.email}
                    type="button"
                    onClick={() => fillDemoAccount(account)}
                  >
                    <Icon aria-hidden="true" size={18} />
                    <span>
                      <strong>{account.label}</strong>
                      <small>{account.description}</small>
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        </div>
      </section>
    </main>
  )
}
