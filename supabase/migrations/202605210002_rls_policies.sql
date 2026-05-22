create or replace function public.current_user_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.users where id = auth.uid() and is_active = true;
$$;

create or replace function public.current_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id from public.users where id = auth.uid() and is_active = true;
$$;

create or replace function public.current_employee_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select employee_id from public.users where id = auth.uid() and is_active = true;
$$;

create or replace function public.current_assigned_site_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select e.assigned_site_id
  from public.users u
  join public.employees e on e.id = u.employee_id
  where u.id = auth.uid()
    and u.is_active = true
    and e.is_active = true;
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() = 'super_admin'::public.app_role, false);
$$;

create or replace function public.is_company_admin(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.current_user_role() = 'company_admin'::public.app_role
    and public.current_company_id() = target_company_id,
    false
  );
$$;

create or replace function public.is_company_member(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.is_super_admin()
    or public.current_company_id() = target_company_id,
    false
  );
$$;

create or replace function public.is_employee_self(target_employee_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_employee_id() = target_employee_id, false);
$$;

alter table public.companies enable row level security;
alter table public.users enable row level security;
alter table public.employees enable row level security;
alter table public.sites enable row level security;
alter table public.attendance_settings enable row level security;
alter table public.attendance_records enable row level security;
alter table public.device_sessions enable row level security;
alter table public.audit_logs enable row level security;

create policy companies_select_members
on public.companies for select to authenticated
using (public.is_company_member(id));

create policy companies_insert_super_admin
on public.companies for insert to authenticated
with check (public.is_super_admin());

create policy companies_update_admins
on public.companies for update to authenticated
using (public.is_super_admin() or public.is_company_admin(id))
with check (public.is_super_admin() or public.is_company_admin(id));

create policy companies_delete_super_admin
on public.companies for delete to authenticated
using (public.is_super_admin());

create policy users_select_scoped
on public.users for select to authenticated
using (
  public.is_super_admin()
  or public.is_company_admin(company_id)
  or id = auth.uid()
);

create policy users_update_super_admin
on public.users for update to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create policy employees_select_scoped
on public.employees for select to authenticated
using (
  public.is_super_admin()
  or public.is_company_admin(company_id)
  or public.is_employee_self(id)
);

create policy employees_insert_admins
on public.employees for insert to authenticated
with check (public.is_super_admin() or public.is_company_admin(company_id));

create policy employees_update_admins
on public.employees for update to authenticated
using (public.is_super_admin() or public.is_company_admin(company_id))
with check (public.is_super_admin() or public.is_company_admin(company_id));

create policy employees_delete_admins
on public.employees for delete to authenticated
using (public.is_super_admin() or public.is_company_admin(company_id));

create policy sites_select_scoped
on public.sites for select to authenticated
using (
  public.is_super_admin()
  or public.is_company_admin(company_id)
  or id = public.current_assigned_site_id()
);

create policy sites_insert_admins
on public.sites for insert to authenticated
with check (public.is_super_admin() or public.is_company_admin(company_id));

create policy sites_update_admins
on public.sites for update to authenticated
using (public.is_super_admin() or public.is_company_admin(company_id))
with check (public.is_super_admin() or public.is_company_admin(company_id));

create policy sites_delete_admins
on public.sites for delete to authenticated
using (public.is_super_admin() or public.is_company_admin(company_id));

create policy attendance_settings_select_members
on public.attendance_settings for select to authenticated
using (public.is_company_member(company_id));

create policy attendance_settings_insert_admins
on public.attendance_settings for insert to authenticated
with check (public.is_super_admin() or public.is_company_admin(company_id));

create policy attendance_settings_update_admins
on public.attendance_settings for update to authenticated
using (public.is_super_admin() or public.is_company_admin(company_id))
with check (public.is_super_admin() or public.is_company_admin(company_id));

create policy attendance_records_select_scoped
on public.attendance_records for select to authenticated
using (
  public.is_super_admin()
  or public.is_company_admin(company_id)
  or public.is_employee_self(employee_id)
);

create policy attendance_records_delete_super_admin
on public.attendance_records for delete to authenticated
using (public.is_super_admin());

create policy device_sessions_select_scoped
on public.device_sessions for select to authenticated
using (
  public.is_super_admin()
  or public.is_employee_self(employee_id)
  or exists (
    select 1
    from public.employees e
    where e.id = device_sessions.employee_id
      and public.is_company_admin(e.company_id)
  )
);

create policy device_sessions_update_admins
on public.device_sessions for update to authenticated
using (
  public.is_super_admin()
  or exists (
    select 1
    from public.employees e
    where e.id = device_sessions.employee_id
      and public.is_company_admin(e.company_id)
  )
)
with check (
  public.is_super_admin()
  or exists (
    select 1
    from public.employees e
    where e.id = device_sessions.employee_id
      and public.is_company_admin(e.company_id)
  )
);

create policy audit_logs_select_admins
on public.audit_logs for select to authenticated
using (public.is_super_admin() or public.is_company_admin(company_id));

grant usage on schema public to authenticated;
grant select on public.companies, public.users, public.employees, public.sites, public.attendance_settings, public.attendance_records, public.device_sessions, public.audit_logs to authenticated;
grant insert, update, delete on public.companies, public.employees, public.sites, public.attendance_settings to authenticated;
grant update on public.users, public.device_sessions to authenticated;
