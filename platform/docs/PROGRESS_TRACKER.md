# AI4NEURO Progress Tracker

Last updated: 2026-07-11.

This is the living progress sheet for the unified platform. Update this whenever
we make a setup, security, model, report, or deployment decision.

## Current Safe Point

The repo is at a useful checkpoint for team collaboration:

- unified EEG/MRI upload flow
- light AI4NEURO dashboard direction
- role dashboards routed into unified flow
- patient/doctor dropdowns from Supabase schema
- real EEG binary and multiclass local tests passing
- real MRI ConViT checkpoint smoke test passing with valid synthetic NIfTI
- PDF generation verified across EEG/MRI binary/multiclass report variants
- user-facing analysis errors sanitized
- MRI analysis labels normalized to Binary and Multiclass

## Completed Recently

| Area | Status | Notes |
|---|---:|---|
| EEG binary | Done | Real ADformer checkpoint path verified locally. |
| EEG multiclass | Done | Real ADformer checkpoint path verified locally. |
| MRI multiclass | Done | Real ConViT checkpoint loads and runs on valid NIfTI. |
| MRI binary naming | Done | UI/API now use `binary`; old `ad-only` is a compatibility alias only. |
| MRI multiclass naming | Done | UI/API now use `multiclass`; old `multi-disease` is a compatibility alias only. |
| MRI probability mapping | Done | Binary maps 3-class ConViT output to non-AD vs AD. |
| PDF `N/A` EEG result bug | Done | EEG report context now receives prediction/probabilities/model version. |
| PDF processing time bug | Done | MRI reports now use pipeline `processing_time_ms` converted to seconds. |
| Friendly failures | Done | Raw model exceptions stay in logs; UI receives clean status messages. |
| Supabase JWT support | Done | Backend supports legacy HS256 and newer JWKS asymmetric tokens. |
| Team onboarding guide | Done | See `platform/docs/TEAM_ONBOARDING.md`. |
| Windows teammate path | Done | Backend guidance recommends WSL2 Ubuntu, frontend can run on Windows. |

## Next High-Priority Work

| Priority | Task | Owner | Status |
|---:|---|---|---|
| P0 | Store model artifacts in R2 or Oracle Object Storage | TBD | Pending |
| P0 | Add model sync/bootstrap script for teammates and Oracle VM | Done | Completed |
| P0 | Add checkpoint upload/sync guide and team ownership split | Done | Completed |
| P0 | Confirm backend works with Supabase `sb_secret_...` key | Done | Completed |
| P0 | Install/fix native `dtaidistance` on primary dev machine | Done | Completed |
| P0 | Install/fix native `dtaidistance` on every teammate/VM machine | TBD | Pending |
| P1 | Add `.env.example` comments for publishable/secret Supabase keys | Done | Completed |
| P1 | Add real model smoke-test command/script | Done | Completed |
| P1 | Add UI copy explaining MRI Binary = non-AD vs AD | TBD | Pending |
| P1 | Add CAT12 integration notes and separate CAT12 test plan | Done | Completed |
| P1 | Make reports pull real patient/hospital/doctor details instead of mock context | TBD | Pending |
| P2 | Replace legacy dark/old pages still outside main flow | TBD | Pending |
| P2 | Full lint cleanup for inherited frontend tree | TBD | Pending |

## Model Artifact Plan

Canonical artifact store:

```text
R2 or Oracle Object Storage
```

Runtime paths:

```text
Local developers:
platform/backend/models/...

Oracle VM:
/opt/ai4neuro/models/...
```

Current local paths:

```text
platform/backend/models/eeg/checkpoints
platform/backend/models/mri/ConVit_checkpoint.pth
```

Do not commit model binaries.

Deployment guide:

```text
platform/docs/CHECKPOINT_DEPLOYMENT.md
```

Recommended ownership:

- model owner uploads EEG/MRI artifacts to R2 or Oracle Object Storage
- teammates run `platform/scripts/sync_models_from_object_storage.sh`
- CAT12 owner follows `platform/docs/CAT12_SETUP.md` separately

## Supabase Auth Plan

Current backend auth support:

```text
HS256 legacy JWT secret
JWKS-based ES256/RS256 Supabase signing keys
```

Recommended key usage:

```text
Frontend: sb_publishable_... or legacy anon
Backend:  sb_secret_... preferred, legacy service_role fallback
```

Current finding:

```text
supabase==2.31.0 accepts sb_secret_... during create_client(). The backend is
now pinned to the upgraded client path.
```

Production requirements:

```env
AUTH_DEV_BYPASS=false
```

## CAT12 Plan

Current default:

```env
USE_CAT12_PREPROCESSING=false
```

Reason:

```text
CAT12 is host/tooling dependent and should not block normal teammate setup.
ConViT real MRI inference works without CAT12 by reading valid NIfTI and slicing.
```

CAT12 validation plan is documented in:

```text
platform/docs/CAT12_SETUP.md
```

Current repo support:

- cross-platform CAT12 wrapper
- setup validator script
- real `--run` smoke test command
- user-friendly failure if CAT12 is enabled but no `mwp1` output is produced

Real CAT12 execution is still blocked until a host has CAT12 Standalone and
MATLAB Runtime installed.

## DTW Plan

Primary dev machine status:

```text
Fixed on 2026-07-11 by installing Homebrew libomp.
Real EEG binary pipeline test passed after fix.
```

Common macOS issue:

```text
dtaidistance native extension exists but cannot load because libomp is missing.
```

Fix:

```bash
brew install libomp
pip install --force-reinstall --no-cache-dir "dtaidistance>=2.3.10"
```

Acceptance:

```bash
python -c "import numpy as np; from dtaidistance import dtw; import dtaidistance.dtw_cc; print(dtw.distance_fast(np.array([1.,2.,3.]), np.array([1.,2.,4.])))"
```

## Verification Commands

Backend deterministic suite:

```bash
cd platform/backend
USE_MOCK_MODEL=true .venv/bin/python -m pytest \
  tests/test_analysis_flow.py \
  tests/test_permissions.py \
  tests/test_orchestrator.py \
  tests/test_error_messages.py \
  tests/test_mri_pipeline.py \
  tests/test_reports.py::test_report_generation_matrix_for_all_analysis_variants \
  tests/test_reports.py::test_mri_reports_generate_and_upload
```

Real EEG:

```bash
cd platform/backend
.venv/bin/python -m pytest \
  tests/test_eeg_pipeline.py::test_binary_end_to_end \
  tests/test_eeg_pipeline.py::test_multiclass_shape
```

Frontend:

```bash
cd platform/frontend
npx tsc --noEmit
```
