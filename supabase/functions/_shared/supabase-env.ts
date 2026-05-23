type KeyMap = Record<string, unknown>;

function parseDefaultKey(raw: string | undefined): string | undefined {
  if (!raw) return undefined;

  try {
    const parsed = JSON.parse(raw) as KeyMap;
    if (typeof parsed.default === 'string' && parsed.default.length > 0) {
      return parsed.default;
    }

    const firstKey = Object.values(parsed).find((value) => typeof value === 'string' && value.length > 0);
    return typeof firstKey === 'string' ? firstKey : undefined;
  } catch {
    return undefined;
  }
}

export function readSupabaseFunctionEnv() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    ?? parseDefaultKey(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS'));
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    ?? parseDefaultKey(Deno.env.get('SUPABASE_SECRET_KEYS'));

  return { supabaseUrl, anonKey, serviceRoleKey };
}
