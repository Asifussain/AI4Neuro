# CAT12 Setup, Deployment, And Testing

CAT12 is external neuroimaging tooling, not a Python package. The AI4NEURO
backend can call it, but each host must install and configure CAT12 plus MATLAB
Runtime before `USE_CAT12_PREPROCESSING=true` is enabled.

Official references:

- CAT12 project page: https://neuro-jena.github.io/cat/
- CAT12 source/downloads: https://github.com/ChristianGaser/cat12

## What CAT12 Does In Our MRI Pipeline

Without CAT12:

```text
T1 NIfTI -> slice extraction -> ConViT checkpoint -> Binary/Multiclass result -> PDF
```

With CAT12:

```text
T1 NIfTI -> CAT12 segmentation -> mwp1 grey-matter NIfTI -> slice extraction
-> ConViT checkpoint -> Binary/Multiclass result -> PDF
```

CAT12 is used only for MRI. EEG does not use CAT12.

## Recommended Strategy

Use this order:

1. Keep local teammate setup simple with `USE_CAT12_PREPROCESSING=false`.
2. Validate real MRI ConViT inference locally without CAT12.
3. Provision one staging Linux VM for CAT12.
4. Install CAT12 Standalone and MATLAB Runtime on that VM.
5. Run the CAT12 smoke test on one known-good T1 `.nii` or `.nii.gz`.
6. Only then set `USE_CAT12_PREPROCESSING=true` in staging/prod.

This avoids every teammate needing a heavy CAT12/MATLAB Runtime setup.

## Team Handoff

Assign CAT12 to one teammate as a separate infrastructure task. That teammate
does not need to touch EEG or frontend code.

Owner responsibilities:

1. Pick the target host: preferably Oracle Linux/Ubuntu VM.
2. Install CAT12 Standalone for the correct OS/architecture.
3. Install MATLAB Runtime R2023b/v232.
4. Set `CAT12_ROOT`, `CAT12_EXE`, `MCR_ROOT`, and `CAT12_OUTPUT_DIR`.
5. Run `python ../scripts/check_cat12_setup.py`.
6. Run `python ../scripts/check_cat12_setup.py --run --input <known-good-T1.nii.gz>`.
7. Share the final env values and the generated `mwp1...` output path.

Acceptance criteria:

- `check_cat12_setup.py` says config is ready.
- Real CAT12 smoke test produces an `mwp1...` file.
- Backend MRI upload with `USE_CAT12_PREPROCESSING=true` completes.
- MRI PDF/report metadata indicates CAT12 was used.
- Failure logs stay in backend terminal/logs, not exposed as raw errors in UI.

Non-goals for the CAT12 owner:

- They do not need to deploy checkpoints. Use `CHECKPOINT_DEPLOYMENT.md`.
- They do not need to change Supabase schema.
- They do not need to modify frontend flow unless a CAT12-specific status label
  is later requested.

## Local Env

Default teammate mode:

```env
USE_MOCK_MODEL=false
USE_CAT12_PREPROCESSING=false
CONVIT_CHECKPOINT_PATH=/absolute/path/to/platform/backend/models/mri/ConVit_checkpoint.pth
```

CAT12-enabled mode:

```env
USE_MOCK_MODEL=false
USE_CAT12_PREPROCESSING=true
CONVIT_CHECKPOINT_PATH=/absolute/path/to/platform/backend/models/mri/ConVit_checkpoint.pth
CAT12_ROOT=/absolute/path/to/cat12-or-standalone
CAT12_EXE=/absolute/path/to/cat12/spm25
MCR_ROOT=/absolute/path/to/MATLAB/MATLAB_Runtime/R2023b
CAT12_OUTPUT_DIR=/tmp/neuro-platform/cat12
```

Windows native example:

```env
CAT12_ROOT=C:\CAT12\CAT12.9_R2023b_MCR_Win
CAT12_EXE=C:\CAT12\CAT12.9_R2023b_MCR_Win\spm25.exe
MCR_ROOT=C:\Program Files\MATLAB\MATLAB Runtime\R2023b
CAT12_OUTPUT_DIR=C:\tmp\neuro-platform\cat12
```

For Windows teammates, prefer WSL2 for normal backend/frontend development.
Use native Windows only if specifically testing the Windows CAT12 standalone.

## Deployment Env On Oracle VM

Recommended production/staging layout:

```env
USE_MOCK_MODEL=false
USE_CAT12_PREPROCESSING=true
CONVIT_CHECKPOINT_PATH=/opt/ai4neuro/models/mri/ConVit_checkpoint.pth
CAT12_ROOT=/opt/cat12
CAT12_EXE=/opt/cat12/spm25
MCR_ROOT=/opt/MATLAB/MATLAB_Runtime/R2023b
CAT12_OUTPUT_DIR=/tmp/neuro-platform/cat12
LOCAL_JOB_MAX_WORKERS=1
```

Use `LOCAL_JOB_MAX_WORKERS=1` while CAT12 is enabled. CAT12 can be CPU/RAM
heavy and may take several minutes per scan.

## Install Notes

Use the CAT12 official download links for the matching OS and architecture.
CAT12 Standalone does not need a MATLAB license, but it does need the free
MATLAB Runtime R2023b/v232.

Linux VM shape:

- Ubuntu 22.04/24.04
- At least 4 OCPU if possible
- At least 16 GB RAM for comfortable MRI preprocessing
- 50-100 GB disk for runtime, temp files, checkpoints, and logs

Keep model checkpoints in object storage, then sync them onto the VM. Do not put
large `.pth` checkpoint files in GitHub.

## Validate Setup

From the repo:

```bash
cd platform/backend
source .venv/bin/activate
python ../scripts/check_cat12_setup.py
```

Expected when paths are missing:

```text
Not ready:
  - CAT12_ROOT is not set.
  - CAT12_EXE is not set.
  - MCR_ROOT is not set.
```

Expected when paths exist:

```text
Config looks ready.
Detected MATLAB Runtime paths: ...
Dry run complete.
```

## Real CAT12 Smoke Test

Use a valid T1 structural MRI NIfTI:

```bash
cd platform/backend
source .venv/bin/activate
python ../scripts/check_cat12_setup.py --run --input /path/to/T1.nii.gz
```

Success means the script prints an `mwp1...` output path. That file is the
CAT12 grey-matter output used by the MRI pipeline.

Then start the API:

```bash
cd platform/backend
source .venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Upload the same `.nii`/`.nii.gz` through the MRI Binary and MRI Multiclass UI.
The report metadata should show CAT12 was used.

## Failure Policy

If `USE_CAT12_PREPROCESSING=true` and CAT12 cannot produce `mwp1...`, the MRI
job should fail with a user-friendly preprocessing error. Raw CAT12 stdout/stderr
belongs in backend logs only, not in the frontend.

For local demo/testing, set:

```env
USE_CAT12_PREPROCESSING=false
```

That keeps MRI ConViT testing unblocked while CAT12 deployment is being hardened.
