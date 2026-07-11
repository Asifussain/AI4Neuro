# AI4NEURO Team Onboarding Runbook

Last updated: 2026-07-11.

This guide is for teammates who clone the repo and need a predictable local
setup. It separates the product app setup from large model artifacts, Supabase
secrets, and host-specific CAT12 tooling.

## 1. What GitHub Contains

GitHub should contain:

- FastAPI backend code
- Next.js frontend code
- Supabase schema/seed scripts
- tests and docs
- model artifact instructions

GitHub should not contain:

- `.env` or `.env.local`
- `.pth`, `.pt`, `.ckpt`
- EEG checkpoint folders
- MRI checkpoint files
- local `.DS_Store` files

Large model files are runtime artifacts. They must live in object storage and be
synced to each developer's local disk or to the Oracle VM.

Detailed artifact deployment guide:
[CHECKPOINT_DEPLOYMENT.md](./CHECKPOINT_DEPLOYMENT.md).

Pipeline execution reference:
[PIPELINE_EXECUTION_REFERENCE.md](./PIPELINE_EXECUTION_REFERENCE.md).

## 2. Recommended OS Strategy

Use this matrix as the team default:

| OS | Backend/model work | Frontend work | Model sync script | Notes |
| --- | --- | --- | --- | --- |
| macOS | Supported in Terminal | Supported in Terminal | Supported | Best local setup for Mac teammates. Install `libomp`. |
| Ubuntu/Linux | Supported in Bash | Supported in Bash | Supported | Closest to Oracle VM production. |
| Windows | Use WSL2 Ubuntu | Native Windows or WSL2 | Run inside WSL2 | Do not use native Windows Python as the default backend path. |

The backend, EEG/MRI pipelines, and checkpoint sync should use a Unix-like
environment: macOS Terminal, Ubuntu/Linux Bash, or WSL2 Ubuntu on Windows. This
keeps paths, subprocesses, PyTorch, NIfTI handling, and future CAT12 work close
to production.

### macOS

macOS is fully supported for local product development and real EEG/MRI model
testing.

Use:

```text
Homebrew
Python 3.11 or 3.12
Node.js 20+
```

Install native DTW support:

```bash
brew install libomp
```

### Ubuntu/Linux

Ubuntu/Linux is fully supported and is closest to the planned Oracle VM backend
environment. Use this path for Ubuntu laptops, WSL2 Ubuntu, and the Oracle VM.

Install system packages:

```bash
sudo apt-get update
sudo apt-get install -y python3 python3-venv python3-pip build-essential libomp-dev git
```

### Windows

For Windows developers, use WSL2 Ubuntu for backend/model work.

Recommended setup:

```text
Backend: WSL2 Ubuntu
Frontend: Windows native or WSL2
Repo location: inside the WSL filesystem, not C:\ or /mnt/c
Model sync: inside WSL2 Ubuntu
```

Do not make native Windows Python the default backend path. It can work, but it
creates more friction with PyTorch, compiled DTW, NIfTI tooling, path handling,
and future CAT12 work.

WSL2 backend setup:

```bash
sudo apt-get update
sudo apt-get install -y python3 python3-venv python3-pip build-essential libomp-dev git

mkdir -p ~/projects
cd ~/projects
git clone <repo-url>
cd AI4Neuro/platform/backend

python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements/dev.txt
pip install -r requirements/eeg.txt -r requirements/mri.txt
```

Start the WSL2 backend:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Windows frontend setup:

```powershell
cd AI4Neuro\platform\frontend
npm ci
copy .env.example .env.local
npm run dev
```

Set frontend API URL:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

Windows developers should run the model sync helper inside WSL2, not PowerShell.

Native Windows is acceptable for the Next.js frontend only:

```powershell
cd AI4Neuro\platform\frontend
nvm use 20
npm ci
npm run dev
```

## 3. Minimum Local Modes

### Product E2E Mode

Use this mode for teammates who only need login, upload, status, results, and PDF
flows.

```env
USE_MOCK_MODEL=true
USE_CAT12_PREPROCESSING=false
AUTH_DEV_BYPASS=true
```

This mode does not need checkpoints.

### Real EEG Mode

Use this mode for testing EEG checkpoints locally.

```env
USE_MOCK_MODEL=false
USE_CAT12_PREPROCESSING=false
EEG_CHECKPOINT_ROOT=/absolute/path/to/platform/backend/models/eeg/checkpoints
EEG_REFERENCE_DIR=/absolute/path/to/Alzheimer-Detection/backend
EEG_SIDDHI_DIR=/absolute/path/to/platform/backend/app/pipelines/eeg/siddhi
EEG_USE_GPU=false
```

EEG binary expects `.npy` shaped like:

```text
segments x 128 x 19
```

EEG multiclass expects `.npy` shaped like:

```text
segments x 256 x 19
```

### Real MRI Mode

Use this mode for ConViT checkpoint testing with valid NIfTI files.

```env
USE_MOCK_MODEL=false
USE_CAT12_PREPROCESSING=false
CONVIT_CHECKPOINT_PATH=/absolute/path/to/platform/backend/models/mri/ConVit_checkpoint.pth
MRI_USE_GPU=false
MRI_MODEL_VERSION=ConViT-v1.0
```

Upload only valid `.nii` or `.nii.gz` files. Fake bytes should fail with a clean
user-facing error.

## 4. Model Artifact Distribution

Recommended shared storage:

```text
Cloudflare R2 or Oracle Object Storage
```

Recommended local runtime layout:

```text
platform/backend/models/
  eeg/checkpoints/
    classification/...
  mri/
    ConVit_checkpoint.pth
```

Recommended Oracle VM runtime layout:

```text
/opt/ai4neuro/models/
  eeg/checkpoints/
  eeg/reference/
  mri/ConViT_model.pth
```

Team rule:

```text
Download or sync model artifacts once. Do not commit them. Do not download them
on every request.
```

Use the repo sync helper after the team creates a shared R2/Oracle bucket:

```bash
cd platform
AWS_ACCESS_KEY_ID=... \
AWS_SECRET_ACCESS_KEY=... \
MODEL_BUCKET=ai4neuro-models \
MODEL_ENDPOINT_URL=https://<account-id>.r2.cloudflarestorage.com \
MODEL_PREFIX=ai4neuro \
./scripts/sync_models_from_object_storage.sh
```

For Oracle Object Storage S3 compatibility, use Oracle's S3 endpoint as
`MODEL_ENDPOINT_URL` and an S3-compatible access key pair.

For the full upload/sync flow and ownership split, use:
[CHECKPOINT_DEPLOYMENT.md](./CHECKPOINT_DEPLOYMENT.md).

## 5. CAT12 Boundary

CAT12 is not a normal Python dependency. It requires host-level neuroimaging
tooling and a separate validation path. Keep the teammate-friendly default:

```env
USE_CAT12_PREPROCESSING=false
```

With CAT12 off, MRI still performs:

```text
NIfTI read -> slice extraction -> ConViT inference -> charts -> reports
```

CAT12 should not block teammates from testing real EEG or real ConViT MRI
inference. When we are ready to test or deploy CAT12, use the dedicated guide:
[CAT12_SETUP.md](./CAT12_SETUP.md).

Recommended ownership:

- One teammate owns CAT12 setup and smoke testing.
- Everyone else keeps `USE_CAT12_PREPROCESSING=false`.
- Checkpoints are shared through object storage using
  [CHECKPOINT_DEPLOYMENT.md](./CHECKPOINT_DEPLOYMENT.md).

## 6. Supabase Keys And JWT Verification

Supabase now recommends:

- frontend: publishable key, `sb_publishable_...`
- backend: secret key, `sb_secret_...`

Legacy keys still work:

- frontend: legacy `anon`
- backend: legacy `service_role`

Backend env keeps the existing variable name:

```env
SUPABASE_SERVICE_ROLE_KEY=
```

Put the newer `sb_secret_...` key there. Legacy `service_role` can still be used
as a fallback, but `sb_secret_...` is the preferred backend key after upgrading
the backend Supabase client to `supabase==2.31.0`. Never expose either backend
key in the browser.

For user JWT verification:

- legacy HS256 tokens use `SUPABASE_JWT_SECRET`
- newer ES256/RS256 tokens are verified through the Supabase JWKS endpoint

The backend now supports both. `AUTH_DEV_BYPASS=true` is acceptable only for local
setup. Production must use:

```env
AUTH_DEV_BYPASS=false
```

## 7. DTW Native Dependency

EEG similarity uses `dtaidistance`. If the native extension is unavailable, the
pipeline falls back to slower Python DTW.

On macOS, the common issue is missing OpenMP:

```text
Library not loaded: /opt/homebrew/opt/libomp/lib/libomp.dylib
```

Fix:

```bash
brew install libomp
cd platform/backend
. .venv/bin/activate
pip install --force-reinstall --no-cache-dir "dtaidistance>=2.3.10"
```

Verification:

```bash
python -c "import numpy as np; from dtaidistance import dtw; import dtaidistance.dtw_cc; print(dtw.distance_fast(np.array([1.,2.,3.]), np.array([1.,2.,4.])))"
```

Linux/Oracle VM notes:

```bash
sudo apt-get update
sudo apt-get install -y build-essential libomp-dev
pip install --force-reinstall --no-cache-dir "dtaidistance>=2.3.10"
```

## 8. Setup Order For A New Teammate

1. Clone repo.
2. Install backend Python deps.
3. Install frontend Node deps.
4. Copy env examples into local env files.
5. Fill Supabase URL and keys.
6. Start with `USE_MOCK_MODEL=true`.
7. Confirm login/upload/report flow.
8. Sync model artifacts.
9. Turn on real EEG or real MRI as needed.
10. Leave CAT12 off unless specifically testing CAT12.

## 9. Commands

Backend:

```bash
cd platform/backend
python3.12 -m venv .venv
. .venv/bin/activate
pip install -r requirements/dev.txt
pip install -r requirements/eeg.txt -r requirements/mri.txt
uvicorn app.main:app --reload --port 8000
```

Frontend:

```bash
cd platform/frontend
nvm use 20
npm ci
npm run dev
```

Backend focused tests:

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

Frontend typecheck:

```bash
cd platform/frontend
npx tsc --noEmit
```
