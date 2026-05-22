import { FormEvent, useEffect, useMemo, useState } from 'react';

import { DataTable } from '../components/DataTable';
import { Field, SelectField, ToggleField } from '../components/FormField';
import { PageHeader } from '../components/PageHeader';
import { ErrorState, LoadingState } from '../components/State';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Employee, Site } from '../lib/types';

type EmployeeForm = {
  id?: string;
  employee_code: string;
  full_name: string;
  phone: string;
  email: string;
  department: string;
  assigned_site_id: string;
  is_active: boolean;
};

const emptyForm: EmployeeForm = {
  employee_code: '',
  full_name: '',
  phone: '',
  email: '',
  department: '',
  assigned_site_id: '',
  is_active: true,
};

export function EmployeesPage() {
  const { profile } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [form, setForm] = useState<EmployeeForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const siteOptions = useMemo(() => sites.map((site) => ({ label: site.name, value: site.id })), [sites]);

  async function load() {
    if (!profile) return;
    setLoading(true);
    setError(null);
    try {
      let employeeQuery = supabase.from('employees').select('*').order('created_at', { ascending: false });
      let siteQuery = supabase.from('sites').select('*').eq('is_active', true).order('name');
      if (profile.role !== 'super_admin') {
        employeeQuery = employeeQuery.eq('company_id', profile.company_id);
        siteQuery = siteQuery.eq('company_id', profile.company_id);
      }
      const [employeeResult, siteResult] = await Promise.all([employeeQuery, siteQuery]);
      if (employeeResult.error) throw employeeResult.error;
      if (siteResult.error) throw siteResult.error;
      setEmployees((employeeResult.data ?? []) as Employee[]);
      setSites((siteResult.data ?? []) as Site[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load employees');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [profile]);

  function edit(employee: Employee) {
    setForm({
      id: employee.id,
      employee_code: employee.employee_code,
      full_name: employee.full_name,
      phone: employee.phone ?? '',
      email: employee.email ?? '',
      department: employee.department ?? '',
      assigned_site_id: employee.assigned_site_id ?? '',
      is_active: employee.is_active,
    });
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!profile) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const payload = {
        company_id: profile.company_id,
        employee_code: form.employee_code,
        full_name: form.full_name,
        phone: form.phone || null,
        email: form.email || null,
        department: form.department || null,
        assigned_site_id: form.assigned_site_id || null,
        is_active: form.is_active,
      };

      const { error: saveError } = form.id
        ? await supabase.from('employees').update(payload).eq('id', form.id)
        : await supabase.from('employees').insert(payload);
      if (saveError) throw saveError;
      setMessage(form.id ? 'Employee updated.' : 'Employee created.');
      setForm(emptyForm);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save employee');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(employee: Employee) {
    const { error: updateError } = await supabase.from('employees').update({ is_active: !employee.is_active }).eq('id', employee.id);
    if (updateError) setError(updateError.message);
    await load();
  }

  if (loading) return <LoadingState />;
  if (error && employees.length === 0) return <ErrorState message={error} />;

  return (
    <>
      <PageHeader title="Employee Management" eyebrow="Profiles and site assignment" />
      <section className="split-grid">
        <div className="panel">
          <h2>{form.id ? 'Edit employee' : 'Add employee'}</h2>
          <form onSubmit={save} className="form-stack">
            <Field label="Employee code" value={form.employee_code} onChange={(event) => setForm({ ...form, employee_code: event.target.value })} required />
            <Field label="Full name" value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} required />
            <Field label="Phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
            <Field label="Email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
            <Field label="Department" value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })} />
            <SelectField label="Assigned site" value={form.assigned_site_id} options={siteOptions} onChange={(event) => setForm({ ...form, assigned_site_id: event.target.value })} />
            <ToggleField label="Active employee" checked={form.is_active} onChange={(value) => setForm({ ...form, is_active: value })} />
            {error && <div className="inline-error">{error}</div>}
            {message && <div className="inline-success">{message}</div>}
            <div className="button-row">
              <button className="primary-button" disabled={saving}>{saving ? 'Saving...' : 'Save employee'}</button>
              {form.id && <button type="button" className="secondary-button" onClick={() => setForm(emptyForm)}>Cancel</button>}
            </div>
          </form>
        </div>
        <div className="panel wide">
          <h2>Employees</h2>
          <DataTable
            rows={employees}
            columns={[
              { header: 'Code', cell: (row) => row.employee_code },
              { header: 'Name', cell: (row) => row.full_name },
              { header: 'Department', cell: (row) => row.department ?? '-' },
              { header: 'Site', cell: (row) => sites.find((site) => site.id === row.assigned_site_id)?.name ?? '-' },
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
