# Deploying MamaDoc to Vercel

## Environment variables

Set these in Vercel → Project → Settings → Environment Variables.
**Names only — never paste real values into docs, code, or git.**

| Name | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string (Neon) |
| `SESSION_SECRET` | Session cookie signing key |
| `HEALTH_DATA_KEY` | AES-256-GCM key for health data (32 random bytes, base64) |
| `EMERGENCY_NUMBER` | Emergency number shown in safety notices (e.g. 112) |
| `APP_TZ` | Timezone for dates/times (e.g. Africa/Lagos) |
| `DEMO_MODE` | Enables demo "Try demo" buttons (`true`/`false`) |

`.env` stays local/git-ignored; Vercel is the source of truth in production.

## Build settings

- **Install command:** `npm install`
  (the `postinstall` script runs `prisma generate`)
- **Build command:** `npm run build`
  (runs `prisma generate && next build` — fixes Vercel's "Prisma was generated
  outside the build" error)
- **Output:** Next.js default (no override needed)

## After the first deploy

1. Run `npx prisma migrate deploy` once against the production `DATABASE_URL`
   (or seed the database) so the schema exists.
2. Confirm the app loads and login works before sharing the link.
