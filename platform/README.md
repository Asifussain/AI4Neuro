# Unified Neuro Platform

One product for **EEG** (Alzheimer's, ADformer/SIDDHI) and **MRI** (CAT12 / NIfTI /
ConViT) neuro-analysis. Built by merging two independent apps
(`Alzheimer-Detection/` + `mri-platform/`) into a single Next.js frontend, a single
FastAPI backend, two **internally isolated** ML pipelines, and one Supabase project —
so users experience one login, one upload flow, and one result/report experience
regardless of modality.

> This directory (`platform/`) is the unified product. The two legacy apps remain in
> the repo, untouched, until parity is reached and they are retired.

---

## What it does

```
User logs in
  → picks a patient and uploads an EEG (.npy) or MRI (.nii/.nii.gz) scan
  → backend creates an analysis session (queued)
  → a background job runs the modality pipeline
  → results, plots, viewer slices and PDF reports land in Supabase
  → the frontend polls status and renders the unified result
```

The frontend never cares whether a session is EEG or MRI beyond choosing `modality`;
the backend routes internally, and **both modalities return an identical outer result
shape**.

---

## Architecture

```
                        Next.js frontend  (App Router, TypeScript, shadcn)
                                  |
                                  |  HTTPS  (Authorization: Bearer <supabase jwt>)
                                  v
                          FastAPI backend  (layered)
        api  ──►  services  ──►  pipelines  ──►  models/vendor
         │           │              │
         │           │              ├── eeg/   SIDDHI / ADformer (subprocess)
         │           │              └── mri/   CAT12 → NIfTI slice → ConViT (mock-capable)
         │           │
         │           ├── DatabaseService ─┐
         │           ├── StorageService ──┤──►  Supabase  (Postgres + Auth + Storage)
         │           ├── JobService (ThreadPoolExecutor)
         │           └── PdfReportService
         │
         └── JWT guard + permissions (role + hospital scoped)
```

**Layering rule:** nothing under `app/pipelines/` imports FastAPI. Pipelines take an
`AnalysisContext` and return a `PipelineResult` (plain data) — the API and job
orchestrator dispatch through a registry and never import SIDDHI or ConViT directly.
This is what keeps the two pipelines isolated and swappable.

---

## The full request pipeline (end to end)

1. **Upload** — `POST /api/v1/analysis` (multipart). The route validates the modality
   and file extension, checks `can_create_analysis(role, modality)`, creates a
   `queued` `analysis_sessions` row, uploads the raw file to the `raw-files` bucket,
   records its path, and **enqueues a job** via `JobService.enqueue_analysis(session_id)`.
   Returns `{ session_id, status: "queued", modality, analysis_type }` (202).
2. **Orchestration** — `run_analysis_job(session_id)` (the durable boundary) reads the
   session, downloads the raw file to a per-session temp dir, builds an
   `AnalysisContext`, and calls `run_pipeline(context)` — which the registry dispatches
   to the EEG or MRI runner. Status/stage/progress are written to the DB as it goes;
   every failure marks the session `failed`, records a `job_event`, and cleans up.
3. **EEG pipeline** (`app/pipelines/eeg/`) — runs the ADformer model via the SIDDHI
   subprocess (concurrency-safe: `cwd=` + a unique `--output_path`, no `os.chdir`),
   normalizes to `PipelineResult` (prediction, probabilities, DTW similarity, EEG stats,
   consistency), and writes 3 plot artifacts (timeseries / PSD / similarity).
4. **MRI pipeline** (`app/pipelines/mri/`) — CAT12 → NIfTI slice → ConViT, with a
   **mock fallback** when weights/CAT12 are unavailable (e.g. on Linux). Produces
   volume metrics + normative comparison, similarity, consistency, 3 charts, and (from
   a real NIfTI) per-orientation viewer slices.
5. **Persist** — the orchestrator uploads artifacts to `report-assets` and viewer
   slices to `viewer-slices` (signed URLs → `analysis_results.visualizations`), inserts
   `analysis_results`, then `PdfReportService` renders patient/clinician/technical PDFs
   (reusing the ported fpdf2 builders, dispatched by modality), uploads them to
   `reports`, and writes `analysis_reports`. Report failures are non-fatal.
6. **Poll + render** — the frontend polls `GET /api/v1/analysis/{id}` every ~4s until a
   terminal status, then `GET .../result` and renders the unified result: prediction +
   probabilities, modality-specific visualizations (EEG plots / MRI charts + viewer),
   and report download links. A role-scoped `/dashboard` lists sessions via
   `GET /api/v1/analysis`.

---

## API surface (`/api/v1`)

| Method | Path | Purpose |
|---|---|---|
| POST | `/analysis` | Create an analysis (multipart; modality-routed) |
| GET | `/analysis` | Role-scoped list (filters: modality/status/patient_id/mine) |
| GET | `/analysis/{id}` | Session status (polled) |
| GET | `/analysis/{id}/result` | Unified result |
| GET | `/analysis/{id}/reports` | Report + asset URLs |
| POST | `/analysis/{id}/retry` | Re-queue a failed session |
| GET | `/users/me` | Caller's profile (role/hospital/status) |
| GET | `/health`, `/health/database`, `/health/storage` | Health probes |

See `docs/architecture.md` for the unified result shape and the data model.

---

## Run it

### Local dev (two terminals)

```bash
# Backend
cd platform/backend
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements/dev.txt          # api + tests (add eeg.txt/mri.txt to run real pipelines)
cp .env.example .env                          # fill SUPABASE_* when available
uvicorn app.main:app --reload --port 8000     # http://localhost:8000/docs

# Frontend
cd platform/frontend
npm install
cp .env.example .env.local                    # NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
npm run dev                                    # http://localhost:3000
```

Without Supabase configured the backend still boots (health reports `not_configured`,
DB-backed routes return a clean `503`) and `AUTH_DEV_BYPASS=true` injects a dev admin,
so you can exercise the API locally.

### Docker Compose

```bash
cd platform
cp backend/.env.example backend/.env          # SUPABASE_* etc.
cp frontend/.env.example frontend/.env        # NEXT_PUBLIC_* etc.
docker compose up --build
```

Supabase is an **external managed service** (not a container). Apply the SQL in
`../supabase/migrations/` and create the buckets first — see `docs/deployment.md`.

---

## Repo layout

```
platform/
  backend/            FastAPI (layered: api → services → pipelines → models)
    app/api/v1/       health, analysis, users
    app/core/         config, logging, security (JWT)
    app/services/     database, storage, jobs, orchestrator, reports, permissions
    app/pipelines/    base (contracts+registry), eeg/, mri/
    app/reports/      eeg/ + mri/ fpdf2 builders + context
    requirements/     api / eeg / mri / dev
    tests/            33 pytest tests (FakeSupabase, no secrets)
    Dockerfile        all-in-one MVP · Dockerfile.api  slim API
  frontend/           Next 16 App Router / TS / shadcn (MRI base + unified flow)
    src/lib/api/      unified backend client (JWT)
    src/features/analysis/  types, api, hooks, components
    src/app/analysis/ new + [id] · src/app/dashboard · src/app/technician
    Dockerfile        Next standalone
  docs/               architecture.md · deployment.md
  docker-compose.yml
../supabase/migrations/   0001_unified_analysis.sql · 0002_pipeline_options.sql
```

---

## Verification status

- **Backend:** 33 pytest tests pass (health, upload validation, full job loop, real EEG
  E2E, MRI mock + real viewer-slice extraction, report `%PDF` generation, permissions,
  list/scoping). Verified against an in-memory `FakeSupabase` — no secrets needed.
- **Frontend:** `tsc --noEmit` clean, ESLint clean, `next build` succeeds (standalone).
- **Deploy:** Dockerfiles + compose written; `docker compose config` validates. Image
  builds and a live end-to-end run require Docker + Supabase creds + model weights
  (the sandbox has no Docker daemon) — see `docs/deployment.md`.
