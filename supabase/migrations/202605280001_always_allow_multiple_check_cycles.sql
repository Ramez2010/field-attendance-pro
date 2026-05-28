alter table public.attendance_settings
  alter column allow_multiple_checkins_per_day set default true;

update public.attendance_settings
set allow_multiple_checkins_per_day = true
where allow_multiple_checkins_per_day is distinct from true;

insert into public.attendance_settings (
  company_id,
  require_geofence,
  minimum_gps_accuracy,
  allow_check_in_outside_geofence,
  allow_multiple_checkins_per_day,
  require_notes
)
select
  c.id,
  false,
  50,
  false,
  true,
  false
from public.companies c
left join public.attendance_settings s
  on s.company_id = c.id
where s.company_id is null;
