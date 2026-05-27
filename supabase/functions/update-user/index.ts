import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { readSupabaseFunctionEnv } from '../_shared/supabase-env.ts';

type AppRole = 'super_admin' | 'company_admin' | 'employee';

type UpdateUserPayload = {
  user_id: string;
  role?: AppRole;
  employee_id?: string | null;
  is_active?: boolean;
  password?: string;
};

const allowedRoles: AppRole[] = ['super_admin', 'company_admin', 'employee'];

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
      return jsonResponse({ error: 'Only admins can update users' }, 403);
    }

    const payload = (await req.json()) as UpdateUserPayload;
    if (!payload.user_id) {
      return jsonResponse({ error: 'user_id is required' }, 400);
    }

    if (payload.role && !allowedRoles.includes(payload.role)) {
      return jsonResponse({ error: 'Invalid role' }, 400);
    }

    const nextPassword = payload.password?.trim();
    if (Object.prototype.hasOwnProperty.call(payload, 'password')) {
      if (!nextPassword || nextPassword.length < 8) {
        return jsonResponse({ error: 'password must be at least 8 characters' }, 400);
      }
    }

    const { data: target, error: targetError } = await adminClient
      .from('users')
      .select('id, role, company_id, employee_id')
      .eq('id', payload.user_id)
      .single();

    if (targetError || !target) {
      return jsonResponse({ error: 'Target user was not found' }, 404);
    }

    if (callerProfile.role === 'company_admin') {
      if (target.company_id !== callerProfile.company_id) {
        return jsonResponse({ error: 'Cannot manage users outside your company' }, 403);
      }
      if (target.role === 'super_admin' || payload.role === 'super_admin') {
        return jsonResponse({ error: 'Company admins cannot manage super admins' }, 403);
      }
    }

    const nextRole = payload.role ?? target.role;
    const nextEmployeeId = Object.prototype.hasOwnProperty.call(payload, 'employee_id')
      ? payload.employee_id ?? null
      : target.employee_id;

    if (nextRole === 'employee' && !nextEmployeeId) {
      return jsonResponse({ error: 'employee_id is required for employee users' }, 400);
    }

    if (nextEmployeeId) {
      const { data: employee, error: employeeError } = await adminClient
        .from('employees')
        .select('id, company_id')
        .eq('id', nextEmployeeId)
        .single();

      if (employeeError || !employee || employee.company_id !== target.company_id) {
        return jsonResponse({ error: 'Employee must belong to the target company' }, 400);
      }
    }

    const patch: Record<string, unknown> = {};
    if (payload.role) patch.role = payload.role;
    if (Object.prototype.hasOwnProperty.call(payload, 'employee_id')) patch.employee_id = nextEmployeeId;
    if (Object.prototype.hasOwnProperty.call(payload, 'is_active')) patch.is_active = payload.is_active;

    if (Object.keys(patch).length === 0 && !nextPassword) {
      return jsonResponse({ error: 'No changes were provided' }, 400);
    }

    if (nextPassword) {
      const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(payload.user_id, {
        password: nextPassword,
      });
      if (authUpdateError) {
        return jsonResponse({ error: authUpdateError.message }, 400);
      }
    }

    let profile = target;
    if (Object.keys(patch).length > 0) {
      const { data: updatedProfile, error: updateError } = await adminClient
        .from('users')
        .update(patch)
        .eq('id', payload.user_id)
        .select()
        .single();

      if (updateError) {
        return jsonResponse({ error: updateError.message }, 400);
      }

      profile = updatedProfile;
    }

    await adminClient.rpc('write_audit', {
      p_company_id: target.company_id,
      p_user_id: authData.user.id,
      p_action: 'user.update',
      p_entity_name: 'users',
      p_entity_id: payload.user_id,
    });

    return jsonResponse({ user: profile });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unexpected error' }, 500);
  }
});
