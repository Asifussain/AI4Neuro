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

For CAT12 preprocessing, also set the CAT12/MATLAB Runtime paths and enable:

```env
USE_CAT12_PREPROCESSING=true
CAT12_ROOT=...
CAT12_EXE=...
MCR_ROOT=...
CAT12_OUTPUT_DIR=...
```
