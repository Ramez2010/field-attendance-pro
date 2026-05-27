import { NavLink } from 'react-router-dom';

export function EmployeesUsersTabs() {
  return (
    <div className="section-tabs">
      <NavLink to="/employees" end className={({ isActive }) => `section-tab ${isActive ? 'active' : ''}`}>
        Employees
      </NavLink>
      <NavLink to="/users" className={({ isActive }) => `section-tab ${isActive ? 'active' : ''}`}>
        Users
      </NavLink>
    </div>
  );
}
