create or replace function public.calculate_distance_meters(
  lat1 double precision,
  lon1 double precision,
  lat2 double precision,
  lon2 double precision
)
returns double precision
language sql
immutable
as $$
  select 6371000 * 2 * asin(
    sqrt(
      power(sin(radians((lat2 - lat1) / 2)), 2)
      + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians((lon2 - lon1) / 2)), 2)
    )
  );
$$;

create or replace function public.write_audit(
  p_company_id uuid,
  p_user_id uuid,
  p_action text,
  p_entity_name text,
  p_entity_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs(company_id, user_id, action, entity_name, entity_id)
  values (p_company_id, p_user_id, p_action, p_entity_name, p_entity_id);
end;
$$;

create or replace function public.register_device_session(
  p_device_id text,
  p_device_name text default null
)
returns public.device_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee_id uuid;
  v_company_id uuid;
  v_session public.device_sessions%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  if nullif(trim(p_device_id), '') is null then
    raise exception 'Device id is required';
  end if;

  select u.employee_id, u.company_id
    into v_employee_id, v_company_id
  from public.users u
  join public.employees e on e.id = u.employee_id
  where u.id = auth.uid()
    and u.role = 'employee'::public.app_role
    and u.is_active = true
    and e.is_active = true;

  if v_employee_id is null then
    raise exception 'Active employee profile was not found';
  end if;

  update public.device_sessions
     set is_active = false
   where employee_id = v_employee_id
     and device_id <> p_device_id
     and is_active = true;

  insert into public.device_sessions(employee_id, device_id, device_name, is_active, last_login_at)
  values (v_employee_id, p_device_id, p_device_name, true, now())
  on conflict (employee_id, device_id)
  do update set
    device_name = excluded.device_name,
    is_active = true,
    last_login_at = now()
  returning * into v_session;

  perform public.write_audit(v_company_id, auth.uid(), 'device_session.register', 'device_sessions', v_session.id);
  return v_session;
end;
$$;

create or replace function public.record_attendance(
  p_check_type public.attendance_check_type,
  p_latitude double precision,
  p_longitude double precision,
  p_gps_accuracy double precision,
  p_device_id text,
  p_device_name text default null,
  p_notes text default null
)
returns public.attendance_records
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_employee_id uuid;
  v_site_id uuid;
  v_site_latitude double precision;
  v_site_longitude double precision;
  v_site_allowed_radius integer;
  v_settings public.attendance_settings%rowtype;
  v_company_timezone text;
  v_distance double precision;
  v_day_start timestamptz;
  v_day_end timestamptz;
  v_latest_record public.attendance_records%rowtype;
  v_record public.attendance_records%rowtype;
  v_allow_multiple boolean;
  v_require_geofence boolean;
  v_allow_outside boolean;
  v_require_notes boolean;
  v_min_accuracy double precision;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  if p_check_type not in ('check_in'::public.attendance_check_type, 'check_out'::public.attendance_check_type) then
    raise exception 'Invalid attendance check type';
  end if;

  if p_latitude is null or p_longitude is null
     or p_latitude < -90 or p_latitude > 90
     or p_longitude < -180 or p_longitude > 180 then
    raise exception 'Invalid GPS coordinates';
  end if;

  if p_gps_accuracy is null or p_gps_accuracy < 0 then
    raise exception 'Invalid GPS accuracy';
  end if;

  if nullif(trim(p_device_id), '') is null then
    raise exception 'Device id is required';
  end if;

  select
    u.company_id,
    u.employee_id,
    c.timezone,
    s.id,
    s.latitude::double precision,
    s.longitude::double precision,
    s.allowed_radius_meters
    into
      v_company_id,
      v_employee_id,
      v_company_timezone,
      v_site_id,
      v_site_latitude,
      v_site_longitude,
      v_site_allowed_radius
  from public.users u
  join public.employees e on e.id = u.employee_id
  join public.companies c on c.id = u.company_id
  join public.sites s on s.id = e.assigned_site_id
  where u.id = auth.uid()
    and u.role = 'employee'::public.app_role
    and u.is_active = true
    and e.is_active = true
    and s.is_active = true;

  if v_employee_id is null then
    raise exception 'Active employee, site, or user profile was not found';
  end if;

  select * into v_settings
  from public.attendance_settings
  where company_id = v_company_id;

  v_require_geofence := coalesce(v_settings.require_geofence, true);
  v_min_accuracy := coalesce(v_settings.minimum_gps_accuracy::double precision, 50);
  v_allow_outside := coalesce(v_settings.allow_check_in_outside_geofence, false);
  v_allow_multiple := coalesce(v_settings.allow_multiple_checkins_per_day, false);
  v_require_notes := coalesce(v_settings.require_notes, false);

  if p_gps_accuracy > v_min_accuracy then
    raise exception 'GPS accuracy is too low. Required <= % meters, received % meters', v_min_accuracy, p_gps_accuracy;
  end if;

  if v_require_notes and nullif(trim(coalesce(p_notes, '')), '') is null then
    raise exception 'Notes are required for attendance';
  end if;

  v_distance := public.calculate_distance_meters(
    p_latitude,
    p_longitude,
    v_site_latitude,
    v_site_longitude
  );

  if v_require_geofence and v_distance > v_site_allowed_radius and not v_allow_outside then
    raise exception 'You are outside the allowed geofence. Distance is % meters and allowed radius is % meters', round(v_distance::numeric, 2), v_site_allowed_radius;
  end if;

  if not exists (
    select 1
    from public.device_sessions ds
    where ds.employee_id = v_employee_id
      and ds.device_id = p_device_id
      and ds.is_active = true
  ) then
    raise exception 'This device is not the active registered session';
  end if;

  v_day_start := date_trunc('day', timezone(v_company_timezone, now())) at time zone v_company_timezone;
  v_day_end := v_day_start + interval '1 day';

  select * into v_latest_record
  from public.attendance_records ar
  where ar.employee_id = v_employee_id
    and ar.attendance_time >= v_day_start
    and ar.attendance_time < v_day_end
  order by ar.attendance_time desc, ar.created_at desc
  limit 1;

  if p_check_type = 'check_in'::public.attendance_check_type then
    if v_latest_record.id is not null and v_latest_record.check_type = 'check_in'::public.attendance_check_type then
      raise exception 'Employee is already checked in';
    end if;

    if not v_allow_multiple and exists (
      select 1
      from public.attendance_records ar
      where ar.employee_id = v_employee_id
        and ar.check_type = 'check_in'::public.attendance_check_type
        and ar.attendance_time >= v_day_start
        and ar.attendance_time < v_day_end
    ) then
      raise exception 'Multiple check-ins are disabled for today';
    end if;
  else
    if v_latest_record.id is null or v_latest_record.check_type <> 'check_in'::public.attendance_check_type then
      raise exception 'A check-out requires an active check-in first';
    end if;
  end if;

  insert into public.attendance_records(
    company_id,
    employee_id,
    site_id,
    check_type,
    attendance_time,
    latitude,
    longitude,
    gps_accuracy,
    distance_from_site,
    device_id,
    device_name,
    notes
  ) values (
    v_company_id,
    v_employee_id,
    v_site_id,
    p_check_type,
    now(),
    p_latitude,
    p_longitude,
    round(p_gps_accuracy::numeric, 2),
    round(v_distance::numeric, 2),
    p_device_id,
    p_device_name,
    nullif(trim(coalesce(p_notes, '')), '')
  ) returning * into v_record;

  perform public.write_audit(v_company_id, auth.uid(), 'attendance.' || p_check_type::text, 'attendance_records', v_record.id);
  return v_record;
end;
$$;

create or replace view public.attendance_records_detailed
with (security_invoker = true)
as
select
  ar.id,
  ar.company_id,
  ar.employee_id,
  e.employee_code,
  e.full_name as employee_name,
  e.department,
  ar.site_id,
  s.name as site_name,
  ar.check_type,
  ar.attendance_time,
  ar.latitude,
  ar.longitude,
  ar.gps_accuracy,
  ar.distance_from_site,
  ar.device_id,
  ar.device_name,
  ar.notes,
  ar.created_at
from public.attendance_records ar
join public.employees e on e.id = ar.employee_id
join public.sites s on s.id = ar.site_id;

grant select on public.attendance_records_detailed to authenticated;

revoke execute on function public.write_audit(uuid, uuid, text, text, uuid) from public, anon, authenticated;
revoke execute on function public.register_device_session(text, text) from public, anon;
revoke execute on function public.record_attendance(public.attendance_check_type, double precision, double precision, double precision, text, text, text) from public, anon;
grant execute on function public.calculate_distance_meters(double precision, double precision, double precision, double precision) to authenticated;
grant execute on function public.register_device_session(text, text) to authenticated;
grant execute on function public.record_attendance(public.attendance_check_type, double precision, double precision, double precision, text, text, text) to authenticated;
grant execute on function public.write_audit(uuid, uuid, text, text, uuid) to service_role;
