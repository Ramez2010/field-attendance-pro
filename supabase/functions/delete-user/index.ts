import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { readSupabaseFunctionEnv } from '../_shared/supabase-env.ts';

type DeleteUserPayload = {
  user_id: string;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const { supabaseUrl, anonKey, serviceRoleKey } = readSupabaseFunctionEnv();

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return jsonResponse({ error: 'Supabase function environment is not configured' }, 500);
    }

    const authHeader = req.headers.get('Authorization') ?? '';
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: authData, error: authError } = await callerClient.auth.getUser();
    if (authError || !authData.user) {
      return jsonResponse({ error: 'Authentication is required' }, 401);
    }

    const { data: callerProfile, error: callerError } = await adminClient
      .from('users')
      .select('id, role, company_id, is_active')
      .eq('id', authData.user.id)
      .single();

    if (callerError || !callerProfile?.is_active) {
      return jsonResponse({ error: 'Active caller profile was not found' }, 403);
    }

    if (!['super_admin', 'company_admin'].includes(callerProfile.role)) {
      return jsonResponse({ error: 'Only admins can delete users' }, 403);
    }

    const payload = (await req.json()) as DeleteUserPayload;
    if (!payload.user_id) {
      return jsonResponse({ error: 'user_id is required' }, 400);
    }

    const { data: target, error: targetError } = await adminClient
      .from('users')
      .select('id, role, company_id')
      .eq('id', payload.user_id)
      .single();

    if (targetError || !target) {
      return jsonResponse({ error: 'Target user was not found' }, 404);
    }

    if (callerProfile.role === 'company_admin') {
      if (target.company_id !== callerProfile.company_id) {
        return jsonResponse({ error: 'Cannot manage users outside your company' }, 403);
      }
      if (target.role === 'super_admin') {
        return jsonResponse({ error: 'Company admins cannot manage super admins' }, 403);
      }
    }

    const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(payload.user_id);
    if (authDeleteError && !authDeleteError.message.toLowerCase().includes('not found')) {
      return jsonResponse({ error: authDeleteError.message }, 400);
    }

    const { error: profileDeleteError } = await adminClient
      .from('users')
      .delete()
      .eq('id', payload.user_id);
    if (profileDeleteError) {
      return jsonResponse({ error: profileDeleteError.message }, 400);
    }

    await adminClient.rpc('write_audit', {
      p_company_id: target.company_id,
      p_user_id: authData.user.id,
      p_action: 'user.delete',
      p_entity_name: 'users',
      p_entity_id: payload.user_id,
    });

    return jsonResponse({ deleted: true });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unexpected error' }, 500);
  }
});
