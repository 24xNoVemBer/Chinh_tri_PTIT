import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import RoleGuard from './features/auth/RoleGuard'

const LecturerLayout = lazy(() => import('./layouts/LecturerLayout'))
const AdminLayout = lazy(() => import('./layouts/AdminLayout'))
const StudentLayout = lazy(() => import('./layouts/StudentLayout'))
const HomePage = lazy(() => import('./pages/common/HomePage'))
const RoleSelector = lazy(() => import('./pages/auth/RoleSelector'))
const NotFoundPage = lazy(() => import('./pages/common/NotFoundPage'))
const ClassPage = lazy(() => import('./pages/lecturer/ClassPage'))
const ClassesPage = lazy(() => import('./pages/lecturer/ClassesPage'))
const ClassStudentsPage = lazy(() => import('./pages/lecturer/ClassStudentsPage'))
const ClassContentPage = lazy(() => import('./pages/lecturer/ClassContentPage'))
const LecturerHome = lazy(() => import('./pages/lecturer/LecturerHome'))
const QuestionInboxPage = lazy(() => import('./pages/lecturer/QuestionInboxPage'))
const QuestionDetailPage = lazy(() => import('./pages/lecturer/QuestionDetailPage'))
const QuestionsPage = lazy(() => import('./pages/lecturer/QuestionsPage'))
const PracticeQuestionBankPage = lazy(() => import('./pages/lecturer/PracticeQuestionBankPage'))
const PracticeAnalyticsPage = lazy(() => import('./pages/lecturer/PracticeAnalyticsPage'))
const PracticeQuestionEditorPage = lazy(() => import('./pages/lecturer/PracticeQuestionEditorPage'))
const PracticeQuestionImportPage = lazy(() => import('./pages/lecturer/PracticeQuestionImportPage'))
const ReviewQueuePage = lazy(() => import('./pages/lecturer/ReviewQueuePage'))
const LessonPage = lazy(() => import('./pages/student/LessonPage'))
const NotificationsPage = lazy(() => import('./pages/student/NotificationsPage'))
const QnAPage = lazy(() => import('./pages/student/QnAPage'))
const QuestionHistoryPage = lazy(() => import('./pages/student/QuestionHistoryPage'))
const QuizPage = lazy(() => import('./pages/student/QuizPage'))
const SearchPage = lazy(() => import('./pages/student/SearchPage'))
const StudentHome = lazy(() => import('./pages/student/StudentHome'))
const ChatPage = lazy(() => import('./pages/student/ChatPage'))
const PracticePage = lazy(() => import('./pages/student/PracticePage'))
const StudentQuestionDetailPage = lazy(() => import('./pages/student/StudentQuestionDetailPage'))
const SubjectPage = lazy(() => import('./pages/student/SubjectPage'))
const SubjectsPage = lazy(() => import('./pages/student/SubjectsPage'))
const AdminOverviewPage = lazy(() => import('./pages/admin/AdminOverviewPage'))
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage'))
const AdminSubjectsPage = lazy(() => import('./pages/admin/AdminSubjectsPage'))
const AdminTermsPage = lazy(() => import('./pages/admin/AdminTermsPage'))
const AdminClassesPage = lazy(() => import('./pages/admin/AdminClassesPage'))
const AdminQuestionBankPage = lazy(() => import('./pages/admin/AdminQuestionBankPage'))
const AdminOperationsPage = lazy(() => import('./pages/admin/AdminOperationsPage'))

function LegacyStudentSubjectRedirect() {
  const { subjectId } = useParams()
  return <Navigate to={`/student/subjects/${subjectId}`} replace />
}

function LegacyLecturerClassRedirect() {
  const { classId } = useParams()
  return <Navigate to={`/lecturer/classes/${classId}`} replace />
}

function LegacyLecturerContentRedirect() {
  const { classId } = useParams()
  return <Navigate to={`/lecturer/classes/${classId}/content`} replace />
}

function RouteFallback() {
  return (
    <div className="route-loader" role="status">
      Đang tải giao diện…
    </div>
  )
}

export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<RoleSelector />} />

        <Route element={<RoleGuard role="student" />}>
          <Route path="/student" element={<StudentLayout />}>
            <Route index element={<StudentHome />} />
            <Route path="chat" element={<ChatPage />} />
            <Route path="practice" element={<PracticePage />} />
            <Route path="practice/:sessionId" element={<PracticePage />} />
            <Route path="subjects" element={<SubjectsPage />} />
            <Route path="subjects/:subjectId" element={<SubjectPage />} />
            <Route path="subjects/:subjectId/qna" element={<QnAPage />} />
            <Route path="lessons/:lessonId" element={<LessonPage />} />
            <Route path="search" element={<SearchPage />} />
            <Route path="questions" element={<QuestionHistoryPage />} />
            <Route path="questions/:questionId" element={<StudentQuestionDetailPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="quizzes/:quizId" element={<QuizPage />} />
          </Route>
        </Route>

        <Route element={<RoleGuard role="lecturer" />}>
          <Route path="/lecturer" element={<LecturerLayout />}>
            <Route index element={<LecturerHome />} />
            <Route path="classes" element={<ClassesPage />} />
            <Route path="classes/:classId" element={<ClassPage />} />
            <Route path="classes/:classId/students" element={<ClassStudentsPage />} />
            <Route path="classes/:classId/lessons" element={<LegacyLecturerContentRedirect />} />
            <Route path="classes/:classId/materials" element={<LegacyLecturerContentRedirect />} />
            <Route path="classes/:classId/questions" element={<QuestionsPage />} />
            <Route
              path="classes/:classId/practice-questions"
              element={<PracticeQuestionBankPage />}
            />
            <Route path="classes/:classId/analytics" element={<PracticeAnalyticsPage />} />
            <Route path="classes/:classId/content" element={<ClassContentPage />} />
            <Route path="practice-questions" element={<PracticeQuestionBankPage />} />
            <Route path="practice-analytics" element={<PracticeAnalyticsPage />} />
            <Route path="practice-questions/new" element={<PracticeQuestionEditorPage />} />
            <Route path="practice-questions/import" element={<PracticeQuestionImportPage />} />
            <Route
              path="practice-questions/:questionId/edit"
              element={<PracticeQuestionEditorPage />}
            />
            <Route path="questions" element={<QuestionInboxPage />} />
            <Route path="questions/:questionId" element={<QuestionDetailPage />} />
            <Route path="review-queue" element={<ReviewQueuePage />} />
          </Route>
        </Route>

        <Route element={<RoleGuard role="admin" />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminOverviewPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="subjects" element={<AdminSubjectsPage />} />
            <Route path="terms" element={<AdminTermsPage />} />
            <Route path="classes" element={<AdminClassesPage />} />
            <Route path="question-bank" element={<AdminQuestionBankPage />} />
            <Route path="analytics" element={<PracticeAnalyticsPage />} />
            <Route path="operations" element={<AdminOperationsPage />} />
          </Route>
        </Route>

        <Route path="/student/subject/:subjectId" element={<LegacyStudentSubjectRedirect />} />
        <Route path="/lecturer/class/:classId" element={<LegacyLecturerClassRedirect />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  )
}
