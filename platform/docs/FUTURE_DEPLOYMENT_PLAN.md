# Future Deployment Plan: Vercel + Oracle + Cloudflare R2

This is the planned production-friendly deployment path for AI4NEURO after local
E2E is stable. The goal is simple: deploy the app without blocking on large model
files, then turn real EEG/MRI inference on safely.

## Target Topology

```text
Users / Hospitals
  -> Vercel frontend
  -> Oracle VM FastAPI backend
  -> Supabase Auth + Postgres + app storage
  -> Cloudflare R2 model artifacts
```

Recommended service split:

```text
Vercel
  Next.js frontend only

Oracle Cloud VM
  FastAPI backend
  local in-process job worker for MVP
  mounted /models directory

Supabase
  Auth
  Postgres
  raw uploads, reports, viewer slices

Cloudflare R2
  EEG checkpoints
  MRI ConViT checkpoint
  future model versions
```

This is a good MVP architecture. Vercel handles the hospital-facing UI well,
Oracle gives us a controllable machine for Python/PyTorch/CAT12 later, Supabase
keeps product data simple, and R2 keeps large model artifacts out of Git and out
of the Docker build.

For the final URL, DNS, SSL, and environment-variable mapping, see:
[`PRODUCTION_HOSTING_DNS_REFERENCE.md`](./PRODUCTION_HOSTING_DNS_REFERENCE.md).

## Why Not Put Models In Git Or The Docker Image?

Do not commit `.pth`, `.pt`, `.ckpt`, or full checkpoint folders.

Large model files cause:

- slow Git operations
- huge Docker builds
- failed deployments on size/time limits
- painful rollbacks
- accidental leakage of proprietary model artifacts

Instead, the deployed backend should boot even when model files are missing. In
that case it should run with:

```env
USE_MOCK_MODEL=true
USE_CAT12_PREPROCESSING=false
```

Then real inference can be enabled after the model files are available at
runtime.

## Artifact Storage Strategy

Use Supabase Storage for product data:

```text
raw-files
report-assets
reports
viewer-slices
```

Use Cloudflare R2 for model artifacts:

```text
ai4neuro-models/
  eeg/
    siddhi-checkpoints-v1/
      classification/
        ADSZ-Indep/...
        ADFD-Indep/...
  mri/
    convit-v1/
      ConViT_model.pth
```

The MRI filename expected by the current code is:

```text
ConViT_model.pth
```

If the downloaded file is named `ConVit_checkpoint.pth`, either rename it or set
`CONVIT_CHECKPOINT_PATH` directly to that filename.

Local note: the current downloaded MRI checkpoint is:

```text
platform/backend/models/mri/ConVit_checkpoint.pth
```

That is fine for local testing if the backend env uses:

```env
CONVIT_CHECKPOINT_PATH=/Users/neelam.sathwik@zomato.com/Desktop/praxiatech/AI4Neuro/platform/backend/models/mri/ConVit_checkpoint.pth
```

For deployment consistency, prefer uploading/renaming it in R2 as:

```text
mri/convit-v1/ConViT_model.pth
```

## Oracle VM Runtime Layout

Use this layout on the Oracle VM:

```text
/opt/ai4neuro/
  app/
    docker-compose.yml
    backend.env
    frontend.env
  models/
    eeg/checkpoints/...
    mri/ConViT_model.pth
  tmp/
```

Backend env paths:

```env
EEG_CHECKPOINT_ROOT=/models/eeg/checkpoints
CONVIT_CHECKPOINT_PATH=/models/mri/ConViT_model.pth
LOCAL_TMP_DIR=/tmp/neuro-platform
```

Docker should mount:

```text
/opt/ai4neuro/models:/models
/opt/ai4neuro/tmp:/tmp/neuro-platform
```

## Deployment Phases

### Phase 1: Stable Mock Deployment

Deploy without real models first.

Backend:

```env
APP_ENV=production
AUTH_DEV_BYPASS=false
USE_MOCK_MODEL=true
USE_CAT12_PREPROCESSING=false
LOCAL_JOB_MAX_WORKERS=1
```

Goal:

- login works
- dashboard works
- EEG/MRI uploads work
- analysis sessions are created
- mock processing completes
- reports/status/result screens work

This phase proves product workflow and infrastructure without model risk.

### Phase 2: R2 Model Artifact Setup

Create an R2 bucket:

```text
ai4neuro-models
```

Upload:

```text
eeg/siddhi-checkpoints-v1/classification/...
mri/convit-v1/ConViT_model.pth
```

Create restricted R2 credentials with read-only access for the backend deploy.
Do not expose R2 secrets to Vercel frontend.

Suggested backend-only env:

```env
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=ai4neuro-models
R2_ENDPOINT_URL=https://<account-id>.r2.cloudflarestorage.com
```

### Phase 3: Runtime Model Sync

Add a startup script or one-shot deploy command that downloads models from R2
into `/models` only if they are missing.

Pseudo-flow:

```text
if /models/eeg/checkpoints is missing:
  download eeg/siddhi-checkpoints-v1 from R2

if /models/mri/ConViT_model.pth is missing:
  download mri/convit-v1/ConViT_model.pth from R2

start FastAPI
```

The backend should not download models on every request. Download once at
startup/deploy time, then reuse the mounted disk.

### Phase 4: Turn On Real EEG

Enable EEG real inference first because the checkpoints are already present in
the repo workspace locally and the pathing is understood.

Backend:

```env
USE_MOCK_MODEL=false
EEG_CHECKPOINT_ROOT=/models/eeg/checkpoints
EEG_REFERENCE_DIR=/models/eeg/reference
EEG_USE_GPU=false
```

Keep MRI in fallback mode until the ConViT checkpoint is verified.

### Phase 4.5: EEG End-to-End Hardening

Real EEG inference already works locally. Before calling EEG production-ready,
handle these cleanup items:

```text
[x] Fix backend Supabase JWT verification for ES256/JWKS.
[ ] Set AUTH_DEV_BYPASS=false outside local development.
[ ] Install/compile the fast dtaidistance C extension.
[ ] Add a real EEG smoke test using a sample .npy file.
[ ] Polish EEG result UI: prediction, confidence, voting, PSD, time series, similarity.
[ ] Add clearer frontend upload help for accepted .npy shape and channel index.
[ ] Make status polling resilient for queued, processing, completed, failed, retry.
[ ] Keep EEG checkpoints external via R2 or mounted /models volume.
```

Current local warning to clean up later:

```text
The compiled dtaidistance C library is not available.
```

This does not block correctness today because the code falls back to standard
DTW, but it can slow analysis.

Current local DTW fix:

```bash
# macOS
brew install libomp
pip install --force-reinstall --no-cache-dir "dtaidistance>=2.3.10"

# Ubuntu / Oracle VM
sudo apt-get install -y build-essential libomp-dev
pip install --force-reinstall --no-cache-dir "dtaidistance>=2.3.10"
```

Supabase auth note: the backend now supports both legacy HS256 JWT-secret
verification and newer JWKS-based ES256/RS256 verification. Reinstall backend
API deps after pulling this change so `PyJWT[crypto]` is available.

### Phase 5: Turn On Real MRI Without CAT12

After `ConViT_model.pth` exists:

```env
USE_MOCK_MODEL=false
CONVIT_CHECKPOINT_PATH=/models/mri/ConViT_model.pth
USE_CAT12_PREPROCESSING=false
```

This runs the ConViT-compatible path without CAT12 preprocessing.

### Phase 6: CAT12 / MATLAB Runtime Upgrade

CAT12 is the hardest deployment piece. It needs a VM-like environment where OS
paths and MATLAB Runtime can be controlled. Oracle VM is appropriate for this.
Use `platform/docs/CAT12_SETUP.md` as the source of truth for install, env, and
smoke testing.

Only enable after CAT12 is installed and tested:

```env
USE_CAT12_PREPROCESSING=true
CAT12_ROOT=/opt/cat12
CAT12_EXE=/opt/cat12/spm25
MCR_ROOT=/opt/matlab-runtime
CAT12_OUTPUT_DIR=/tmp/neuro-platform/cat12
```

Validate paths before running the API:

```bash
cd platform/backend
source .venv/bin/activate
python ../scripts/check_cat12_setup.py
```

Run the real smoke test with a valid T1 scan:

```bash
python ../scripts/check_cat12_setup.py --run --input /path/to/T1.nii.gz
```

Keep this behind a staging test first. CAT12 failures should fail the job, not
crash the API process.

## Vercel Frontend Plan

Vercel should host only the Next.js frontend.

Frontend env:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_API_BASE_URL=https://api.ai4neuro.yourdomain.com
```

Never put these in Vercel:

```env
SUPABASE_SERVICE_ROLE_KEY
R2_SECRET_ACCESS_KEY
R2_ACCESS_KEY_ID
```

Those belong only on the backend server.

## Oracle Backend Plan

Run the backend on Oracle as a Docker container or systemd-managed Python app.
Docker is preferred for reproducibility.

Backend env:

```env
APP_ENV=production
API_HOST=0.0.0.0
API_PORT=8000
CORS_ORIGINS=https://app.ai4neuro.yourdomain.com
AUTH_DEV_BYPASS=false

SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...   # prefer sb_secret_..., legacy service_role fallback
SUPABASE_JWT_SECRET=...         # optional for legacy HS256 projects

RAW_FILES_BUCKET=raw-files
REPORT_ASSETS_BUCKET=report-assets
REPORTS_BUCKET=reports
VIEWER_SLICES_BUCKET=viewer-slices

JOB_BACKEND=local
LOCAL_JOB_MAX_WORKERS=1
LOCAL_TMP_DIR=/tmp/neuro-platform
MAX_UPLOAD_MB=512

USE_MOCK_MODEL=true
USE_CAT12_PREPROCESSING=false

EEG_CHECKPOINT_ROOT=/models/eeg/checkpoints
CONVIT_CHECKPOINT_PATH=/models/mri/ConViT_model.pth
```

Use Nginx or Caddy as reverse proxy:

```text
https://api.ai4neuro.yourdomain.com -> localhost:8000
```

## Will This Halt Deployment?

No, if we follow the phases.

The deployed app should start with:

```env
USE_MOCK_MODEL=true
```

That means missing model artifacts will not block the app. Users can still test
auth, uploads, queues, status polling, reports, and dashboards. Real model mode
is switched on only after R2 download + mounted paths are verified.

Hard rule:

```text
Deployment must not depend on model download success during the first launch.
```

Use a separate model-sync step and keep mock mode as the fallback.

## Operational Checks

Before production:

```text
[ ] Vercel frontend builds with production API URL
[ ] Oracle backend health endpoint works
[ ] Supabase migrations applied
[ ] Supabase buckets private and created
[ ] AUTH_DEV_BYPASS=false
[ ] CORS allows only frontend domain
[ ] Service-role key only exists on backend
[ ] R2 credentials only exist on backend
[ ] /models volume mounted
[ ] Mock upload E2E passes
[ ] Real EEG E2E passes in staging
[ ] MRI checkpoint exists and loads
[ ] CAT12 tested separately before enabling
```

## Future Upgrade Path

When usage grows:

1. Split FastAPI API and ML workers.
2. Move job execution from in-process local workers to Redis/Celery/RQ or a
   managed queue.
3. Keep API image small.
4. Run EEG and MRI workers as separate machines/containers.
5. Use GPU workers only where they actually improve latency/cost.
6. Version model artifacts in R2:

```text
models/eeg/siddhi-checkpoints-v1
models/eeg/siddhi-checkpoints-v2
models/mri/convit-v1/ConViT_model.pth
models/mri/convit-v2/ConViT_model.pth
```

Then switch versions via env vars, not code changes.

## Verdict

Vercel + Oracle + R2 is a sensible deployment strategy for AI4NEURO:

- Vercel is excellent for the Next.js frontend.
- Oracle VM gives enough control for Python, PyTorch, large files, and CAT12.
- R2 is the right place for large model artifacts.
- Supabase remains the right place for auth, Postgres, product uploads, and
  generated report assets.

The key is to deploy mock-mode first, then enable real models one modality at a
time.
