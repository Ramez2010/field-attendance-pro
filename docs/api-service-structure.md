# API and Service Structure

## Mobile App Services

`apps/mobile/lib/core/services`

- `supabase_provider.dart`: shared Supabase client and auth stream providers
- `device_info_service.dart`: platform device id and name
- `location_service.dart`: GPS permission checks and high-accuracy location lookup

`apps/mobile/lib/features/auth`

- `AuthRepository.signIn`: signs in with Supabase Auth, then registers the active device session via RPC
- `AuthRepository.signOut`: signs out from Supabase

`apps/mobile/lib/features/attendance`

- `AttendanceRepository.loadContext`: loads user profile, employee, assigned site, settings, and today records
- `AttendanceRepository.recordAttendance`: calls PostgreSQL RPC `record_attendance`
- `GeofenceCalculator`: client-side Haversine calculation for immediate feedback

## Supabase RPC

### `register_device_session`

Called by the mobile app after login. It deactivates previous device sessions for the employee and marks the current device as active.

### `record_attendance`

Called by the mobile app for check-in/check-out. It performs server-side validation and inserts one attendance record inside the database transaction.

### `calculate_distance_meters`

Reusable immutable Haversine distance function.

## Edge Functions

### `create-user`

Used by the admin dashboard to create Supabase Auth users and matching `public.users` profiles. It validates caller role and company scope.

### `update-user`

Used by the admin dashboard to update app role, employee binding, and activation state. It prevents company admins from managing super admins or users outside their company.
