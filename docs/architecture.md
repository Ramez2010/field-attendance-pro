# Architecture

Field Attendance Pro is a standalone attendance system with three deployable layers.

## Layers

1. Flutter mobile app
   - Employee login/logout
   - Session restore through Supabase Auth
   - GPS permission and accuracy validation
   - Client-side geofence feedback for fast UX
   - Server-side attendance RPC submission

2. React admin dashboard
   - Company settings
   - Employee management
   - Site/geofence management
   - Attendance rules
   - User management
   - Monitoring and reporting

3. Supabase backend
   - PostgreSQL schema
   - Row Level Security
   - Auth-backed role model
   - RPC functions for attendance validation
   - Edge Functions for service-role-only user creation/update

## Data Access Model

Users never need direct database access. The dashboard and mobile app use Supabase Auth with RLS.

- Employee: own profile, assigned site, attendance settings, own attendance records
- Company admin: data scoped to `company_id`
- Super admin: all data

## Attendance Validation

The mobile app performs early validation for user feedback, but PostgreSQL is authoritative.

`record_attendance` validates:

- Authenticated active employee
- Active assigned site
- Latitude and longitude ranges
- GPS accuracy threshold
- Required notes
- Geofence radius using Haversine distance
- Active device session
- Duplicate check-in rules
- Invalid check-out sequence

## Low-Cost Design

The backend avoids an always-running API server. PostgreSQL functions handle attendance transactions, and Edge Functions are used only when the service-role key is required.
