update public.attendance_settings
set allow_check_in_outside_geofence = false
where allow_check_in_outside_geofence is distinct from false;

alter table public.attendance_settings
  alter column allow_check_in_outside_geofence set default false;

alter table public.attendance_settings
  drop constraint if exists attendance_settings_outside_geofence_disabled;

alter table public.attendance_settings
  add constraint attendance_settings_outside_geofence_disabled
  check (allow_check_in_outside_geofence = false);

