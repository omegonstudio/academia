# Branching — Academia

Definitive Git workflow for this repository.

## Branches

| Branch | Role |
| --- | --- |
| `main` | Production-ready history only. **Never commit directly.** Updated only by PR from `dev` when a Stage (or an explicit slice) is ready to promote. Deploy target: DigitalOcean PROD (future). |
| `dev` | Integration branch. All Stage work lands here first. Hosted frontend DEV on Vercel; API/DB/storage DEV are separate. Day-to-day base for feature branches. |
| `feature/stage-N-<slug>` | Short-lived work branches cut from `dev`. Open PRs into `dev`, not into `main`. |

```text
feature/*  →  (PR)  →  dev  →  CI + Vercel DEV  →  validation
                              ↓
                         (PR)  →  main  →  CI  →  DigitalOcean PROD
```

## Rules

1. **Do not push product work to `main`.** Use a PR `dev` → `main`.
2. **Do not open Stage PRs against `main`.** Target `dev`.
3. Cut every new Stage increment from the tip of `dev`.
4. Keep `ROUTE-MAP.md`, `TODO.md`, and `docs/DECISIONS.md` in sync on every PR into `dev`.
5. Prefer one Stage (or one Stage slice) per promotion `dev` → `main`.
6. **DEV never uses the PROD database** (and the reverse). Hosted secrets are
   environment-specific — see `docs/INFRASTRUCTURE.md`.

## Historical branch (do not use)

`feature/stage-0-foundation-infrastructure` carried Stage 0–1 and the start of
Stage 2 before `dev` existed. It remains on the remote as history only.

- Do **not** open new PRs from it.
- Do **not** merge new work into it.
- Do **not** continue Stage work on it.

New work starts from `dev` (or from a `feature/stage-N-*` branch based on `dev`).

## Naming

```text
feature/stage-4-classes-calendar
feature/stage-4-calendar-ui
feature/stage-5-materials
```

Use the Stage number and a short kebab-case slug.

## Local setup after clone

```bash
git fetch origin
git checkout dev
git pull --ff-only origin dev
git checkout -b feature/stage-N-<slug>
```
