# AI4Neuro

AI-assisted EEG and MRI analysis for early neurological pattern detection.

**Start here → [`platform/README.md`](platform/README.md)** — that's the
active, unified product: one Next.js frontend, one FastAPI backend, one
Supabase project, supporting both EEG and MRI analysis.

## Repository layout

| Path | What it is |
|---|---|
| [`platform/`](platform/README.md) | **The active product.** Unified FastAPI + Next.js app. All new work happens here. |
| [`supabase/`](supabase/setup/full_setup.sql) | Shared database schema (migrations + a from-scratch setup script + seed data). |
| [`Alzheimer-Detection/`](Alzheimer-Detection/README.md) | Legacy standalone EEG app (Flask + Celery). Predates `platform/`; kept running during the migration, not under active development. |
| [`mri-platform/`](mri-platform/frontend/README.md) | Legacy standalone MRI app (Flask + threading). Predates `platform/`; kept running during the migration, not under active development. |
| [`UNIFIED_NEURO_PLATFORM_ARCHITECTURE_PLAN.md`](UNIFIED_NEURO_PLATFORM_ARCHITECTURE_PLAN.md) | The original plan for merging the two legacy apps into `platform/`. |

## Getting started

See [`platform/docs/SETUP_GUIDE.md`](platform/docs/SETUP_GUIDE.md) for a full
local setup walkthrough, and [`platform/docs/TEAM_ONBOARDING.md`](platform/docs/TEAM_ONBOARDING.md)
for team conventions.

## License

Proprietary — see [`LICENSE`](LICENSE).
