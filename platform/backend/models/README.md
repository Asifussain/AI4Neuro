# AI4NEURO Model Artifacts

This folder is for local real-model artifacts. These files are not required for
mock-mode E2E testing, but they are required when `USE_MOCK_MODEL=false`.

## EEG

Expected root:

```text
platform/backend/models/eeg/checkpoints
```

This should contain the SIDDHI/ADformer tree:

```text
classification/
  ADSZ-Indep/ADformer/.../checkpoint.pth
  ADFD-Indep/ADformer/.../checkpoint.pth
```

Set:

```env
EEG_CHECKPOINT_ROOT=/absolute/path/to/platform/backend/models/eeg/checkpoints
```

## MRI

Expected checkpoint file:

```text
platform/backend/models/mri/ConViT_model.pth
```

The MRI code expects `ConViT_model.pth`. If your downloaded file is named
`ConVit_checkpoint.pth`, either rename it or point `CONVIT_CHECKPOINT_PATH`
directly at that file.

Set:

```env
CONVIT_CHECKPOINT_PATH=/absolute/path/to/platform/backend/models/mri/ConViT_model.pth
USE_MOCK_MODEL=false
```

For CAT12 preprocessing, install a standalone CAT12 build (bundled SPM
standalone) plus the **matching** MATLAB Runtime (MCR) version for your OS,
entirely outside this repo (these are multi-GB third-party binaries, never
committed). Use the same CAT12/MCR version everyone else on the team uses
(currently: CAT12.9, built on SPM25, requiring MATLAB Runtime **R2023b**) -
a different version can segment slightly differently, and accuracy has only
been validated against this exact pairing.

Both Windows and Mac/Linux work with the same 4 env vars - only the
**filename** `CAT12_EXE` points at differs per OS (`cat12_manager.py` picks
the right invocation automatically):

```env
USE_CAT12_PREPROCESSING=true
CAT12_ROOT=/path/to/your/CAT12/install
CAT12_EXE=/path/to/your/CAT12/install/<launcher - see below>
MCR_ROOT=/path/to/your/MATLAB Runtime/install
CAT12_OUTPUT_DIR=/path/to/a/scratch/dir
```

**Windows** - `CAT12_EXE` points at the `cat12_standalone.bat` wrapper that
ships next to `spm25.exe` (it sets up the MCR `PATH` before invoking it):

```env
CAT12_ROOT=E:\CAT12\CAT12.9_R2023b_MCR_Win
CAT12_EXE=E:\CAT12\CAT12.9_R2023b_MCR_Win\cat12_standalone.bat
MCR_ROOT=E:\MCR\R2023b
```

**Mac (and Linux)** - `CAT12_EXE` points at `run_spm25.sh`, which sits at the
top level of the CAT12 install folder (the official `cat_standalone.sh`
script that ships alongside it calls this exact file the same way, so it's
confirmed correct, not a guess). MCR on Mac typically installs under
`/Applications/MATLAB/MATLAB_Runtime/<version>`:

```env
CAT12_ROOT=/Users/yourname/CAT12/CAT12.9_R2023b_MCR_Mac
CAT12_EXE=/Users/yourname/CAT12/CAT12.9_R2023b_MCR_Mac/run_spm25.sh
MCR_ROOT=/Applications/MATLAB/MATLAB_Runtime/v232
```

If `run_spm25.sh` isn't executable after download/extraction (a "Permission
denied" error), the pipeline now fixes that automatically on first run - no
manual `chmod` needed. macOS Gatekeeper may still block the *first* run of
an unsigned downloaded binary; if so, right-click the CAT12 folder → Open
once (or `xattr -d com.apple.quarantine` on it) before starting the backend.

`validate_cat12_config()` in `app/pipelines/mri/cat12_manager.py` checks
these paths on startup and will flag the most common mistake - pointing
`CAT12_EXE` at the wrong OS's launcher (e.g. copying a teammate's `.env`
across platforms without updating this one line).
