"""Pipeline package.

``register_default_pipelines`` wires modality runners into the registry at app
startup.

- EEG (Phase 2): registered as a **lazy** wrapper so the API process boots
  without importing torch/matplotlib/dtaidistance. The heavy EEG modules are
  imported only when an EEG job actually runs (in the worker that has ``eeg.txt``
  installed).
- MRI (Phase 3 pending): still the deterministic stub.
"""

from __future__ import annotations

from app.pipelines.base import (
    AnalysisContext,
    PipelineResult,
    register_pipeline,
    stub_runner_factory,
)


def _run_eeg_lazy(context: AnalysisContext) -> PipelineResult:
    # Deferred import: keeps EEG deps out of the API image / import path.
    from app.pipelines.eeg.runner import run_eeg_pipeline

    return run_eeg_pipeline(context)


def register_default_pipelines() -> None:
    register_pipeline("eeg", _run_eeg_lazy)
    register_pipeline("mri", stub_runner_factory("mri"))  # real MRI runner in Phase 3
