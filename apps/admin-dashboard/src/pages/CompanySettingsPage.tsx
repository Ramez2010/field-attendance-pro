import { FormEvent, useEffect, useState } from 'react';

import { Field, SelectField } from '../components/FormField';
import { PageHeader } from '../components/PageHeader';
import { ErrorState, LoadingState } from '../components/State';
import { useAuth } from '../context/AuthContext';
import { useCompanyScope } from '../context/CompanyScopeContext';
import { getFriendlyErrorMessage } from '../lib/errors';
import { supabase } from '../lib/supabase';
import { Company } from '../lib/types';

const timezones = ['UTC', 'Africa/Cairo', 'Asia/Riyadh', 'Asia/Dubai', 'Europe/London', 'America/New_York'];

export function CompanySettingsPage() {
  const { profile } = useAuth();
  const { selectedCompanyId, setSelectedCompanyId, refreshCompanies } = useCompanyScope();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [name, setName] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    if (!profile) return;
    setLoading(true);
    setError(null);
    try {
      let query = supabase.from('companies').select('*').order('created_at', { ascending: false });
      if (profile.role !== 'super_admin') query = query.eq('id', profile.company_id);
      const { data, error: loadError } = await query;
      if (loadError) throw loadError;
      const rows = (data ?? []) as Company[];
      setCompanies(rows);
      const selected = rows.find((company) => company.id === selectedCompanyId)
        ?? rows.find((company) => company.id === selectedId)
        ?? rows[0];
      if (selected) {
        setSelectedId(selected.id);
        setName(selected.name);
        setTimezone(selected.timezone);
      }
    } catch (err) {
      setError(await getFriendlyErrorMessage(err, 'Failed to load company settings'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [profile, selectedCompanyId]);

  function handleSelect(companyId: string) {
    const selected = companies.find((company) => company.id === companyId);
    setSelectedId(companyId);
    if (companyId) setSelectedCompanyId(companyId);
    if (selected) {
      setName(selected.name);
      setTimezone(selected.timezone);
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!profile) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      if (selectedId) {
        const { error: updateError } = await supabase.from('companies').update({ name, timezone }).eq('id', selectedId);
        if (updateError) throw updateError;
      } else {
        const { data: inserted, error: insertError } = await supabase.from('companies').insert({ name, timezone }).select().single();
        if (insertError) throw insertError;
        if (inserted?.id) setSelectedCompanyId(inserted.id);
      }
      setMessage('Company settings saved.');
      await refreshCompanies();
      await load();
    } catch (err) {
      setError(await getFriendlyErrorMessage(err, 'Failed to save company'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingState />;
  if (error && companies.length === 0) return <ErrorState message={error} />;

  return (
    <>
      <PageHeader
        title="Company Settings"
        eyebrow="Tenant configuration"
        actions={profile?.role === 'super_admin' ? <button className="secondary-button" onClick={() => { setSelectedId(''); setName(''); setTimezone('UTC'); }}>New company</button> : null}
      />
      <section className="panel narrow">
        <form onSubmit={save} className="form-grid">
          {profile?.role === 'super_admin' && companies.length > 0 && (
            <SelectField
              label="Company"
              value={selectedId}
              onChange={(event) => handleSelect(event.target.value)}
              options={companies.map((company) => ({ label: company.name, value: company.id }))}
            />
          )}
          <Field label="Company name" value={name} onChange={(event) => setName(event.target.value)} required />
          <SelectField
            label="Timezone"
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
            options={timezones.map((value) => ({ label: value, value }))}
          />
          {error && <div className="inline-error full-width">{error}</div>}
          {message && <div className="inline-success full-width">{message}</div>}
          <button className="primary-button" disabled={saving}>{saving ? 'Saving...' : 'Save company'}</button>
        </form>
      </section>
    </>
  );
}
