import { FormEvent, useEffect, useMemo, useState } from 'react';

import { DataTable } from '../components/DataTable';
import { Field, SelectField, ToggleField } from '../components/FormField';
import { PageHeader } from '../components/PageHeader';
import { ErrorState, LoadingState } from '../components/State';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { AppRole, Employee, UserProfile } from '../lib/types';

type UserForm = {
  id?: string;
  email: string;
  password: string;
  role: AppRole;
  employee_id: string;
  is_active: boolean;
};

const emptyForm: UserForm = {
  email: '',
  password: '',
  role: 'employee',
  employee_id: '',
  is_active: true,
};

export function UsersPage() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const employeeOptions = useMemo(
    () => employees.map((employee) => ({ label: `${employee.employee_code} - ${employee.full_name}`, value: employee.id })),
    [employees],
  );

  const roleOptions = useMemo(() => {
    const roles: AppRole[] = profile?.role === 'super_admin' ? ['super_admin', 'company_admin', 'employee'] : ['company_admin', 'employee'];
    return roles.map((role) => ({ label: role.replace('_', ' '), value: role }));
  }, [profile]);

  async function load() {
    if (!profile) return;
    setLoading(true);
    setError(null);
    try {
      let usersQuery = supabase.from('users').select('*').order('created_at', { ascending: false });
      let employeesQuery = supabase.from('employees').select('*').eq('is_active', true).order('full_name');
      if (profile.role !== 'super_admin') {
        usersQuery = usersQuery.eq('company_id', profile.company_id);
        employeesQuery = employeesQuery.eq('company_id', profile.company_id);
      }
      const [usersResult, employeesResult] = await Promise.all([usersQuery, employeesQuery]);
      if (usersResult.error) throw usersResult.error;
      if (employeesResult.error) throw employeesResult.error;
      setUsers((usersResult.data ?? []) as UserProfile[]);
      setEmployees((employeesResult.data ?? []) as Employee[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [profile]);

  function edit(user: UserProfile) {
    setForm({
      id: user.id,
      email: user.email,
      password: '',
      role: user.role,
      employee_id: user.employee_id ?? '',
      is_active: user.is_active,
    });
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!profile) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const body = form.id
        ? {
            user_id: form.id,
            role: form.role,
            employee_id: form.employee_id || null,
            is_active: form.is_active,
          }
        : {
            email: form.email,
            password: form.password,
            role: form.role,
            company_id: profile.company_id,
            employee_id: form.employee_id || null,
            is_active: form.is_active,
          };

      const { error: invokeError } = await supabase.functions.invoke(form.id ? 'update-user' : 'create-user', { body });
      if (invokeError) throw invokeError;
      setMessage(form.id ? 'User updated.' : 'User created.');
      setForm(emptyForm);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save user');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(user: UserProfile) {
    const { error: invokeError } = await supabase.functions.invoke('update-user', {
      body: { user_id: user.id, is_active: !user.is_active },
    });
    if (invokeError) setError(invokeError.message);
    await load();
  }

  if (loading) return <LoadingState />;
  if (error && users.length === 0) return <ErrorState message={error} />;

  return (
    <>
      <PageHeader title="User Management" eyebrow="Credentials, roles, and access control" />
      <section className="split-grid">
        <div className="panel">
          <h2>{form.id ? 'Edit user' : 'Create login credentials'}</h2>
          <form onSubmit={save} className="form-stack">
            <Field label="Email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} disabled={Boolean(form.id)} required />
            {!form.id && <Field label="Temporary password" type="password" minLength={8} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required />}
            <SelectField label="Role" value={form.role} options={roleOptions} onChange={(event) => setForm({ ...form, role: event.target.value as AppRole })} />
            <SelectField label="Employee profile" value={form.employee_id} options={employeeOptions} onChange={(event) => setForm({ ...form, employee_id: event.target.value })} />
            <ToggleField label="Active user" checked={form.is_active} onChange={(value) => setForm({ ...form, is_active: value })} />
            {error && <div className="inline-error">{error}</div>}
            {message && <div className="inline-success">{message}</div>}
            <div className="button-row">
              <button className="primary-button" disabled={saving}>{saving ? 'Saving...' : 'Save user'}</button>
              {form.id && <button type="button" className="secondary-button" onClick={() => setForm(emptyForm)}>Cancel</button>}
            </div>
          </form>
        </div>
        <div className="panel wide">
          <h2>Users</h2>
          <DataTable
            rows={users}
            columns={[
              { header: 'Email', cell: (row) => row.email },
              { header: 'Role', cell: (row) => row.role.replace('_', ' ') },
              { header: 'Employee', cell: (row) => employees.find((employee) => employee.id === row.employee_id)?.full_name ?? '-' },
              { header: 'Status', cell: (row) => <span className={`pill ${row.is_active ? 'active' : 'inactive'}`}>{row.is_active ? 'active' : 'inactive'}</span> },
              {
                header: 'Actions',
                cell: (row) => (
                  <div className="table-actions">
                    <button className="link-button" onClick={() => edit(row)}>Edit</button>
                    <button className="link-button" onClick={() => toggleActive(row)}>{row.is_active ? 'Deactivate' : 'Activate'}</button>
                  </div>
                ),
              },
            ]}
          />
        </div>
      </section>
    </>
  );
}
