import { FormEvent, useEffect, useState } from 'react';

import { DataTable } from '../components/DataTable';
import { Field, SelectField, TextArea, ToggleField } from '../components/FormField';
import { PageHeader } from '../components/PageHeader';
import { ErrorState, LoadingState } from '../components/State';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Company, Site } from '../lib/types';

type SiteForm = {
  id?: string;
  company_id: string;
  name: string;
  address: string;
  latitude: string;
  longitude: string;
  allowed_radius_meters: string;
  is_active: boolean;
};

const emptyForm: SiteForm = {
  company_id: '',
  name: '',
  address: '',
  latitude: '',
  longitude: '',
  allowed_radius_meters: '100',
  is_active: true,
};

export function SitesPage() {
  const { profile } = useAuth();
  const [sites, setSites] = useState<Site[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [form, setForm] = useState<SiteForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const companyOptions = companies.map((company) => ({ label: company.name, value: company.id }));

  async function load() {
    if (!profile) return;
    setLoading(true);
    setError(null);
    try {
      let query = supabase.from('sites').select('*').order('created_at', { ascending: false });
      let companiesQuery = supabase.from('companies').select('*').order('name');
      if (profile.role !== 'super_admin') query = query.eq('company_id', profile.company_id);
      if (profile.role !== 'super_admin') companiesQuery = companiesQuery.eq('id', profile.company_id);
      const [sitesResult, companiesResult] = await Promise.all([query, companiesQuery]);
      const { data, error: loadError } = sitesResult;
      if (loadError) throw loadError;
      if (companiesResult.error) throw companiesResult.error;
      const companyRows = (companiesResult.data ?? []) as Company[];
      setSites((data ?? []) as Site[]);
      setCompanies(companyRows);
      setForm((current) => {
        if (current.company_id || companyRows.length === 0) return current;
        return { ...current, company_id: profile.role === 'super_admin' ? companyRows[0].id : profile.company_id };
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sites');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [profile]);

  function edit(site: Site) {
    setForm({
      id: site.id,
      company_id: site.company_id,
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
    if (!profile) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const payload = {
        company_id: profile.role === 'super_admin' ? form.company_id : profile.company_id,
        name: form.name,
        address: form.address || null,
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        allowed_radius_meters: Number(form.allowed_radius_meters),
        is_active: form.is_active,
      };
      const { error: saveError } = form.id
        ? await supabase.from('sites').update(payload).eq('id', form.id)
        : await supabase.from('sites').insert(payload);
      if (saveError) throw saveError;
      setMessage(form.id ? 'Site updated.' : 'Site created.');
      setForm({ ...emptyForm, company_id: profile.role === 'super_admin' ? form.company_id : profile.company_id });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save site');
    } finally {
      setSaving(false);
    }
  }

  async function deleteSite(site: Site) {
    if (!confirm(`Delete ${site.name}? Use deactivate if attendance records already reference this site.`)) return;
    const { error: deleteError } = await supabase.from('sites').delete().eq('id', site.id);
    if (deleteError) setError(deleteError.message);
    await load();
  }

  if (loading) return <LoadingState />;
  if (error && sites.length === 0) return <ErrorState message={error} />;

  return (
    <>
      <PageHeader title="Site / Geofence Management" eyebrow="Work locations and radius validation" />
      <section className="split-grid">
        <div className="panel">
          <h2>{form.id ? 'Edit site' : 'Add site'}</h2>
          <form onSubmit={save} className="form-stack">
            {profile?.role === 'super_admin' && (
              <SelectField
                label="Company"
                value={form.company_id}
                options={companyOptions}
                onChange={(event) => setForm({ ...form, company_id: event.target.value })}
                disabled={Boolean(form.id)}
                required
              />
            )}
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
              ...(profile?.role === 'super_admin'
                ? [{ header: 'Company', cell: (row: Site) => companies.find((company) => company.id === row.company_id)?.name ?? '-' }]
                : []),
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
