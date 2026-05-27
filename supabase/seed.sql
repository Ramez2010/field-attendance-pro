insert into public.companies (id, name, timezone)
values ('00000000-0000-4000-8000-000000000001', 'Demo Field Company', 'Africa/Cairo')
on conflict (id) do nothing;

insert into public.sites (id, company_id, name, address, latitude, longitude, allowed_radius_meters)
values (
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000001',
  'Main Site',
  'Demo work site',
  30.0444000,
  31.2357000,
  150
)
on conflict (id) do nothing;

insert into public.attendance_settings (
  id,
  company_id,
  require_geofence,
  minimum_gps_accuracy,
  allow_check_in_outside_geofence,
  allow_multiple_checkins_per_day,
  require_notes
)
values (
  '00000000-0000-4000-8000-000000000003',
  '00000000-0000-4000-8000-000000000001',
  false,
  50,
  false,
  false,
  false
)
on conflict (company_id) do nothing;

insert into public.employees (
  id,
  company_id,
  employee_code,
  full_name,
  phone,
  email,
  department,
  assigned_site_id
)
values (
  '00000000-0000-4000-8000-000000000004',
  '00000000-0000-4000-8000-000000000001',
  'EMP-001',
  'Demo Employee',
  '+201000000000',
  'employee@example.com',
  'Field Operations',
  '00000000-0000-4000-8000-000000000002'
)
on conflict (company_id, employee_code) do nothing;

-- Create auth users from the Supabase dashboard or create-user Edge Function,
-- then insert matching public.users rows. The user id must equal auth.users.id.
