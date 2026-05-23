import { FormEvent, useEffect, useMemo, useState } from 'react';

import { DataTable } from '../components/DataTable';
import { Field, ToggleField } from '../components/FormField';
import { PageHeader } from '../components/PageHeader';
import { ErrorState, LoadingState } from '../components/State';
import { useAuth } from '../context/AuthContext';
import { useCompanyScope } from '../context/CompanyScopeContext';
import { getFriendlyErrorMessage } from '../lib/errors';
import { supabase } from '../lib/supabase';
import { AttendanceSettings, Site } from '../lib/types';

type GeofenceSettingsForm = {
  require_geofence: boolean;
  minimum_gps_accuracy: number;
  allow_check_in_outside_geofence: boolean;
};

const defaults: GeofenceSettingsForm = {
  require_geofence: true,
  minimum_gps_accuracy: 50,
  allow_check_in_outside_geofence: false,
};

export function GeofenceConfigPage() {
  const { profile } = useAuth();
  const { selectedCompanyId, selectedCompany } = useCompanyScope();
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [settings, setSettings] = useState<GeofenceSettingsForm>(defaults);
  const [sites, setSites] = useState<Site[]>([]);
  const [radiusDrafts, setRadiusDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingSiteId, setSavingSiteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const averageRadius = useMemo(() => {
    if (sites.length === 0) return 0;
    const total = sites.reduce((sum, site) => sum + Number(site.allowed_radius_meters), 0);
    return Math.round(total / sites.length);
  }, [sites]);

  async function load() {
    if (!profile || !selectedCompanyId) return;
    setLoading(true);
    setError(null);
    try {
      const settingsQuery = supabase
        .from('attendance_settings')
        .select('*')
        .eq('company_id', selectedCompanyId)
        .maybeSingle();
      const sitesQuery = supabase
        .from('sites')
        .select('*')
        .eq('company_id', selectedCompanyId)
        .order('name');

      const [settingsResult, sitesResult] = await Promise.all([settingsQuery, sitesQuery]);
      if (settingsResult.error) throw settingsResult.error;
      if (sitesResult.error) throw sitesResult.error;

      if (settingsResult.data) {
        const row = settingsResult.data as AttendanceSettings;
        setSettingsId(row.id);
        setSettings({
          require_geofence: row.require_geofence,
          minimum_gps_accuracy: Number(row.minimum_gps_accuracy),
          allow_check_in_outside_geofence: row.allow_check_in_outside_geofence,
        });
      } else {
        setSettingsId(null);
        setSettings(defaults);
      }

      const siteRows = (sitesResult.data ?? []) as Site[];
      setSites(siteRows);
      setRadiusDrafts(
        siteRows.reduce<Record<string, string>>((acc, site) => {
          acc[site.id] = String(site.allowed_radius_meters);
          return acc;
        }, {}),
      );
    } catch (err) {
      setError(await getFriendlyErrorMessage(err, 'Failed to load geofence settings'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setMessage(null);
    void load();
  }, [profile, selectedCompanyId]);

  async function saveSettings(event: FormEvent) {
    event.preventDefault();
    if (!profile || !selectedCompanyId) return;
    if (!Number.isFinite(settings.minimum_gps_accuracy) || settings.minimum_gps_accuracy <= 0) {
      setError('Minimum GPS accuracy must be greater than 0.');
      return;
    }

    setSavingSettings(true);
    setError(null);
    setMessage(null);
    try {
      const payload = {
        company_id: selectedCompanyId,
        require_geofence: settings.require_geofence,
        minimum_gps_accuracy: Number(settings.minimum_gps_accuracy),
        allow_check_in_outside_geofence: settings.allow_check_in_outside_geofence,
      };
      const upsertPayload = settingsId ? { id: settingsId, ...payload } : payload;
      const { error: saveError } = await supabase
        .from('attendance_settings')
        .upsert(upsertPayload as Record<string, unknown>, { onConflict: 'company_id' });
      if (saveError) throw saveError;
      setMessage('Geofence policy saved.');
      await load();
    } catch (err) {
      setError(await getFriendlyErrorMessage(err, 'Failed to save geofence policy'));
    } finally {
      setSavingSettings(false);
    }
  }

  async function saveSiteRadius(site: Site) {
    const value = radiusDrafts[site.id] ?? '';
    const radius = Number(value);
    if (!Number.isFinite(radius) || radius < 10 || radius > 10000) {
      setError(`Allowed radius for ${site.name} must be between 10 and 10000 meters.`);
      return;
    }

    setSavingSiteId(site.id);
    setError(null);
    setMessage(null);
    try {
      const { error: updateError } = await supabase
        .from('sites')
        .update({ allowed_radius_meters: radius })
        .eq('id', site.id);
      if (updateError) throw updateError;
      setMessage(`Updated geofence radius for ${site.name}.`);
      await load();
    } catch (err) {
      setError(await getFriendlyErrorMessage(err, `Failed to update ${site.name} radius`));
    } finally {
      setSavingSiteId(null);
    }
  }

  if (loading) return <LoadingState />;
  if (error && sites.length === 0) return <ErrorState message={error} />;

  return (
    <>
      <PageHeader title="Geofence Configuration" eyebrow={selectedCompany ? `${selectedCompany.name} location policy` : 'Global and per-site geofence controls'} />
      <section className="split-grid">
        <div className="panel">
          <h2>Global geofence policy</h2>
          <form onSubmit={saveSettings} className="form-stack">
            <ToggleField
              label="Require geofence validation"
              checked={settings.require_geofence}
              onChange={(value) => setSettings({ ...settings, require_geofence: value })}
            />
            <Field
              label="Minimum GPS accuracy in meters"
              type="number"
              min={1}
              max={500}
              value={settings.minimum_gps_accuracy}
              onChange={(event) => setSettings({ ...settings, minimum_gps_accuracy: Number(event.target.value) })}
            />
            <ToggleField
              label="Allow attendance outside geofence"
              checked={settings.allow_check_in_outside_geofence}
              onChange={(value) => setSettings({ ...settings, allow_check_in_outside_geofence: value })}
            />
            <button className="primary-button" disabled={savingSettings}>{savingSettings ? 'Saving...' : 'Save geofence policy'}</button>
          </form>
        </div>
        <div className="panel">
          <h2>Geofence summary</h2>
          <p><strong>Sites:</strong> {sites.length}</p>
          <p><strong>Average radius:</strong> {averageRadius}m</p>
          <p><strong>Outside attempts:</strong> {settings.allow_check_in_outside_geofence ? 'Allowed' : 'Blocked'}</p>
          <p><strong>Required GPS accuracy:</strong> &lt;= {settings.minimum_gps_accuracy}m</p>
        </div>
      </section>
      <section className="panel">
        <h2>Per-site radius controls</h2>
        {error && <div className="inline-error">{error}</div>}
        {message && <div className="inline-success">{message}</div>}
        <DataTable
          rows={sites}
          columns={[
            { header: 'Site', cell: (row) => row.name },
            { header: 'Address', cell: (row) => row.address ?? '-' },
            {
              header: 'Allowed radius (m)',
              cell: (row) => (
                <input
                  type="number"
                  min={10}
                  max={10000}
                  value={radiusDrafts[row.id] ?? ''}
                  onChange={(event) => setRadiusDrafts((prev) => ({ ...prev, [row.id]: event.target.value }))}
                />
              ),
            },
            { header: 'Status', cell: (row) => <span className={`pill ${row.is_active ? 'active' : 'inactive'}`}>{row.is_active ? 'active' : 'inactive'}</span> },
            {
              header: 'Action',
              cell: (row) => (
                <button
                  className="secondary-button"
                  onClick={() => void saveSiteRadius(row)}
                  disabled={savingSiteId === row.id}
                >
                  {savingSiteId === row.id ? 'Saving...' : 'Save radius'}
                </button>
              ),
            },
          ]}
        />
      </section>
    </>
  );
}
