import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Building2,
  ClipboardList,
  Gauge,
  History,
  LogOut,
  MapPin,
  RadioTower,
  Settings,
  Target,
  ShieldCheck,
  Users,
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { useCompanyScope } from '../context/CompanyScopeContext';
import { ErrorState, LoadingState } from './State';

const links = [
  { to: '/', label: 'Overview', icon: Gauge },
  { to: '/company', label: 'Company', icon: Building2 },
  { to: '/employees', label: 'Employees', icon: Users },
  { to: '/sites', label: 'Sites', icon: MapPin },
  { to: '/geofence', label: 'Geofence', icon: Target },
  { to: '/rules', label: 'Rules', icon: Settings },
  { to: '/users', label: 'Users', icon: ShieldCheck },
  { to: '/monitoring', label: 'Monitoring', icon: RadioTower },
  { to: '/history', label: 'History', icon: History },
  { to: '/reports', label: 'Reports', icon: ClipboardList },
];

export function Layout() {
  const { profile, signOut } = useAuth();
  const { companies, selectedCompanyId, selectedCompany, loading, error, setSelectedCompanyId } = useCompanyScope();
  const location = useLocation();
  const canManageCompanies = location.pathname === '/company';

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">FA</div>
          <div>
            <strong>Field Attendance Pro</strong>
            <span>Admin Dashboard</span>
          </div>
        </div>
        {profile?.role === 'super_admin' && (
          <label className="scope-selector">
            <span>Active company</span>
            <select value={selectedCompanyId} onChange={(event) => setSelectedCompanyId(event.target.value)}>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>{company.name}</option>
              ))}
            </select>
          </label>
        )}
        <nav className="nav-list">
          {links.map((link) => {
            const Icon = link.icon;
            return (
              <NavLink key={link.to} to={link.to} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} end={link.to === '/'}>
                <Icon size={18} />
                {link.label}
              </NavLink>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <span>{profile?.email}</span>
          <button className="ghost-button" onClick={signOut}>
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>
      <main className="main-panel">
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} />
        ) : !selectedCompany && !canManageCompanies ? (
          <ErrorState message="Create or select a company before using the dashboard." />
        ) : (
          <Outlet />
        )}
      </main>
    </div>
  );
}
