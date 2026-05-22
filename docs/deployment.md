# Deployment Guide

## Supabase

1. Create a Supabase project.
2. Apply the SQL migrations in order.
3. Deploy `create-user` and `update-user` Edge Functions.
4. Set Edge Function secrets.
5. Bootstrap the first super admin.
6. Configure company settings, sites, employees, rules, and users from the dashboard.

## Admin Dashboard

The dashboard is a static Vite app and can be deployed to any static host.

```bash
cd apps/admin-dashboard
npm install
npm run build
```

Deploy `apps/admin-dashboard/dist` to Netlify, Vercel, Cloudflare Pages, Supabase Hosting, or any static file host.

Environment variables required at build time:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
```

## Flutter Mobile

Android:

```bash
cd apps/mobile
flutter build appbundle --release \
  --dart-define=SUPABASE_URL=https://your-project-ref.supabase.co \
  --dart-define=SUPABASE_ANON_KEY=your-public-anon-key
```

Installable APK for testing:

```bash
flutter build apk --release \
  --dart-define=SUPABASE_URL=https://your-project-ref.supabase.co \
  --dart-define=SUPABASE_ANON_KEY=your-public-anon-key
```

iOS:

```bash
flutter build ipa --release \
  --dart-define=SUPABASE_URL=https://your-project-ref.supabase.co \
  --dart-define=SUPABASE_ANON_KEY=your-public-anon-key
```

## Production Checklist

- Enable email confirmation or controlled user provisioning according to your rollout policy.
- Add custom SMTP in Supabase if employees will reset passwords.
- Set allowed redirect URLs in Supabase Auth.
- Restrict Edge Function CORS origins before public production launch.
- Verify RLS policies with test users for every role.
- Keep the service-role key only in Supabase Edge Function secrets.
