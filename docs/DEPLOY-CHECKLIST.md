# Production deployment checklist

Use this before the first (and every) deploy from `main` to DigitalOcean.

## Environments (never mix)

| | DEV (`dev`) | PROD (`main`) |
| --- | --- | --- |
| Frontend | Vercel (`apps/web`) | DigitalOcean Compose `web` |
| API | API DEV host | API PROD (Compose `api`) |
| Database | PostgreSQL DEV | PostgreSQL PROD |
| Storage | Spaces/bucket DEV | Spaces/bucket PROD |
| Payments | MP/Stripe **sandbox** | MP/Stripe **live** |
| Email | Resend DEV sender | Resend PROD sender |

**DEV never uses DB PROD. PROD never uses DB DEV.**

## Prerequisites

- [ ] Droplet with Docker + Compose; git checkout at `DEPLOY_PATH`.
- [ ] TLS terminator (Caddy / nginx / Traefik) in front of port 3000.
- [ ] GitHub Environment `production` with secrets: `DEPLOY_SSH_KEY`, `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_PATH`.
- [ ] Repository variable `PRODUCTION_URL` (public HTTPS origin).
- [ ] Server `.env` (mode `600`) with **PROD-only** values — see `.env.example` production checklist.
- [ ] Spaces PROD bucket + keys (not MinIO sample keys).
- [ ] Resend domain verified; `NOTIFICATIONS_ENABLED=true`.
- [ ] (Optional) Google Meet: `GOOGLE_MEET_CLIENT_ID` / `_SECRET` / `_REFRESH_TOKEN` (+ Calendar API enabled).
- [ ] Mercado Pago + Stripe **live** tokens + webhook secrets pointing at:
  - `https://<prod>/api/finance/webhooks/mercado-pago`
  - `https://<prod>/api/finance/webhooks/stripe`
- [ ] `SENTRY_DSN` (optional but recommended).

## Deploy steps

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

## Vercel DEV (parallel)

| Setting | Value |
| --- | --- |
| Root Directory | `apps/web` |
| Install | `cd ../.. && npm ci` |
| Build | `cd ../.. && npm run build -w @academia/shared && npm run build -w @academia/web` |
| Env | `NEXT_PUBLIC_APP_URL`, `API_INTERNAL_URL` only |

API DEV secrets stay on the API host, not on Vercel.
