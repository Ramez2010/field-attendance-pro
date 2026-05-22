import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

type AppRole = 'super_admin' | 'company_admin' | 'employee';

type CreateUserPayload = {
  email: string;
  password: string;
  role: AppRole;
  company_id?: string;
  employee_id?: string | null;
  is_active?: boolean;
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

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
      return jsonResponse({ error: 'Only admins can create users' }, 403);
    }

    const payload = (await req.json()) as CreateUserPayload;
    const email = payload.email?.trim().toLowerCase();
    const password = payload.password;
    const role = payload.role;

    if (!email || !password || password.length < 8 || !allowedRoles.includes(role)) {
      return jsonResponse({ error: 'Valid email, password >= 8 chars, and role are required' }, 400);
    }

    const companyId = callerProfile.role === 'super_admin' ? payload.company_id : callerProfile.company_id;
    if (!companyId) {
      return jsonResponse({ error: 'company_id is required' }, 400);
    }

    if (callerProfile.role === 'company_admin' && role === 'super_admin') {
      return jsonResponse({ error: 'Company admins cannot create super admins' }, 403);
    }

    const employeeId = payload.employee_id ?? null;
    if (role === 'employee' && !employeeId) {
      return jsonResponse({ error: 'employee_id is required for employee users' }, 400);
    }

    if (employeeId) {
      const { data: employee, error: employeeError } = await adminClient
        .from('employees')
        .select('id, company_id')
        .eq('id', employeeId)
        .single();

      if (employeeError || !employee || employee.company_id !== companyId) {
        return jsonResponse({ error: 'Employee must belong to the target company' }, 400);
      }
    }

    const { data: createdAuthUser, error: createAuthError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role, company_id: companyId, employee_id: employeeId },
    });

    if (createAuthError || !createdAuthUser.user) {
      return jsonResponse({ error: createAuthError?.message ?? 'Failed to create auth user' }, 400);
    }

    const { data: profile, error: profileError } = await adminClient
      .from('users')
      .insert({
        id: createdAuthUser.user.id,
        company_id: companyId,
        employee_id: employeeId,
        role,
        email,
        is_active: payload.is_active ?? true,
      })
      .select()
      .single();

    if (profileError) {
      await adminClient.auth.admin.deleteUser(createdAuthUser.user.id);
      return jsonResponse({ error: profileError.message }, 400);
    }

    await adminClient.rpc('write_audit', {
      p_company_id: companyId,
      p_user_id: authData.user.id,
      p_action: 'user.create',
      p_entity_name: 'users',
      p_entity_id: createdAuthUser.user.id,
    });

    return jsonResponse({ user: profile }, 201);
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unexpected error' }, 500);
  }
});
