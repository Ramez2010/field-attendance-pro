import { FormEvent, useEffect, useMemo, useState } from 'react';

import { DataTable } from '../components/DataTable';
import { Field, SelectField } from '../components/FormField';
import { PageHeader } from '../components/PageHeader';
import { StatCard } from '../components/StatCard';
import { ErrorState, LoadingState } from '../components/State';
import { useAuth } from '../context/AuthContext';
import { useCompanyScope } from '../context/CompanyScopeContext';
import { useLanguage } from '../context/LanguageContext';
import { formatDateTime } from '../lib/date';
import { getFriendlyErrorMessage } from '../lib/errors';
import { exportExcel } from '../lib/export';
import { supabase } from '../lib/supabase';
import { AttendanceCheckType, AttendanceRecordDetailed, Employee, Site } from '../lib/types';

type GeofenceFilter = '' | 'inside' | 'outside';

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

function startOfDateIso(value: string) {
  return new Date(`${value}T00:00:00`).toISOString();
}

function endOfDateIso(value: string) {
  return new Date(`${value}T23:59:59`).toISOString();
}

export function AttendanceHistoryPage() {
  const { profile } = useAuth();
  const { selectedCompanyId, selectedCompany } = useCompanyScope();
  const { t } = useLanguage();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [records, setRecords] = useState<AttendanceRecordDetailed[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [employeeId, setEmployeeId] = useState('');
  const [siteId, setSiteId] = useState('');
  const [checkType, setCheckType] = useState<AttendanceCheckType | ''>('');
  const [geofenceFilter, setGeofenceFilter] = useState<GeofenceFilter>('');
  const [dateFrom, setDateFrom] = useState(todayInput());
  const [dateTo, setDateTo] = useState(todayInput());

  const employeeOptions = useMemo(
    () => employees.map((employee) => ({ label: `${employee.employee_code} - ${employee.full_name}`, value: employee.id })),
    [employees],
  );

  const siteOptions = useMemo(
    () => sites.map((site) => ({ label: site.name, value: site.id })),
    [sites],
  );

  const siteRadiusById = useMemo(
    () => new Map(sites.map((site) => [site.id, Number(site.allowed_radius_meters)])),
    [sites],
  );

  function isOutsideGeofence(record: AttendanceRecordDetailed) {
    const allowedRadius = siteRadiusById.get(record.site_id);
    if (typeof allowedRadius !== 'number') return false;
    return Number(record.distance_from_site) > allowedRadius;
  }

  const historyRows = useMemo(() => {
    if (!geofenceFilter) return records;

    return records.filter((record) => {
      const outside = isOutsideGeofence(record);
      return geofenceFilter === 'outside' ? outside : !outside;
    });
  }, [records, geofenceFilter, siteRadiusById]);

  async function loadFilters() {
    if (!profile || !selectedCompanyId) return;
    setLoading(true);
    setError(null);
    try {
      const employeesQuery = supabase
        .from('employees')
        .select('*')
        .eq('company_id', selectedCompanyId)
        .order('full_name');
      const sitesQuery = supabase
        .from('sites')
        .select('*')
        .eq('company_id', selectedCompanyId)
        .order('name');

      const [employeesResult, sitesResult] = await Promise.all([employeesQuery, sitesQuery]);
      if (employeesResult.error) throw employeesResult.error;
      if (sitesResult.error) throw sitesResult.error;

      setEmployees((employeesResult.data ?? []) as Employee[]);
      setSites((sitesResult.data ?? []) as Site[]);
    } catch (err) {
      setError(await getFriendlyErrorMessage(err, 'Failed to load history filters'));
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
    setMessage(null);
    try {
      let query = supabase
        .from('attendance_records_detailed')
        .select('*')
        .eq('company_id', selectedCompanyId)
        .gte('attendance_time', startOfDateIso(dateFrom))
        .lte('attendance_time', endOfDateIso(dateTo))
        .order('attendance_time', { ascending: false })
        .limit(2000);

      if (employeeId) query = query.eq('employee_id', employeeId);
      if (siteId) query = query.eq('site_id', siteId);
      if (checkType) query = query.eq('check_type', checkType);

      const { data, error: reportError } = await query;
      if (reportError) throw reportError;

      const rows = (data ?? []) as AttendanceRecordDetailed[];
      setRecords(rows);
      setMessage(`Loaded ${rows.length} attendance records.`);
    } catch (err) {
      setError(await getFriendlyErrorMessage(err, 'Failed to load attendance history'));
    } finally {
      setReportLoading(false);
    }
  }

  function exportHistory() {
    const rows = historyRows.map((record) => {
      const allowedRadius = siteRadiusById.get(record.site_id);
      const outside = isOutsideGeofence(record);
      return {
        employee_code: record.employee_code,
        employee_name: record.employee_name,
        department: record.department ?? '',
        site_name: record.site_name,
        check_type: record.check_type,
        attendance_time: formatDateTime(record.attendance_time),
        gps_accuracy_m: Number(record.gps_accuracy).toFixed(2),
        distance_from_site_m: Number(record.distance_from_site).toFixed(2),
        allowed_radius_m: typeof allowedRadius === 'number' ? allowedRadius : '',
        geofence_status: outside ? 'outside' : 'inside',
        latitude: record.latitude,
        longitude: record.longitude,
        device_id: record.device_id,
        device_name: record.device_name ?? '',
        notes: record.notes ?? '',
      };
    });

    exportExcel(rows, `${selectedCompany?.name ?? 'company'}-attendance-history`);
  }

  useEffect(() => {
    setEmployeeId('');
    setSiteId('');
    setCheckType('');
    setGeofenceFilter('');
    setRecords([]);
    setMessage(null);
    loadFilters();
  }, [profile, selectedCompanyId]);

  useEffect(() => {
    if (!loading) void runReport();
  }, [loading]);

  const checkInCount = historyRows.filter((row) => row.check_type === 'check_in').length;
  const checkOutCount = historyRows.filter((row) => row.check_type === 'check_out').length;
  const outsideCount = historyRows.filter((row) => isOutsideGeofence(row)).length;

  if (loading) return <LoadingState />;
  if (error && historyRows.length === 0) return <ErrorState message={error} />;

  return (
    <>
      <PageHeader
        title={t('historyPage.title')}
        eyebrow={selectedCompany ? `${selectedCompany.name} time records` : 'Filtered attendance timeline'}
        actions={
          <div className="button-row">
            <button className="secondary-button" onClick={exportHistory} disabled={historyRows.length === 0}>
              {t('common.exportExcel')}
            </button>
          </div>
        }
      />
      <section className="panel">
        <form className="filters-grid" onSubmit={runReport}>
          <SelectField label={t('common.employee')} value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} options={employeeOptions} />
          <SelectField label={t('common.site')} value={siteId} onChange={(event) => setSiteId(event.target.value)} options={siteOptions} />
          <SelectField
            label={t('common.type')}
            value={checkType}
            onChange={(event) => setCheckType(event.target.value as AttendanceCheckType | '')}
            options={[
              { label: 'Check in', value: 'check_in' },
              { label: 'Check out', value: 'check_out' },
            ]}
          />
          <SelectField
            label="Geofence status"
            value={geofenceFilter}
            onChange={(event) => setGeofenceFilter(event.target.value as GeofenceFilter)}
            options={[
              { label: 'Inside geofence', value: 'inside' },
              { label: 'Outside geofence', value: 'outside' },
            ]}
          />
          <Field label={t('common.dateFrom')} type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          <Field label={t('common.dateTo')} type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          <button className="primary-button" disabled={reportLoading}>{reportLoading ? t('common.loading') : t('common.applyFilters')}</button>
        </form>
        {error && <div className="inline-error">{error}</div>}
        {message && <div className="inline-success">{message}</div>}
      </section>
      <section className="stats-grid">
        <StatCard label="Records" value={historyRows.length} />
        <StatCard label="Check-ins" value={checkInCount} />
        <StatCard label="Check-outs" value={checkOutCount} />
        <StatCard label="Outside geofence" value={outsideCount} />
      </section>
      <section className="panel">
        <h2>Attendance records</h2>
        <DataTable
          rows={historyRows}
          columns={[
            { header: 'Employee', cell: (row) => row.employee_name },
            { header: 'Site', cell: (row) => row.site_name },
            { header: 'Type', cell: (row) => row.check_type.replace('_', ' ') },
            { header: 'Time', cell: (row) => formatDateTime(row.attendance_time) },
            { header: 'Distance', cell: (row) => `${Number(row.distance_from_site).toFixed(0)}m` },
            {
              header: 'Geofence',
              cell: (row) => (
                <span className={`pill ${isOutsideGeofence(row) ? 'inactive' : 'active'}`}>
                  {isOutsideGeofence(row) ? 'outside' : 'inside'}
                </span>
              ),
            },
            { header: 'GPS', cell: (row) => `${Number(row.gps_accuracy).toFixed(0)}m` },
          ]}
        />
      </section>
    </>
  );
}
