import { Navigate, Outlet, Route, Routes } from 'react-router-dom';

import { Layout } from './components/Layout';
import { LoadingState } from './components/State';
import { useAuth } from './context/AuthContext';
import { useLanguage } from './context/LanguageContext';
import { AttendanceRulesPage } from './pages/AttendanceRulesPage';
import { AttendanceHistoryPage } from './pages/AttendanceHistoryPage';
import { CompanySettingsPage } from './pages/CompanySettingsPage';
import { DashboardPage } from './pages/DashboardPage';
import { EmployeesPage } from './pages/EmployeesPage';
import { GeofenceConfigPage } from './pages/GeofenceConfigPage';
import { LoginPage } from './pages/LoginPage';
import { MonitoringPage } from './pages/MonitoringPage';
import { ReportsPage } from './pages/ReportsPage';
import { SitesPage } from './pages/SitesPage';
import { UsersPage } from './pages/UsersPage';

export function App() {
  const { session, profile, profileError, loading } = useAuth();
  const { t } = useLanguage();

  if (loading) return <LoadingState />;

  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route element={<ProtectedShell session={session} profile={profile} profileError={profileError} t={t} />}>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="company" element={<CompanySettingsPage />} />
          <Route path="employees" element={<EmployeesPage />} />
          <Route path="sites" element={<SitesPage />} />
          <Route path="geofence" element={<GeofenceConfigPage />} />
          <Route path="rules" element={<AttendanceRulesPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="monitoring" element={<MonitoringPage />} />
          <Route path="history" element={<AttendanceHistoryPage />} />
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
  t,
}: {
  session: unknown;
  profile: { role: string } | null;
  profileError: string | null;
  t: (key: string) => string;
}) {
  if (!session) return <Navigate to="/login" replace />;
  if (!profile && profileError) {
    return (
      <main className="login-page">
        <section className="login-card">
          <h1>{t('app.profileSetupRequired')}</h1>
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
          <h1>{t('app.adminAccessRequired')}</h1>
          <p>{t('app.adminAccessOnly')}</p>
        </section>
      </main>
    );
  }
  return <Outlet />;
}

