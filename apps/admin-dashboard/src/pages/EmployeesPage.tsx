import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';

import { DataTable } from '../components/DataTable';
import { Field, SelectField, ToggleField } from '../components/FormField';
import { PageHeader } from '../components/PageHeader';
import { ErrorState, LoadingState } from '../components/State';
import { useAuth } from '../context/AuthContext';
import { useCompanyScope } from '../context/CompanyScopeContext';
import { getFriendlyErrorMessage, getUserErrorMessage } from '../lib/errors';
import { exportExcel, getSpreadsheetValue, importSpreadsheetRows } from '../lib/export';
import { supabase } from '../lib/supabase';
import { AppRole, Employee, EmployeeSiteAssignment, Site, UserProfile } from '../lib/types';

type EmployeeForm = {
  id?: string;
  employee_code: string;
  full_name: string;
  phone: string;
  email: string;
  department: string;
  assigned_site_id: string;
  assigned_site_ids: string[];
  is_active: boolean;
  create_login_user: boolean;
  login_email: string;
  login_password: string;
  login_role: AppRole;
  login_is_active: boolean;
};

const emptyForm: EmployeeForm = {
  employee_code: '',
  full_name: '',
  phone: '',
  email: '',
  department: '',
  assigned_site_id: '',
  assigned_site_ids: [],
  is_active: true,
  create_login_user: false,
  login_email: '',
  login_password: '',
  login_role: 'employee',
  login_is_active: true,
};

const employeeImportHeaders = [
  'employee_code',
  'full_name',
  'phone',
  'email',
  'department',
  'assigned_sites',
  'assigned_site',
  'is_active',
];

export function EmployeesPage() {
  const { profile } = useAuth();
  const { selectedCompanyId, selectedCompany } = useCompanyScope();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [usersByEmployeeId, setUsersByEmployeeId] = useState<Record<string, UserProfile>>({});
  const [employeeSiteMap, setEmployeeSiteMap] = useState<Record<string, string[]>>({});
  const [employeePrimarySiteMap, setEmployeePrimarySiteMap] = useState<Record<string, string | null>>({});
  const [form, setForm] = useState<EmployeeForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const siteOptions = useMemo(
    () => sites.map((site) => ({ label: site.name, value: site.id })),
    [sites],
  );

  const selectedSiteOptions = useMemo(
    () => siteOptions.filter((option) => form.assigned_site_ids.includes(option.value)),
    [siteOptions, form.assigned_site_ids],
  );

  const loginRoleOptions = useMemo(
    () => [
      { label: 'employee', value: 'employee' },
      { label: 'company admin', value: 'company_admin' },
    ],
    [],
  );

  async function load() {
    if (!profile || !selectedCompanyId) return;
    setLoading(true);
    setError(null);
    try {
      const employeeQuery = supabase.from('employees').select('*').eq('company_id', selectedCompanyId).order('created_at', { ascending: false });
      const siteQuery = supabase.from('sites').select('*').eq('company_id', selectedCompanyId).eq('is_active', true).order('name');
      const assignmentsQuery = supabase
        .from('employee_site_assignments')
        .select('employee_id,site_id,is_primary,created_at');
      const usersQuery = supabase
        .from('users')
        .select('id,company_id,employee_id,role,email,is_active,created_at')
        .eq('company_id', selectedCompanyId);

      const [employeeResult, siteResult, assignmentsResult, usersResult] = await Promise.all([employeeQuery, siteQuery, assignmentsQuery, usersQuery]);
      if (employeeResult.error) throw employeeResult.error;
      if (siteResult.error) throw siteResult.error;
      if (assignmentsResult.error) throw assignmentsResult.error;
      if (usersResult.error) throw usersResult.error;

      const employeeRows = (employeeResult.data ?? []) as Employee[];
      const assignmentRows = (assignmentsResult.data ?? []) as EmployeeSiteAssignment[];

      const nextSiteMap: Record<string, string[]> = {};
      const nextPrimaryMap: Record<string, string | null> = {};
      for (const employee of employeeRows) {
        const list: string[] = [];
        if (employee.assigned_site_id) list.push(employee.assigned_site_id);
        nextSiteMap[employee.id] = list;
        nextPrimaryMap[employee.id] = employee.assigned_site_id;
      }

      for (const assignment of assignmentRows) {
        if (!nextSiteMap[assignment.employee_id]) {
          nextSiteMap[assignment.employee_id] = [];
        }
        if (!nextSiteMap[assignment.employee_id].includes(assignment.site_id)) {
          nextSiteMap[assignment.employee_id].push(assignment.site_id);
        }
        if (assignment.is_primary) {
          nextPrimaryMap[assignment.employee_id] = assignment.site_id;
        }
      }

      setEmployees(employeeRows);
      setSites((siteResult.data ?? []) as Site[]);
      setEmployeeSiteMap(nextSiteMap);
      setEmployeePrimarySiteMap(nextPrimaryMap);

      const nextUsersByEmployeeId: Record<string, UserProfile> = {};
      for (const user of (usersResult.data ?? []) as UserProfile[]) {
        if (user.employee_id && !nextUsersByEmployeeId[user.employee_id]) {
          nextUsersByEmployeeId[user.employee_id] = user;
        }
      }
      setUsersByEmployeeId(nextUsersByEmployeeId);
    } catch (err) {
      setError(await getFriendlyErrorMessage(err, 'Failed to load employees'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setForm(emptyForm);
    setMessage(null);
    void load();
  }, [profile, selectedCompanyId]);

  function edit(employee: Employee) {
    const assignedSiteIds = employeeSiteMap[employee.id]?.slice()
      ?? (employee.assigned_site_id ? [employee.assigned_site_id] : []);
    const primarySiteId = employeePrimarySiteMap[employee.id]
      ?? employee.assigned_site_id
      ?? assignedSiteIds[0]
      ?? '';
    const linkedUser = usersByEmployeeId[employee.id];

    setForm({
      id: employee.id,
      employee_code: employee.employee_code,
      full_name: employee.full_name,
      phone: employee.phone ?? '',
      email: employee.email ?? '',
      department: employee.department ?? '',
      assigned_site_id: primarySiteId,
      assigned_site_ids: assignedSiteIds,
      is_active: employee.is_active,
      create_login_user: false,
      login_email: linkedUser?.email ?? employee.email ?? '',
      login_password: '',
      login_role: linkedUser?.role ?? 'employee',
      login_is_active: linkedUser?.is_active ?? true,
    });
  }

  function toggleFormSite(siteId: string, checked: boolean) {
    setForm((prev) => {
      const nextAssignedIds = checked
        ? Array.from(new Set([...prev.assigned_site_ids, siteId]))
        : prev.assigned_site_ids.filter((id) => id !== siteId);

      let nextPrimary = prev.assigned_site_id;
      if (nextAssignedIds.length === 0) {
        nextPrimary = '';
      } else if (!nextAssignedIds.includes(nextPrimary)) {
        nextPrimary = nextAssignedIds[0];
      }

      return {
        ...prev,
        assigned_site_ids: nextAssignedIds,
        assigned_site_id: nextPrimary,
      };
    });
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!profile || !selectedCompanyId) return;

    const existingLinkedUser = form.id ? usersByEmployeeId[form.id] : null;
    if (form.create_login_user && existingLinkedUser) {
      setError('This employee already has a linked login user.');
      return;
    }

    if (form.create_login_user) {
      if (!form.login_email.trim()) {
        setError('Login email is required when creating a linked user.');
        return;
      }
      if (form.login_password.trim().length < 8) {
        setError('Temporary login password must be at least 8 characters.');
        return;
      }
    }

    if (existingLinkedUser && form.login_password.trim().length > 0 && form.login_password.trim().length < 8) {
      setError('New login password must be at least 8 characters.');
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const assignedSiteIds = Array.from(new Set(form.assigned_site_ids.filter(Boolean)));
      const primarySiteId = assignedSiteIds.includes(form.assigned_site_id)
        ? form.assigned_site_id
        : (assignedSiteIds[0] ?? null);

      const payload = {
        company_id: selectedCompanyId,
        employee_code: form.employee_code,
        full_name: form.full_name,
        phone: form.phone || null,
        email: form.email || null,
        department: form.department || null,
        assigned_site_id: primarySiteId,
        is_active: form.is_active,
      };

      const saveResult = form.id
        ? await supabase.from('employees').update(payload).eq('id', form.id).select('id').single()
        : await supabase.from('employees').insert(payload).select('id').single();
      if (saveResult.error) throw saveResult.error;

      const employeeId = String(saveResult.data.id);
      const { error: clearAssignmentsError } = await supabase
        .from('employee_site_assignments')
        .delete()
        .eq('employee_id', employeeId);
      if (clearAssignmentsError) throw clearAssignmentsError;

      if (assignedSiteIds.length > 0) {
        const assignmentRows = assignedSiteIds.map((siteId) => ({
          employee_id: employeeId,
          site_id: siteId,
          is_primary: siteId === primarySiteId,
        }));
        const { error: assignmentsUpsertError } = await supabase
          .from('employee_site_assignments')
          .upsert(assignmentRows, { onConflict: 'employee_id,site_id' });
        if (assignmentsUpsertError) throw assignmentsUpsertError;
      }

      let createdLinkedUser = false;
      let updatedLinkedUser = false;
      if (form.create_login_user) {
        const { error: createUserError } = await supabase.functions.invoke('create-user', {
          body: {
            email: form.login_email.trim().toLowerCase(),
            password: form.login_password.trim(),
            role: form.login_role,
            company_id: selectedCompanyId,
            employee_id: employeeId,
            is_active: form.login_is_active,
          },
        });

        if (createUserError) {
          const userMessage = await getUserErrorMessage(createUserError, 'Failed to create login user');
          throw new Error(`Employee saved, but login user was not created. ${userMessage}`);
        }

        createdLinkedUser = true;
      }
      else if (existingLinkedUser) {
        const nextPassword = form.login_password.trim();
        const loginChanged =
          form.login_role !== existingLinkedUser.role
          || form.login_is_active !== existingLinkedUser.is_active
          || nextPassword.length > 0;

        if (loginChanged) {
          const { error: updateUserError } = await supabase.functions.invoke('update-user', {
            body: {
              user_id: existingLinkedUser.id,
              role: form.login_role,
              employee_id: employeeId,
              is_active: form.login_is_active,
              ...(nextPassword ? { password: nextPassword } : {}),
            },
          });

          if (updateUserError) {
            const userMessage = await getUserErrorMessage(updateUserError, 'Failed to update linked login user');
            throw new Error(`Employee saved, but login user was not updated. ${userMessage}`);
          }

          updatedLinkedUser = true;
        }
      }

      setMessage(
        form.id
          ? (
            createdLinkedUser
              ? 'Employee updated and login user created.'
              : updatedLinkedUser
                ? 'Employee and login user updated.'
                : 'Employee updated.'
          )
          : (createdLinkedUser ? 'Employee and login user created.' : 'Employee created.'),
      );
      setForm(emptyForm);
      await load();
    } catch (err) {
      setError(await getFriendlyErrorMessage(err, 'Failed to save employee'));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(employee: Employee) {
    setError(null);
    try {
      const { error: updateError } = await supabase.from('employees').update({ is_active: !employee.is_active }).eq('id', employee.id);
      if (updateError) throw updateError;
      await load();
    } catch (err) {
      setError(await getFriendlyErrorMessage(err, 'Failed to update employee status'));
    }
  }

  function exportEmployees() {
    exportExcel(
      employees.map((employee) => {
        const assignedSiteIds = employeeSiteMap[employee.id] ?? (employee.assigned_site_id ? [employee.assigned_site_id] : []);
        const assignedSiteNames = assignedSiteIds
          .map((siteId) => sites.find((site) => site.id === siteId)?.name ?? siteId)
          .filter(Boolean);
        const primarySiteId = employeePrimarySiteMap[employee.id] ?? employee.assigned_site_id;
        const primarySiteName = primarySiteId ? (sites.find((site) => site.id === primarySiteId)?.name ?? primarySiteId) : '';

        return {
          employee_code: employee.employee_code,
          full_name: employee.full_name,
          phone: employee.phone ?? '',
          email: employee.email ?? '',
          department: employee.department ?? '',
          assigned_sites: assignedSiteNames.join(', '),
          assigned_site: primarySiteName,
          is_active: employee.is_active ? 'true' : 'false',
        };
      }),
      `${selectedCompany?.name ?? 'company'}-employees`,
      employeeImportHeaders,
    );
  }

  async function importEmployees(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !selectedCompanyId) return;

    setImporting(true);
    setError(null);
    setMessage(null);
    try {
      const rows = await importSpreadsheetRows(file);
      if (rows.length === 0) throw new Error('The file has no employee rows.');

      const sitesByName = new Map(sites.map((site) => [site.name.trim().toLowerCase(), site.id]));
      const sitesById = new Map(sites.map((site) => [site.id, site.id]));

      function resolveSiteId(raw: string): string | null {
        const value = raw.trim();
        if (!value) return null;
        return sitesById.get(value) ?? sitesByName.get(value.toLowerCase()) ?? null;
      }

      function resolveMultipleSites(raw: string): string[] {
        if (!raw.trim()) return [];
        const tokens = raw.split(/[;,|]/g).map((token) => token.trim()).filter(Boolean);
        const resolved = tokens.map((token) => ({ token, id: resolveSiteId(token) }));
        const failed = resolved.find((item) => item.id == null);
        if (failed) {
          throw new Error(`Site "${failed.token}" was not found in the selected company.`);
        }
        return Array.from(new Set(resolved.map((item) => item.id!)));
      }

      const parsedRows = rows.map((row, index) => {
        const employeeCode = getSpreadsheetValue(row, ['employee_code', 'code']);
        const fullName = getSpreadsheetValue(row, ['full_name', 'name']);
        if (!employeeCode || !fullName) {
          throw new Error(`Row ${index + 2}: employee_code and full_name are required.`);
        }

        const multiSitesRaw = getSpreadsheetValue(row, ['assigned_sites', 'sites']);
        const primarySiteRaw = getSpreadsheetValue(row, ['assigned_site', 'site', 'site_name', 'assigned_site_id']);

        let assignedSiteIds: string[];
        try {
          assignedSiteIds = resolveMultipleSites(multiSitesRaw);
        } catch (err) {
          throw new Error(`Row ${index + 2}: ${(err as Error).message}`);
        }

        const primarySiteId = resolveSiteId(primarySiteRaw);
        if (primarySiteRaw && !primarySiteId) {
          throw new Error(`Row ${index + 2}: assigned_site "${primarySiteRaw}" was not found in the selected company.`);
        }

        if (primarySiteId && !assignedSiteIds.includes(primarySiteId)) {
          assignedSiteIds = [primarySiteId, ...assignedSiteIds];
        }

        const normalizedPrimarySiteId = primarySiteId ?? assignedSiteIds[0] ?? null;

        return {
          employee_code: employeeCode,
          full_name: fullName,
          phone: getSpreadsheetValue(row, ['phone']) || null,
          email: getSpreadsheetValue(row, ['email']) || null,
          department: getSpreadsheetValue(row, ['department']) || null,
          assigned_site_id: normalizedPrimarySiteId,
          assigned_site_ids: assignedSiteIds,
          is_active: parseBoolean(getSpreadsheetValue(row, ['is_active', 'active']), true),
        };
      });

      const employeePayload = parsedRows.map((row) => ({
        company_id: selectedCompanyId,
        employee_code: row.employee_code,
        full_name: row.full_name,
        phone: row.phone,
        email: row.email,
        department: row.department,
        assigned_site_id: row.assigned_site_id,
        is_active: row.is_active,
      }));

      const { error: importError } = await supabase
        .from('employees')
        .upsert(employeePayload, { onConflict: 'company_id,employee_code' });
      if (importError) throw importError;

      const codes = parsedRows.map((row) => row.employee_code);
      const { data: importedEmployees, error: fetchImportedError } = await supabase
        .from('employees')
        .select('id,employee_code')
        .eq('company_id', selectedCompanyId)
        .in('employee_code', codes);
      if (fetchImportedError) throw fetchImportedError;

      const employeeIdByCode = new Map(
        (importedEmployees ?? []).map((row) => [String(row.employee_code), String(row.id)]),
      );

      const targetEmployeeIds = Array.from(employeeIdByCode.values());
      if (targetEmployeeIds.length > 0) {
        const { error: clearAssignmentsError } = await supabase
          .from('employee_site_assignments')
          .delete()
          .in('employee_id', targetEmployeeIds);
        if (clearAssignmentsError) throw clearAssignmentsError;

        const assignmentRows = parsedRows.flatMap((row) => {
          const employeeId = employeeIdByCode.get(row.employee_code);
          if (!employeeId) return [];
          return row.assigned_site_ids.map((siteId) => ({
            employee_id: employeeId,
            site_id: siteId,
            is_primary: siteId === row.assigned_site_id,
          }));
        });

        if (assignmentRows.length > 0) {
          const { error: insertAssignmentsError } = await supabase
            .from('employee_site_assignments')
            .upsert(assignmentRows, { onConflict: 'employee_id,site_id' });
          if (insertAssignmentsError) throw insertAssignmentsError;
        }
      }

      setMessage(`Imported ${parsedRows.length} employees.`);
      await load();
    } catch (err) {
      setError(await getFriendlyErrorMessage(err, 'Failed to import employees'));
    } finally {
      setImporting(false);
    }
  }

  if (loading) return <LoadingState />;
  if (error && employees.length === 0) return <ErrorState message={error} />;

  return (
    <>
      <PageHeader
        title="Employee Management"
        eyebrow={selectedCompany ? `${selectedCompany.name} profiles` : 'Profiles and site assignment'}
        actions={
          <div className="button-row">
            <button className="secondary-button" onClick={exportEmployees}>Export Excel</button>
            <button className="secondary-button" onClick={() => exportExcel([], 'employees-import-template', employeeImportHeaders)}>Template</button>
            <button className="secondary-button" onClick={() => importInputRef.current?.click()} disabled={importing}>{importing ? 'Importing...' : 'Import Excel'}</button>
            <input ref={importInputRef} className="hidden-file-input" type="file" accept=".xlsx,.xls,.csv" onChange={importEmployees} />
          </div>
        }
      />
      <section className="split-grid">
        <div className="panel">
          <h2>{form.id ? 'Edit employee' : 'Add employee'}</h2>
          <form onSubmit={save} className="form-stack">
            <Field label="Employee code" value={form.employee_code} onChange={(event) => setForm({ ...form, employee_code: event.target.value })} required />
            <Field label="Full name" value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} required />
            <Field label="Phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
            <Field label="Email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
            <Field label="Department" value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })} />
            <label className="field">
              <span>Assigned sites (multiple)</span>
              <div className="multi-checklist">
                {sites.length === 0 && <span className="muted-note">No active sites available.</span>}
                {sites.map((site) => (
                  <label key={site.id} className="multi-checklist-row">
                    <input
                      type="checkbox"
                      checked={form.assigned_site_ids.includes(site.id)}
                      onChange={(event) => toggleFormSite(site.id, event.target.checked)}
                    />
                    <span>{site.name}</span>
                  </label>
                ))}
              </div>
            </label>
            <SelectField
              label="Primary site"
              value={form.assigned_site_id}
              options={selectedSiteOptions}
              onChange={(event) => setForm((prev) => ({ ...prev, assigned_site_id: event.target.value }))}
            />
            <ToggleField label="Active employee" checked={form.is_active} onChange={(value) => setForm({ ...form, is_active: value })} />
            {form.id && usersByEmployeeId[form.id] && (
              <>
                <div className="inline-success">
                  Linked login user: {usersByEmployeeId[form.id].email}.
                </div>
                <SelectField
                  label="Linked user role"
                  value={form.login_role}
                  options={loginRoleOptions}
                  onChange={(event) => setForm((prev) => ({ ...prev, login_role: event.target.value as AppRole }))}
                />
                <ToggleField
                  label="Linked user active"
                  checked={form.login_is_active}
                  onChange={(value) => setForm((prev) => ({ ...prev, login_is_active: value }))}
                />
                <Field
                  label="Reset linked user password (optional)"
                  type="password"
                  minLength={8}
                  placeholder="Leave blank to keep current password"
                  value={form.login_password}
                  onChange={(event) => setForm((prev) => ({ ...prev, login_password: event.target.value }))}
                />
              </>
            )}
            {(!form.id || !usersByEmployeeId[form.id]) && (
              <>
                <ToggleField
                  label="Create linked login user"
                  checked={form.create_login_user}
                  onChange={(value) => setForm({ ...form, create_login_user: value })}
                />
                {form.create_login_user && (
                  <>
                    <Field
                      label="Login email"
                      type="email"
                      value={form.login_email}
                      onChange={(event) => setForm({ ...form, login_email: event.target.value })}
                      required
                    />
                    <Field
                      label="Temporary password"
                      type="password"
                      minLength={8}
                      value={form.login_password}
                      onChange={(event) => setForm({ ...form, login_password: event.target.value })}
                      required
                    />
                    <SelectField
                      label="Login role"
                      value={form.login_role}
                      options={loginRoleOptions}
                      onChange={(event) => setForm((prev) => ({ ...prev, login_role: event.target.value as AppRole }))}
                    />
                    <ToggleField
                      label="Active login user"
                      checked={form.login_is_active}
                      onChange={(value) => setForm({ ...form, login_is_active: value })}
                    />
                  </>
                )}
              </>
            )}
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
              { header: 'Login user', cell: (row) => usersByEmployeeId[row.id]?.email ?? '-' },
              {
                header: 'Sites',
                cell: (row) => {
                  const assignedSiteIds = employeeSiteMap[row.id] ?? (row.assigned_site_id ? [row.assigned_site_id] : []);
                  if (assignedSiteIds.length === 0) return '-';
                  return assignedSiteIds
                    .map((siteId) => sites.find((site) => site.id === siteId)?.name ?? siteId)
                    .join(', ');
                },
              },
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
