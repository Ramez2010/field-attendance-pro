# Field Attendance Pro

Standalone attendance mobile application with GPS tracking and geofence validation.

This project intentionally does not connect to Odoo, ERP, payroll, accounting, task management, or HR suites. It focuses only on employees, work sites, attendance capture, GPS validation, monitoring, and reports.

## Repository Structure

```text
apps/
  mobile/                  Flutter Android/iOS employee app
  admin-dashboard/         React/Vite admin dashboard
supabase/
  migrations/              PostgreSQL schema, RLS policies, RPC validation
  functions/               Supabase Edge Functions for secure admin user actions
  seed.sql                 Demo company/site/settings/employee seed data
docs/
  architecture.md          System architecture and security model
  api-service-structure.md Service layer and RPC/Edge Function map
  deployment.md            Deployment guide
```

## Backend

Supabase is used for:

- PostgreSQL data storage
- Supabase Auth
- Row Level Security on every table
- PostgreSQL RPC functions for low-cost attendance validation
- Edge Functions only where service-role access is required, such as creating Auth users

Core migrations:

1. `supabase/migrations/202605210001_initial_schema.sql`
2. `supabase/migrations/202605210002_rls_policies.sql`
3. `supabase/migrations/202605210003_attendance_functions.sql`
4. `supabase/migrations/202605210004_integrity_triggers.sql`
5. `supabase/seed.sql`

## Local Setup

### 1. Supabase

Create a Supabase project, then apply migrations in order from the SQL editor or with the Supabase CLI on a machine where it is installed.

```bash
supabase db push
supabase db reset
```

If using the dashboard SQL editor, run each migration file in order, then run `supabase/seed.sql` if you want demo data.

Deploy Edge Functions:

```bash
supabase functions deploy create-user
supabase functions deploy update-user
```

Set function secrets:

```bash
supabase secrets set SUPABASE_URL=https://your-project-ref.supabase.co
supabase secrets set SUPABASE_ANON_KEY=your-anon-key
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Never expose `SUPABASE_SERVICE_ROLE_KEY` in the mobile app or dashboard.

### 2. Admin Dashboard

```bash
cd apps/admin-dashboard
npm install
cp .env.example .env
npm run dev
```

Required environment variables:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
```

### 3. Mobile App

```bash
cd apps/mobile
flutter pub get
cp .env.example .env
flutter run
```

Required environment variables:

```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-public-anon-key
```

Production mobile builds can use `--dart-define` instead of `.env`:

```bash
flutter build apk --release \
  --dart-define=SUPABASE_URL=https://your-project-ref.supabase.co \
  --dart-define=SUPABASE_ANON_KEY=your-public-anon-key
```

## First Admin User

The first super admin must be bootstrapped once because there is no existing admin to create users yet.

1. Create a Supabase Auth user from the Supabase dashboard.
2. Insert a matching `public.users` row with role `super_admin` and a company id.
3. After that, create all company admins and employees from the admin dashboard.

Example after creating the Auth user and copying its id:

```sql
insert into public.users (id, company_id, role, email, is_active)
values (
  'AUTH_USER_ID_HERE',
  '00000000-0000-4000-8000-000000000001',
  'super_admin',
  'admin@example.com',
  true
);
```

## Security Notes

- All tables have RLS enabled.
- Employees can only read their own profile and attendance records.
- Company admins can only access their own company data.
- Super admins can access all data.
- Attendance inserts are not exposed as direct table inserts. The mobile app calls `record_attendance`, which validates GPS accuracy, geofence distance, device session, duplicate check-ins, and check-out sequence.
- Auth user creation and user role updates go through Edge Functions that validate the caller and use the service-role key server-side only.

## Cost Control

- Attendance validation runs inside PostgreSQL RPC functions to avoid always-on servers.
- Storage is not used by default.
- Reports query indexed attendance tables and a security-invoker view.
- Live monitoring uses polling at a conservative 30-second interval.
