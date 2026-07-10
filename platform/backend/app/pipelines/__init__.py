"""Pipeline package.

``register_default_pipelines`` wires modality runners into the registry at app
startup.

Both EEG (Phase 2) and MRI (Phase 3) are registered as **lazy** wrappers so the
API process boots without importing their heavy deps (torch/matplotlib/
dtaidistance for EEG; torch/timm/nibabel/matplotlib for MRI). The modality
modules are imported only when a job of that modality actually runs, in a worker
that has the corresponding ``eeg.txt`` / ``mri.txt`` installed.
"""

from __future__ import annotations

from app.pipelines.base import (
    AnalysisContext,
    PipelineResult,
    register_pipeline,
)


def _run_eeg_lazy(context: AnalysisContext) -> PipelineResult:
    from app.pipelines.eeg.runner import run_eeg_pipeline

    return run_eeg_pipeline(context)


def _run_mri_lazy(context: AnalysisContext) -> PipelineResult:
    from app.pipelines.mri.runner import run_mri_pipeline

    return run_mri_pipeline(context)


def register_default_pipelines() -> None:
    register_pipeline("eeg", _run_eeg_lazy)
    register_pipeline("mri", _run_mri_lazy)
