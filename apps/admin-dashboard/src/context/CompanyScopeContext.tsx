import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';

import { useAuth } from './AuthContext';
import { getFriendlyErrorMessage } from '../lib/errors';
import { supabase } from '../lib/supabase';
import { Company } from '../lib/types';

type CompanyScopeContextValue = {
  companies: Company[];
  selectedCompanyId: string;
  selectedCompany: Company | null;
  loading: boolean;
  error: string | null;
  setSelectedCompanyId: (companyId: string) => void;
  refreshCompanies: () => Promise<void>;
};

const CompanyScopeContext = createContext<CompanyScopeContextValue | null>(null);
const STORAGE_KEY = 'field_attendance_pro_selected_company_id';

export function CompanyScopeProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyIdState] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refreshCompanies() {
    if (!profile) {
      setCompanies([]);
      setSelectedCompanyIdState('');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      let query = supabase.from('companies').select('*').order('name');
      if (profile.role !== 'super_admin') query = query.eq('id', profile.company_id);

      const { data, error: loadError } = await query;
      if (loadError) throw loadError;

      const rows = (data ?? []) as Company[];
      const storedCompanyId = window.localStorage.getItem(STORAGE_KEY) ?? '';
      const fallbackCompanyId = profile.role === 'super_admin' ? rows[0]?.id ?? '' : profile.company_id;
      const nextCompanyId = rows.some((company) => company.id === selectedCompanyId)
        ? selectedCompanyId
        : rows.some((company) => company.id === storedCompanyId)
          ? storedCompanyId
          : fallbackCompanyId;

      setCompanies(rows);
      setSelectedCompanyIdState(nextCompanyId);
      if (nextCompanyId) window.localStorage.setItem(STORAGE_KEY, nextCompanyId);
    } catch (err) {
      setError(await getFriendlyErrorMessage(err, 'Failed to load companies'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshCompanies();
  }, [profile?.id, profile?.company_id, profile?.role]);

  function setSelectedCompanyId(companyId: string) {
    setSelectedCompanyIdState(companyId);
    if (companyId) window.localStorage.setItem(STORAGE_KEY, companyId);
  }

  const selectedCompany = companies.find((company) => company.id === selectedCompanyId) ?? null;

  const value = useMemo<CompanyScopeContextValue>(
    () => ({
      companies,
      selectedCompanyId,
      selectedCompany,
      loading,
      error,
      setSelectedCompanyId,
      refreshCompanies,
    }),
    [companies, selectedCompanyId, selectedCompany, loading, error],
  );

  return <CompanyScopeContext.Provider value={value}>{children}</CompanyScopeContext.Provider>;
}

export function useCompanyScope() {
  const context = useContext(CompanyScopeContext);
  if (!context) throw new Error('useCompanyScope must be used inside CompanyScopeProvider');
  return context;
}
