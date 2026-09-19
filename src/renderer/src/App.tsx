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
import { ReportTab } from './pages/Classes/ReportTab'
import { ClassSettingsTab } from './pages/Classes/ClassSettingsTab'
import { SettingsPage } from './pages/Settings/SettingsPage'
import { StudentReportPrintPage } from './pages/Print/StudentReportPrintPage'

function App(): React.JSX.Element {
  return (
    <Routes>
      <Route path="/print/student/:studentId/:classId" element={<StudentReportPrintPage />} />
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
          <Route path="report" element={<ReportTab />} />
          <Route path="settings" element={<ClassSettingsTab />} />
        </Route>
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  )
}

export default App
