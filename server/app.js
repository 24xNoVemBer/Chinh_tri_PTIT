import { createServer } from 'node:http'
import {
  authenticateRequest,
  clearSessionCookie,
  createSession,
  createSessionCookie,
  destroySession,
  getSessionToken,
  verifyPassword,
} from './auth.js'
import { ApiError, readJson, requireFields, requireRole, sendJson, serializeError } from './http.js'
import { createRepositories } from './repositories.js'

const decode = (value) => decodeURIComponent(value)

function matchPath(pathname, pattern) {
  const match = pathname.match(pattern)
  return match ? match.slice(1).map(decode) : null
}

function sendData(response, data, status = 200, headers = {}) {
  sendJson(response, status, { data }, headers)
}

export function createRequestHandler({ db, secureCookies = false, logger = console } = {}) {
  if (!db) throw new Error('createRequestHandler requires a database connection.')
  const repositories = createRepositories(db)

  return async function handleRequest(request, response) {
    const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`)
    const { pathname, searchParams } = url
    const method = request.method ?? 'GET'

    try {
      if (method === 'GET' && pathname === '/api/health') {
        sendData(response, { status: 'ok', database: 'connected' })
        return
      }

      if (method === 'POST' && pathname === '/api/auth/login') {
        const input = await readJson(request)
        requireFields(input, ['email', 'password'])
        const email = String(input.email).trim().toLowerCase()
        const user = db
          .prepare(
            `SELECT id, name, email, role, password_hash
             FROM users
             WHERE lower(email) = ?`,
          )
          .get(email)

        const credentialsValid = user && verifyPassword(String(input.password), user.password_hash)
        const roleValid = !input.role || input.role === user?.role
        if (!credentialsValid || !roleValid) {
          throw new ApiError(
            401,
            'INVALID_CREDENTIALS',
            'Email, mật khẩu hoặc vai trò không chính xác.',
          )
        }

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
