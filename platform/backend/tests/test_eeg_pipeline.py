"""Real EEG pipeline tests (SIDDHI/ADformer).

Skipped automatically when torch / plotting deps / checkpoints are unavailable,
so CI without the EEG stack (and the foundation suite) stays green. Run after
`pip install -r requirements/eeg.txt` with the EEG checkpoints present.
"""

from __future__ import annotations

import os
import threading

import numpy as np
import pytest

# Skip the whole module unless the EEG stack is importable.
pytest.importorskip("torch")
pytest.importorskip("matplotlib")
pytest.importorskip("dtaidistance")

from app.core.config import get_settings  # noqa: E402
from app.pipelines.base import AnalysisContext  # noqa: E402

_settings = get_settings()
_CKPT_ROOT = _settings.eeg_checkpoint_root
_SIDDHI_DIR = _settings.eeg_siddhi_dir
_SAMPLE = os.path.join(_SIDDHI_DIR, "Sample", "feature_02.npy")

pytestmark = pytest.mark.skipif(
    not os.path.isdir(_CKPT_ROOT) or not os.path.exists(_SAMPLE),
    reason="EEG checkpoints or sample input not available",
)


def _make_context(base_dir, arr, analysis_type: str, sid: str, channel_index: int = 0):
    """Write the input into a per-session work dir (mirrors the orchestrator)."""
    work_dir = os.path.join(str(base_dir), sid)
    os.makedirs(work_dir, exist_ok=True)
    path = os.path.join(work_dir, "input.npy")
    np.save(path, arr)
    return AnalysisContext(
        session_id=sid,
        modality="eeg",
        analysis_type=analysis_type,
        local_input_path=path,
        original_filename="input.npy",
        patient_id="11111111-1111-1111-1111-111111111111",
        options={"channel_index": channel_index},
    )


def test_multiclass_128_seqlen_input_end_to_end(tmp_path):
    """The 128-seq-len ADSZ-format sample now runs through preprocessing
    (interpolated to 256 timepoints) and the ADFD-only pipeline, instead of
    requiring a separate binary checkpoint."""
    from app.pipelines.eeg.runner import run_eeg_pipeline

    arr = np.load(_SAMPLE, allow_pickle=True)
    ctx = _make_context(tmp_path, arr, "multiclass", "sess-128")
    res = run_eeg_pipeline(ctx)

    assert res.prediction in {"CN", "MCI", "AD"}
    assert abs(sum(res.probabilities.values()) - 1.0) < 1e-4
    assert res.model_version == "ADFormer-ADFD-Indep"
    assert "eeg_stats" in res.metrics
    for key in ("timeseries_plot_url", "psd_plot_url", "similarity_plot_url"):
        assert key in res.artifacts and os.path.exists(res.artifacts[key])


def test_multiclass_shape(tmp_path):
    from app.pipelines.eeg.checkpoint_registry import get_spec
    from app.pipelines.eeg.runner import run_eeg_pipeline

    arr = np.random.randn(256, 19).astype(np.float32)
    ctx = _make_context(tmp_path, arr, "multiclass", "sess-mc")
    res = run_eeg_pipeline(ctx)

    spec = get_spec("multiclass")
    assert set(res.probabilities.keys()) == set(spec.classes)
    assert res.prediction in spec.classes
    assert res.model_version == spec.model_version


def test_concurrent_jobs_no_collision(tmp_path):
    """Two EEG jobs in parallel must not race on CWD or output files."""
    from app.pipelines.eeg.runner import run_eeg_pipeline

    arr = np.load(_SAMPLE, allow_pickle=True)
    results: dict[str, object] = {}
    errors: list[Exception] = []

    def _run(sid: str) -> None:
        try:
            results[sid] = run_eeg_pipeline(_make_context(tmp_path, arr, "multiclass", sid))
        except Exception as exc:  # noqa: BLE001
            errors.append(exc)

    threads = [threading.Thread(target=_run, args=(f"c{i}",)) for i in range(2)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert not errors, f"Concurrent EEG jobs raised: {errors}"
    assert len(results) == 2
    assert all(r.prediction in {"CN", "MCI", "AD"} for r in results.values())


def test_full_loop_via_orchestrator(tmp_path, monkeypatch):
    """Upload -> orchestrator -> real EEG runner -> normalized result in the DB."""
    from app.pipelines.base import register_pipeline
    from app.pipelines.eeg.runner import run_eeg_pipeline
    from app.services.database import DatabaseService
    from app.services.orchestrator import run_analysis_job
    from app.services.storage import StorageService
    from tests.fake_supabase import FakeSupabase

    # Ensure the registry points at the real runner for this test.
    register_pipeline("eeg", run_eeg_pipeline)

    fake = FakeSupabase()
    db = DatabaseService(client=fake)
    storage = StorageService(client=fake)

    session = db.create_session(
        modality="eeg",
        analysis_type="multiclass",
        original_filename="input.npy",
        patient_id="11111111-1111-1111-1111-111111111111",
        pipeline_options={"channel_index": 0},
    )
    sid = str(session["id"])
    with open(_SAMPLE, "rb") as fh:
        data = fh.read()
    bucket, path = storage.upload_raw_file(
        modality="eeg", session_id=sid, filename="input.npy", data=data
    )
    db.set_raw_file(sid, path=path, bucket=bucket)

    run_analysis_job(sid, db=db, storage=storage)

    session = db.get_session(sid)
    assert session["status"] == "completed"
    result = db.get_result(sid)
    assert result["prediction"] in {"CN", "MCI", "AD"}
    assert result["model_version"] == "ADFormer-ADFD-Indep"
    # Artifacts were uploaded and folded into visualizations as signed URLs.
    assert set(result["visualizations"].keys()) >= {
        "timeseries_plot_url", "psd_plot_url", "similarity_plot_url"
    }
