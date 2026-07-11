# Checkpoint Deployment And Team Sync

This guide explains how to share real EEG/MRI model artifacts without committing
large files to GitHub.

## Goal

Teammates should be able to:

1. Clone the repo.
2. Fill normal `.env` values.
3. Sync checkpoints from shared object storage.
4. Run local real EEG/MRI tests without asking for files manually.

CAT12 is separate. Checkpoints should be deployed first so the product remains
testable while one teammate owns CAT12 setup.

For details on which checkpoint each analysis flow uses, see
[PIPELINE_EXECUTION_REFERENCE.md](./PIPELINE_EXECUTION_REFERENCE.md).

## OS Support For Sync

The sync helper is a Bash script:

```text
platform/scripts/sync_models_from_object_storage.sh
```

Supported team usage:

| OS | Supported path |
| --- | --- |
| macOS | Run from Terminal. |
| Ubuntu/Linux | Run from Bash. |
| Oracle VM | Run from Bash on the VM. |
| Windows | Run inside WSL2 Ubuntu, not PowerShell. |

Windows teammates should keep backend/model work inside the WSL filesystem, for
example `~/projects/AI4Neuro`, instead of `C:\...` or `/mnt/c/...`. Native
Windows is fine for frontend-only development, but checkpoint sync and real
model execution should use WSL2 Ubuntu.

## Do Not Commit These Files

Do not commit:

```text
platform/backend/models/eeg/checkpoints/
platform/backend/models/eeg/reference/
platform/backend/models/mri/*.pth
.env
.env.local
```

These are runtime artifacts.

## Canonical Bucket Layout

Use Cloudflare R2 or Oracle Object Storage with S3 compatibility.

Recommended bucket:

```text
ai4neuro-models
```

Recommended prefix:

```text
ai4neuro/
  eeg/
    checkpoints/
      classification/
        ADSZ-Indep/...
        ADFD-Indep/...
    reference/
      ...
  mri/
    ConVit_checkpoint.pth
```

Keep the MRI filename exactly:

```text
ConVit_checkpoint.pth
```

That matches the current local env and avoids teammate confusion.

## One-Time Upload By Model Owner

Install AWS CLI v2 first. For R2 or Oracle, create S3-compatible access keys.

Example upload from repo root:

```bash
cd /Users/neelam.sathwik@zomato.com/Desktop/praxiatech/AI4Neuro/platform

AWS_ACCESS_KEY_ID=... \
AWS_SECRET_ACCESS_KEY=... \
MODEL_BUCKET=ai4neuro-models \
MODEL_ENDPOINT_URL=https://<account-id>.r2.cloudflarestorage.com \
MODEL_PREFIX=ai4neuro \
aws s3 sync backend/models/eeg/checkpoints \
  s3://ai4neuro-models/ai4neuro/eeg/checkpoints \
  --endpoint-url https://<account-id>.r2.cloudflarestorage.com
```

Upload EEG reference/vendor files if needed by the real EEG pipeline:

```bash
AWS_ACCESS_KEY_ID=... \
AWS_SECRET_ACCESS_KEY=... \
aws s3 sync backend/models/eeg/reference \
  s3://ai4neuro-models/ai4neuro/eeg/reference \
  --endpoint-url https://<account-id>.r2.cloudflarestorage.com
```

Upload MRI checkpoint:

```bash
AWS_ACCESS_KEY_ID=... \
AWS_SECRET_ACCESS_KEY=... \
aws s3 cp backend/models/mri/ConVit_checkpoint.pth \
  s3://ai4neuro-models/ai4neuro/mri/ConVit_checkpoint.pth \
  --endpoint-url https://<account-id>.r2.cloudflarestorage.com
```

For Oracle Object Storage, replace `MODEL_ENDPOINT_URL` / `--endpoint-url` with
Oracle's S3-compatible endpoint.

## Teammate Sync

From repo root:

```bash
cd platform

AWS_ACCESS_KEY_ID=... \
AWS_SECRET_ACCESS_KEY=... \
MODEL_BUCKET=ai4neuro-models \
MODEL_ENDPOINT_URL=https://<account-id>.r2.cloudflarestorage.com \
MODEL_PREFIX=ai4neuro \
./scripts/sync_models_from_object_storage.sh
```

After sync, expected local layout:

```text
platform/backend/models/
  eeg/
    checkpoints/
    reference/
  mri/
    ConVit_checkpoint.pth
```

## Backend Env After Sync

```env
USE_MOCK_MODEL=false
USE_CAT12_PREPROCESSING=false

EEG_CHECKPOINT_ROOT=/absolute/path/to/AI4Neuro/platform/backend/models/eeg/checkpoints
EEG_REFERENCE_DIR=/absolute/path/to/AI4Neuro/platform/backend/models/eeg/reference
EEG_SIDDHI_DIR=/absolute/path/to/AI4Neuro/platform/backend/app/pipelines/eeg/siddhi
EEG_USE_GPU=false
EEG_DEFAULT_FS=128
EEG_SUBPROCESS_TIMEOUT=600

CONVIT_CHECKPOINT_PATH=/absolute/path/to/AI4Neuro/platform/backend/models/mri/ConVit_checkpoint.pth
MRI_USE_GPU=false
MRI_MODEL_VERSION=ConViT-v1.0
```

Keep:

```env
USE_CAT12_PREPROCESSING=false
```

until the CAT12 owner completes the separate CAT12 setup guide.

## Oracle VM Sync

Recommended VM model path:

```text
/opt/ai4neuro/models/
```

Run:

```bash
cd /opt/ai4neuro/app/platform

AWS_ACCESS_KEY_ID=... \
AWS_SECRET_ACCESS_KEY=... \
MODEL_BUCKET=ai4neuro-models \
MODEL_ENDPOINT_URL=https://<namespace>.compat.objectstorage.<region>.oraclecloud.com \
MODEL_PREFIX=ai4neuro \
MODEL_DIR=/opt/ai4neuro/models \
./scripts/sync_models_from_object_storage.sh
```

Oracle backend env:

```env
EEG_CHECKPOINT_ROOT=/opt/ai4neuro/models/eeg/checkpoints
EEG_REFERENCE_DIR=/opt/ai4neuro/models/eeg/reference
CONVIT_CHECKPOINT_PATH=/opt/ai4neuro/models/mri/ConVit_checkpoint.pth
```

## Verification Checklist

After syncing:

```bash
cd platform/backend
source .venv/bin/activate
python -m pytest tests/test_mri_pipeline.py
```

For local product E2E without real model dependency:

```bash
USE_MOCK_MODEL=true python -m pytest tests/test_analysis_flow.py tests/test_mri_pipeline.py
```

For real model E2E, use known-good EEG `.npy` files and a valid MRI `.nii` or
`.nii.gz`. Fake MRI bytes should fail cleanly.

## Ownership

Recommended split:

- Model owner: uploads checkpoints and verifies bucket layout.
- Backend owner: verifies sync script and env examples.
- CAT12 owner: follows `CAT12_SETUP.md` separately on a VM or dedicated machine.
- Frontend owner: tests dashboard/upload/report flows after backend is running.
