# AI4NEURO Pipeline Execution Reference

This document explains what actually runs when a user selects one of the four
AI4NEURO analysis flows:

```text
EEG Binary
EEG Multiclass
MRI Binary
MRI Multiclass
```

It is intended for teammates debugging local setup, checkpoint deployment, and
end-to-end testing.

## Shared Backend Flow

All four flows start the same way:

```text
Frontend upload
-> POST /api/v1/analysis
-> create analysis_sessions row
-> upload raw file to Supabase Storage
-> enqueue local background job
-> run modality pipeline
-> upload artifacts/results/reports
-> mark analysis completed or failed
```

The selected values that matter are:

```text
modality: eeg | mri
analysis_type: binary | multiclass
```

## EEG Binary

Purpose:

```text
Normal vs Alzheimer's
```

Expected input:

```text
.npy file
shape: segments x 128 x 19
```

Model code path:

```text
app/pipelines/eeg/runner.py
-> app/pipelines/eeg/ml_runner.py
-> app/pipelines/eeg/siddhi/run.py
-> app/pipelines/eeg/siddhi/exp/exp_classification.py
```

Model family:

```text
SIDDHI / ADformer
```

Checkpoint:

```text
EEG_CHECKPOINT_ROOT/classification/ADSZ-Indep/ADformer/
  ADSZ-Indep_ftM_sl128_ll48_pl96_dm128_nh8_el6_dl1_df256_fc1_ebtimeF_dtTrue_'Exp'/
    checkpoint.pth
```

Verified checkpoint head:

```text
projection.weight: (2, 6656)
projection.bias:   (2,)
```

Labels:

```text
0 -> Normal
1 -> Alzheimer's
```

Subprocess command characteristics:

```text
--model_id ADSZ-Indep
--data ADSZIndep
--model ADformer
--num_class 2
--seq_len 128
--patch_len_list 4
--up_dim_list 19
--swa false
```

Additional EEG outputs:

```text
trial predictions
class probabilities
consistency metrics
descriptive EEG stats
time-series plot
PSD plot
DTW similarity plot
```

## EEG Multiclass

Purpose:

```text
CN vs MCI vs AD
```

Expected input:

```text
.npy file
shape: segments x 256 x 19
```

Model code path:

```text
app/pipelines/eeg/runner.py
-> app/pipelines/eeg/ml_runner.py
-> app/pipelines/eeg/siddhi/run.py
-> app/pipelines/eeg/siddhi/exp/exp_classification.py
```

Model family:

```text
SIDDHI / ADformer
```

Checkpoint:

```text
EEG_CHECKPOINT_ROOT/classification/ADFD-Indep/ADformer/
  ADFD-Indep_ftM_sl256_ll48_pl96_dm128_nh8_el6_dl1_df256_fc1_ebtimeF_dtTrue__'Exp'/
    checkpoint.pth
```

Verified checkpoint head:

```text
module.projection.weight: (3, 110976)
module.projection.bias:   (3,)
```

Labels:

```text
0 -> CN
1 -> MCI
2 -> AD
```

Subprocess command characteristics:

```text
--model_id ADFD-Indep
--data ADFDIndep
--model ADformer
--num_class 3
--seq_len 256
--patch_len_list 2,2,2,4,4,4
--up_dim_list 19,38,76,152
--swa true
```

Additional EEG outputs:

```text
trial predictions
class probabilities
consistency metrics
descriptive EEG stats
time-series plot
PSD plot
multiclass DTW similarity plot
```

## MRI Multiclass

Purpose:

```text
CN vs MCI vs AD
```

Expected input:

```text
.nii or .nii.gz file
valid structural MRI NIfTI
```

Model code path:

```text
app/pipelines/mri/runner.py
-> app/pipelines/mri/ml_runner.py
-> app/pipelines/mri/ml/nifti_slicer.py
-> app/pipelines/mri/ml/predictor.py
```

Model family:

```text
ConViT
```

Checkpoint:

```text
CONVIT_CHECKPOINT_PATH=/absolute/path/to/platform/backend/models/mri/ConVit_checkpoint.pth
```

Verified checkpoint head:

```text
head.weight: (3, 768)
head.bias:   (3,)
```

Labels:

```text
CN
MCI
AD
```

Execution:

```text
NIfTI read
-> extract 5 middle axial slices
-> load/reuse ConViT checkpoint
-> predict each slice
-> average probabilities
-> majority/aggregate patient-level result
-> create MRI plots/viewer slices
-> generate PDF reports
```

Notes:

```text
The first run after backend startup loads the checkpoint into memory.
Later runs reuse the global predictor, so they are much faster.
```

## MRI Binary

Purpose:

```text
Non-AD vs AD
```

Expected input:

```text
.nii or .nii.gz file
valid structural MRI NIfTI
```

Model code path:

```text
Same as MRI Multiclass
```

Checkpoint:

```text
Same ConVit_checkpoint.pth as MRI Multiclass
```

Important distinction:

```text
MRI does not currently have a separate binary checkpoint.
MRI Binary is derived from the 3-class ConViT output.
```

Mapping:

```text
AD     = AD probability
Non-AD = CN probability + MCI probability
```

API/classes returned:

```text
CN
AD
```

In this binary context, `CN` should be read as the product's non-AD bucket:

```text
CN means non-AD = CN + MCI
```

## CAT12 Status

CAT12 is optional and MRI-only.

Current teammate/local default:

```env
USE_CAT12_PREPROCESSING=false
```

With CAT12 off:

```text
raw NIfTI
-> slice extraction
-> ConViT inference
```

With CAT12 on:

```text
raw NIfTI
-> CAT12 segmentation
-> mwp1 grey-matter NIfTI
-> slice extraction
-> ConViT inference
```

CAT12 does not affect EEG.

## Checkpoint Summary

Critical EEG checkpoints:

```text
classification/ADSZ-Indep/.../checkpoint.pth
classification/ADFD-Indep/.../checkpoint.pth
```

Optional/extra EEG checkpoint currently present:

```text
classification/APAVA-Indep/.../checkpoint.pth
```

Critical MRI checkpoint:

```text
mri/ConVit_checkpoint.pth
```

## Environment Summary

EEG:

```env
EEG_CHECKPOINT_ROOT=/absolute/path/to/platform/backend/models/eeg/checkpoints
EEG_REFERENCE_DIR=/absolute/path/to/platform/backend/models/eeg/reference
EEG_SIDDHI_DIR=/absolute/path/to/platform/backend/app/pipelines/eeg/siddhi
EEG_USE_GPU=false
EEG_DEFAULT_FS=128
EEG_SUBPROCESS_TIMEOUT=600
```

MRI:

```env
CONVIT_CHECKPOINT_PATH=/absolute/path/to/platform/backend/models/mri/ConVit_checkpoint.pth
MRI_USE_GPU=false
MRI_MODEL_VERSION=ConViT-v1.0
USE_CAT12_PREPROCESSING=false
```

## Quick Debug Checklist

If EEG fails:

```text
1. Check .npy shape: binary needs 128 x 19, multiclass needs 256 x 19.
2. Check EEG_CHECKPOINT_ROOT points to the folder containing classification/.
3. Check EEG_SIDDHI_DIR points to app/pipelines/eeg/siddhi.
4. Check subprocess logs for the exact checkpoint path.
```

If MRI fails:

```text
1. Check uploaded file is a valid .nii or .nii.gz.
2. Check CONVIT_CHECKPOINT_PATH points to ConVit_checkpoint.pth.
3. Check USE_MOCK_MODEL=false for real inference.
4. Check USE_CAT12_PREPROCESSING=false unless CAT12 is actually installed.
5. Check logs for "MRIPredictor initialized successfully".
```

If MRI Binary and Multiclass look related:

```text
That is expected. Both use the same 3-class ConViT checkpoint.
Binary is derived as AD vs CN+MCI.
```
