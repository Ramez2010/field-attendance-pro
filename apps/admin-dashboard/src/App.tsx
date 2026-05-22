import { Navigate, Outlet, Route, Routes } from 'react-router-dom';

import { Layout } from './components/Layout';
import { LoadingState } from './components/State';
import { useAuth } from './context/AuthContext';
import { AttendanceRulesPage } from './pages/AttendanceRulesPage';
import { CompanySettingsPage } from './pages/CompanySettingsPage';
import { DashboardPage } from './pages/DashboardPage';
import { EmployeesPage } from './pages/EmployeesPage';
import { LoginPage } from './pages/LoginPage';
import { MonitoringPage } from './pages/MonitoringPage';
import { ReportsPage } from './pages/ReportsPage';
import { SitesPage } from './pages/SitesPage';
import { UsersPage } from './pages/UsersPage';

export function App() {
  const { session, profile, profileError, loading } = useAuth();

  if (loading) return <LoadingState />;

  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route element={<ProtectedShell session={session} profile={profile} profileError={profileError} />}>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="company" element={<CompanySettingsPage />} />
          <Route path="employees" element={<EmployeesPage />} />
          <Route path="sites" element={<SitesPage />} />
          <Route path="rules" element={<AttendanceRulesPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="monitoring" element={<MonitoringPage />} />
          <Route path="reports" element={<ReportsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function ProtectedShell({
  session,
  profile,
  profileError,
}: {
  session: unknown;
  profile: { role: string } | null;
  profileError: string | null;
}) {
  if (!session) return <Navigate to="/login" replace />;
  if (!profile && profileError) {
    return (
      <main className="login-page">
        <section className="login-card">
          <h1>Profile setup required</h1>
          <p>{profileError}</p>
        </section>
      </main>
    );
  }
  if (!profile) return <LoadingState />;
  if (profile.role === 'employee') {
    return (
      <main className="login-page">
        <section className="login-card">
          <h1>Admin access required</h1>
          <p>This dashboard is only available to super admins and company admins.</p>
        </section>
      </main>
    );
  }
  return <Outlet />;
}

