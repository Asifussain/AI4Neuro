"""EEG pipeline runner.

Wraps the SIDDHI/ADformer model, DTW similarity, and EEG stats/plots behind the
framework-independent ``run_eeg_pipeline(context) -> PipelineResult`` contract.
Reproduces the analysis half of the legacy Celery task
(``Alzheimer-Detection/backend/routes/predict_api.py:run_full_analysis_task``);
PDF report generation is intentionally deferred to Phase 4 — this runner returns
stats/similarity/consistency as data and the three plots as artifact files, which
the orchestrator uploads into ``visualizations``.
"""

from __future__ import annotations

import os

import numpy as np

from app.core.config import get_settings
from app.core.logging import get_logger
from app.pipelines.artifacts import write_data_uri_png
from app.pipelines.base import AnalysisContext, PipelineResult
from app.pipelines.eeg import ml_runner
from app.pipelines.eeg import preprocessing
from app.pipelines.eeg.checkpoint_registry import get_spec
from app.pipelines.eeg.loader import first_trial_2d
from app.pipelines.eeg.similarity_analyzer import run_multiclass_similarity_analysis
from app.pipelines.eeg.visualization import (
    generate_average_psd_image,
    generate_descriptive_stats,
    generate_stacked_timeseries_image,
)
from app.pipelines.plotting import PLOT_LOCK

logger = get_logger(__name__)

# matplotlib's pyplot state machine is process-global and not thread-safe; the
# copied viz/similarity helpers use pyplot. Serialize only the (fast) plotting
# with the process-wide PLOT_LOCK (shared with the MRI runner — a same-process
# EEG+MRI job pair races on the same pyplot state too) so concurrent jobs can't
# corrupt each other's figures. The (slow) model inference runs in a subprocess
# and stays fully parallel.


def _reference_paths() -> dict[str, str]:
    ref_dir = get_settings().eeg_reference_dir
    return {
        "cn": os.path.join(ref_dir, "representative", "cn repr.npy"),
        "mci": os.path.join(ref_dir, "representative", "mci repr.npy"),
        "ad": os.path.join(ref_dir, "representative", "ad repr.npy"),
    }


def run_eeg_pipeline(context: AnalysisContext) -> PipelineResult:
    settings = get_settings()
    analysis_type = "multiclass"  # ADFD-only; binary/ADSZ is retired.
    spec = get_spec(analysis_type)
    input_path = context.local_input_path
    work_dir = os.path.dirname(os.path.abspath(input_path))
    channel_index = int(context.options.get("channel_index", 0) or 0)

    # --- 0) Preprocess: one raw load, then align/resample/pad to spec ---
    metadata = preprocessing.parse_eeg_metadata(context.options.get("eeg_metadata"))
    raw = np.load(input_path, allow_pickle=True)
    prepared = preprocessing.preprocess_eeg(
        raw, metadata, spec, apply_zscore=settings.eeg_apply_zscore
    )
    prepared_path = preprocessing.write_preprocessed_npy(
        prepared,
        os.path.join(work_dir, f"eeg_preprocessed_{context.session_id}.npy"),
    )

    # --- 1) Model inference (subprocess, unique output file per job) ---
    output_path = os.path.join(work_dir, f"siddhi_output_{context.session_id}.json")
    ml_output = ml_runner.run_model(prepared_path, analysis_type, output_path=output_path)

    majority = ml_output.get("majority_prediction")
    probs_list = ml_output.get("probabilities") or []
    trial_predictions = ml_output.get("trial_predictions")
    consistency_metrics = ml_output.get("consistency_metrics") or {}

    # --- 2) Normalize prediction / probabilities / confidence ---
    classes = spec.classes
    prediction = spec.labels.get(majority, "Unknown")
    probabilities = {
        cls: float(p) for cls, p in zip(classes, probs_list)
    } if probs_list else {}
    confidence = probabilities.get(
        prediction, max(probabilities.values(), default=0.0)
    )

    # --- 3) Stats + plots + similarity (serialized: pyplot global state) ---
    with PLOT_LOCK:
        eeg_data = first_trial_2d(prepared)
        fs = settings.eeg_default_fs
        stats = generate_descriptive_stats(eeg_data, fs)
        ts_b64 = generate_stacked_timeseries_image(eeg_data, fs)
        psd_b64 = generate_average_psd_image(eeg_data, fs)

        refs = _reference_paths()
        sim = run_multiclass_similarity_analysis(
            prepared_path, refs["cn"], refs["mci"], refs["ad"], channel_index
        )

    sim = sim if isinstance(sim, dict) else {}
    sim_b64 = sim.get("plot_base64")
    similarity = {k: v for k, v in sim.items() if k != "plot_base64"}

    # --- 4) Write plot artifacts (orchestrator uploads them into visualizations) ---
    artifacts: dict[str, str] = {}
    for key, b64, name in [
        ("timeseries_plot_url", ts_b64, "timeseries.png"),
        ("psd_plot_url", psd_b64, "psd.png"),
        ("similarity_plot_url", sim_b64, "similarity.png"),
    ]:
        written = write_data_uri_png(b64, os.path.join(work_dir, name))
        if written:
            artifacts[key] = written

    return PipelineResult(
        prediction=prediction,
        confidence=float(confidence),
        probabilities=probabilities,
        metrics={"eeg_stats": stats},
        similarity=similarity,
        consistency={"trial_predictions": trial_predictions, **consistency_metrics},
        visualizations={},
        model_version=spec.model_version,
        artifacts=artifacts,
    )
