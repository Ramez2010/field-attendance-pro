create extension if not exists pgcrypto;
create extension if not exists citext;

create type public.app_role as enum ('super_admin', 'company_admin', 'employee');
create type public.attendance_check_type as enum ('check_in', 'check_out');

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'UTC',
  created_at timestamptz not null default now()
);

create table public.sites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  address text,
  latitude numeric(10, 7) not null check (latitude between -90 and 90),
  longitude numeric(10, 7) not null check (longitude between -180 and 180),
  allowed_radius_meters integer not null default 100 check (allowed_radius_meters between 10 and 10000),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (company_id, name)
);

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_code text not null,
  full_name text not null,
  phone text,
  email citext,
  department text,
  assigned_site_id uuid references public.sites(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (company_id, employee_code),
  unique (company_id, email)
);

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete set null,
  role public.app_role not null default 'employee',
  email citext not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint users_employee_required_for_employee check (role <> 'employee' or employee_id is not null)
);

create table public.attendance_settings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade unique,
  require_geofence boolean not null default true,
  minimum_gps_accuracy numeric(8, 2) not null default 50 check (minimum_gps_accuracy > 0),
  allow_check_in_outside_geofence boolean not null default false,
  allow_multiple_checkins_per_day boolean not null default false,
  require_notes boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete restrict,
  check_type public.attendance_check_type not null,
  attendance_time timestamptz not null default now(),
  latitude numeric(10, 7) not null check (latitude between -90 and 90),
  longitude numeric(10, 7) not null check (longitude between -180 and 180),
  gps_accuracy numeric(8, 2) not null check (gps_accuracy >= 0),
  distance_from_site numeric(10, 2) not null check (distance_from_site >= 0),
  device_id text not null,
  device_name text,
  notes text,
  created_at timestamptz not null default now()
);

create table public.device_sessions (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  device_id text not null,
  device_name text,
  is_active boolean not null default true,
  last_login_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (employee_id, device_id)
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete set null,
  user_id uuid references public.users(id) on delete set null,
  action text not null,
  entity_name text not null,
  entity_id uuid,
  created_at timestamptz not null default now()
);

create index idx_sites_company_id on public.sites(company_id);
create index idx_sites_active on public.sites(company_id, is_active);

create index idx_employees_company_id on public.employees(company_id);
create index idx_employees_company_active on public.employees(company_id, is_active);
create index idx_employees_assigned_site_id on public.employees(assigned_site_id);

create index idx_users_company_id on public.users(company_id);
create index idx_users_employee_id on public.users(employee_id);
create index idx_users_role on public.users(role);

create index idx_attendance_records_company_time on public.attendance_records(company_id, attendance_time desc);
create index idx_attendance_records_employee_time on public.attendance_records(employee_id, attendance_time desc);
create index idx_attendance_records_site_time on public.attendance_records(site_id, attendance_time desc);
create index idx_attendance_records_type_time on public.attendance_records(company_id, check_type, attendance_time desc);

create index idx_device_sessions_employee_id on public.device_sessions(employee_id);
create unique index idx_device_sessions_one_active_per_employee
  on public.device_sessions(employee_id)
  where is_active;

create index idx_audit_logs_company_time on public.audit_logs(company_id, created_at desc);
create index idx_audit_logs_user_time on public.audit_logs(user_id, created_at desc);
