"""Pipeline package.

``register_default_pipelines`` wires modality runners into the registry at app
startup. For the foundation these are deterministic stubs so the full job loop
runs without torch/weights. Phases 2 and 3 replace the stub registrations with:

    from app.pipelines.eeg.runner import run_eeg_pipeline
    from app.pipelines.mri.runner import run_mri_pipeline
    register_pipeline("eeg", run_eeg_pipeline)
    register_pipeline("mri", run_mri_pipeline)
"""

from __future__ import annotations

from app.pipelines.base import register_pipeline, stub_runner_factory


def register_default_pipelines() -> None:
    register_pipeline("eeg", stub_runner_factory("eeg"))
    register_pipeline("mri", stub_runner_factory("mri"))
