import { MapPin, RadioTower } from 'lucide-react';
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
import { exportExcel } from '../lib/export';
import { supabase } from '../lib/supabase';
import { AttendanceRecordDetailed, Employee, Site } from '../lib/types';

type MonitoringRow = {
  employee_id: string;
  employee_name: string;
  check_in_time: string | null;
  check_in_site_id: string | null;
  check_in_site_name: string | null;
  check_in_latitude: number | null;
  check_in_longitude: number | null;
  check_out_time: string | null;
  check_out_site_id: string | null;
  check_out_site_name: string | null;
  check_out_latitude: number | null;
  check_out_longitude: number | null;
};

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

function startOfDateIso(value: string) {
  return new Date(`${value}T00:00:00`).toISOString();
}

function endOfDateIso(value: string) {
  return new Date(`${value}T23:59:59`).toISOString();
}

function mapUrl(latitude: number | null, longitude: number | null) {
  if (latitude == null || longitude == null) return null;
  return `https://www.google.com/maps?q=${latitude},${longitude}`;
}

function buildMonitoringRows(records: AttendanceRecordDetailed[]) {
  const sorted = [...records].sort((a, b) => {
    const left = new Date(a.attendance_time).getTime();
    const right = new Date(b.attendance_time).getTime();
    return left - right;
  });

  const rows: MonitoringRow[] = [];
  const openByEmployee = new Map<string, AttendanceRecordDetailed>();

  for (const record of sorted) {
    const open = openByEmployee.get(record.employee_id);

    if (record.check_type === 'check_in') {
      if (open) {
        rows.push({
          employee_id: open.employee_id,
          employee_name: open.employee_name,
          check_in_time: open.attendance_time,
          check_in_site_id: open.site_id,
          check_in_site_name: open.site_name,
          check_in_latitude: Number(open.latitude),
          check_in_longitude: Number(open.longitude),
          check_out_time: null,
          check_out_site_id: null,
          check_out_site_name: null,
          check_out_latitude: null,
          check_out_longitude: null,
        });
      }
      openByEmployee.set(record.employee_id, record);
      continue;
    }

    if (open) {
      rows.push({
        employee_id: open.employee_id,
        employee_name: open.employee_name,
        check_in_time: open.attendance_time,
        check_in_site_id: open.site_id,
        check_in_site_name: open.site_name,
        check_in_latitude: Number(open.latitude),
        check_in_longitude: Number(open.longitude),
        check_out_time: record.attendance_time,
        check_out_site_id: record.site_id,
        check_out_site_name: record.site_name,
        check_out_latitude: Number(record.latitude),
        check_out_longitude: Number(record.longitude),
      });
      openByEmployee.delete(record.employee_id);
    } else {
      rows.push({
        employee_id: record.employee_id,
        employee_name: record.employee_name,
        check_in_time: null,
        check_in_site_id: null,
        check_in_site_name: null,
        check_in_latitude: null,
        check_in_longitude: null,
        check_out_time: record.attendance_time,
        check_out_site_id: record.site_id,
        check_out_site_name: record.site_name,
        check_out_latitude: Number(record.latitude),
        check_out_longitude: Number(record.longitude),
      });
    }
  }

  for (const open of openByEmployee.values()) {
    rows.push({
      employee_id: open.employee_id,
      employee_name: open.employee_name,
      check_in_time: open.attendance_time,
      check_in_site_id: open.site_id,
      check_in_site_name: open.site_name,
      check_in_latitude: Number(open.latitude),
      check_in_longitude: Number(open.longitude),
      check_out_time: null,
      check_out_site_id: null,
      check_out_site_name: null,
      check_out_latitude: null,
      check_out_longitude: null,
    });
  }

  return rows.sort((a, b) => {
    const left = a.check_in_time ?? a.check_out_time ?? '';
    const right = b.check_in_time ?? b.check_out_time ?? '';
    return new Date(right).getTime() - new Date(left).getTime();
  });
}

export function MonitoringPage() {
  const { profile } = useAuth();
  const { selectedCompanyId, selectedCompany } = useCompanyScope();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [employeeId, setEmployeeId] = useState('');
  const [siteId, setSiteId] = useState('');
  const [dateFrom, setDateFrom] = useState(todayInput());
  const [dateTo, setDateTo] = useState(todayInput());
  const [rows, setRows] = useState<MonitoringRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const employeeOptions = useMemo(
    () =>
      employees.map((employee) => ({
        label: `${employee.employee_code} - ${employee.full_name}`,
        value: employee.id,
      })),
    [employees],
  );

  const siteOptions = useMemo(
    () =>
      sites.map((site) => ({
        label: site.name,
        value: site.id,
      })),
    [sites],
  );

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

      const [employeesResult, sitesResult] = await Promise.all([
        employeesQuery,
        sitesQuery,
      ]);
      if (employeesResult.error) throw employeesResult.error;
      if (sitesResult.error) throw sitesResult.error;

      setEmployees((employeesResult.data ?? []) as Employee[]);
      setSites((sitesResult.data ?? []) as Site[]);
    } catch (err) {
      setError(
        await getFriendlyErrorMessage(err, 'Failed to load monitoring filters'),
      );
    } finally {
      setLoading(false);
    }
  }

  async function run(event?: FormEvent) {
    event?.preventDefault();
    if (!profile || !selectedCompanyId) return;
    if (dateFrom > dateTo) {
      setError('Date from cannot be after date to.');
      return;
    }

    setRunning(true);
    setError(null);
    try {
      let query = supabase
        .from('attendance_records_detailed')
        .select('*')
        .eq('company_id', selectedCompanyId)
        .gte('attendance_time', startOfDateIso(dateFrom))
        .lte('attendance_time', endOfDateIso(dateTo))
        .order('attendance_time', { ascending: true })
        .limit(5000);

      if (employeeId) {
        query = query.eq('employee_id', employeeId);
      }

      const { data, error: loadError } = await query;
      if (loadError) throw loadError;

      let computedRows = buildMonitoringRows(
        (data ?? []) as AttendanceRecordDetailed[],
      );

      if (siteId) {
        computedRows = computedRows.filter((row) => {
          const matchesCheckIn = row.check_in_site_id === siteId;
          const matchesCheckOut = row.check_out_site_id === siteId;
          return matchesCheckIn || matchesCheckOut;
        });
      }

      setRows(computedRows);
    } catch (err) {
      setError(
        await getFriendlyErrorMessage(err, 'Failed to load monitoring data'),
      );
    } finally {
      setRunning(false);
    }
  }

  useEffect(() => {
    setRows([]);
    setEmployeeId('');
    setSiteId('');
    void loadFilters();
  }, [profile, selectedCompanyId]);

  useEffect(() => {
    if (!loading) {
      void run();
    }
  }, [loading]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void run();
    }, 30000);
    return () => window.clearInterval(interval);
  }, [profile, selectedCompanyId, employeeId, siteId, dateFrom, dateTo, loading]);

  const employeesSeen = new Set(rows.map((row) => row.employee_id)).size;
  const currentlyCheckedIn = rows.filter(
    (row) => row.check_in_time != null && row.check_out_time == null,
  ).length;

  const exportRows = rows.map((row) => ({
    employee: row.employee_name,
    check_in_date_time: row.check_in_time ? formatDateTime(row.check_in_time) : '',
    check_in_site: row.check_in_site_name ?? '',
    check_in_google_map: mapUrl(row.check_in_latitude, row.check_in_longitude) ?? '',
    check_out_date_time: row.check_out_time ? formatDateTime(row.check_out_time) : '',
    check_out_site: row.check_out_site_name ?? '',
    check_out_google_map: mapUrl(row.check_out_latitude, row.check_out_longitude) ?? '',
  }));

  if (loading) return <LoadingState />;
  if (error && rows.length === 0) return <ErrorState message={error} />;

  return (
    <>
      <PageHeader
        title="Attendance Monitoring"
        eyebrow={
          selectedCompany
            ? `${selectedCompany.name} check-in / check-out sessions`
            : 'Auto-refreshes every 30 seconds'
        }
        actions={
          <div className="button-row">
            <button className="secondary-button" onClick={() => void run()}>
              Refresh
            </button>
            <button
              className="secondary-button"
              onClick={() => exportExcel(exportRows, 'attendance-monitoring')}
              disabled={rows.length === 0}
            >
              Export Excel
            </button>
          </div>
        }
      />
      <section className="panel">
        <form className="filters-grid" onSubmit={run}>
          <SelectField
            label="Employee"
            value={employeeId}
            onChange={(event) => setEmployeeId(event.target.value)}
            options={employeeOptions}
          />
          <SelectField
            label="Site"
            value={siteId}
            onChange={(event) => setSiteId(event.target.value)}
            options={siteOptions}
          />
          <Field
            label="Date from"
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
          />
          <Field
            label="Date to"
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
          />
          <button className="primary-button" disabled={running}>
            {running ? 'Loading...' : 'Apply filters'}
          </button>
        </form>
        {error && <div className="inline-error">{error}</div>}
      </section>
      <section className="stats-grid">
        <StatCard
          label="Employees seen"
          value={employeesSeen}
          icon={<RadioTower size={22} />}
        />
        <StatCard
          label="Currently checked in"
          value={currentlyCheckedIn}
          icon={<MapPin size={22} />}
        />
      </section>
      <section className="panel">
        <h2>Attendance sessions</h2>
        <DataTable
          rows={rows}
          columns={[
            { header: 'Employee', cell: (row) => row.employee_name },
            {
              header: 'Check in date/time',
              cell: (row) =>
                row.check_in_time ? formatDateTime(row.check_in_time) : '-',
            },
            {
              header: 'Check in map',
              cell: (row) => {
                const url = mapUrl(
                  row.check_in_latitude,
                  row.check_in_longitude,
                );
                return url ? (
                  <a href={url} target="_blank" rel="noreferrer">
                    Open map
                  </a>
                ) : (
                  '-'
                );
              },
            },
            {
              header: 'Check out date/time',
              cell: (row) =>
                row.check_out_time ? formatDateTime(row.check_out_time) : '-',
            },
            {
              header: 'Check out map',
              cell: (row) => {
                const url = mapUrl(
                  row.check_out_latitude,
                  row.check_out_longitude,
                );
                return url ? (
                  <a href={url} target="_blank" rel="noreferrer">
                    Open map
                  </a>
                ) : (
                  '-'
                );
              },
            },
          ]}
          empty="No attendance sessions found for this filter."
        />
      </section>
    </>
  );
}
