drop function if exists public.record_attendance(
  public.attendance_check_type,
  double precision,
  double precision,
  double precision,
  text,
  text,
  text
);

create or replace function public.record_attendance(
  p_check_type public.attendance_check_type,
  p_latitude double precision,
  p_longitude double precision,
  p_gps_accuracy double precision,
  p_device_id text,
  p_device_name text default null,
  p_notes text default null,
  p_site_id uuid default null
)
returns public.attendance_records
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_employee_id uuid;
  v_assigned_site_id uuid;
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
  v_require_geofence boolean;
  v_allow_outside boolean;
  v_require_notes boolean;
  v_min_accuracy double precision;
  v_has_site_assignments boolean;
  v_has_explicit_site_selection boolean;
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
    e.assigned_site_id,
    c.timezone
    into
      v_company_id,
      v_employee_id,
      v_assigned_site_id,
      v_company_timezone
  from public.users u
  join public.employees e on e.id = u.employee_id
  join public.companies c on c.id = u.company_id
  where u.id = auth.uid()
    and u.role = 'employee'::public.app_role
    and u.is_active = true
    and e.is_active = true;

  if v_employee_id is null then
    raise exception 'Active employee or user profile was not found';
  end if;

  select * into v_settings
  from public.attendance_settings
  where company_id = v_company_id;

  v_require_geofence := coalesce(v_settings.require_geofence, false);
  v_min_accuracy := coalesce(v_settings.minimum_gps_accuracy::double precision, 50);
  v_allow_outside := coalesce(v_settings.allow_check_in_outside_geofence, false);
  v_require_notes := coalesce(v_settings.require_notes, false);

  if p_gps_accuracy > v_min_accuracy then
    raise exception 'GPS accuracy is too low. Required <= % meters, received % meters', v_min_accuracy, p_gps_accuracy;
  end if;

  if v_require_notes and nullif(trim(coalesce(p_notes, '')), '') is null then
    raise exception 'Notes are required for attendance';
  end if;

  v_has_explicit_site_selection := p_site_id is not null;
  select exists (
    select 1
    from public.employee_site_assignments esa
    where esa.employee_id = v_employee_id
  ) into v_has_site_assignments;

  if v_has_explicit_site_selection then
    v_site_id := p_site_id;

    if v_has_site_assignments then
      if not exists (
        select 1
        from public.employee_site_assignments esa
        where esa.employee_id = v_employee_id
          and esa.site_id = v_site_id
      ) and v_site_id <> v_assigned_site_id then
        raise exception 'Selected site is not assigned to your profile';
      end if;
    elsif v_assigned_site_id is not null and v_site_id <> v_assigned_site_id then
      raise exception 'Selected site is not assigned to your profile';
    end if;
  elsif v_has_site_assignments then
    select esa.site_id
      into v_site_id
    from public.employee_site_assignments esa
    where esa.employee_id = v_employee_id
    order by
      case when esa.is_primary then 0 else 1 end,
      esa.created_at
    limit 1;

    if v_site_id is null then
      v_site_id := v_assigned_site_id;
    end if;
  else
    v_site_id := v_assigned_site_id;
  end if;

  if v_site_id is not null then
    select
      s.id,
      s.latitude::double precision,
      s.longitude::double precision,
      s.allowed_radius_meters
      into
        v_site_id,
        v_site_latitude,
        v_site_longitude,
        v_site_allowed_radius
    from public.sites s
    where s.id = v_site_id
      and s.company_id = v_company_id
      and s.is_active = true;
  end if;

  if v_site_id is null then
    if v_has_explicit_site_selection then
      raise exception 'Selected site is not active or does not belong to your company';
    end if;

    if v_has_site_assignments or v_assigned_site_id is not null then
      raise exception 'No active assigned site is available for attendance';
    end if;

    if v_require_geofence then
      raise exception 'Geofence is required but no assigned active site with coordinates is configured';
    end if;

    select
      s.id,
      s.latitude::double precision,
      s.longitude::double precision,
      s.allowed_radius_meters
      into
        v_site_id,
        v_site_latitude,
        v_site_longitude,
        v_site_allowed_radius
    from public.sites s
    where s.company_id = v_company_id
      and s.is_active = true
    order by s.created_at
    limit 1;

    if v_site_id is null then
      insert into public.sites(
        company_id,
        name,
        address,
        latitude,
        longitude,
        allowed_radius_meters,
        is_active
      )
      values (
        v_company_id,
        'General Attendance Site',
        'Auto-created for optional geofence mode',
        null,
        null,
        100,
        true
      )
      on conflict (company_id, name)
      do update
      set
        is_active = true,
        address = excluded.address
      returning
        id,
        latitude::double precision,
        longitude::double precision,
        allowed_radius_meters
      into
        v_site_id,
        v_site_latitude,
        v_site_longitude,
        v_site_allowed_radius;
    end if;

    if v_assigned_site_id is null and v_site_id is not null then
      update public.employees
      set assigned_site_id = v_site_id
      where id = v_employee_id
        and assigned_site_id is null;
    end if;
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
  else
    if v_latest_record.id is null or v_latest_record.check_type <> 'check_in'::public.attendance_check_type then
      raise exception 'A check-out requires an active check-in first';
    end if;

    v_site_id := v_latest_record.site_id;
    select
      s.id,
      s.latitude::double precision,
      s.longitude::double precision,
      s.allowed_radius_meters
      into
        v_site_id,
        v_site_latitude,
        v_site_longitude,
        v_site_allowed_radius
    from public.sites s
    where s.id = v_site_id
      and s.company_id = v_company_id;

    if v_site_id is null then
      raise exception 'The site used for your active check-in is no longer available';
    end if;
  end if;

  if v_require_geofence then
    if v_site_latitude is null or v_site_longitude is null then
      raise exception 'Geofence is enabled but selected site has no coordinates';
    end if;
  end if;

  if v_site_latitude is null or v_site_longitude is null then
    v_distance := 0;
  else
    v_distance := public.calculate_distance_meters(
      p_latitude,
      p_longitude,
      v_site_latitude,
      v_site_longitude
    );
  end if;

  if v_require_geofence and v_distance > v_site_allowed_radius and not v_allow_outside then
    raise exception 'You are outside the allowed geofence. Distance is % meters and allowed radius is % meters', round(v_distance::numeric, 2), v_site_allowed_radius;
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

grant execute on function public.record_attendance(
  public.attendance_check_type,
  double precision,
  double precision,
  double precision,
  text,
  text,
  text,
  uuid
) to authenticated;
