"""MRI pipeline tests (mock-first + real viewer-slice extraction).

The prediction path runs in mock mode (no ConViT checkpoint / CAT12 on Linux),
so the unified-shape assertions always run once matplotlib is installed. The
viewer-slice test builds a small synthetic NIfTI with nibabel to exercise the
real (Supabase-decoupled) slice extraction + upload path.
"""

from __future__ import annotations

import os

import numpy as np
import pytest

# The MRI runner needs matplotlib (charts). Skip the module if absent.
pytest.importorskip("matplotlib")

from app.pipelines.base import AnalysisContext  # noqa: E402


def _make_context(base_dir, filename: str, analysis_type: str, sid: str) -> AnalysisContext:
    work_dir = os.path.join(str(base_dir), sid)
    os.makedirs(work_dir, exist_ok=True)
    path = os.path.join(work_dir, filename)
    # Mock mode ignores content; bytes are enough to stand in for a scan.
    with open(path, "wb") as fh:
        fh.write(b"\x1f\x8b\x08\x00fake-nifti-gzip")
    return AnalysisContext(
        session_id=sid,
        modality="mri",
        analysis_type=analysis_type,
        local_input_path=path,
        original_filename=filename,
        patient_id="11111111-1111-1111-1111-111111111111",
    )


def test_mock_unified_shape(tmp_path):
    from app.pipelines.mri.runner import run_mri_pipeline

    ctx = _make_context(tmp_path, "scan.nii.gz", "multiclass", "mri-mock")
    res = run_mri_pipeline(ctx)

    assert res.prediction in {"CN", "MCI", "AD"}
    assert 0.0 <= res.confidence <= 1.0
    assert set(res.probabilities.keys()) == {"CN", "MCI", "AD"}
    assert abs(sum(res.probabilities.values()) - 1.0) < 1e-4
    # Volume metrics + normative comparison present.
    assert res.metrics["brain_volume"] is not None
    assert "volume_comparison" in res.metrics
    # Charts written as artifacts (uploaded into visualizations by the orchestrator).
    assert "volume_chart_url" in res.artifacts
    assert "confidence_chart_url" in res.artifacts
    for path in res.artifacts.values():
        assert os.path.exists(path)
    # Mock input isn't a real NIfTI → no viewer slices.
    assert res.viewer_slices == {}
    assert res.model_version  # e.g. 'mock-v1.0' or 'ConViT-v1.0'


def test_binary_two_classes(tmp_path):
    from app.pipelines.mri.runner import run_mri_pipeline

    ctx = _make_context(tmp_path, "scan.nii.gz", "binary", "mri-binary")
    res = run_mri_pipeline(ctx)
    assert set(res.probabilities.keys()) == {"CN", "AD"}


def test_viewer_slice_extraction_and_upload(tmp_path):
    """Real NIfTI → local per-orientation slices → uploaded via storage service."""
    nib = pytest.importorskip("nibabel")
    from app.pipelines.mri.ml.nifti_slicer import extract_viewer_slices_local
    from app.services.storage import StorageService
    from tests.fake_supabase import FakeSupabase

    # Build a small synthetic brain-ish volume.
    vol = (np.random.rand(24, 24, 24) * 255).astype(np.float32)
    nifti_path = os.path.join(str(tmp_path), "synthetic.nii.gz")
    nib.save(nib.Nifti1Image(vol, affine=np.eye(4)), nifti_path)

    slices = extract_viewer_slices_local(
        nifti_path, os.path.join(str(tmp_path), "viewer"), num_slices=4
    )
    assert set(slices.keys()) == {"axial", "sagittal", "coronal"}
    for orientation, paths in slices.items():
        assert paths and all(os.path.exists(p) for p in paths)

    storage = StorageService(client=FakeSupabase())
    urls = storage.upload_viewer_slices("sess-viewer", slices)
    assert set(urls.keys()) == {"axial", "sagittal", "coronal"}
    assert all(len(v) == len(slices[k]) for k, v in urls.items())
    assert all(u.startswith("https://fake.storage/viewer-slices/") for v in urls.values() for u in v)


def test_full_loop_via_orchestrator(tmp_path):
    from app.pipelines.base import register_pipeline
    from app.pipelines.mri.runner import run_mri_pipeline
    from app.services.database import DatabaseService
    from app.services.orchestrator import run_analysis_job
    from app.services.storage import StorageService
    from tests.fake_supabase import FakeSupabase

    register_pipeline("mri", run_mri_pipeline)

    fake = FakeSupabase()
    db = DatabaseService(client=fake)
    storage = StorageService(client=fake)

    session = db.create_session(
        modality="mri",
        analysis_type="multiclass",
        original_filename="scan.nii.gz",
        patient_id="11111111-1111-1111-1111-111111111111",
    )
    sid = str(session["id"])
    bucket, path = storage.upload_raw_file(
        modality="mri", session_id=sid, filename="scan.nii.gz", data=b"fake-nifti"
    )
    db.set_raw_file(sid, path=path, bucket=bucket)

    run_analysis_job(sid, db=db, storage=storage)

    session = db.get_session(sid)
    assert session["status"] == "completed"
    result = db.get_result(sid)
    assert result["prediction"] in {"CN", "MCI", "AD"}
    assert "volume_chart_url" in result["visualizations"]
    assert "confidence_chart_url" in result["visualizations"]
