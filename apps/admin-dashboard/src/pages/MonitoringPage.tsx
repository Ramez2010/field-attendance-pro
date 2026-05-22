import { MapPin, RadioTower } from 'lucide-react';
import { useEffect, useState } from 'react';

import { DataTable } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { StatCard } from '../components/StatCard';
import { ErrorState, LoadingState } from '../components/State';
import { useAuth } from '../context/AuthContext';
import { useCompanyScope } from '../context/CompanyScopeContext';
import { endOfTodayIso, formatDateTime, startOfTodayIso } from '../lib/date';
import { supabase } from '../lib/supabase';
import { AttendanceRecordDetailed } from '../lib/types';

export function MonitoringPage() {
  const { profile } = useAuth();
  const { selectedCompanyId, selectedCompany } = useCompanyScope();
  const [records, setRecords] = useState<AttendanceRecordDetailed[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!profile || !selectedCompanyId) return;
    setLoading(true);
    setError(null);
    try {
      const query = supabase
        .from('attendance_records_detailed')
        .select('*')
        .eq('company_id', selectedCompanyId)
        .gte('attendance_time', startOfTodayIso())
        .lt('attendance_time', endOfTodayIso())
        .order('attendance_time', { ascending: false })
        .limit(200);
      const { data, error: loadError } = await query;
      if (loadError) throw loadError;
      setRecords((data ?? []) as AttendanceRecordDetailed[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load monitoring data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const interval = window.setInterval(load, 30000);
    return () => window.clearInterval(interval);
  }, [profile, selectedCompanyId]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  const latestByEmployee = new Map<string, AttendanceRecordDetailed>();
  records.forEach((record) => {
    if (!latestByEmployee.has(record.employee_id)) latestByEmployee.set(record.employee_id, record);
  });
  const liveLocations = [...latestByEmployee.values()];
  const checkedIn = liveLocations.filter((record) => record.check_type === 'check_in').length;

  return (
    <>
      <PageHeader title="Attendance Monitoring" eyebrow={selectedCompany ? `${selectedCompany.name} live view` : 'Auto-refreshes every 30 seconds'} actions={<button className="secondary-button" onClick={load}>Refresh</button>} />
      <section className="stats-grid">
        <StatCard label="Employees seen today" value={liveLocations.length} icon={<RadioTower size={22} />} />
        <StatCard label="Currently checked in" value={checkedIn} icon={<MapPin size={22} />} />
      </section>
      <section className="panel">
        <h2>Latest employee locations</h2>
        <DataTable
          rows={liveLocations}
          columns={[
            { header: 'Employee', cell: (row) => row.employee_name },
            { header: 'Site', cell: (row) => row.site_name },
            { header: 'Status', cell: (row) => <span className={`pill ${row.check_type}`}>{row.check_type.replace('_', ' ')}</span> },
            { header: 'Time', cell: (row) => formatDateTime(row.attendance_time) },
            { header: 'Location', cell: (row) => `${Number(row.latitude).toFixed(5)}, ${Number(row.longitude).toFixed(5)}` },
            { header: 'Distance', cell: (row) => `${Number(row.distance_from_site).toFixed(0)}m` },
          ]}
        />
      </section>
      <section className="panel">
        <h2>Today attendance stream</h2>
        <DataTable
          rows={records.slice(0, 50)}
          columns={[
            { header: 'Employee', cell: (row) => row.employee_name },
            { header: 'Type', cell: (row) => row.check_type.replace('_', ' ') },
            { header: 'Site', cell: (row) => row.site_name },
            { header: 'GPS accuracy', cell: (row) => `${Number(row.gps_accuracy).toFixed(0)}m` },
            { header: 'Time', cell: (row) => formatDateTime(row.attendance_time) },
          ]}
        />
      </section>
    </>
  );
}
