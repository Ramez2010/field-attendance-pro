import { FormEvent, useEffect, useState } from 'react';

import { Field, ToggleField } from '../components/FormField';
import { PageHeader } from '../components/PageHeader';
import { ErrorState, LoadingState } from '../components/State';
import { useAuth } from '../context/AuthContext';
import { useCompanyScope } from '../context/CompanyScopeContext';
import { getFriendlyErrorMessage } from '../lib/errors';
import { supabase } from '../lib/supabase';
import { AttendanceSettings } from '../lib/types';

const defaults = {
  require_geofence: false,
  minimum_gps_accuracy: 50,
  allow_check_in_outside_geofence: false,
  allow_multiple_checkins_per_day: false,
  require_notes: false,
};

export function AttendanceRulesPage() {
  const { profile } = useAuth();
  const { selectedCompanyId, selectedCompany } = useCompanyScope();
  const [settings, setSettings] = useState<typeof defaults>(defaults);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    if (!profile || !selectedCompanyId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: loadError } = await supabase
        .from('attendance_settings')
        .select('*')
        .eq('company_id', selectedCompanyId)
        .maybeSingle();
      if (loadError) throw loadError;
      if (data) {
        const row = data as AttendanceSettings;
        setSettingsId(row.id);
        setSettings({
          require_geofence: row.require_geofence,
          minimum_gps_accuracy: Number(row.minimum_gps_accuracy),
          allow_check_in_outside_geofence: row.allow_check_in_outside_geofence,
          allow_multiple_checkins_per_day: row.allow_multiple_checkins_per_day,
          require_notes: row.require_notes,
        });
      } else {
        setSettingsId(null);
        setSettings(defaults);
      }
    } catch (err) {
      setError(await getFriendlyErrorMessage(err, 'Failed to load attendance rules'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [profile, selectedCompanyId]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!profile || !selectedCompanyId) return;
    if (!Number.isFinite(settings.minimum_gps_accuracy) || Number(settings.minimum_gps_accuracy) <= 0) {
      setError('Minimum GPS accuracy must be greater than 0.');
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const payload = { ...settings, company_id: selectedCompanyId, minimum_gps_accuracy: Number(settings.minimum_gps_accuracy) };
      const upsertPayload = settingsId ? { id: settingsId, ...payload } : payload;
      const { error: saveError } = await supabase
        .from('attendance_settings')
        .upsert(upsertPayload as Record<string, unknown>, { onConflict: 'company_id' });
      if (saveError) throw saveError;
      setMessage('Attendance rules saved.');
      await load();
    } catch (err) {
      setError(await getFriendlyErrorMessage(err, 'Failed to save attendance rules'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingState />;
  if (error && !settings) return <ErrorState message={error} />;

  return (
    <>
      <PageHeader title="Attendance Rules" eyebrow={selectedCompany ? `${selectedCompany.name} GPS validation` : 'GPS and attendance validation'} />
      <section className="panel narrow">
        <form onSubmit={save} className="form-stack">
          <ToggleField label="Require geofence validation" checked={settings.require_geofence} onChange={(value) => setSettings({ ...settings, require_geofence: value })} />
          <Field
            label="Minimum GPS accuracy in meters"
            type="number"
            min={5}
            max={500}
            value={settings.minimum_gps_accuracy}
            onChange={(event) => setSettings({ ...settings, minimum_gps_accuracy: Number(event.target.value) })}
          />
          <ToggleField label="Allow attendance outside geofence" checked={settings.allow_check_in_outside_geofence} onChange={(value) => setSettings({ ...settings, allow_check_in_outside_geofence: value })} />
          <ToggleField label="Allow multiple check-in cycles per day" checked={settings.allow_multiple_checkins_per_day} onChange={(value) => setSettings({ ...settings, allow_multiple_checkins_per_day: value })} />
          <ToggleField label="Require notes" checked={settings.require_notes} onChange={(value) => setSettings({ ...settings, require_notes: value })} />
          {error && <div className="inline-error">{error}</div>}
          {message && <div className="inline-success">{message}</div>}
          <button className="primary-button" disabled={saving}>{saving ? 'Saving...' : 'Save rules'}</button>
        </form>
      </section>
    </>
  );
}
