import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './layouts/Layout';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import ProtectedRoute from './components/ProtectedRoute';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import { Toaster } from 'react-hot-toast';

import MarkingWorkspace from './pages/examiner/MarkingWorkspace';
import ExaminerHome from './pages/examiner/ExaminerHome';
import IdentityCheckPage from './pages/examiner/IdentityCheck';
import ModerationQueue from './pages/moderator/ModerationQueue';
import ReviewSheet from './pages/moderator/ReviewSheet';

// Controller Pages
import LiveDashboard from './pages/controller/LiveDashboard';
import ExamSetup from './pages/controller/ExamSetup';
import SheetsManager from './pages/controller/SheetsManager';
import ExaminerAnalytics from './pages/controller/ExaminerAnalytics';
import AlertsPage from './pages/controller/AlertsPage';
import AuditLog from './pages/controller/AuditLog';
import ExportPage from './pages/controller/ExportPage';

function App() {
  return (
    <ThemeProvider>
      <Toaster position="top-center" reverseOrder={false} toastOptions={{ duration: 4000, style: { background: '#333', color: '#fff' } }} />
      <AuthProvider>
        <Router>
          <Layout>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<Login />} />
              
              {/* Examiner Routes */}
              <Route 
                path="/examiner" 
                element={
                  <ProtectedRoute allowedRoles={['examiner']}>
                    <ExaminerHome />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/examiner/identity" 
                element={
                  <ProtectedRoute allowedRoles={['examiner']}>
                    <IdentityCheckPage />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/examiner/mark/:sheetId" 
                element={
                  <ProtectedRoute allowedRoles={['examiner']} requireIdentity={true}>
                    <MarkingWorkspace />
                  </ProtectedRoute>
                } 
              />

              {/* Moderator Routes */}
              <Route 
                path="/moderator" 
                element={
                  <ProtectedRoute allowedRoles={['moderator']}>
                    <ModerationQueue />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/moderator/review/:sheetId" 
                element={
                  <ProtectedRoute allowedRoles={['moderator']}>
                    <ReviewSheet />
                  </ProtectedRoute>
                } 
              />

              {/* Controller Routes */}
              <Route 
                path="/controller" 
                element={
                  <ProtectedRoute allowedRoles={['controller']}>
                    <LiveDashboard />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/controller/exams" 
                element={
                  <ProtectedRoute allowedRoles={['controller']}>
                    <ExamSetup />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/controller/sheets" 
                element={
                  <ProtectedRoute allowedRoles={['controller']}>
                    <SheetsManager />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/controller/examiners" 
                element={
                  <ProtectedRoute allowedRoles={['controller']}>
                    <ExaminerAnalytics />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/controller/alerts" 
                element={
                  <ProtectedRoute allowedRoles={['controller']}>
                    <AlertsPage />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/controller/audit" 
                element={
                  <ProtectedRoute allowedRoles={['controller']}>
                    <AuditLog />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/controller/export" 
                element={
                  <ProtectedRoute allowedRoles={['controller']}>
                    <ExportPage />
                  </ProtectedRoute>
                } 
              />
            </Routes>
          </Layout>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
