import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';

import { DataTable } from '../components/DataTable';
import { Field, TextArea, ToggleField } from '../components/FormField';
import { PageHeader } from '../components/PageHeader';
import { ErrorState, LoadingState } from '../components/State';
import { useAuth } from '../context/AuthContext';
import { useCompanyScope } from '../context/CompanyScopeContext';
import { getFriendlyErrorMessage } from '../lib/errors';
import { exportExcel, getSpreadsheetValue, importSpreadsheetRows } from '../lib/export';
import { supabase } from '../lib/supabase';
import { Site } from '../lib/types';

type SiteForm = {
  id?: string;
  name: string;
  address: string;
  latitude: string;
  longitude: string;
  allowed_radius_meters: string;
  is_active: boolean;
};

const emptyForm: SiteForm = {
  name: '',
  address: '',
  latitude: '',
  longitude: '',
  allowed_radius_meters: '100',
  is_active: true,
};

const siteImportHeaders = ['name', 'address', 'latitude', 'longitude', 'allowed_radius_meters', 'is_active'];

export function SitesPage() {
  const { profile } = useAuth();
  const { selectedCompanyId, selectedCompany } = useCompanyScope();
  const [sites, setSites] = useState<Site[]>([]);
  const [form, setForm] = useState<SiteForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    if (!profile || !selectedCompanyId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: loadError } = await supabase
        .from('sites')
        .select('*')
        .eq('company_id', selectedCompanyId)
        .order('created_at', { ascending: false });
      if (loadError) throw loadError;
      setSites((data ?? []) as Site[]);
    } catch (err) {
      setError(await getFriendlyErrorMessage(err, 'Failed to load sites'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setForm(emptyForm);
    setMessage(null);
    load();
  }, [profile, selectedCompanyId]);

  function edit(site: Site) {
    setForm({
      id: site.id,
      name: site.name,
      address: site.address ?? '',
      latitude: String(site.latitude),
      longitude: String(site.longitude),
      allowed_radius_meters: String(site.allowed_radius_meters),
      is_active: site.is_active,
    });
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!profile || !selectedCompanyId) return;
    const latitude = Number(form.latitude);
    const longitude = Number(form.longitude);
    const radius = Number(form.allowed_radius_meters);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      setError('Latitude must be between -90 and 90.');
      return;
    }
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      setError('Longitude must be between -180 and 180.');
      return;
    }
    if (!Number.isFinite(radius) || radius < 10 || radius > 10000) {
      setError('Allowed radius must be between 10 and 10000 meters.');
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const payload = {
        company_id: selectedCompanyId,
        name: form.name,
        address: form.address || null,
        latitude,
        longitude,
        allowed_radius_meters: radius,
        is_active: form.is_active,
      };
      const { error: saveError } = form.id
        ? await supabase.from('sites').update(payload).eq('id', form.id)
        : await supabase.from('sites').insert(payload);
      if (saveError) throw saveError;
      setMessage(form.id ? 'Site updated.' : 'Site created.');
      setForm(emptyForm);
      await load();
    } catch (err) {
      setError(await getFriendlyErrorMessage(err, 'Failed to save site'));
    } finally {
      setSaving(false);
    }
  }

  async function deleteSite(site: Site) {
    if (!confirm(`Delete ${site.name}? Use deactivate if attendance records already reference this site.`)) return;
    setError(null);
    try {
      const { error: deleteError } = await supabase.from('sites').delete().eq('id', site.id);
      if (deleteError) throw deleteError;
      await load();
    } catch (err) {
      setError(await getFriendlyErrorMessage(err, 'Failed to delete site'));
    }
  }

  function exportSites() {
    exportExcel(
      sites.map((site) => ({
        name: site.name,
        address: site.address ?? '',
        latitude: site.latitude,
        longitude: site.longitude,
        allowed_radius_meters: site.allowed_radius_meters,
        is_active: site.is_active ? 'true' : 'false',
      })),
      `${selectedCompany?.name ?? 'company'}-sites`,
      siteImportHeaders,
    );
  }

  async function importSites(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !selectedCompanyId) return;

    setImporting(true);
    setError(null);
    setMessage(null);
    try {
      const rows = await importSpreadsheetRows(file);
      if (rows.length === 0) throw new Error('The file has no site rows.');

      const payload = rows.map((row, index) => {
        const name = getSpreadsheetValue(row, ['name', 'site_name']);
        const latitude = Number(getSpreadsheetValue(row, ['latitude', 'lat']));
        const longitude = Number(getSpreadsheetValue(row, ['longitude', 'lng', 'lon']));
        const radius = Number(getSpreadsheetValue(row, ['allowed_radius_meters', 'radius', 'radius_meters']) || 100);

        if (!name) throw new Error(`Row ${index + 2}: name is required.`);
        if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) throw new Error(`Row ${index + 2}: latitude is invalid.`);
        if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) throw new Error(`Row ${index + 2}: longitude is invalid.`);
        if (!Number.isFinite(radius) || radius < 10 || radius > 10000) throw new Error(`Row ${index + 2}: allowed_radius_meters must be between 10 and 10000.`);

        return {
          company_id: selectedCompanyId,
          name,
          address: getSpreadsheetValue(row, ['address']) || null,
          latitude,
          longitude,
          allowed_radius_meters: radius,
          is_active: parseBoolean(getSpreadsheetValue(row, ['is_active', 'active']), true),
        };
      });

      const { error: importError } = await supabase
        .from('sites')
        .upsert(payload, { onConflict: 'company_id,name' });
      if (importError) throw importError;

      setMessage(`Imported ${payload.length} sites.`);
      await load();
    } catch (err) {
      setError(await getFriendlyErrorMessage(err, 'Failed to import sites'));
    } finally {
      setImporting(false);
    }
  }

  if (loading) return <LoadingState />;
  if (error && sites.length === 0) return <ErrorState message={error} />;

  return (
    <>
      <PageHeader
        title="Site / Geofence Management"
        eyebrow={selectedCompany ? `${selectedCompany.name} geofences` : 'Work locations and radius validation'}
        actions={
          <div className="button-row">
            <button className="secondary-button" onClick={exportSites}>Export Excel</button>
            <button className="secondary-button" onClick={() => exportExcel([], 'sites-import-template', siteImportHeaders)}>Template</button>
            <button className="secondary-button" onClick={() => importInputRef.current?.click()} disabled={importing}>{importing ? 'Importing...' : 'Import Excel'}</button>
            <input ref={importInputRef} className="hidden-file-input" type="file" accept=".xlsx,.xls,.csv" onChange={importSites} />
          </div>
        }
      />
      <section className="split-grid">
        <div className="panel">
          <h2>{form.id ? 'Edit site' : 'Add site'}</h2>
          <form onSubmit={save} className="form-stack">
            <Field label="Site name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
            <TextArea label="Address" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} rows={3} />
            <Field label="Latitude" type="number" step="0.0000001" value={form.latitude} onChange={(event) => setForm({ ...form, latitude: event.target.value })} required />
            <Field label="Longitude" type="number" step="0.0000001" value={form.longitude} onChange={(event) => setForm({ ...form, longitude: event.target.value })} required />
            <Field label="Allowed radius meters" type="number" min={10} max={10000} value={form.allowed_radius_meters} onChange={(event) => setForm({ ...form, allowed_radius_meters: event.target.value })} required />
            <ToggleField label="Active site" checked={form.is_active} onChange={(value) => setForm({ ...form, is_active: value })} />
            {error && <div className="inline-error">{error}</div>}
            {message && <div className="inline-success">{message}</div>}
            <div className="button-row">
              <button className="primary-button" disabled={saving}>{saving ? 'Saving...' : 'Save site'}</button>
              {form.id && <button type="button" className="secondary-button" onClick={() => setForm(emptyForm)}>Cancel</button>}
            </div>
          </form>
        </div>
        <div className="panel wide">
          <h2>Sites</h2>
          <DataTable
            rows={sites}
            columns={[
              { header: 'Name', cell: (row) => row.name },
              { header: 'Coordinates', cell: (row) => `${Number(row.latitude).toFixed(5)}, ${Number(row.longitude).toFixed(5)}` },
              { header: 'Radius', cell: (row) => `${row.allowed_radius_meters}m` },
              { header: 'Status', cell: (row) => <span className={`pill ${row.is_active ? 'active' : 'inactive'}`}>{row.is_active ? 'active' : 'inactive'}</span> },
              {
                header: 'Actions',
                cell: (row) => (
                  <div className="table-actions">
                    <button className="link-button" onClick={() => edit(row)}>Edit</button>
                    <button className="link-button danger-text" onClick={() => deleteSite(row)}>Delete</button>
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
