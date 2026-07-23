"""Pipeline contracts and registry.

This module defines the **framework-independent** boundary between the API/service
layers and the ML pipelines. Nothing here (or anywhere under ``app/pipelines/``)
may import FastAPI. Pipelines receive an :class:`AnalysisContext` and return a
:class:`PipelineResult` — plain data — per the architecture doc (6.1/6.2).

    result = run_pipeline(context)      # dispatches by context.modality

The EEG and MRI runners (Phases 2 and 3) register themselves here; the job
orchestrator only knows about this registry, never about SIDDHI or ConViT.
"""

from __future__ import annotations

from typing import Callable, Literal, Protocol

from pydantic import BaseModel, Field

Modality = Literal["eeg", "mri"]


class AnalysisContext(BaseModel):
    """Everything a pipeline needs to run one analysis (doc 6.1)."""

    session_id: str
    modality: Modality
    analysis_type: str
    local_input_path: str
    original_filename: str
    patient_id: str
    doctor_id: str | None = None
    hospital_id: str | None = None
    radiologist_id: str | None = None
    uploaded_by_role: str | None = None
    options: dict = Field(default_factory=dict)


class PipelineResult(BaseModel):
    """Normalized output every pipeline must return (doc 6.2).

    The outer shape is identical across modalities; modality-specific data goes
    into the ``metrics`` / ``similarity`` / ``consistency`` / ``visualizations``
    sub-objects. ``artifacts`` holds local file paths produced by the pipeline
    (plots, slices, etc.) that the storage service uploads afterwards — pipelines
    do not touch Supabase.
    """

    prediction: str
    confidence: float = Field(ge=0.0, le=1.0)
    probabilities: dict[str, float] = Field(default_factory=dict)
    metrics: dict = Field(default_factory=dict)
    similarity: dict = Field(default_factory=dict)
    consistency: dict = Field(default_factory=dict)
    visualizations: dict = Field(default_factory=dict)
    model_version: str = "unknown"
    # Local artifact paths keyed by a logical name, e.g.
    # {"timeseries_plot": "/tmp/.../timeseries.png"}. Uploaded post-run.
    artifacts: dict[str, str] = Field(default_factory=dict)
    # Local MRI viewer-slice paths per orientation, e.g.
    # {"axial": ["/tmp/.../axial/slice_000.png", ...]}. Uploaded to the
    # viewer-slices bucket; surfaced as visualizations.viewer_slice_urls.
    viewer_slices: dict[str, list[str]] = Field(default_factory=dict)
    # In-process visual-explainability payload (Grad-CAM overlay + MNI152
    # reference data-URIs + observations) consumed by the report builder. Held
    # here rather than in ``metrics`` so the large base64 images are NEVER
    # persisted to the DB (mirrors how chart artifacts stay out of metrics).
    explainability: dict | None = None


class Pipeline(Protocol):
    """Callable contract for a modality pipeline."""

    def __call__(self, context: AnalysisContext) -> PipelineResult: ...


# --------------------------------------------------------------------------- #
# Registry
# --------------------------------------------------------------------------- #

_REGISTRY: dict[str, Pipeline] = {}


def register_pipeline(modality: Modality, runner: Pipeline) -> None:
    """Register a runner for a modality. Idempotent (last registration wins)."""
    _REGISTRY[modality] = runner


def get_pipeline(modality: str) -> Pipeline:
    """Return the runner for ``modality`` or raise if none is registered."""
    try:
        return _REGISTRY[modality]
    except KeyError:
        raise UnknownModalityError(modality) from None


def registered_modalities() -> list[str]:
    return sorted(_REGISTRY.keys())


def run_pipeline(context: AnalysisContext) -> PipelineResult:
    """Dispatch an analysis to the registered runner for its modality."""
    return get_pipeline(context.modality)(context)


class UnknownModalityError(KeyError):
    """Raised when no pipeline is registered for a requested modality."""

    def __init__(self, modality: str) -> None:
        self.modality = modality
        super().__init__(
            f"No pipeline registered for modality {modality!r}. "
            f"Registered: {registered_modalities() or '[]'}"
        )


def stub_runner_factory(modality: Modality) -> Callable[[AnalysisContext], PipelineResult]:
    """Build a deterministic stub runner for a modality.

    Used by the foundation (before real pipelines land) so the full job loop —
    upload, status transitions, result normalization, reports — can be exercised
    end to end without torch, model weights, or MATLAB. Real runners registered
    in Phases 2/3 replace these.
    """

    def _run(context: AnalysisContext) -> PipelineResult:
        # EEG is ADFD-only (multiclass) end to end; MRI is multiclass-only too.
        classes = ["CN", "MCI", "AD"]
        # Deterministic pseudo-distribution favouring the last class.
        base = {c: round(0.1 + 0.05 * i, 4) for i, c in enumerate(classes)}
        total = sum(base.values())
        probs = {c: round(v / total, 4) for c, v in base.items()}
        prediction = max(probs, key=probs.get)
        return PipelineResult(
            prediction=prediction,
            confidence=probs[prediction],
            probabilities=probs,
            metrics={"stub": True, "modality": modality},
            visualizations={},
            model_version=f"stub-{modality}-v0",
            artifacts={},
        )

    return _run
