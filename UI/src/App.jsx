import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardPage from './pages/DashboardPage';
import LoginPage from './pages/LoginPage';
import AdminManagementPage from './pages/AdminManagementPage';
import AttendancePage from './pages/AttendancePage';

function ForbiddenPage() {
  return (
    <main className="message-page">
      <p className="eyebrow">ACCESS DENIED</p>
      <h1>You don’t have permission to view this page.</h1>
      <p className="muted">If you think this is a mistake, contact your administrator.</p>
    </main>
  );
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/attendance" element={<AttendancePage />} />
      </Route>
      <Route element={<ProtectedRoute allowedRoles={['superadmin']} />}>
        <Route path="/manage" element={<AdminManagementPage />} />
      </Route>
      <Route path="/forbidden" element={<ForbiddenPage />} />
      <Route path="*" element={<Navigate to={user ? '/' : '/login'} replace />} />
    </Routes>
  );
}

export default function App() {
  return <AppRoutes />;
}
