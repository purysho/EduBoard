import { Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { DashboardPage } from './pages/Dashboard/DashboardPage'
import { StudentsListPage } from './pages/Students/StudentsListPage'
import { StudentProfilePage } from './pages/Students/StudentProfilePage'
import { ClassesListPage } from './pages/Classes/ClassesListPage'
import { ClassDetailLayout } from './pages/Classes/ClassDetailLayout'
import { RosterTab } from './pages/Classes/RosterTab'
import { GradebookTab } from './pages/Classes/GradebookTab'
import { AttendanceTab } from './pages/Classes/AttendanceTab'
import { LessonPlannerTab } from './pages/Classes/LessonPlannerTab'
import { SeatingChartTab } from './pages/Classes/SeatingChartTab'
import { ExitTicketTab } from './pages/Classes/ExitTicketTab'
import { ReportTab } from './pages/Classes/ReportTab'
import { ClassSettingsTab } from './pages/Classes/ClassSettingsTab'
import { SettingsPage } from './pages/Settings/SettingsPage'
import { StudentReportPrintPage } from './pages/Print/StudentReportPrintPage'
import { RubricsPage } from './pages/Rubrics/RubricsPage'
import { ResourcesPage } from './pages/Resources/ResourcesPage'
import { RubricBuilderPage } from './pages/Rubrics/RubricBuilderPage'
import { CommunicationsPage } from './pages/Communications/CommunicationsPage'
import { CompositeGradesPage } from './pages/CompositeGrades/CompositeGradesPage'
import { AnalyticsPage } from './pages/Analytics/AnalyticsPage'
import { TimetablePage } from './pages/Timetable/TimetablePage'
import { HomeworkTab } from './pages/Classes/HomeworkTab'
import { PortalTab } from './pages/Classes/PortalTab'
import { PortalInviteBatchPrintPage } from './pages/Print/PortalInviteBatchPrintPage'

function App(): React.JSX.Element {
  return (
    <Routes>
      <Route path="/print/student/:studentId/:classId" element={<StudentReportPrintPage />} />
      <Route path="/print/invite-batch/:batchId" element={<PortalInviteBatchPrintPage />} />
      <Route element={<AppShell />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/students" element={<StudentsListPage />} />
        <Route path="/students/:studentId" element={<StudentProfilePage />} />
        <Route path="/classes" element={<ClassesListPage />} />
        <Route path="/classes/:classId" element={<ClassDetailLayout />}>
          <Route index element={<RosterTab />} />
          <Route path="gradebook" element={<GradebookTab />} />
          <Route path="attendance" element={<AttendanceTab />} />
          <Route path="lessons" element={<LessonPlannerTab />} />
          <Route path="seating" element={<SeatingChartTab />} />
          <Route path="exit-ticket" element={<ExitTicketTab />} />
          <Route path="homework" element={<HomeworkTab />} />
          <Route path="portal" element={<PortalTab />} />
          <Route path="report" element={<ReportTab />} />
          <Route path="settings" element={<ClassSettingsTab />} />
        </Route>
        <Route path="/rubrics" element={<RubricsPage />} />
        <Route path="/rubrics/:rubricId" element={<RubricBuilderPage />} />
        <Route path="/resources" element={<ResourcesPage />} />
        <Route path="/communications" element={<CommunicationsPage />} />
        <Route path="/composite-grades" element={<CompositeGradesPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/timetable" element={<TimetablePage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  )
}

export default App
