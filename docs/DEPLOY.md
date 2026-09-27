# Deploying EvoPulse

EvoPulse is one Next.js 15 (App Router) server with SQLite via `node:sqlite`. That fixes three requirements:

1. **Node ≥ 22.13** (`node:sqlite` without a flag). The Dockerfile pins `node:22.20-bookworm-slim`.
2. **A persistent disk.** All state is SQLite files. Serverless/ephemeral hosts (Vercel functions, Netlify)
   lose data and are not supported. Use a container host with a volume: **Fly.io** (`fly.toml`) or **Render**
   (`render.yaml`). Any Docker host with a mounted volume works the same way.
3. **Exactly one instance.** SQLite is single-writer; never scale horizontally.

No deploy target or account exists yet. Nothing in this repo creates one.

## Runtime contract

| Env var | Default in Docker | Used by |
| --- | --- | --- |
| `DB_PATH` | `/data/evopulse.db` | Atlas demo DB (`lib/db.ts`) |
| `CONTROL_DB_PATH` | `/data/control.db` | users, sessions, workspaces (`lib/auth/control-db.ts`) |
| `WORKSPACE_DB_DIR` | `/data/workspaces` | one SQLite file per signed-up workspace (`lib/workspace/db.ts`) |
| `PORT` | `3000` | `next start --port` |
| `NODE_ENV` | `production` | secure session cookies (HTTPS required for login) |
| `NODE_OPTIONS` | `--disable-warning=ExperimentalWarning` | hides the `node:sqlite` experimental notice |
| LLM keys (optional) | unset | see `.env.example`; the demo is fully deterministic without them |

- Start command: `next start --hostname 0.0.0.0 --port $PORT` (production build, not dev).
- Health check: `GET /api/health` → `200 {"ok":true,"db":"sqlite",…}`; `503` if the DB cannot be opened. Read-only.
- The container starts as root only long enough to `chown` the mounted `/data` (Fly volumes and Render disks mount
  root-owned), then drops to the `node` user via `setpriv` (`docker-entrypoint.sh`).
- The first request seeds the Atlas demo DB on an empty volume. Signed-up workspaces start empty.

## Local Docker

```bash
docker build -t evopulse .
docker run --rm -p 3000:3000 -v evopulse-data:/data evopulse
# or: docker compose up --build
curl -s localhost:3000/api/health
node scripts/smoke-http.mjs http://localhost:3000   # golden path (resets the DEMO db)
```

## Fly.io (recommended: simplest volume story)

Prereqs: a Fly.io account with billing enabled, and `flyctl` installed (`curl -L https://fly.io/install.sh | sh`).

```bash
fly auth login
# 1. Pick a globally unique app name and put it in fly.toml (`app = "…"`), then create the app without deploying:
fly launch --no-deploy --copy-config --name <your-app-name> --region cdg
# 2. Create the 1 GB volume that holds every SQLite file (same region as primary_region):
fly volumes create evopulse_data --size 1 --region cdg
# 3. Optional LLM keys (never commit them):
fly secrets set OPENROUTER_API_KEY=...        # optional
# 4. Deploy and check:
fly deploy
fly status
curl -s https://<your-app-name>.fly.dev/api/health
node scripts/smoke-http.mjs https://<your-app-name>.fly.dev
```

Keep one machine: `fly scale count 1`. `min_machines_running = 1` keeps it warm; set it to `0` to allow
scale-to-zero (the volume persists; the first request after sleep takes a few seconds).
Backups: `fly volumes snapshots list <volume-id>` (Fly snapshots volumes daily).

## Render

Prereqs: a Render account on a paid instance type (persistent disks are not available on the free plan), and
this GitHub repo connected to Render.

1. Render dashboard → **New → Blueprint** → select `Mohamedbeghanem/Evopulse` → it reads `render.yaml`.
2. Confirm the `evopulse` web service (Docker, `starter` plan, Frankfurt), the 1 GB disk mounted at `/data`,
   and health check `/api/health`. Add optional LLM keys as environment variables in the dashboard.
3. **Apply**. Render builds the Dockerfile and deploys. Every push to `main` redeploys (auto-deploy).
4. Verify: `curl -s https://<service>.onrender.com/api/health` then
   `node scripts/smoke-http.mjs https://<service>.onrender.com`.

Services with a disk cannot scale beyond one instance and have a few seconds of downtime per deploy (expected).

## After deploy: phone

Open `https://<host>/m` on the phone → *Add to Home Screen* / *Install app*. See [MOBILE.md](./MOBILE.md).

## Golden path checked by `scripts/smoke-http.mjs`

health → supplier delay → **850,000 DZD associated revenue / 540,000 DZD expected cash timing** → simulation +3 days
moves **160,000 DZD (Invoice C)** and leaves the state fingerprint unchanged → "Protect everything at risk this week"
via `/api/ask` stops at APPROVAL_REQUIRED → `/m` shows Approve → human approve + execute → MONITORING with PENDING
verification (**not HANDLED**) → Amine's 10% message → **10% BLOCKED** at `discount_max 5%`, the human route refuses
it, `/m` shows no approve control → the 320K follow-up becomes **HANDLED** only because the same party replied, while
the supplier cascade stays unhandled → `/m` "Needs me" count equals `pulseSummary`.
