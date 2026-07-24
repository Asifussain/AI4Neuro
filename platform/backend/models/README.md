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
standalone) plus the matching MATLAB Runtime version for your OS, entirely
outside this repo (these are multi-GB third-party binaries, never committed -
see `app/pipelines/mri/cat12_manager.py` for the exact invocation). Then set:

```env
USE_CAT12_PREPROCESSING=true
CAT12_ROOT=/path/to/CAT12.x_RxxxxX_MCR_<platform>
CAT12_EXE=/path/to/CAT12.x_RxxxxX_MCR_<platform>/cat12_standalone.bat   # Windows
MCR_ROOT=/path/to/MATLAB_Runtime/RxxxxX
CAT12_OUTPUT_DIR=/path/to/a/scratch/dir
```

On Windows, `CAT12_EXE` should point at the `cat12_standalone.bat` wrapper
shipped alongside `spm25.exe` (it sets up the MCR `PATH` before invoking it).
On Mac/Linux, point it at the official `cat_standalone.sh` from the same
CAT12 build instead - `cat12_manager.py`'s invocation only needs to be
extended to branch on OS if this project starts running MRI jobs there too.
