"""SIDDHI/ADformer model runner (subprocess, concurrency-safe).

Adapted from ``Alzheimer-Detection/backend/ml_runner.py``. Preserves the exact
ADformer CLI invocation (same model ids, seq lengths, patch/dim lists, SWA flag,
and the ``--des "'Exp'"`` quoting that matches the checkpoint folder names).

Two changes make it safe under a ThreadPoolExecutor with >1 worker:
  * no ``os.chdir`` — the subprocess runs with ``cwd=<siddhi_dir>``;
  * a UNIQUE ``--output_path`` per call — no shared ``output.json``.

Returns the parsed results dict (``majority_prediction``, ``probabilities``,
``trial_predictions``, ``consistency_metrics``) rather than a file path.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from typing import Any

from app.core.config import get_settings
from app.core.logging import get_logger
from app.pipelines.eeg.checkpoint_registry import get_spec

logger = get_logger(__name__)


def run_model(
    input_path: str,
    analysis_type: str = "multiclass",
    *,
    output_path: str,
    siddhi_dir: str | None = None,
    checkpoint_root: str | None = None,
    use_gpu: bool | None = None,
    timeout: int | None = None,
) -> dict[str, Any]:
    """Run the ADformer model on ``input_path`` and return the parsed results dict.

    output_path: unique JSON path the subprocess writes to (per-job).
    """
    settings = get_settings()
    siddhi_dir = siddhi_dir or settings.eeg_siddhi_dir
    checkpoint_root = checkpoint_root or settings.eeg_checkpoint_root
    use_gpu = settings.eeg_use_gpu if use_gpu is None else use_gpu
    timeout = timeout or settings.eeg_subprocess_timeout

    run_py = os.path.join(siddhi_dir, "run.py")
    input_abs = os.path.abspath(input_path)
    output_abs = os.path.abspath(output_path)

    if not os.path.isdir(siddhi_dir):
        raise FileNotFoundError(f"SIDDHI directory not found at: {siddhi_dir}")
    if not os.path.isfile(input_abs):
        raise FileNotFoundError(f"Input EEG file not found at: {input_abs}")

    spec = get_spec(analysis_type)
    cmd = [
        sys.executable, run_py,
        "--task_name", "classification",
        "--is_training", "0",
        "--model_id", spec.model_id,
        "--model", "ADformer",
        "--data", spec.data_type,
        "--e_layers", "6",
        "--batch_size", "1",
        "--d_model", "128",
        "--d_ff", "256",
        "--enc_in", str(spec.channels),
        "--num_class", str(spec.num_classes),
        "--seq_len", str(spec.seq_len),
        "--input_file", input_abs,
        "--output_path", output_abs,
        "--checkpoint_root", checkpoint_root,
        "--use_gpu", str(use_gpu),
        "--features", "M",
        "--label_len", "48",
        "--pred_len", "96",
        "--n_heads", "8",
        "--d_layers", "1",
        "--factor", "1",
        "--embed", "timeF",
        "--des", "'Exp'",
        "--patch_len_list", spec.patch_len_list,
        "--up_dim_list", spec.up_dim_list,
    ]
    if spec.swa:
        cmd.append("--swa")

    logger.info("Running EEG model (%s): %s", analysis_type, " ".join(cmd))
    try:
        result = subprocess.run(
            cmd, cwd=siddhi_dir, capture_output=True, text=True,
            check=True, encoding="utf-8", timeout=timeout,
        )
    except subprocess.CalledProcessError as exc:
        logger.error("EEG model failed (rc=%s)\nSTDERR:\n%s", exc.returncode, exc.stderr)
        raise
    except subprocess.TimeoutExpired as exc:
        raise TimeoutError("EEG model execution timed out.") from exc

    if result.stderr:
        logger.debug("EEG model STDERR:\n%s", result.stderr)

    if not os.path.exists(output_abs):
        raise FileNotFoundError(
            f"EEG model did not produce output at {output_abs}.\nSTDOUT:\n{result.stdout}"
        )

    with open(output_abs, "r") as fh:
        return json.load(fh)
