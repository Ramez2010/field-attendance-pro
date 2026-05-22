import { FormEvent, useEffect, useState } from 'react';

import { Field, SelectField, ToggleField } from '../components/FormField';
import { PageHeader } from '../components/PageHeader';
import { ErrorState, LoadingState } from '../components/State';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { AttendanceSettings, Company } from '../lib/types';

const defaults = {
  require_geofence: true,
  minimum_gps_accuracy: 50,
  allow_check_in_outside_geofence: false,
  allow_multiple_checkins_per_day: false,
  require_notes: false,
};

export function AttendanceRulesPage() {
  const { profile } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [settings, setSettings] = useState<typeof defaults>(defaults);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const targetCompanyId = profile?.role === 'super_admin' ? selectedCompanyId : profile?.company_id;

  async function load() {
    if (!profile) return;
    setLoading(true);
    setError(null);
    try {
      let companiesQuery = supabase.from('companies').select('*').order('name');
      if (profile.role !== 'super_admin') companiesQuery = companiesQuery.eq('id', profile.company_id);
      const { data: companyData, error: companiesError } = await companiesQuery;
      if (companiesError) throw companiesError;

      const companyRows = (companyData ?? []) as Company[];
      const nextCompanyId = profile.role === 'super_admin'
        ? selectedCompanyId || companyRows[0]?.id
        : profile.company_id;

      setCompanies(companyRows);
      setSelectedCompanyId(nextCompanyId ?? '');

      if (!nextCompanyId) {
        setSettings(defaults);
        setSettingsId(null);
        return;
      }

      const { data, error: loadError } = await supabase
        .from('attendance_settings')
        .select('*')
        .eq('company_id', nextCompanyId)
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
      setError(err instanceof Error ? err.message : 'Failed to load attendance rules');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [profile, selectedCompanyId]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!profile || !targetCompanyId) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const payload = { ...settings, company_id: targetCompanyId, minimum_gps_accuracy: Number(settings.minimum_gps_accuracy) };
      const upsertPayload = settingsId ? { id: settingsId, ...payload } : payload;
      const { error: saveError } = await supabase
        .from('attendance_settings')
        .upsert(upsertPayload as Record<string, unknown>, { onConflict: 'company_id' });
      if (saveError) throw saveError;
      setMessage('Attendance rules saved.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save attendance rules');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingState />;
  if (error && !settings) return <ErrorState message={error} />;

  return (
    <>
      <PageHeader title="Attendance Rules" eyebrow="GPS and attendance validation" />
      <section className="panel narrow">
        <form onSubmit={save} className="form-stack">
          {profile?.role === 'super_admin' && (
            <SelectField
              label="Company"
              value={selectedCompanyId}
              options={companies.map((company) => ({ label: company.name, value: company.id }))}
              onChange={(event) => setSelectedCompanyId(event.target.value)}
              required
            />
          )}
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
