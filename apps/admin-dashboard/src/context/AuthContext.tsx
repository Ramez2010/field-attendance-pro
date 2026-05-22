import { Session } from '@supabase/supabase-js';
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';

import { supabase } from '../lib/supabase';
import { UserProfile } from '../lib/types';

type AuthContextValue = {
  session: Session | null;
  profile: UserProfile | null;
  profileError: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const BOOTSTRAP_TIMEOUT_MS = 8000;

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return await Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error('Request timed out')), timeoutMs);
    }),
  ]);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(currentSession = session): Promise<UserProfile | null> {
    if (!currentSession?.user) {
      setProfile(null);
      setProfileError(null);
      return null;
    }

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', currentSession.user.id)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      throw new Error('No admin profile found for this login email. Create a matching row in public.users.');
    }

    const nextProfile = data as UserProfile;
    setProfile(nextProfile);
    setProfileError(null);
    return nextProfile;
  }

  useEffect(() => {
    let mounted = true;

    withTimeout(supabase.auth.getSession(), BOOTSTRAP_TIMEOUT_MS)
      .then(({ data }) => {
        if (!mounted) return;
        setSession(data.session);
      })
      .catch(() => {
        if (!mounted) return;
        setSession(null);
        setProfile(null);
        setProfileError(null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!session?.user) {
      setProfile(null);
      setProfileError(null);
      return;
    }

    setProfile(null);
    setProfileError(null);

    withTimeout(loadProfile(session), BOOTSTRAP_TIMEOUT_MS).catch((error) => {
      if (cancelled) return;
      setProfile(null);
      setProfileError(error instanceof Error ? error.message : 'Failed to load admin profile');
    });

    return () => {
      cancelled = true;
    };
  }, [session?.user.id]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      profileError,
      loading,
      signIn: async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setSession(data.session);
      },
      signOut: async () => {
        await supabase.auth.signOut();
        setSession(null);
        setProfile(null);
        setProfileError(null);
      },
      refreshProfile: async () => {
        await loadProfile();
      },
    }),
    [session, profile, profileError, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
