import { NavLink } from 'react-router-dom';

export function SitesGeofenceTabs() {
  return (
    <div className="section-tabs">
      <NavLink to="/sites" end className={({ isActive }) => `section-tab ${isActive ? 'active' : ''}`}>
        Sites
      </NavLink>
      <NavLink to="/geofence" className={({ isActive }) => `section-tab ${isActive ? 'active' : ''}`}>
        Geofence policy
      </NavLink>
    </div>
  );
}
