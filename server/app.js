import { createServer } from 'node:http'
import {
  authenticateRequest,
  clearSessionCookie,
  createSession,
  createSessionCookie,
  destroySession,
  DUMMY_PASSWORD_HASH,
  getSessionToken,
  verifyPassword,
} from './auth.js'
import {
  ApiError,
  readJson,
  requireFields,
  requireRole,
  requireSameOrigin,
  sendJson,
  serializeError,
} from './http.js'
import { createRepositories } from './repositories.js'

const LOGIN_MAX_ATTEMPTS = 8
const LOGIN_WINDOW_MS = 15 * 60 * 1000

// Login throttling, keyed per client+email. In-memory is enough for a single-process
// deployment; a multi-instance rollout would need to move this into SQLite or a cache.
function createLoginThrottle() {
  const attempts = new Map()

  function prune(now) {
    for (const [key, entry] of attempts) {
      if (entry.resetAt <= now) attempts.delete(key)
    }
  }

  return {
    check(key) {
      const now = Date.now()
      prune(now)
      const entry = attempts.get(key)
      if (entry && entry.count >= LOGIN_MAX_ATTEMPTS) {
        const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
        throw new ApiError(
          429,
          'TOO_MANY_ATTEMPTS',
          `Bạn đã thử đăng nhập quá nhiều lần. Vui lòng chờ ${retryAfter} giây.`,
          true,
        )
      }
    },
    fail(key) {
      const now = Date.now()
      const entry = attempts.get(key)
      if (entry && entry.resetAt > now) entry.count += 1
      else attempts.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS })
    },
    succeed(key) {
      attempts.delete(key)
    },
  }
}

function clientKey(request) {
  const forwarded = request.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.length) return forwarded.split(',')[0].trim()
  return request.socket?.remoteAddress ?? 'unknown'
}

const decode = (value) => decodeURIComponent(value)

function matchPath(pathname, pattern) {
  const match = pathname.match(pattern)
  if (!match) return null
  // A path segment with a broken escape sequence must be a client error, not a 500.
  try {
    return match.slice(1).map(decode)
  } catch {
    throw new ApiError(400, 'INVALID_PATH', 'Đường dẫn chứa ký tự không hợp lệ.')
  }
}

function sendData(response, data, status = 200, headers = {}) {
  // Repositories return null only when the requested record does not exist (or is not
  // visible to this caller). Answering 200 with `data: null` made every client hand-roll
  // its own not-found check, so translate it into a real 404 here.
  if (data === null || data === undefined) {
    sendJson(
      response,
      404,
      {
        error: { code: 'NOT_FOUND', message: 'Không tìm thấy dữ liệu yêu cầu.', retryable: false },
      },
      headers,
    )
    return
  }
  sendJson(response, status, { data }, headers)
}

export function createRequestHandler({ db, secureCookies = false, logger = console } = {}) {
  if (!db) throw new Error('createRequestHandler requires a database connection.')
  const repositories = createRepositories(db)
  const loginThrottle = createLoginThrottle()

  return async function handleRequest(request, response) {
    const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`)
    const { pathname, searchParams } = url
    const method = request.method ?? 'GET'

    try {
      requireSameOrigin(request)

      if (method === 'GET' && pathname === '/api/health') {
        sendData(response, { status: 'ok', database: 'connected' })
        return
      }

      if (method === 'POST' && pathname === '/api/auth/login') {
        const input = await readJson(request)
        requireFields(input, ['email', 'password'])
        const email = String(input.email).trim().toLowerCase()
        const throttleKey = `${clientKey(request)}|${email}`
        loginThrottle.check(throttleKey)

        const user = db
          .prepare(
            `SELECT id, name, email, role, password_hash
             FROM users
             WHERE lower(email) = ?`,
          )
          .get(email)

        // Always run a verification, even for an unknown email, so the response time does
        // not disclose whether the account exists.
        const passwordMatches = await verifyPassword(
          String(input.password),
          user?.password_hash ?? DUMMY_PASSWORD_HASH,
        )
        const credentialsValid = Boolean(user) && passwordMatches
        const roleValid = !input.role || input.role === user?.role
        if (!credentialsValid || !roleValid) {
          loginThrottle.fail(throttleKey)
          throw new ApiError(
            401,
            'INVALID_CREDENTIALS',
            'Email, mật khẩu hoặc vai trò không chính xác.',
          )
        }

        loginThrottle.succeed(throttleKey)
        const session = createSession(db, user.id)
        repositories.audit(db, user.id, 'auth.login', 'session', null, {
          role: user.role,
        })
        sendData(
          response,
          { id: user.id, name: user.name, email: user.email, role: user.role },
          200,
          { 'Set-Cookie': createSessionCookie(session.token, { secure: secureCookies }) },
        )
        return
      }

      const auth = authenticateRequest(db, request)

      if (method === 'GET' && pathname === '/api/auth/me') {
        const user = requireRole(auth, ['student', 'lecturer'])
        sendData(response, user)
        return
      }

      if (method === 'POST' && pathname === '/api/auth/logout') {
        if (auth) {
          repositories.audit(db, auth.user.id, 'auth.logout', 'session', auth.sessionId)
        }
        destroySession(db, getSessionToken(request))
        sendData(response, { success: true }, 200, {
          'Set-Cookie': clearSessionCookie({ secure: secureCookies }),
        })
        return
      }

      if (pathname.startsWith('/api/lecturer/')) {
        const lecturer = requireRole(auth, ['lecturer'])
        const classIdMatch = matchPath(pathname, /^\/api\/lecturer\/classes\/([^/]+)$/)
        const classStudentsMatch = matchPath(
          pathname,
          /^\/api\/lecturer\/classes\/([^/]+)\/students$/,
        )
        const classStudentMatch = matchPath(
          pathname,
          /^\/api\/lecturer\/classes\/([^/]+)\/students\/([^/]+)$/,
        )
        const classMetricsMatch = matchPath(
          pathname,
          /^\/api\/lecturer\/classes\/([^/]+)\/metrics$/,
        )
        const classLessonsMatch = matchPath(
          pathname,
          /^\/api\/lecturer\/classes\/([^/]+)\/lessons$/,
        )
        const availableLessonsMatch = matchPath(
          pathname,
          /^\/api\/lecturer\/classes\/([^/]+)\/lessons\/available$/,
        )
        const classLessonMatch = matchPath(
          pathname,
          /^\/api\/lecturer\/classes\/([^/]+)\/lessons\/([^/]+)$/,
        )
        const classMaterialsMatch = matchPath(
          pathname,
          /^\/api\/lecturer\/classes\/([^/]+)\/materials$/,
        )
        const availableMaterialsMatch = matchPath(
          pathname,
          /^\/api\/lecturer\/classes\/([^/]+)\/materials\/available$/,
        )
        const classMaterialMatch = matchPath(
          pathname,
          /^\/api\/lecturer\/classes\/([^/]+)\/materials\/([^/]+)$/,
        )
        const materialVersionMatch = matchPath(
          pathname,
          /^\/api\/lecturer\/materials\/([^/]+)\/versions$/,
        )
        const questionMatch = matchPath(pathname, /^\/api\/lecturer\/questions\/([^/]+)$/)
        const answerMatch = matchPath(pathname, /^\/api\/lecturer\/questions\/([^/]+)\/answer$/)
        const ragReviewMatch = matchPath(
          pathname,
          /^\/api\/lecturer\/rag\/responses\/([^/]+)\/review$/,
        )

        if (method === 'GET' && pathname === '/api/lecturer/classes') {
          sendData(response, repositories.classRepository.listForLecturer(lecturer.id))
          return
        }
        if (method === 'GET' && classIdMatch) {
          sendData(response, repositories.classRepository.getById(classIdMatch[0], lecturer.id))
          return
        }
        if (method === 'GET' && classStudentsMatch) {
          sendData(
            response,
            repositories.classRepository.listStudents(classStudentsMatch[0], lecturer.id, {
              query: searchParams.get('query') ?? '',
              status: searchParams.get('status') ?? 'all',
            }),
          )
          return
        }
        if (method === 'PATCH' && classStudentMatch) {
          const input = await readJson(request)
          requireFields(input, ['status'])
          sendData(
            response,
            repositories.classRepository.updateStudentStatus(
              classStudentMatch[0],
              classStudentMatch[1],
              input.status,
              lecturer.id,
            ),
          )
          return
        }
        if (method === 'GET' && classMetricsMatch) {
          sendData(
            response,
            repositories.classRepository.getMetrics(classMetricsMatch[0], lecturer.id),
          )
          return
        }
        if (method === 'GET' && classLessonsMatch) {
          sendData(
            response,
            repositories.classContentRepository.listLessons(classLessonsMatch[0], lecturer.id),
          )
          return
        }
        if (method === 'GET' && availableLessonsMatch) {
          sendData(
            response,
            repositories.classContentRepository.listAvailableLessons(
              availableLessonsMatch[0],
              lecturer.id,
            ),
          )
          return
        }
        if (method === 'POST' && classLessonsMatch) {
          const input = await readJson(request)
          requireFields(input, ['lessonId', 'date'])
          sendData(
            response,
            repositories.classContentRepository.scheduleLesson(
              classLessonsMatch[0],
              input,
              lecturer.id,
            ),
            201,
          )
          return
        }
        if (method === 'PATCH' && classLessonMatch) {
          const input = await readJson(request)
          requireFields(input, ['status'])
          sendData(
            response,
            repositories.classContentRepository.updateLessonStatus(
              classLessonMatch[0],
              classLessonMatch[1],
              input.status,
              lecturer.id,
            ),
          )
          return
        }
        if (method === 'GET' && classMaterialsMatch) {
          sendData(
            response,
            repositories.classContentRepository.listMaterials(classMaterialsMatch[0], lecturer.id),
          )
          return
        }
        if (method === 'GET' && availableMaterialsMatch) {
          sendData(
            response,
            repositories.classContentRepository.listAvailableMaterials(
              availableMaterialsMatch[0],
              lecturer.id,
            ),
          )
          return
        }
        if (method === 'POST' && classMaterialsMatch) {
          const input = await readJson(request)
          requireFields(input, ['materialId'])
          sendData(
            response,
            repositories.classContentRepository.attachMaterial(
              classMaterialsMatch[0],
              input,
              lecturer.id,
            ),
            201,
          )
          return
        }
        if (method === 'PATCH' && classMaterialMatch) {
          const input = await readJson(request)
          requireFields(input, ['status'])
          sendData(
            response,
            repositories.classContentRepository.updateMaterialStatus(
              classMaterialMatch[0],
              classMaterialMatch[1],
              input.status,
              lecturer.id,
            ),
          )
          return
        }
        if (method === 'POST' && materialVersionMatch) {
          const input = await readJson(request)
          requireFields(input, ['year', 'fileUrl'])
          sendData(
            response,
            repositories.classContentRepository.addMaterialVersion(
              materialVersionMatch[0],
              input,
              lecturer.id,
            ),
            201,
          )
          return
        }
        if (method === 'GET' && pathname === '/api/lecturer/questions') {
          sendData(
            response,
            repositories.questionRepository.listForLecturer(lecturer.id, {
              classId: searchParams.get('classId') ?? '',
              subjectId: searchParams.get('subjectId') ?? '',
              status: searchParams.get('status') ?? 'all',
              query: searchParams.get('query') ?? '',
            }),
          )
          return
        }
        if (method === 'GET' && questionMatch) {
          sendData(
            response,
            repositories.questionRepository.getForLecturer(questionMatch[0], lecturer.id),
          )
          return
        }
        if (method === 'POST' && answerMatch) {
          const input = await readJson(request)
          requireFields(input, ['content'])
          sendData(
            response,
            repositories.questionRepository.answer(answerMatch[0], input, lecturer.id),
          )
          return
        }
        if (method === 'GET' && pathname === '/api/lecturer/rag/reviews') {
          sendData(
            response,
            repositories.ragRepository.listForReview(
              lecturer.id,
              searchParams.get('status') ?? 'pending_review',
              searchParams.get('priority') ?? 'attention',
            ),
          )
          return
        }
        if (method === 'POST' && ragReviewMatch) {
          const input = await readJson(request)
          requireFields(input, ['action'])
          sendData(
            response,
            repositories.ragRepository.review(ragReviewMatch[0], input, lecturer.id),
          )
          return
        }
        if (method === 'GET' && pathname === '/api/lecturer/audit-logs') {
          sendData(
            response,
            repositories.auditRepository.listForLecturer(lecturer.id, searchParams.get('limit')),
          )
          return
        }
      }

      if (pathname.startsWith('/api/student/')) {
        const student = requireRole(auth, ['student'])
        const subjectMatch = matchPath(pathname, /^\/api\/student\/subjects\/([^/]+)$/)
        const chapterLessonsMatch = matchPath(
          pathname,
          /^\/api\/student\/chapters\/([^/]+)\/lessons$/,
        )
        const lessonMatch = matchPath(pathname, /^\/api\/student\/lessons\/([^/]+)$/)
        const progressMatch = matchPath(pathname, /^\/api\/student\/lessons\/([^/]+)\/progress$/)
        const questionMatch = matchPath(pathname, /^\/api\/student\/questions\/([^/]+)$/)

        if (method === 'GET' && pathname === '/api/student/dashboard') {
          sendData(response, repositories.learningRepository.getDashboard(student.id))
          return
        }
        if (method === 'GET' && pathname === '/api/student/subjects') {
          sendData(response, repositories.learningRepository.listSubjectProgress(student.id))
          return
        }
        if (method === 'GET' && subjectMatch) {
          sendData(
            response,
            repositories.learningRepository.getSubjectOverview(student.id, subjectMatch[0]),
          )
          return
        }
        if (method === 'GET' && chapterLessonsMatch) {
          sendData(
            response,
            repositories.learningRepository.getChapterLessons(student.id, chapterLessonsMatch[0]),
          )
          return
        }
        if (method === 'GET' && lessonMatch) {
          sendData(
            response,
            repositories.learningRepository.getLessonForStudent(student.id, lessonMatch[0]),
          )
          return
        }
        if (method === 'PATCH' && progressMatch) {
          const input = await readJson(request)
          requireFields(input, ['progress'])
          sendData(
            response,
            repositories.learningRepository.updateProgress(
              student.id,
              progressMatch[0],
              input.progress,
            ),
          )
          return
        }
        if (method === 'GET' && pathname === '/api/student/questions') {
          sendData(response, repositories.questionRepository.listForStudent(student.id))
          return
        }
        if (method === 'POST' && pathname === '/api/student/questions') {
          const input = await readJson(request)
          requireFields(input, ['subjectId', 'content'])
          sendData(response, repositories.questionRepository.create(input, student.id), 201)
          return
        }
        if (method === 'POST' && pathname === '/api/student/chat') {
          const input = await readJson(request)
          requireFields(input, ['subjectId', 'content'])
          sendData(response, repositories.ragRepository.createDemoChat(input, student.id), 201)
          return
        }
        if (method === 'GET' && questionMatch) {
          sendData(
            response,
            repositories.questionRepository.getForStudent(questionMatch[0], student.id),
          )
          return
        }
        if (method === 'POST' && pathname === '/api/student/search') {
          const input = await readJson(request)
          requireFields(input, ['query'])
          sendData(response, repositories.searchRepository.search(input, student.id))
          return
        }
        if (method === 'GET' && pathname === '/api/student/search-history') {
          sendData(response, repositories.searchRepository.listHistory(student.id))
          return
        }
      }

      throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy API được yêu cầu.')
    } catch (error) {
      const result = serializeError(error)
      if (result.status >= 500) logger.error(error)
      sendJson(response, result.status, result.payload)
    }
  }
}

export function createApiServer(options) {
  return createServer(createRequestHandler(options))
}
