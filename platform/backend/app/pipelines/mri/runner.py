"""MRI pipeline runner.

Wraps the NIfTI-slice → ConViT (majority vote) flow behind the
framework-independent ``run_mri_pipeline(context) -> PipelineResult`` contract.
The uploaded scan is treated as already preprocessed (no CAT12 step) and the
pipeline is multiclass-only (CN/MCI/AD). If the model can't run (no/invalid
checkpoint, inference failure), ``ml_runner.run_model`` returns an error dict
and this raises ``RuntimeError`` rather than returning a fabricated result.
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
    scan_path = context.local_input_path
    work_dir = os.path.dirname(os.path.abspath(scan_path))

    # --- 1) Model inference (multiclass-only; raises below if the model can't run) ---
    ml = ml_runner.run_model(scan_path, "multiclass")
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

    # --- 3) Charts (serialized: pyplot global state) ---
    with _PLOT_LOCK:
        volume_chart_b64 = generate_volume_comparison_chart(ml)
        confidence_chart_b64 = (
            generate_confidence_chart(probs_list, classes) if probs_list else None
        )

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
        consistency=consistency,
        visualizations={},
        model_version=ml.get("model_version", get_settings().mri_model_version),
        artifacts=artifacts,
        viewer_slices=viewer_slices,
    )
