import { createServer } from 'node:http'
import {
  authenticateRequestAsync,
  clearSessionCookie,
  createSessionAsync,
  createSessionCookie,
  DUMMY_PASSWORD_HASH,
  destroySessionAsync,
  getSessionToken,
  verifyPasswordAsync,
} from './auth.js'
import {
  createLoginRateLimiter,
  DEFAULT_AUTH_RATE_LIMIT_CONFIG,
  loginRateLimitHeaders,
} from './authRateLimit.js'
import { ApiError, readJson, requireFields, requireRole, sendJson, serializeError } from './http.js'
import { createAsyncRepositories } from './repositoriesAsync.js'
import { createLiveRagRepository } from './rag/liveRepository.js'
import { writeAudit } from './db/audit.js'

const decode = (value) => decodeURIComponent(value)

function matchPath(pathname, pattern) {
  const match = pathname.match(pattern)
  return match ? match.slice(1).map(decode) : null
}

function sendData(response, data, status = 200, headers = {}) {
  sendJson(response, status, { data }, headers)
}

export function createRequestHandler({
  db,
  secureCookies = false,
  logger = console,
  ragClient,
  allowDemoRag = true,
  authConfig = DEFAULT_AUTH_RATE_LIMIT_CONFIG,
  loginRateLimiter,
} = {}) {
  if (!db) throw new Error('createRequestHandler requires a database connection.')
  const authLimiter = loginRateLimiter ?? createLoginRateLimiter({ db, config: authConfig })
  const repositories = createAsyncRepositories(db)
  const liveRagRepository = ragClient
    ? createLiveRagRepository({
        db,
        ragClient,
        questionRepository: repositories.questionRepository,
      })
    : null

  return async function handleRequest(request, response) {
    const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`)
    const { pathname, searchParams } = url
    const method = request.method ?? 'GET'

    try {
      if (method === 'GET' && pathname === '/api/health') {
        sendData(response, { status: 'ok', database: 'connected' })
        return
      }

      if (method === 'GET' && pathname === '/api/ready') {
        const readiness = { status: 'ready', database: 'connected', rag: 'disabled' }
        try {
          await db.one('SELECT 1 AS ok')
          if (db.dialect === 'postgres') {
            await db.one('SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1')
          }
        } catch (error) {
          readiness.status = 'degraded'
          readiness.database = 'unavailable'
          logger.warn?.(error)
          sendData(response, readiness, 503)
          return
        }
        if (ragClient) {
          try {
            await ragClient.readiness()
            readiness.rag = 'ready'
          } catch (error) {
            readiness.status = 'degraded'
            readiness.rag = 'unavailable'
            logger.warn?.(error)
          }
        }
        sendData(response, readiness, readiness.status === 'ready' ? 200 : 503)
        return
      }

      if (method === 'POST' && pathname === '/api/auth/login') {
        const input = await readJson(request)
        requireFields(input, ['email', 'password'])
        const email = String(input.email).trim().toLowerCase()
        const clientAddress = authLimiter.clientAddress(request)
        const rateLimit = await authLimiter.consume(email, clientAddress)
        if (!rateLimit.allowed) {
          throw new ApiError(
            429,
            'AUTH_RATE_LIMITED',
            'Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau.',
            true,
            loginRateLimitHeaders(rateLimit),
          )
        }
        const user = await db.one(
          `SELECT id, name, email, role, status, password_hash
           FROM users
           WHERE lower(email) = ?`,
          [email],
        )

        const passwordMatches = await verifyPasswordAsync(
          String(input.password),
          user?.password_hash ?? DUMMY_PASSWORD_HASH,
        )
        const credentialsValid = Boolean(user) && user.status === 'active' && passwordMatches
        const roleValid = !input.role || input.role === user?.role
        if (!credentialsValid || !roleValid) {
          throw new ApiError(
            401,
            'INVALID_CREDENTIALS',
            'Email, mật khẩu hoặc vai trò không chính xác.',
          )
        }

        await authLimiter.reset(email, clientAddress)
        const session = await createSessionAsync(db, user.id)
        await writeAudit(db, user.id, 'auth.login', 'session', null, {
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

      const auth = await authenticateRequestAsync(db, request)

      if (method === 'GET' && pathname === '/api/auth/me') {
        const user = requireRole(auth, ['student', 'lecturer', 'admin'])
        sendData(response, user)
        return
      }

      if (method === 'POST' && pathname === '/api/auth/logout') {
        if (auth) {
          await writeAudit(db, auth.user.id, 'auth.logout', 'session', auth.sessionId)
        }
        await destroySessionAsync(db, getSessionToken(request))
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
        const practiceQuestionMatch = matchPath(
          pathname,
          /^\/api\/lecturer\/practice-questions\/([^/]+)$/,
        )
        const practiceQuestionPublishMatch = matchPath(
          pathname,
          /^\/api\/lecturer\/practice-questions\/([^/]+)\/publish$/,
        )
        const practiceQuestionArchiveMatch = matchPath(
          pathname,
          /^\/api\/lecturer\/practice-questions\/([^/]+)\/archive$/,
        )
        const practiceQuestionRestoreMatch = matchPath(
          pathname,
          /^\/api\/lecturer\/practice-questions\/([^/]+)\/restore$/,
        )
        const practiceQuestionDraftMatch = matchPath(
          pathname,
          /^\/api\/lecturer\/practice-questions\/([^/]+)\/draft$/,
        )

        if (method === 'GET' && pathname === '/api/lecturer/classes') {
          sendData(response, await repositories.classRepository.listForLecturer(lecturer.id))
          return
        }
        if (method === 'GET' && classIdMatch) {
          sendData(
            response,
            await repositories.classRepository.getById(classIdMatch[0], lecturer.id),
          )
          return
        }
        if (method === 'GET' && classStudentsMatch) {
          sendData(
            response,
            await repositories.classRepository.listStudents(classStudentsMatch[0], lecturer.id, {
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
            await repositories.classRepository.updateStudentStatus(
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
            await repositories.classRepository.getMetrics(classMetricsMatch[0], lecturer.id),
          )
          return
        }
        if (method === 'GET' && classLessonsMatch) {
          sendData(
            response,
            await repositories.classContentRepository.listLessons(
              classLessonsMatch[0],
              lecturer.id,
            ),
          )
          return
        }
        if (method === 'GET' && availableLessonsMatch) {
          sendData(
            response,
            await repositories.classContentRepository.listAvailableLessons(
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
            await repositories.classContentRepository.scheduleLesson(
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
            await repositories.classContentRepository.updateLessonStatus(
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
            await repositories.classContentRepository.listMaterials(
              classMaterialsMatch[0],
              lecturer.id,
            ),
          )
          return
        }
        if (method === 'GET' && availableMaterialsMatch) {
          sendData(
            response,
            await repositories.classContentRepository.listAvailableMaterials(
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
            await repositories.classContentRepository.attachMaterial(
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
            await repositories.classContentRepository.updateMaterialStatus(
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
            await repositories.classContentRepository.addMaterialVersion(
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
            await repositories.questionRepository.listForLecturer(lecturer.id, {
              classId: searchParams.get('classId') ?? '',
              subjectId: searchParams.get('subjectId') ?? '',
              status: searchParams.get('status') ?? 'all',
              query: searchParams.get('query') ?? '',
            }),
          )
          return
        }
        if (method === 'GET' && pathname === '/api/lecturer/practice-questions') {
          sendData(
            response,
            await repositories.practiceQuestionRepository.listForLecturer(lecturer.id, {
              subjectId: searchParams.get('subjectId') ?? '',
              chapterId: searchParams.get('chapterId') ?? '',
              status: searchParams.get('status') ?? 'all',
              query: searchParams.get('query') ?? '',
              page: searchParams.get('page') ?? '1',
              pageSize: searchParams.get('pageSize') ?? '12',
            }),
          )
          return
        }
        if (method === 'GET' && pathname === '/api/lecturer/practice-analytics') {
          sendData(
            response,
            await repositories.practiceAnalyticsRepository.getForLecturer(lecturer.id, {
              classId: searchParams.get('classId') ?? '',
              subjectId: searchParams.get('subjectId') ?? '',
            }),
          )
          return
        }
        if (method === 'POST' && pathname === '/api/lecturer/practice-questions/import') {
          const input = await readJson(request)
          requireFields(input, ['subjectId', 'chapterId', 'questions'])
          sendData(
            response,
            await repositories.practiceQuestionRepository.importDrafts(input, lecturer.id),
            201,
          )
          return
        }
        if (method === 'POST' && pathname === '/api/lecturer/practice-questions') {
          const input = await readJson(request)
          requireFields(input, [
            'subjectId',
            'chapterId',
            'content',
            'explanation',
            'options',
            'correctOptionKey',
          ])
          sendData(
            response,
            await repositories.practiceQuestionRepository.create(input, lecturer.id),
            201,
          )
          return
        }
        if (method === 'GET' && practiceQuestionMatch) {
          sendData(
            response,
            await repositories.practiceQuestionRepository.getForLecturer(
              practiceQuestionMatch[0],
              lecturer.id,
            ),
          )
          return
        }
        if (method === 'PATCH' && practiceQuestionMatch) {
          const input = await readJson(request)
          requireFields(input, [
            'subjectId',
            'chapterId',
            'content',
            'explanation',
            'options',
            'correctOptionKey',
          ])
          sendData(
            response,
            await repositories.practiceQuestionRepository.update(
              practiceQuestionMatch[0],
              input,
              lecturer.id,
            ),
          )
          return
        }
        if (method === 'POST' && practiceQuestionPublishMatch) {
          sendData(
            response,
            await repositories.practiceQuestionRepository.publish(
              practiceQuestionPublishMatch[0],
              lecturer.id,
            ),
          )
          return
        }
        if (method === 'POST' && practiceQuestionArchiveMatch) {
          sendData(
            response,
            await repositories.practiceQuestionRepository.archive(
              practiceQuestionArchiveMatch[0],
              lecturer.id,
            ),
          )
          return
        }
        if (method === 'POST' && practiceQuestionRestoreMatch) {
          sendData(
            response,
            await repositories.practiceQuestionRepository.restore(
              practiceQuestionRestoreMatch[0],
              lecturer.id,
            ),
          )
          return
        }
        if (method === 'POST' && practiceQuestionDraftMatch) {
          sendData(
            response,
            await repositories.practiceQuestionRepository.saveDraft(
              practiceQuestionDraftMatch[0],
              lecturer.id,
            ),
          )
          return
        }
        if (method === 'DELETE' && practiceQuestionMatch) {
          sendData(
            response,
            await repositories.practiceQuestionRepository.remove(
              practiceQuestionMatch[0],
              lecturer.id,
            ),
          )
          return
        }
        if (method === 'GET' && questionMatch) {
          sendData(
            response,
            await repositories.questionRepository.getForLecturer(questionMatch[0], lecturer.id),
          )
          return
        }
        if (method === 'POST' && answerMatch) {
          const input = await readJson(request)
          requireFields(input, ['content'])
          sendData(
            response,
            await repositories.questionRepository.answer(answerMatch[0], input, lecturer.id),
          )
          return
        }
        if (method === 'GET' && pathname === '/api/lecturer/rag/reviews') {
          sendData(
            response,
            await repositories.ragRepository.listForReview(
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
            await repositories.ragRepository.review(ragReviewMatch[0], input, lecturer.id),
          )
          return
        }
        if (method === 'GET' && pathname === '/api/lecturer/audit-logs') {
          sendData(
            response,
            await repositories.auditRepository.listForLecturer(
              lecturer.id,
              searchParams.get('limit'),
            ),
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
        const practiceConfigMatch = matchPath(
          pathname,
          /^\/api\/student\/practice\/config\/([^/]+)$/,
        )
        const practiceSessionAnswersMatch = matchPath(
          pathname,
          /^\/api\/student\/practice-sessions\/([^/]+)\/answers$/,
        )
        const practiceSessionCompleteMatch = matchPath(
          pathname,
          /^\/api\/student\/practice-sessions\/([^/]+)\/complete$/,
        )
        const practiceSessionMatch = matchPath(
          pathname,
          /^\/api\/student\/practice-sessions\/([^/]+)$/,
        )

        if (method === 'GET' && pathname === '/api/student/dashboard') {
          sendData(response, await repositories.learningRepository.getDashboard(student.id))
          return
        }
        if (method === 'GET' && pathname === '/api/student/practice/overview') {
          sendData(response, await repositories.practiceSessionRepository.getOverview(student.id))
          return
        }
        if (method === 'GET' && pathname === '/api/student/practice/stats') {
          sendData(
            response,
            await repositories.practiceSessionRepository.getStats(student.id, {
              subjectId: searchParams.get('subjectId') ?? '',
              chapterId: searchParams.get('chapterId') ?? '',
            }),
          )
          return
        }
        if (method === 'GET' && pathname === '/api/student/subjects') {
          sendData(response, await repositories.learningRepository.listSubjectProgress(student.id))
          return
        }
        if (method === 'GET' && subjectMatch) {
          sendData(
            response,
            await repositories.learningRepository.getSubjectOverview(student.id, subjectMatch[0]),
          )
          return
        }
        if (method === 'GET' && chapterLessonsMatch) {
          sendData(
            response,
            await repositories.learningRepository.getChapterLessons(
              student.id,
              chapterLessonsMatch[0],
            ),
          )
          return
        }
        if (method === 'GET' && lessonMatch) {
          sendData(
            response,
            await repositories.learningRepository.getLessonForStudent(student.id, lessonMatch[0]),
          )
          return
        }
        if (method === 'PATCH' && progressMatch) {
          const input = await readJson(request)
          requireFields(input, ['progress'])
          sendData(
            response,
            await repositories.learningRepository.updateProgress(
              student.id,
              progressMatch[0],
              input.progress,
            ),
          )
          return
        }
        if (method === 'GET' && practiceConfigMatch) {
          sendData(
            response,
            await repositories.practiceSessionRepository.getConfig(
              student.id,
              practiceConfigMatch[0],
            ),
          )
          return
        }
        if (method === 'GET' && pathname === '/api/student/practice-sessions/history') {
          sendData(response, await repositories.practiceSessionRepository.listHistory(student.id))
          return
        }
        if (method === 'POST' && pathname === '/api/student/practice-sessions') {
          const input = await readJson(request)
          requireFields(input, ['subjectId'])
          sendData(
            response,
            await repositories.practiceSessionRepository.create(input, student.id),
            201,
          )
          return
        }
        if (method === 'GET' && practiceSessionMatch) {
          sendData(
            response,
            await repositories.practiceSessionRepository.get(practiceSessionMatch[0], student.id),
          )
          return
        }
        if (method === 'POST' && practiceSessionAnswersMatch) {
          const input = await readJson(request)
          requireFields(input, ['questionId', 'optionId'])
          sendData(
            response,
            await repositories.practiceSessionRepository.answer(
              practiceSessionAnswersMatch[0],
              input,
              student.id,
            ),
          )
          return
        }
        if (method === 'POST' && practiceSessionCompleteMatch) {
          sendData(
            response,
            await repositories.practiceSessionRepository.complete(
              practiceSessionCompleteMatch[0],
              student.id,
            ),
          )
          return
        }
        if (method === 'GET' && pathname === '/api/student/questions') {
          sendData(response, await repositories.questionRepository.listForStudent(student.id))
          return
        }
        if (method === 'POST' && pathname === '/api/student/questions') {
          const input = await readJson(request)
          requireFields(input, ['subjectId', 'content'])
          sendData(response, await repositories.questionRepository.create(input, student.id), 201)
          return
        }
        if (method === 'POST' && pathname === '/api/student/chat') {
          const input = await readJson(request)
          requireFields(input, ['subjectId', 'content'])
          if (!liveRagRepository && !allowDemoRag) {
            throw new ApiError(503, 'RAG_UNAVAILABLE', 'Trợ giảng AI hiện chưa được kết nối.')
          }
          const result = liveRagRepository
            ? await liveRagRepository.createChat(input, student.id)
            : await repositories.ragRepository.createDemoChat(input, student.id)
          sendData(response, result, 201)
          return
        }
        if (method === 'GET' && questionMatch) {
          sendData(
            response,
            await repositories.questionRepository.getForStudent(questionMatch[0], student.id),
          )
          return
        }
        if (method === 'POST' && pathname === '/api/student/search') {
          const input = await readJson(request)
          requireFields(input, ['query'])
          sendData(response, await repositories.searchRepository.search(input, student.id))
          return
        }
        if (method === 'GET' && pathname === '/api/student/search-history') {
          sendData(response, await repositories.searchRepository.listHistory(student.id))
          return
        }
      }

      throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy API được yêu cầu.')
    } catch (error) {
      const result = serializeError(error)
      if (result.status >= 500) logger.error(error)
      sendJson(response, result.status, result.payload, result.headers)
    }
  }
}

export function createApiServer(options) {
  return createServer(createRequestHandler(options))
}
