create or replace function public.enforce_employee_site_company()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.assigned_site_id is not null and not exists (
    select 1 from public.sites s
    where s.id = new.assigned_site_id
      and s.company_id = new.company_id
  ) then
    raise exception 'Assigned site must belong to the employee company';
  end if;

  return new;
end;
$$;

create trigger trg_employees_site_company
before insert or update of company_id, assigned_site_id on public.employees
for each row execute function public.enforce_employee_site_company();

create or replace function public.enforce_user_employee_company()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.employee_id is not null and not exists (
    select 1 from public.employees e
    where e.id = new.employee_id
      and e.company_id = new.company_id
  ) then
    raise exception 'Employee profile must belong to the user company';
  end if;

  return new;
end;
$$;

create trigger trg_users_employee_company
before insert or update of company_id, employee_id on public.users
for each row execute function public.enforce_user_employee_company();

create or replace function public.enforce_attendance_company_scope()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.employees e
    where e.id = new.employee_id
      and e.company_id = new.company_id
  ) then
    raise exception 'Attendance employee must belong to the attendance company';
  end if;

  if not exists (
    select 1 from public.sites s
    where s.id = new.site_id
      and s.company_id = new.company_id
  ) then
    raise exception 'Attendance site must belong to the attendance company';
  end if;

  return new;
end;
$$;

create trigger trg_attendance_company_scope
before insert or update of company_id, employee_id, site_id on public.attendance_records
for each row execute function public.enforce_attendance_company_scope();
