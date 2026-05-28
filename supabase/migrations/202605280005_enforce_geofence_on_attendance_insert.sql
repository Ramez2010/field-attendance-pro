create or replace function public.enforce_attendance_geofence_on_insert()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_require_geofence boolean := true;
  v_allow_outside boolean := false;
  v_site_latitude double precision;
  v_site_longitude double precision;
  v_site_allowed_radius integer;
  v_distance double precision;
begin
  select
    coalesce(s.require_geofence, true),
    coalesce(s.allow_check_in_outside_geofence, false)
    into
      v_require_geofence,
      v_allow_outside
  from public.attendance_settings s
  where s.company_id = new.company_id;

  if not v_require_geofence then
    return new;
  end if;

  select
    st.latitude::double precision,
    st.longitude::double precision,
    st.allowed_radius_meters
    into
      v_site_latitude,
      v_site_longitude,
      v_site_allowed_radius
  from public.sites st
  where st.id = new.site_id
    and st.company_id = new.company_id;

  if v_site_allowed_radius is null then
    raise exception 'Selected site does not belong to your company or no longer exists';
  end if;

  if v_site_latitude is null or v_site_longitude is null then
    raise exception 'Geofence is enabled but selected site has no coordinates';
  end if;

  v_distance := public.calculate_distance_meters(
    new.latitude::double precision,
    new.longitude::double precision,
    v_site_latitude,
    v_site_longitude
  );

  new.distance_from_site := round(v_distance::numeric, 2);

  if not v_allow_outside and v_distance > v_site_allowed_radius then
    raise exception
      'You are outside the allowed geofence. Distance is % meters and allowed radius is % meters',
      round(v_distance::numeric, 2),
      v_site_allowed_radius;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_attendance_records_enforce_geofence on public.attendance_records;
create trigger trg_attendance_records_enforce_geofence
before insert on public.attendance_records
for each row execute function public.enforce_attendance_geofence_on_insert();
