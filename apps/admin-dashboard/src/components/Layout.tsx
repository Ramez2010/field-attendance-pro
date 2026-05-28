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
  Users,
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { useCompanyScope } from '../context/CompanyScopeContext';
import { useLanguage } from '../context/LanguageContext';
import { ErrorState, LoadingState } from './State';

const links = [
  { to: '/', labelKey: 'layout.overview', icon: Gauge },
  { to: '/company', labelKey: 'layout.company', icon: Building2 },
  { to: '/employees', labelKey: 'layout.employeesUsers', icon: Users, aliases: ['/users'] },
  { to: '/sites', labelKey: 'layout.sitesGeofence', icon: MapPin, aliases: ['/geofence'] },
  { to: '/rules', labelKey: 'layout.rules', icon: Settings },
  { to: '/monitoring', labelKey: 'layout.monitoring', icon: RadioTower },
  { to: '/history', labelKey: 'layout.history', icon: History },
  { to: '/reports', labelKey: 'layout.reports', icon: ClipboardList },
];

export function Layout() {
  const { profile, signOut } = useAuth();
  const { companies, selectedCompanyId, selectedCompany, loading, error, setSelectedCompanyId } = useCompanyScope();
  const { language, setLanguage, t } = useLanguage();
  const location = useLocation();
  const canManageCompanies = location.pathname === '/company';

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">FA</div>
          <div>
            <strong>Field Attendance Pro</strong>
            <span>{t('layout.brandSubtitle')}</span>
          </div>
        </div>
        <label className="scope-selector">
          <span>{t('layout.language')}</span>
          <select value={language} onChange={(event) => setLanguage(event.target.value === 'ar' ? 'ar' : 'en')}>
            <option value="en">{t('language.english')}</option>
            <option value="ar">{t('language.arabic')}</option>
          </select>
        </label>
        {profile?.role === 'super_admin' && (
          <label className="scope-selector">
            <span>{t('layout.activeCompany')}</span>
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
            const aliasActive =
              Array.isArray((link as { aliases?: string[] }).aliases)
              && (link as { aliases?: string[] }).aliases?.some((alias) => location.pathname === alias || location.pathname.startsWith(`${alias}/`));
            return (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) => `nav-link ${isActive || aliasActive ? 'active' : ''}`}
                end={link.to === '/'}
              >
                <Icon size={18} />
                {t(link.labelKey)}
              </NavLink>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <span>{profile?.email}</span>
          <button className="ghost-button" onClick={signOut}>
            <LogOut size={16} /> {t('layout.signOut')}
          </button>
        </div>
      </aside>
      <main className="main-panel">
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} />
        ) : !selectedCompany && !canManageCompanies ? (
          <ErrorState message={t('app.selectCompanyFirst')} />
        ) : (
          <Outlet />
        )}
      </main>
    </div>
  );
}
