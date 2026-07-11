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
import threading

import numpy as np

from app.core.config import get_settings
from app.core.logging import get_logger
from app.pipelines.artifacts import write_data_uri_png
from app.pipelines.base import AnalysisContext, PipelineResult
from app.pipelines.eeg import ml_runner
from app.pipelines.eeg.loader import load_eeg_2d
from app.pipelines.eeg.similarity_analyzer import (
    run_multiclass_similarity_analysis,
    run_similarity_analysis,
)
from app.pipelines.eeg.visualization import (
    generate_average_psd_image,
    generate_descriptive_stats,
    generate_stacked_timeseries_image,
)

logger = get_logger(__name__)

# matplotlib's pyplot state machine is process-global and not thread-safe; the
# copied viz/similarity helpers use pyplot. Serialize only the (fast) plotting so
# concurrent EEG jobs can't corrupt each other's figures. The (slow) model
# inference runs in a subprocess and stays fully parallel.
_PLOT_LOCK = threading.Lock()

_LABELS = {
    "binary": {0: "Normal", 1: "Alzheimer's"},
    "multiclass": {0: "CN", 1: "MCI", 2: "AD"},
}
_CLASSES = {
    "binary": ["Normal", "Alzheimer's"],
    "multiclass": ["CN", "MCI", "AD"],
}
_MODEL_VERSION = {
    "binary": "ADFormer-ADSZ-Indep",
    "multiclass": "ADFormer-ADFD-Indep",
}
_EXPECTED_SHAPES = {
    "binary": {"seq_len": 128, "channels": 19, "alternate": "multiclass"},
    "multiclass": {"seq_len": 256, "channels": 19, "alternate": "binary"},
}


def _reference_paths(analysis_type: str) -> dict[str, str]:
    ref_dir = get_settings().eeg_reference_dir
    if analysis_type == "multiclass":
        return {
            "cn": os.path.join(ref_dir, "representative", "cn repr.npy"),
            "mci": os.path.join(ref_dir, "representative", "mci repr.npy"),
            "ad": os.path.join(ref_dir, "representative", "ad repr.npy"),
        }
    return {
        "alz": os.path.join(ref_dir, "feature_07.npy"),
        "norm": os.path.join(ref_dir, "feature_35.npy"),
    }


def run_eeg_pipeline(context: AnalysisContext) -> PipelineResult:
    settings = get_settings()
    analysis_type = context.analysis_type if context.analysis_type in _LABELS else "binary"
    input_path = context.local_input_path
    work_dir = os.path.dirname(os.path.abspath(input_path))
    channel_index = int(context.options.get("channel_index", 0) or 0)
    _validate_eeg_input_shape(input_path, analysis_type)

    # --- 1) Model inference (subprocess, unique output file per job) ---
    output_path = os.path.join(work_dir, f"siddhi_output_{context.session_id}.json")
    ml_output = ml_runner.run_model(input_path, analysis_type, output_path=output_path)

    majority = ml_output.get("majority_prediction")
    probs_list = ml_output.get("probabilities") or []
    trial_predictions = ml_output.get("trial_predictions")
    consistency_metrics = ml_output.get("consistency_metrics") or {}

    # --- 2) Normalize prediction / probabilities / confidence ---
    classes = _CLASSES[analysis_type]
    prediction = _LABELS[analysis_type].get(majority, "Unknown")
    probabilities = {
        cls: float(p) for cls, p in zip(classes, probs_list)
    } if probs_list else {}
    confidence = probabilities.get(
        prediction, max(probabilities.values(), default=0.0)
    )

    # --- 3) Stats + plots + similarity (serialized: pyplot global state) ---
    with _PLOT_LOCK:
        eeg_data = load_eeg_2d(input_path)
        fs = settings.eeg_default_fs
        stats = generate_descriptive_stats(eeg_data, fs)
        ts_b64 = generate_stacked_timeseries_image(eeg_data, fs)
        psd_b64 = generate_average_psd_image(eeg_data, fs)

        refs = _reference_paths(analysis_type)
        if analysis_type == "multiclass":
            sim = run_multiclass_similarity_analysis(
                input_path, refs["cn"], refs["mci"], refs["ad"], channel_index
            )
        else:
            sim = run_similarity_analysis(
                input_path, refs["alz"], refs["norm"], channel_index
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
        model_version=_MODEL_VERSION[analysis_type],
        artifacts=artifacts,
    )


def _validate_eeg_input_shape(input_path: str, analysis_type: str) -> None:
    expected = _EXPECTED_SHAPES[analysis_type]
    eeg = np.load(input_path, allow_pickle=True)
    if eeg.ndim == 3:
        _, seq_len, channels = eeg.shape
    elif eeg.ndim == 2:
        seq_len, channels = eeg.shape
    else:
        raise ValueError(
            f"Unsupported EEG data dimension {eeg.ndim}. Expected 2D or 3D .npy data."
        )

    if channels != expected["channels"]:
        raise ValueError(
            f"EEG input has {channels} channels, but AI4NEURO expects "
            f"{expected['channels']} channels."
        )

    if seq_len != expected["seq_len"]:
        alternate = expected["alternate"]
        raise ValueError(
            f"EEG input sequence length is {seq_len}, but {analysis_type} analysis "
            f"expects {expected['seq_len']}. Select EEG {alternate} if this file "
            "belongs to that pipeline, or upload a matching EEG .npy file."
        )
