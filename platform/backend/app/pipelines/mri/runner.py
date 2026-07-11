"""MRI pipeline runner.

Wraps the CAT12 → NIfTI-slice → ConViT flow (with mock fallback) behind the
framework-independent ``run_mri_pipeline(context) -> PipelineResult`` contract.
Reproduces the analysis half of the legacy background pipeline
(``mri-platform/backend/app.py:_run_pipeline_background``); PDF report generation
is deferred to Phase 4.

Mock-first: with no ConViT checkpoint / CAT12 (e.g. on Linux) the ported runner
returns realistic mock predictions and volumes, so this runs end to end here.
Real viewer slices are extracted only when the input is a genuine NIfTI.
"""

from __future__ import annotations

import os
import threading

from app.core.config import get_settings
from app.core.logging import get_logger
from app.pipelines.artifacts import write_data_uri_png
from app.pipelines.base import AnalysisContext, PipelineResult
from app.pipelines.mri import ml_runner
from app.pipelines.mri.similarity_analyzer import (
    generate_confidence_chart,
    generate_volume_comparison_chart,
    run_similarity_analysis,
)

logger = get_logger(__name__)

# matplotlib pyplot is process-global / not thread-safe (same as EEG); serialize
# the fast charting so concurrent MRI jobs can't corrupt each other's figures.
_PLOT_LOCK = threading.Lock()

_VOLUME_KEYS = [
    "brain_volume", "gm_volume", "wm_volume",
    "csf_volume", "hippocampal_volume", "ventricular_volume",
]
_NIFTI_EXTS = (".nii", ".nii.gz", ".gz")


def _extract_viewer_slices(scan_path: str, work_dir: str) -> dict[str, list[str]]:
    """Extract per-orientation viewer slices from a real NIfTI (empty otherwise)."""
    if not scan_path.lower().endswith(_NIFTI_EXTS):
        return {}
    try:
        from app.pipelines.mri.ml.nifti_slicer import extract_viewer_slices_local

        return extract_viewer_slices_local(
            scan_path, os.path.join(work_dir, "viewer"), num_slices=20
        )
    except Exception as exc:  # nibabel missing / not a valid NIfTI (e.g. mock input)
        logger.info("Viewer slice extraction skipped: %s", exc)
        return {}


def run_mri_pipeline(context: AnalysisContext) -> PipelineResult:
    analysis_type = _normalize_analysis_type(context.analysis_type)
    scan_path = context.local_input_path
    work_dir = os.path.dirname(os.path.abspath(scan_path))

    # --- 1) Model inference (mock unless a real ConViT checkpoint/CAT12 exist) ---
    ml = ml_runner.run_model(scan_path, analysis_type)
    if ml.get("prediction") == "Error":
        raise RuntimeError(ml.get("error_details", "MRI model returned an error."))

    classes = ml.get("classes", ["CN", "MCI", "AD"])
    probs_list = ml.get("probabilities", []) or []
    probabilities = (
        {cls: float(p) for cls, p in zip(classes, probs_list)}
        if len(probs_list) == len(classes)
        else {}
    )
    prediction = ml.get("prediction", "Unknown")
    raw_conf = ml.get("confidence", probabilities.get(prediction, 0.0)) or 0.0
    confidence = min(max(float(raw_conf), 0.0), 1.0)

    # --- 2) Volume metrics + normative comparison ---
    metrics: dict = {k: ml.get(k) for k in _VOLUME_KEYS}
    metrics["volume_comparison"] = ml_runner.get_volume_comparison(ml)
    metrics["used_cat12"] = ml.get("used_cat12")
    metrics["processing_time_ms"] = ml.get("processing_time")
    for opt in ("scan_quality", "motion_artifacts"):
        if opt in ml:
            metrics[opt] = ml[opt]

    # --- 3) Similarity (mock) + charts (serialized: pyplot global state) ---
    with _PLOT_LOCK:
        sim = run_similarity_analysis(scan_path, analysis_type, ml)
        sim = sim if isinstance(sim, dict) else {}
        sim_b64 = sim.get("plot_base64")
        volume_chart_b64 = generate_volume_comparison_chart(ml)
        confidence_chart_b64 = (
            generate_confidence_chart(probs_list, classes) if probs_list else None
        )
    similarity = {k: v for k, v in sim.items() if k != "plot_base64"}

    # --- 4) Consistency (only present from the real slice-voting predictor) ---
    consistency: dict = {}
    for src, dst in [
        ("individual_predictions", "slice_predictions"),
        ("vote_distribution", "vote_distribution"),
        ("consensus_strength", "consensus_strength"),
        ("total_images_processed", "total_images_processed"),
    ]:
        if src in ml:
            consistency[dst] = ml[src]

    # --- 5) Chart artifacts (orchestrator uploads them into visualizations) ---
    artifacts: dict[str, str] = {}
    for key, b64, name in [
        ("similarity_plot_url", sim_b64, "mri_similarity.png"),
        ("volume_chart_url", volume_chart_b64, "volume_chart.png"),
        ("confidence_chart_url", confidence_chart_b64, "confidence_chart.png"),
    ]:
        written = write_data_uri_png(b64, os.path.join(work_dir, name))
        if written:
            artifacts[key] = written

    # --- 6) Viewer slices (real NIfTI only) ---
    viewer_slices = _extract_viewer_slices(scan_path, work_dir)

    return PipelineResult(
        prediction=prediction,
        confidence=confidence,
        probabilities=probabilities,
        metrics=metrics,
        similarity=similarity,
        consistency=consistency,
        visualizations={},
        model_version=ml.get("model_version", get_settings().mri_model_version),
        artifacts=artifacts,
        viewer_slices=viewer_slices,
    )


def _normalize_analysis_type(analysis_type: str | None) -> str:
    aliases = {
        "multi-disease": "multiclass",
        "ad-only": "binary",
    }
    return aliases.get((analysis_type or "multiclass").strip().lower(), analysis_type or "multiclass")
