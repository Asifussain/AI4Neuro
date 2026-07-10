# Unified Neuro Platform — Backend (FastAPI)

One API for EEG and MRI neuro-analysis. This is the merge target for the two
legacy Flask backends (`Alzheimer-Detection/backend`, `mri-platform/backend`).
See `../../UNIFIED_NEURO_PLATFORM_ARCHITECTURE_PLAN.md` for the full design and
`/root/.claude/plans/…` for the migration plan.

## Layered architecture

```
api (FastAPI routes)      app/api/v1/*        — orchestrate only, no ML
  ↓
services                  app/services/*      — database, storage, jobs, orchestrator, reports
  ↓
pipelines                 app/pipelines/*     — framework-independent ML (no FastAPI imports)
  ↓
models/vendor                                 — SIDDHI/ADformer, ConViT, CAT12 (added in Phases 2–3)
```

The **pipeline boundary** is the key contract: a runner takes an `AnalysisContext`
and returns a `PipelineResult` (`app/pipelines/base.py`). The API and job
orchestrator never import SIDDHI or ConViT — they dispatch through the registry,
so both modalities return an identical outer shape and background execution can be
swapped (ThreadPoolExecutor → Celery) without touching routes.

## Status: complete backend (all phases)

Implemented and verified (33 pytest tests):

- `GET /api/v1/health[/database|/storage]`, `GET /api/v1/users/me`
- `POST /api/v1/analysis` (multipart; modality + extension validation, session
  creation, raw-file upload, job enqueue) with create-permission enforcement
- `GET /api/v1/analysis` (role-scoped list), `GET /analysis/{id}` (status),
  `.../result`, `.../reports`, `POST /analysis/{id}/retry` — all read/retry
  permission-enforced
- `JobService` (ThreadPoolExecutor) + orchestrator (failure handling, job events,
  cleanup); artifacts/viewer-slices uploaded; results + reports persisted
- **Real EEG pipeline** (SIDDHI/ADformer, subprocess, concurrency-safe) and
  **MRI pipeline** (CAT12/NIfTI/ConViT, mock-first) behind the registry
- **Report generation** — one `PdfReportService`, modality-dispatched fpdf2 builders
- **Auth + permissions** — Supabase JWT verify + `user_profiles` load + role/hospital
  checks (`AUTH_DEV_BYPASS` for local dev only)
- Migrations `0001_unified_analysis.sql` + `0002_pipeline_options.sql`

Both pipelines register **lazily**, so this API image boots with zero ML libraries
imported; the heavy modules load only when a job of that modality runs. See
`../docs/architecture.md`.

## Run locally

```bash
cd platform/backend
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements/dev.txt          # api + test deps
cp .env.example .env                          # fill in Supabase creds when available
uvicorn app.main:app --reload --port 8000
# → http://localhost:8000/docs
```

Without Supabase configured the app still boots; health checks report
`not_configured` and DB-backed routes return a clean `503 service_unavailable`.

## Test

```bash
pytest            # 12 tests: health, upload validation, full job loop, orchestrator failure paths
```

Tests inject an in-memory `FakeSupabase` (`tests/fake_supabase.py`) and run jobs
synchronously, so no credentials are needed.

## Requirements layout (per architecture doc §3.3)

- `requirements/api.txt` — FastAPI + Supabase + auth (small image, no ML)
- `requirements/eeg.txt` — EEG pipeline deps (torch, dtaidistance, …) — Phase 2
- `requirements/mri.txt` — MRI pipeline deps (torch, timm, nibabel, …) — Phase 3
- `requirements/dev.txt` — api + pytest/httpx/numpy
