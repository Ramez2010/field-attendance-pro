import { NavLink, Outlet } from 'react-router-dom';
import {
  Building2,
  ClipboardList,
  Gauge,
  LogOut,
  MapPin,
  RadioTower,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';

const links = [
  { to: '/', label: 'Overview', icon: Gauge },
  { to: '/company', label: 'Company', icon: Building2 },
  { to: '/employees', label: 'Employees', icon: Users },
  { to: '/sites', label: 'Sites', icon: MapPin },
  { to: '/rules', label: 'Rules', icon: Settings },
  { to: '/users', label: 'Users', icon: ShieldCheck },
  { to: '/monitoring', label: 'Monitoring', icon: RadioTower },
  { to: '/reports', label: 'Reports', icon: ClipboardList },
];

export function Layout() {
  const { profile, signOut } = useAuth();

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
        <Outlet />
      </main>
    </div>
  );
}
