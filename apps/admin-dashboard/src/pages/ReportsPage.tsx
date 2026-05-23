import { FormEvent, useEffect, useMemo, useState } from 'react';

import { DataTable } from '../components/DataTable';
import { Field, SelectField } from '../components/FormField';
import { PageHeader } from '../components/PageHeader';
import { StatCard } from '../components/StatCard';
import { ErrorState, LoadingState } from '../components/State';
import { useAuth } from '../context/AuthContext';
import { useCompanyScope } from '../context/CompanyScopeContext';
import { formatDateTime } from '../lib/date';
import { getFriendlyErrorMessage } from '../lib/errors';
import { exportCsv, exportExcel } from '../lib/export';
import { supabase } from '../lib/supabase';
import { AttendanceRecordDetailed, Employee, Site } from '../lib/types';

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

function endOfDateIso(value: string) {
  return new Date(`${value}T23:59:59`).toISOString();
}

function startOfDateIso(value: string) {
  return new Date(`${value}T00:00:00`).toISOString();
}

function localDateKey(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

export function ReportsPage() {
  const { profile } = useAuth();
  const { selectedCompanyId, selectedCompany } = useCompanyScope();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [employeeId, setEmployeeId] = useState('');
  const [siteId, setSiteId] = useState('');
  const [dateFrom, setDateFrom] = useState(todayInput());
  const [dateTo, setDateTo] = useState(todayInput());
  const [lateAfter, setLateAfter] = useState('09:00');
  const [records, setRecords] = useState<AttendanceRecordDetailed[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const employeeOptions = useMemo(() => employees.map((employee) => ({ label: `${employee.employee_code} - ${employee.full_name}`, value: employee.id })), [employees]);
  const siteOptions = useMemo(() => sites.map((site) => ({ label: site.name, value: site.id })), [sites]);

  async function loadFilters() {
    if (!profile || !selectedCompanyId) return;
    setLoading(true);
    setError(null);
    try {
      const employeesQuery = supabase.from('employees').select('*').eq('company_id', selectedCompanyId).order('full_name');
      const sitesQuery = supabase.from('sites').select('*').eq('company_id', selectedCompanyId).order('name');
      const [employeeResult, siteResult] = await Promise.all([employeesQuery, sitesQuery]);
      if (employeeResult.error) throw employeeResult.error;
      if (siteResult.error) throw siteResult.error;
      setEmployees((employeeResult.data ?? []) as Employee[]);
      setSites((siteResult.data ?? []) as Site[]);
    } catch (err) {
      setError(await getFriendlyErrorMessage(err, 'Failed to load report filters'));
    } finally {
      setLoading(false);
    }
  }

  async function runReport(event?: FormEvent) {
    event?.preventDefault();
    if (!profile || !selectedCompanyId) return;
    if (dateFrom > dateTo) {
      setError('Date from cannot be after date to.');
      return;
    }
    setReportLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('attendance_records_detailed')
        .select('*')
        .eq('company_id', selectedCompanyId)
        .gte('attendance_time', startOfDateIso(dateFrom))
        .lte('attendance_time', endOfDateIso(dateTo))
        .order('attendance_time', { ascending: false });
      if (employeeId) query = query.eq('employee_id', employeeId);
      if (siteId) query = query.eq('site_id', siteId);
      const { data, error: reportError } = await query;
      if (reportError) throw reportError;
      setRecords((data ?? []) as AttendanceRecordDetailed[]);
    } catch (err) {
      setError(await getFriendlyErrorMessage(err, 'Failed to run report'));
    } finally {
      setReportLoading(false);
    }
  }

  useEffect(() => {
    setEmployeeId('');
    setSiteId('');
    setRecords([]);
    loadFilters();
  }, [profile, selectedCompanyId]);

  useEffect(() => {
    if (!loading) runReport();
  }, [loading]);

  const latestByEmployeeDay = new Map<string, AttendanceRecordDetailed>();
  records.forEach((record) => {
    const key = `${record.employee_id}:${localDateKey(record.attendance_time)}`;
    if (!latestByEmployeeDay.has(key)) latestByEmployeeDay.set(key, record);
  });
  const missingCheckouts = [...latestByEmployeeDay.values()].filter((record) => record.check_type === 'check_in');

  const firstCheckInByEmployeeDay = new Map<string, AttendanceRecordDetailed>();
  [...records].reverse().forEach((record) => {
    if (record.check_type !== 'check_in') return;
    const key = `${record.employee_id}:${localDateKey(record.attendance_time)}`;
    if (!firstCheckInByEmployeeDay.has(key)) firstCheckInByEmployeeDay.set(key, record);
  });
  const [lateHour, lateMinute] = lateAfter.split(':').map(Number);
  const lateArrivals = [...firstCheckInByEmployeeDay.values()].filter((record) => {
    const date = new Date(record.attendance_time);
    return date.getHours() > lateHour || (date.getHours() === lateHour && date.getMinutes() > lateMinute);
  });

  const exportRows = records.map((record) => ({
    employee_code: record.employee_code,
    employee_name: record.employee_name,
    department: record.department ?? '',
    site_name: record.site_name,
    check_type: record.check_type,
    attendance_time: formatDateTime(record.attendance_time),
    latitude: record.latitude,
    longitude: record.longitude,
    gps_accuracy: record.gps_accuracy,
    distance_from_site: record.distance_from_site,
    notes: record.notes ?? '',
  }));

  if (loading) return <LoadingState />;
  if (error && records.length === 0) return <ErrorState message={error} />;

  return (
    <>
      <PageHeader
        title="Reports"
        eyebrow={selectedCompany ? `${selectedCompany.name} attendance reports` : 'Daily, employee, site, missing check-out, and late arrival views'}
        actions={
          <div className="button-row">
            <button className="secondary-button" onClick={() => exportCsv(exportRows, 'attendance-report')} disabled={records.length === 0}>Export CSV</button>
            <button className="secondary-button" onClick={() => exportExcel(exportRows, 'attendance-report')} disabled={records.length === 0}>Export Excel</button>
          </div>
        }
      />
      <section className="panel">
        <form className="filters-grid" onSubmit={runReport}>
          <SelectField label="Employee" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} options={employeeOptions} />
          <SelectField label="Site" value={siteId} onChange={(event) => setSiteId(event.target.value)} options={siteOptions} />
          <Field label="Date from" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          <Field label="Date to" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          <Field label="Late after" type="time" value={lateAfter} onChange={(event) => setLateAfter(event.target.value)} />
          <button className="primary-button" disabled={reportLoading}>{reportLoading ? 'Running...' : 'Run report'}</button>
        </form>
        {error && <div className="inline-error">{error}</div>}
      </section>
      <section className="stats-grid">
        <StatCard label="Records" value={records.length} />
        <StatCard label="Missing check-outs" value={missingCheckouts.length} detail="Latest record is check-in" />
        <StatCard label="Late arrivals" value={lateArrivals.length} detail={`First check-in after ${lateAfter}`} />
      </section>
      <section className="panel">
        <h2>Attendance records</h2>
        <DataTable
          rows={records}
          columns={[
            { header: 'Employee', cell: (row) => row.employee_name },
            { header: 'Site', cell: (row) => row.site_name },
            { header: 'Type', cell: (row) => row.check_type.replace('_', ' ') },
            { header: 'Time', cell: (row) => formatDateTime(row.attendance_time) },
            { header: 'Accuracy', cell: (row) => `${Number(row.gps_accuracy).toFixed(0)}m` },
            { header: 'Distance', cell: (row) => `${Number(row.distance_from_site).toFixed(0)}m` },
          ]}
        />
      </section>
    </>
  );
}
