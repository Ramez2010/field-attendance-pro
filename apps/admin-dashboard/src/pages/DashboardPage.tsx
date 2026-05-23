import { Activity, MapPin, UserCheck, Users } from 'lucide-react';
import { useEffect, useState } from 'react';

import { PageHeader } from '../components/PageHeader';
import { StatCard } from '../components/StatCard';
import { DataTable } from '../components/DataTable';
import { ErrorState, LoadingState } from '../components/State';
import { useAuth } from '../context/AuthContext';
import { useCompanyScope } from '../context/CompanyScopeContext';
import { endOfTodayIso, formatDateTime, startOfTodayIso } from '../lib/date';
import { getFriendlyErrorMessage } from '../lib/errors';
import { supabase } from '../lib/supabase';
import { AttendanceRecordDetailed } from '../lib/types';

type DashboardStats = {
  employees: number;
  activeSites: number;
  todayRecords: number;
  checkedInNow: number;
  latest: AttendanceRecordDetailed[];
};

export function DashboardPage() {
  const { profile } = useAuth();
  const { selectedCompanyId, selectedCompany } = useCompanyScope();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!profile || !selectedCompanyId) return;
      setStats(null);
      setError(null);
      try {
        const employeesQuery = supabase.from('employees').select('id', { count: 'exact', head: true }).eq('is_active', true).eq('company_id', selectedCompanyId);
        const sitesQuery = supabase.from('sites').select('id', { count: 'exact', head: true }).eq('is_active', true).eq('company_id', selectedCompanyId);
        const todayQuery = supabase
          .from('attendance_records_detailed')
          .select('*')
          .eq('company_id', selectedCompanyId)
          .gte('attendance_time', startOfTodayIso())
          .lt('attendance_time', endOfTodayIso())
          .order('attendance_time', { ascending: false });

        const [employees, sites, today] = await Promise.all([employeesQuery, sitesQuery, todayQuery.limit(100)]);
        if (employees.error) throw employees.error;
        if (sites.error) throw sites.error;
        if (today.error) throw today.error;

        const latestByEmployee = new Map<string, AttendanceRecordDetailed>();
        (today.data as AttendanceRecordDetailed[]).forEach((record) => {
          if (!latestByEmployee.has(record.employee_id)) latestByEmployee.set(record.employee_id, record);
        });

        setStats({
          employees: employees.count ?? 0,
          activeSites: sites.count ?? 0,
          todayRecords: today.data?.length ?? 0,
          checkedInNow: [...latestByEmployee.values()].filter((record) => record.check_type === 'check_in').length,
          latest: (today.data as AttendanceRecordDetailed[]).slice(0, 8),
        });
      } catch (err) {
        setError(await getFriendlyErrorMessage(err, 'Failed to load dashboard'));
      }
    }

    load();
  }, [profile, selectedCompanyId]);

  if (error) return <ErrorState message={error} />;
  if (!stats) return <LoadingState />;

  return (
    <>
      <PageHeader title="Overview" eyebrow={selectedCompany ? `${selectedCompany.name} operations` : 'Attendance operations'} />
      <section className="stats-grid">
        <StatCard label="Active employees" value={stats.employees} icon={<Users size={22} />} />
        <StatCard label="Active sites" value={stats.activeSites} icon={<MapPin size={22} />} />
        <StatCard label="Today records" value={stats.todayRecords} icon={<Activity size={22} />} />
        <StatCard label="Checked in now" value={stats.checkedInNow} icon={<UserCheck size={22} />} />
      </section>
      <section className="panel">
        <h2>Latest attendance</h2>
        <DataTable
          rows={stats.latest}
          columns={[
            { header: 'Employee', cell: (row) => row.employee_name },
            { header: 'Site', cell: (row) => row.site_name },
            { header: 'Type', cell: (row) => <span className={`pill ${row.check_type}`}>{row.check_type.replace('_', ' ')}</span> },
            { header: 'Time', cell: (row) => formatDateTime(row.attendance_time) },
            { header: 'Distance', cell: (row) => `${Number(row.distance_from_site).toFixed(0)}m` },
          ]}
        />
      </section>
    </>
  );
}
