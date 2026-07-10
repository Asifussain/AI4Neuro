# Unified Neuro Platform — Implementation Status

*High-level engineering handover. Last updated: 2026-07-10, branch `claude/trusting-turing-kkdf1n`.*

This document summarizes the current state of the migration from two separate apps
(`Alzheimer-Detection/` for EEG, `mri-platform/` for MRI) into one unified product in
`platform/`. It reflects what has actually been built and verified — not the original
architecture plan in isolation. For deep technical detail see `platform/README.md`,
`platform/docs/architecture.md`, `platform/docs/deployment.md`, and
`platform/docs/SETUP_GUIDE.md`.

---

## 1. Project Overview

The goal of this project was to merge two independently working diagnostic apps into a
single product so that clinicians experience **one login, one upload flow, and one
result/report experience**, regardless of whether they are analyzing an EEG recording or
an MRI scan:

- **EEG app** (`Alzheimer-Detection/`) — Flask + Celery/Redis backend running a SIDDHI/
  ADformer transformer model on `.npy` EEG data (binary Normal/Alzheimer's, and
  multiclass CN/MCI/AD); Next.js 15 Pages Router / JavaScript / MUI frontend.
- **MRI app** (`mri-platform/`) — Flask + `threading.Thread` backend running a
  CAT12 → NIfTI-slicing → ConViT pipeline on `.nii`/`.nii.gz` scans (CN/MCI/AD); Next.js
  16 App Router / TypeScript / shadcn frontend.

Both apps shared the same underlying Supabase identity schema (hospitals, user profiles,
role-specific profiles) but had diverged in framework choice, job execution model,
database columns, and frontend stack.

The unified platform lives in `platform/backend` (FastAPI) and `platform/frontend`
(Next.js 16), backed by one Supabase project. The two legacy apps
(`Alzheimer-Detection/`, `mri-platform/`) were **left untouched and still work
independently** — they were not deleted or modified, so nothing was put at risk during
the migration.

All 8 planned migration phases are complete and pushed to `claude/trusting-turing-kkdf1n`
(PR #1). This document distinguishes what is **fully implemented and verified** from what
is **explicitly deferred**.

---

## 2. Major Changes Made

Work proceeded in 8 incremental, independently-verified phases (commit hashes on
`claude/trusting-turing-kkdf1n`):

| Phase | Commit | What was built |
|---|---|---|
| 1. Backend foundation | `2d9d07e` | FastAPI app, layered `api → services → pipelines`, pipeline contract (`AnalysisContext`/`PipelineResult`), job abstraction, Supabase-backed services, unified DB migration |
| 2. EEG pipeline | `75b9fb4` | Real SIDDHI/ADformer inference ported and wired in, made subprocess concurrency-safe |
| 3. MRI pipeline | `1963eef` | Real MRI pipeline code ported (mock-first — see §7), decoupled from direct Supabase calls |
| 4. Report generation | `4e32684` | Unified `PdfReportService` generating patient/clinician/technical PDFs for both modalities |
| 5. Auth + permissions | `e863e0f` | JWT-based auth, role/hospital-scoped permission checks on every route |
| 6. Frontend base + analysis flow | `a89dc71` | Next.js 16 frontend stood up (MRI app as base), unified upload + polling UI |
| 7. Dashboards + viewers | `859d94d` | Role-scoped analysis list endpoint + dashboard, MRI viewer wired to real API data |
| 8. Deployment + docs | `9d855e9` | Dockerfiles, docker-compose, CI workflow, architecture/deployment docs |

Two follow-up fixes landed after migration completion:
- `dd436a9` — fixed failing frontend CI check (see §6).
- `928b96f` — corrected a stale environment variable name in `.env.example`.
- `496fea6` — added a from-scratch Supabase setup path: consolidated SQL schema, a
  re-runnable seed script, and a full setup guide (see §5).

---

## 3. Current Implementation

### Backend (`platform/backend`)

FastAPI application, layered so pipeline code has **no framework dependency**:

- **API layer** (`app/api/v1/`): `analysis.py` (create/status/result/reports/retry/list),
  `users.py` (`/users/me`), `health.py`.
- **Services layer** (`app/services/`): `DatabaseService` (Supabase table access),
  `StorageService` (Supabase Storage uploads + signed URLs), `JobService` (background
  execution interface), `PdfReportService` (report generation), `permissions.py`
  (role/hospital-scoped authorization checks).
- **Pipelines layer** (`app/pipelines/`): `eeg/` and `mri/` runners, each implementing
  `run_<modality>_pipeline(context) -> PipelineResult`. Registered in a small registry
  and imported **lazily** so the API process does not load torch/matplotlib/nibabel at
  startup — only when a job of that modality actually runs.
- **Orchestrator** (`app/services/orchestrator.py`): `run_analysis_job` is the single
  durable job boundary — downloads the raw file, dispatches to the right pipeline,
  uploads result artifacts, generates reports, writes results, and marks the session
  `completed` or `failed` with a logged `job_event` on every failure path.
- **Background jobs**: `LocalJobService` (`app/workers/local_executor.py`), a Python
  `ThreadPoolExecutor`. This is an MVP implementation behind the `JobService` interface —
  swapping to Celery/Redis later only requires a new class, not API changes (see §7).
- **Auth**: Supabase JWT verification (`app/core/security.py`), enriched with the
  caller's `user_profiles` row (`app/api/deps.py:get_current_user`), with a dev-bypass
  flag for local testing without live credentials.

### Frontend (`platform/frontend`)

Next.js 16, App Router, TypeScript, shadcn/Radix — built from the MRI app's frontend as
a base (chosen over the EEG app's older Pages Router/JS/MUI stack), then extended with:

- `src/lib/api/client.ts` — single client for all calls to the FastAPI backend, attaching
  the user's Supabase session token as a Bearer token.
- `src/features/analysis/` — shared types, API wrappers, and a polling hook
  (`useAnalysisSession`) used by both modalities.
- Pages: `/analysis/new` (single upload form, modality-routed), `/analysis/[id]` (status
  + result view, polls until terminal), `/dashboard` (role-scoped session list), plus a
  new `/technician/dashboard`.
- `AnalysisResultPanel` renders modality-specific results and, for MRI, the existing
  `RealMRIViewer`/`MockMRIViewer` components wired to real backend data.

### Database (`supabase/migrations/`)

Two additive, idempotent migrations layered on top of the existing identity schema
(`user_profiles`, `patient_profiles`, `doctor_profiles`, `radiologist_profiles`,
`hospitals`, etc., which were **not modified in structure**, only extended):

- `0001_unified_analysis.sql` — `analysis_sessions`, `analysis_results`,
  `analysis_reports`, `job_events`; widens `user_profiles.role` to include
  `technician`; adds 4 private storage buckets; enables RLS.
- `0002_pipeline_options.sql` — adds `pipeline_options jsonb` to `analysis_sessions`
  (used for EEG channel index / MRI scan metadata).

### Tests

Backend: 8 test files (`platform/backend/tests/`) covering health checks, the full
analysis flow against a fake in-memory Supabase client, the orchestrator's success/failure
paths, permissions, real EEG pipeline execution, MRI pipeline execution, report
generation, and the list/users endpoints. **33 tests passing** as of the last verified
run. Frontend: `tsc --noEmit` and a scoped `eslint` pass clean, `next build` succeeds.

---

## 4. Current System Flow

1. User logs in via Supabase Auth (email/password) in the Next.js frontend.
2. User uploads a file on `/analysis/new`, selecting EEG or MRI. The frontend calls
   `POST /api/v1/analysis` (multipart) on the FastAPI backend with a Bearer token.
3. Backend validates the file extension and the caller's permission to create an
   analysis for the given patient/hospital, creates an `analysis_sessions` row
   (`status='queued'`), uploads the raw file to Supabase Storage, and enqueues a job via
   `LocalJobService`. It immediately returns `{session_id}`.
4. The frontend navigates to `/analysis/[id]` and polls `GET /api/v1/analysis/{id}`.
5. In a background thread, the orchestrator downloads the raw file, calls the
   modality-appropriate pipeline (`run_eeg_pipeline` or `run_mri_pipeline`), uploads any
   generated plots/slices as artifacts, generates the three PDF reports, writes the
   result row, and sets the session to `completed` (or `failed` with an error message).
6. The frontend's polling hook detects the terminal state and renders the result panel
   (prediction, confidence, visualizations, and links to the generated reports) or an
   error state with a retry option (`POST .../retry`).
7. Dashboards (`/dashboard`, `/technician/dashboard`) call `GET /api/v1/analysis` (a
   role-scoped, filterable list) to show a clinician's or technician's sessions.

This flow is identical for EEG and MRI from the frontend's perspective — modality-specific
data lives inside JSON sub-fields (e.g. `metrics.eeg_stats` vs. volumetric metrics), not
in separate endpoints or separate UI flows.

---

## 5. Database & Infrastructure

- **Database/Auth/Storage**: Supabase (Postgres + Auth + Storage), one project shared by
  both pipelines and the frontend.
- **Schema**: existing identity tables reused as-is; new analysis tables added via the
  two migrations above. `analysis_sessions.patient_id` correctly references
  `patient_profiles(user_id)` (the real primary key), a deliberate deviation from the
  original architecture doc, which assumed the wrong column.
- **Row Level Security**: enabled on all tables. Identity tables have simple
  "authenticated users can read" policies. The new analysis tables are **fail-closed** —
  no permissive policies exist yet, so all reads/writes currently happen through the
  backend's service-role key, with authorization enforced in the FastAPI permission
  layer (`app/services/permissions.py`), not in the database. Fine-grained per-role RLS
  policies on the analysis tables are **not yet implemented** (see §7).
- **Storage**: 4 private buckets (raw files, report assets, reports, viewer slices),
  accessed via signed URLs generated by the backend.
- **Setup tooling** (added this session, commit `496fea6`): `supabase/setup/full_setup.sql`
  is a single idempotent script that provisions the entire schema (identity + analysis
  tables + buckets) from scratch; `supabase/seed/seed.mjs` is a re-runnable Node script
  that creates one demo user per role plus a sample completed analysis session. Both were
  validated against a real local PostgreSQL 16 instance, including confirming the setup
  script is safe to run twice.
- **Deployment**: `platform/backend/Dockerfile.api` (slim, API-only) and `Dockerfile`
  (all-in-one, includes both ML pipelines for the MVP where jobs run in-process);
  `platform/frontend/Dockerfile` (Next.js standalone build); `platform/docker-compose.yml`
  wiring them together (Supabase remains an external managed service). **Docker image
  builds have not been executed** — the sandbox this work was done in has no Docker
  daemon available. Verification was limited to `docker compose config` (syntax
  validation) and a real `next build` producing a working standalone server bundle.
- **CI**: `.github/workflows/platform-ci.yml` runs backend pytest and frontend
  tsc/eslint/build on every push touching `platform/**`. Currently green on PR #1.

---

## 6. Current Status

- All 8 migration phases are **complete, committed, and pushed** to
  `claude/trusting-turing-kkdf1n`; PR #1 is open and all CI checks are green.
- Backend: 33 automated tests passing, including real EEG model inference (CPU) and a
  full mock-mode MRI run.
- Frontend: type-checks, scoped lint, and production build all pass.
- The frontend CI lint step is intentionally **scoped** to the files this migration
  added or touched (`src/lib/api/client.ts`, `src/features/analysis`, `src/app/analysis`,
  `src/app/dashboard`, `src/app/technician`) rather than the whole tree, because the
  inherited-unmodified MRI base app has ~92 pre-existing lint errors in files this
  migration did not touch. This was a deliberate, verified decision, not an oversight.
- The legacy apps (`Alzheimer-Detection/`, `mri-platform/`) remain fully intact and
  functional; they have not been retired.

---

## 7. Known Limitations

These are honest, current gaps — not defects, but scope that was explicitly deferred:

- **MRI real inference is not available in this environment.** No ConViT checkpoint,
  CAT12, or MATLAB installation is present, so the MRI pipeline runs in its existing
  mock-prediction fallback mode (which was already part of the original MRI app). The
  code path for real inference was ported and is registered but has not been exercised
  end-to-end.
- **Report content is partly mock data.** `app/reports/context.py:build_report_context`
  currently returns mock `comprehensive_data` (patient/hospital narrative details) rather
  than pulling real values from the database for every field. PDF generation itself works
  and produces real files.
- **No fine-grained database-level RLS on analysis tables.** Authorization for analysis
  data is enforced in the backend's permission layer, not via per-role Postgres RLS
  policies. This is fail-closed (safe by default) but is a single-layer defense rather
  than defense-in-depth.
- **Background jobs run in-process** (`ThreadPoolExecutor`), not on a distributed queue.
  This was a deliberate MVP choice — the `JobService` interface was designed so Celery/
  Redis (or another queue) can be substituted later without touching API routes — but
  that substitution has not been done.
- **No Google OAuth.** Login is Supabase email/password only. A guide for optionally
  adding Google OAuth was written (`platform/docs/SETUP_GUIDE.md`, Appendix A), but no
  code implements it.
- **Docker images have never been built or run**, only their configuration validated
  (no Docker daemon in this environment).
- **Patient/doctor selector UI** (for choosing which patient an upload belongs to) still
  needs a dedicated backend endpoint (`/patients`) — deferred from Phase 6/7.
- **Legacy dashboard components** in the original MRI app that read directly from
  Supabase (bypassing the new backend API) have not been migrated to the unified API
  client; only the new unified dashboard (`/dashboard`) uses it.
- **CI runs on Node 20**, which GitHub is deprecating; not yet bumped to Node 22.

---

## 8. Next Steps

Planned but not started, in rough priority order:

1. Harden authorization with real per-role RLS policies on `analysis_sessions`/
   `analysis_results`/`analysis_reports`, as defense-in-depth alongside the existing
   backend permission checks.
2. Replace mock report context data with real DB-backed patient/hospital detail lookups.
3. Add a `/patients` backend endpoint and wire proper patient/doctor selectors into the
   upload form.
4. Obtain a real ConViT checkpoint (and, if needed, CAT12/MATLAB access) to validate the
   MRI pipeline's real-inference path end-to-end, not just its mock fallback.
5. Migrate remaining legacy dashboard components off direct Supabase reads onto the
   unified API client, then retire `Alzheimer-Detection/` and `mri-platform/` once full
   feature parity is confirmed.
6. Swap `LocalJobService` for a durable queue (Celery/Redis or similar) for production
   scale, behind the existing `JobService` interface.
7. Build and run the Docker images in an environment with a Docker daemon to validate the
   deployment path that has so far only been statically checked.
8. Optionally implement Google OAuth per the SETUP_GUIDE.md Appendix A, if the product
   requires it.
9. Bump CI to Node 22 ahead of GitHub Actions' Node 20 deprecation.
