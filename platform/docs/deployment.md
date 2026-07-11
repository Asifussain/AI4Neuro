# Deployment

How to run the unified platform in production. See `README.md` for local dev and
`architecture.md` for how it fits together.

For URL/domain/DNS planning, see
[`PRODUCTION_HOSTING_DNS_REFERENCE.md`](./PRODUCTION_HOSTING_DNS_REFERENCE.md).

---

## Topology

```
Vercel / Node host          Container host                  Managed Supabase
  Next.js frontend   ──►     FastAPI backend        ──►      Postgres + Auth + Storage
                              (jobs run in-process,
                               or split API + workers)
```

Supabase is an **external managed service** — it is not a container in
`docker-compose.yml`. Provision a Supabase project first.

---

## 1. Supabase setup (do this first)

1. **Apply migrations** (idempotent, additive — safe to re-run; test on staging first):
   - `supabase/migrations/0001_unified_analysis.sql` — analysis tables, `technician`
     role, private buckets, RLS (fail-closed), indexes.
   - `supabase/migrations/0002_pipeline_options.sql` — `pipeline_options` column.
   Apply via the Supabase SQL editor or `supabase db push`.
2. **Confirm the buckets** exist and are **private**: `raw-files`, `report-assets`,
   `reports`, `viewer-slices` (0001 creates them; verify in the dashboard).
3. **Keys:** the frontend uses only the public `sb_publishable_...` key. The
   backend uses the server-only `sb_secret_...` key. `SUPABASE_JWT_SECRET` is
   only needed for older HS256 projects; newer Supabase JWT signing keys are
   verified through JWKS using `SUPABASE_URL`.

---

## 2. Environment matrix

### Backend (`backend/.env`, see `.env.example`)

| Var | Notes |
|---|---|
| `APP_ENV` | `production` disables the auth dev-bypass |
| `CORS_ORIGINS` | comma-separated allowlist (no wildcard in prod) |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_JWT_SECRET` | Supabase URL + server-only key; JWT secret optional for legacy HS256 |
| `RAW_FILES_BUCKET` / `REPORT_ASSETS_BUCKET` / `REPORTS_BUCKET` / `VIEWER_SLICES_BUCKET` | bucket names |
| `JOB_BACKEND` / `LOCAL_JOB_MAX_WORKERS` | `local` + worker count (keep low for MRI) |
| `MAX_UPLOAD_MB` / `LOCAL_TMP_DIR` | upload limit + temp dir |
| `AUTH_DEV_BYPASS` | **false in production** |
| `USE_MOCK_MODEL` / `USE_CAT12_PREPROCESSING` | MRI real vs mock |
| `EEG_CHECKPOINT_ROOT` / `EEG_REFERENCE_DIR` / `EEG_SIDDHI_DIR` / `EEG_USE_GPU` | EEG model + data |
| `CONVIT_CHECKPOINT_PATH` / `CAT12_ROOT` / `CAT12_EXE` / `MCR_ROOT` | MRI real mode |

### Frontend (`frontend/.env`, `.env.local` for dev)

| Var | Notes |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public Supabase URL + `sb_publishable_...`, inlined at build time |
| `NEXT_PUBLIC_API_BASE_URL` | e.g. `https://api.ai4neuro.in` |
| `SUPABASE_SERVICE_ROLE_KEY`, `EMAIL_*` | server-only (Next route handlers) |

---

## 3. Docker images

| File | What | Notes |
|---|---|---|
| `backend/Dockerfile` | **All-in-one MVP** — API + both pipelines, jobs in-process | Large (PyTorch). CPU torch via `TORCH_INDEX_URL` build arg. Used by compose. |
| `backend/Dockerfile.api` | **Slim API** — FastAPI only, no ML | Small, fast. The production API image when split from workers. |
| `frontend/Dockerfile` | Next.js **standalone** | Multi-stage; `NEXT_PUBLIC_*` passed as build args. |

**Model weights are not baked in.** Mount them at `/models` (compose maps `./models`):

```
models/
  eeg/checkpoints/classification/ADSZ-Indep/...   # from Alzheimer-Detection/backend/SIDDHI/checkpoints
  eeg/reference/{feature_07.npy, feature_35.npy, representative/*}
  mri/ConViT_model.pth                             # host on Releases/HuggingFace (gitignored)
```

Point `EEG_CHECKPOINT_ROOT`, `EEG_REFERENCE_DIR`, `CONVIT_CHECKPOINT_PATH` at these.
Without the ConViT weights + CAT12, MRI runs in `USE_MOCK_MODEL=true`.

### Compose (MVP)

```bash
cd platform
cp backend/.env.example backend/.env      # fill in
cp frontend/.env.example frontend/.env    # fill in
docker compose up --build
```

`docker compose config` validates the file. (Image builds + a live run need a Docker
daemon + Supabase creds + weights; the CI sandbox used to develop this has no daemon, so
images were not built there — build on a host with Docker.)

---

## 4. MVP vs production (background jobs)

- **MVP (implemented):** one all-in-one backend container runs jobs on a
  `ThreadPoolExecutor`. Simple; good for demo/internal/low concurrency. Caveats: a
  restart loses in-flight jobs, and long MRI jobs occupy the process. Keep
  `LOCAL_JOB_MAX_WORKERS` conservative.
- **Production upgrade (no API changes):** implement `JobService` over Redis/Celery/RQ
  and split images — slim `Dockerfile.api` + an EEG worker (SIDDHI + torch) + an MRI
  worker (torch + timm + nibabel, and CAT12 + MATLAB Runtime for real preprocessing).
  Because the API only calls `job_service.enqueue_analysis(...)`, only the JobService
  implementation and Dockerfiles change. CAT12/MATLAB need a VM/container host where you
  control OS packages (EC2/GCE/Azure/DO), not a PaaS.

---

## 5. Recommended hosting

- **Frontend:** Vercel (or any Node host) — standalone image also works anywhere.
- **Backend MVP:** Render / Railway / Fly.io / a Docker VM.
- **MRI real mode:** a VM/container host (CAT12 + MATLAB Runtime paths are sensitive,
  jobs are long, memory/CPU heavy).

---

## 6. Security release checklist (doc §14.12)

```
[ ] APP_ENV=production and AUTH_DEV_BYPASS=false
[ ] No service-role key in any frontend env; anon key only in the browser
[ ] Supabase JWT verification works through JWKS; `SUPABASE_JWT_SECRET` only if legacy HS256
[ ] Backend enforces role/permission checks (permissions.py)
[ ] CORS restricted to production origins
[ ] Sensitive buckets private; reports served via short-lived signed URLs
[ ] RLS enabled on analysis tables (add per-role SELECT policies before opening
    any direct-Supabase reads)
[ ] Upload size/type limits configured
[ ] Errors return the structured shape, never tracebacks
[ ] Migrations tested on staging before production
```

---

## 7. Verification done in development

- Backend: 33 pytest tests pass against an in-memory Supabase fake (no secrets).
- Frontend: `tsc --noEmit`, ESLint, and `next build` (standalone) all clean.
- Deploy: `docker compose config` valid; Dockerfiles written. Image builds and a live
  end-to-end run are the deploy-time step (need Docker + Supabase + weights).
