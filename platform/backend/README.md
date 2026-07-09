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

## Status: Phase 1 (foundation)

Implemented and verified:

- `GET /api/v1/health[/database|/storage]`
- `POST /api/v1/analysis` (multipart; validates modality + extension, creates a
  session, uploads the raw file, enqueues a background job)
- `GET /api/v1/analysis/{id}` (status), `.../result`, `.../reports`
- `POST /api/v1/analysis/{id}/retry`
- `JobService` (ThreadPoolExecutor) + orchestrator with failure handling + cleanup
- Supabase JWT guard (with `AUTH_DEV_BYPASS` for local dev)
- Unified SQL migration (`../../supabase/migrations/0001_unified_analysis.sql`)

Pipelines are **deterministic stubs** in this phase so the full job loop runs
without torch/weights. Real EEG (Phase 2) and MRI (Phase 3) runners register in
place of the stubs (`app/pipelines/__init__.py`).

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
