import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';

import { DataTable } from '../components/DataTable';
import { Field, SelectField, ToggleField } from '../components/FormField';
import { PageHeader } from '../components/PageHeader';
import { ErrorState, LoadingState } from '../components/State';
import { useAuth } from '../context/AuthContext';
import { useCompanyScope } from '../context/CompanyScopeContext';
import { getUserErrorMessage } from '../lib/errors';
import { exportExcel, getSpreadsheetValue, importSpreadsheetRows } from '../lib/export';
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

const userImportHeaders = ['email', 'temporary_password', 'role', 'employee_code', 'is_active'];

export function UsersPage() {
  const { profile } = useAuth();
  const { selectedCompanyId, selectedCompany } = useCompanyScope();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const employeeOptions = useMemo(
    () => employees
      .map((employee) => ({ label: `${employee.employee_code} - ${employee.full_name}`, value: employee.id })),
    [employees],
  );

  const roleOptions = useMemo(() => {
    const roles: AppRole[] = profile?.role === 'super_admin' ? ['super_admin', 'company_admin', 'employee'] : ['company_admin', 'employee'];
    return roles.map((role) => ({ label: role.replace('_', ' '), value: role }));
  }, [profile]);

  async function load() {
    if (!profile || !selectedCompanyId) return;
    setLoading(true);
    setError(null);
    try {
      const usersQuery = supabase.from('users').select('*').eq('company_id', selectedCompanyId).order('created_at', { ascending: false });
      const employeesQuery = supabase.from('employees').select('*').eq('company_id', selectedCompanyId).eq('is_active', true).order('full_name');
      const [usersResult, employeesResult] = await Promise.all([usersQuery, employeesQuery]);
      if (usersResult.error) throw usersResult.error;
      if (employeesResult.error) throw employeesResult.error;
      setUsers((usersResult.data ?? []) as UserProfile[]);
      setEmployees((employeesResult.data ?? []) as Employee[]);
    } catch (err) {
      setError(await getUserErrorMessage(err, 'Failed to load users'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setForm(emptyForm);
    setMessage(null);
    load();
  }, [profile, selectedCompanyId]);

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
    if (!profile || !selectedCompanyId) return;
    if (form.role === 'employee' && !form.employee_id) {
      setError('Select an employee profile when role is Employee.');
      return;
    }
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
            company_id: selectedCompanyId,
            employee_id: form.employee_id || null,
            is_active: form.is_active,
          };

      const { error: invokeError } = await supabase.functions.invoke(form.id ? 'update-user' : 'create-user', { body });
      if (invokeError) throw invokeError;
      setMessage(form.id ? 'User updated.' : 'User created.');
      setForm(emptyForm);
      await load();
    } catch (err) {
      setError(await getUserErrorMessage(err, 'Failed to save user'));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(user: UserProfile) {
    setError(null);
    try {
      const { error: invokeError } = await supabase.functions.invoke('update-user', {
        body: { user_id: user.id, is_active: !user.is_active },
      });
      if (invokeError) throw invokeError;
      await load();
    } catch (err) {
      setError(await getUserErrorMessage(err, 'Failed to update user'));
    }
  }

  function exportUsers() {
    exportExcel(
      users.map((user) => ({
        email: user.email,
        temporary_password: '',
        role: user.role,
        employee_code: employees.find((employee) => employee.id === user.employee_id)?.employee_code ?? '',
        is_active: user.is_active ? 'true' : 'false',
      })),
      `${selectedCompany?.name ?? 'company'}-users`,
      userImportHeaders,
    );
  }

  async function importUsers(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !selectedCompanyId) return;

    setImporting(true);
    setError(null);
    setMessage(null);
    try {
      const rows = await importSpreadsheetRows(file);
      if (rows.length === 0) throw new Error('The file has no user rows.');

      const employeesByCode = new Map(employees.map((employee) => [employee.employee_code.trim().toLowerCase(), employee.id]));
      let createdCount = 0;

      for (const [index, row] of rows.entries()) {
        const email = getSpreadsheetValue(row, ['email']).toLowerCase();
        const password = getSpreadsheetValue(row, ['temporary_password', 'password']);
        const role = normalizeRole(getSpreadsheetValue(row, ['role']));
        const employeeCode = getSpreadsheetValue(row, ['employee_code', 'employee']);
        const employeeId = employeeCode ? employeesByCode.get(employeeCode.trim().toLowerCase()) : null;

        if (!email) throw new Error(`Row ${index + 2}: email is required.`);
        if (!password || password.length < 8) throw new Error(`Row ${index + 2}: temporary_password must be at least 8 characters.`);
        if (!role) throw new Error(`Row ${index + 2}: role must be super_admin, company_admin, or employee.`);
        if (role === 'employee' && !employeeId) throw new Error(`Row ${index + 2}: employee users require a valid employee_code.`);

        const { error: invokeError } = await supabase.functions.invoke('create-user', {
          body: {
            email,
            password,
            role,
            company_id: selectedCompanyId,
            employee_id: employeeId,
            is_active: parseBoolean(getSpreadsheetValue(row, ['is_active', 'active']), true),
          },
        });

        if (invokeError) {
          const rowMessage = await getUserErrorMessage(invokeError, 'Failed to create user');
          throw new Error(`Row ${index + 2}: ${rowMessage}`);
        }
        createdCount += 1;
      }

      setMessage(`Imported ${createdCount} users.`);
      await load();
    } catch (err) {
      setError(await getUserErrorMessage(err, 'Failed to import users'));
    } finally {
      setImporting(false);
    }
  }

  if (loading) return <LoadingState />;
  if (error && users.length === 0) return <ErrorState message={error} />;

  return (
    <>
      <PageHeader
        title="User Management"
        eyebrow={selectedCompany ? `${selectedCompany.name} access control` : 'Credentials, roles, and access control'}
        actions={
          <div className="button-row">
            <button className="secondary-button" onClick={exportUsers}>Export Excel</button>
            <button className="secondary-button" onClick={() => exportExcel([], 'users-import-template', userImportHeaders)}>Template</button>
            <button className="secondary-button" onClick={() => importInputRef.current?.click()} disabled={importing}>{importing ? 'Importing...' : 'Import Excel'}</button>
            <input ref={importInputRef} className="hidden-file-input" type="file" accept=".xlsx,.xls,.csv" onChange={importUsers} />
          </div>
        }
      />
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

function parseBoolean(value: string, fallback: boolean) {
  if (!value) return fallback;
  return ['true', 'yes', '1', 'active'].includes(value.trim().toLowerCase());
}

function normalizeRole(value: string): AppRole | null {
  const normalized = value.trim().toLowerCase().replaceAll(' ', '_');
  if (normalized === 'super_admin' || normalized === 'company_admin' || normalized === 'employee') return normalized;
  return null;
}
