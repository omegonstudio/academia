# Production deployment checklist

Use this before the first (and every) deploy from `main` to DigitalOcean.

## Environments (never mix)

| | DEV (`dev`) | PROD (`main`) |
| --- | --- | --- |
| Frontend | Vercel Services `web` | DigitalOcean Compose `web` |
| API | Vercel Services `api` (Fluid) | DigitalOcean Compose `api` |
| Database | Neon DEV | PostgreSQL PROD |
| Storage | Optional omit / Spaces DEV | Spaces/bucket PROD |
| Payments | MP/Stripe **sandbox** (optional) | MP/Stripe **live** |
| Email | Resend DEV sender (optional) | Resend PROD sender |

**DEV never uses DB PROD. PROD never uses DB DEV.**

---

## Vercel DEV (operator checklist — you)

Do this after the repo has `vercel.json` Services on branch `dev`.

### 1. Project

- [ ] Import the Git repo in Vercel.
- [ ] **Root Directory empty** (monorepo root — not `apps/web`).
- [ ] Production Branch = `dev`.
- [ ] Node.js 22.
- [ ] Confirm deploy uses root [`vercel.json`](../vercel.json) (`web` + `api` services).

### 2. Neon

- [ ] Marketplace → Neon → install and connect to this project.
- [ ] Scope: Production (for `dev` deploys); Preview optional.
- [ ] Note pooled `DATABASE_URL` and direct `DATABASE_URL_UNPOOLED`.

### 3. Environment variables (Production scope of this DEV project)

**Web**

- [ ] `NEXT_PUBLIC_APP_URL` = `https://<project>.vercel.app` (update after first URL is known).
- [ ] Do **not** set `API_INTERNAL_URL` manually (service binding injects it).

**API**

- [ ] `NODE_ENV=production`
- [ ] `DATABASE_URL` = Neon pooled (integration may inject).
- [ ] `DATABASE_URL_UNPOOLED` = Neon direct.
- [ ] `AUTH_SECRET` = `openssl rand -base64 48` (not the sample from `.env.example`).
- [ ] `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` (≥12 chars).
- [ ] `DIRECTOR_EMAIL` / `DIRECTOR_PASSWORD` (≥12 chars).
- [ ] `LOAD_SEED_DATA=false`
- [ ] `APP_PUBLIC_URL` = same as `NEXT_PUBLIC_APP_URL`
- [ ] `ACADEMY_TIMEZONE=America/Argentina/Buenos_Aires`
- [ ] `CORS_ALLOWED_ORIGINS` empty
- [ ] **Do not set `S3_*`** until materials are needed
- [ ] Optional later: Resend, MP/Stripe TEST, Meet/Zoom

### 4. Migrate + smoke

- [ ] `vercel env pull` (or copy unpooled URL) → `npm run db:deploy`
- [ ] Redeploy / hit the site so the API cold-starts and bootstraps identities
- [ ] Open the URL → `/login` → dashboard
- [ ] Confirm `/api/health` (Network) returns healthy / `ok`
- [ ] Disable Deployment Protection or use a shareable link if you want others to open DEV

### 5. Share

- [ ] Send the Vercel URL
- [ ] Tell testers: materials uploads are off until `S3_*` is configured; payments stay stubs unless sandbox keys are set

---

## Prerequisites (DigitalOcean PROD)

- [ ] Droplet with Docker + Compose; git checkout at `DEPLOY_PATH`.
- [ ] TLS terminator (Caddy / nginx / Traefik) in front of port 3000.
- [ ] GitHub Environment `production` with secrets: `DEPLOY_SSH_KEY`, `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_PATH`.
- [ ] Repository variable `PRODUCTION_URL` (public HTTPS origin).
- [ ] Server `.env` (mode `600`) with **PROD-only** values — see `.env.example` production checklist.
- [ ] Spaces PROD bucket + keys (not MinIO sample keys).
- [ ] Resend domain verified; `NOTIFICATIONS_ENABLED=true`.
- [ ] (Optional) Google Meet: `GOOGLE_MEET_CLIENT_ID` / `_SECRET` / `_REFRESH_TOKEN` (+ Calendar API enabled).
- [ ] (Optional) Zoom S2S (API host only): `ZOOM_ACCOUNT_ID` / `ZOOM_CLIENT_ID` / `ZOOM_CLIENT_SECRET` / `ZOOM_HOST_USER_ID`. With `GOOGLE_MEET_*` also set, Zoom classes get a Calendar link event.
- [ ] Mercado Pago + Stripe **live** tokens + webhook secrets pointing at:
  - `https://<prod>/api/finance/webhooks/mercado-pago` (or API origin + `/finance/webhooks/mercado-pago` if ngrok/API is exposed directly)
  - `https://<prod>/api/finance/webhooks/stripe`
- [ ] `API_PUBLIC_URL` set to the publicly reachable API base so Preferences include `notification_url`
- [ ] `SENTRY_DSN` (optional but recommended).

## Deploy steps (PROD)

1. Merge validated work: PR `feature/*` → `dev` → (validate) → PR `dev` → `main`.
2. Push to `main` triggers `.github/workflows/production.yml` (CI gate + SSH `prod-up.sh`).
3. Confirm `scripts/health-check.sh` / public `PRODUCTION_URL` respond.
4. Smoke: login → create student (email + in-app) → assign teacher → set `meetingUrl` → student checkout (live).

## Rollback

```bash
cd "$DEPLOY_PATH"
git reset --hard <good-sha>
./scripts/prod-up.sh
```

Forward-only migrations: undo with a new migration, never auto-drop.
