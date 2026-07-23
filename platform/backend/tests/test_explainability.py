"""Tests for MRI AI visual explainability (observations, slice selection,
MNI152 reference slicing, graceful Grad-CAM fallback, and report rendering).

These exercise everything that does NOT require torch/the checkpoint — the
Grad-CAM overlay itself degrades to a plain slice when the model is
unavailable, which is exactly the path validated here.
"""

from __future__ import annotations

import os

import pytest

pytest.importorskip("fpdf")
pytest.importorskip("PIL")

from PIL import Image  # noqa: E402

from app.pipelines.mri import explainability as ex  # noqa: E402


def _make_slices(tmp_path, n=10):
    paths = []
    for i in range(1, n + 1):
        p = tmp_path / f"slice_{i}.png"
        Image.new("L", (120, 120), int(20 + i * 8)).convert("RGB").save(p)
        paths.append(str(p))
    return paths


class _NoModelPredictor:
    model = None
    transform = None

    def is_available(self):
        return False


def test_observations_ad_from_real_volumes():
    ml = {"hippocampal_volume": 2.5, "csf_volume": 400, "gm_volume": 400, "brain_volume": 1000}
    obs = ex.build_observations(ml, "AD")
    joined = " ".join(obs).lower()
    assert "hippocamp" in joined
    assert any("temporal" in o.lower() for o in obs)


def test_observations_cn_reports_no_abnormality():
    obs = ex.build_observations({}, "CN")
    assert len(obs) == 1
    assert "no significant" in obs[0].lower()


def test_slice_selection_prefers_highest_pathology_score(tmp_path):
    slices = _make_slices(tmp_path)
    preds = [
        {
            "image_index": i,
            "image_path": f"slice_{i}.png",
            "predicted_class": "AD",
            "probabilities": {"AD": 10 * i, "CN": 5, "MCI": 5},
        }
        for i in range(1, 11)
    ]
    selected = ex._select_informative_slices(slices, preds, "AD", 2)
    chosen_idx = {idx for idx, _ in selected}
    # slices 9 and 10 have the highest AD probability (0-based 8, 9).
    assert chosen_idx == {8, 9}


def test_slice_selection_fallback_without_probabilities(tmp_path):
    slices = _make_slices(tmp_path)
    selected = ex._select_informative_slices(slices, [], "AD", 2)
    assert 1 <= len(selected) <= 2
    assert all(0 <= idx < len(slices) for idx, _ in selected)


def test_mni_reference_slices_available():
    refs = ex._load_reference_slices("axial", count=10)
    # The bundled MNI152 template must yield real reference data-URIs.
    assert refs, "MNI152 template asset missing or unreadable"
    assert any(r and r.startswith("data:image/png") for r in refs)


def test_generate_explainability_fallback_produces_panels(tmp_path):
    slices = _make_slices(tmp_path)
    preds = [
        {
            "image_index": i,
            "image_path": f"slice_{i}.png",
            "predicted_class": "AD",
            "probabilities": {"AD": 10 * i, "CN": 5, "MCI": 5},
        }
        for i in range(1, 11)
    ]
    ml = {"hippocampal_volume": 2.5, "csf_volume": 400, "gm_volume": 400, "brain_volume": 1000}
    payload = ex.generate_explainability(
        scan_path="x.nii.gz",
        slice_paths=slices,
        individual_predictions=preds,
        predictor=_NoModelPredictor(),
        ml_results=ml,
        prediction="AD",
        work_dir=str(tmp_path),
    )
    assert payload and payload["panels"]
    assert payload["regions"], "AD should list clinically relevant regions"
    panel = payload["panels"][0]
    assert panel["affected_image"].startswith("data:image")
    assert panel["reference_image"].startswith("data:image")
    assert panel["observations"]


def test_generate_explainability_normal_case(tmp_path):
    slices = _make_slices(tmp_path)
    payload = ex.generate_explainability(
        scan_path="x.nii.gz",
        slice_paths=slices,
        individual_predictions=[],
        predictor=_NoModelPredictor(),
        ml_results={},
        prediction="CN",
        work_dir=str(tmp_path),
    )
    assert payload and payload["panels"]
    assert payload["regions"] == []
    assert "no significant" in payload["summary"].lower()


def test_mri_report_renders_with_explainability(tmp_path):
    pytest.importorskip("matplotlib")
    from app.reports.mri import UnifiedPDFReport, build_unified_report

    slices = _make_slices(tmp_path)
    preds = [
        {"image_index": i, "image_path": f"slice_{i}.png", "predicted_class": "AD",
         "probabilities": {"AD": 10 * i, "CN": 5, "MCI": 5}}
        for i in range(1, 11)
    ]
    ml = {"hippocampal_volume": 2.5, "csf_volume": 400, "gm_volume": 400, "brain_volume": 1000}
    payload = ex.generate_explainability(
        scan_path="x.nii.gz", slice_paths=slices, individual_predictions=preds,
        predictor=_NoModelPredictor(), ml_results=ml, prediction="AD", work_dir=str(tmp_path),
    )
    context = {
        "hospital": {"name": "Saint Elizabeth Hospital", "address": "1500 San Pablo Street",
                     "phone": "+1 800 765 7678", "email": "care@hospital.org"},
        "patient": {"full_name": "Celeste Lim", "unique_identifier": "1234565"},
        "patient_profile": {"patient_code": "PAT-1", "gender": "Female", "date_of_birth": "2015-03-09"},
        "doctor": {"full_name": "Dr. Maxine Chan"},
        "radiologist": {"full_name": "Dr. Vimal Shah"},
        "blood_group": "A+",
        "session": {"session_code": "MRI-1", "analysis_type": "multiclass",
                    "scan_date": "2026-07-20T00:00:00Z"},
    }
    ml_results = {
        "prediction": "AD", "confidence": 0.82,
        "probabilities": {"CN": 0.1, "MCI": 0.08, "AD": 0.82}, "classes": ["CN", "MCI", "AD"],
        "brain_volume": 1000, "gm_volume": 400, "wm_volume": 380, "csf_volume": 400,
        "hippocampal_volume": 2.5, "ventricular_volume": 45, "model_version": "ConViT-v1.0",
        "analysis_type": "multiclass", "processing_time": 1.2, "used_cat12": False,
        "explainability": payload,
    }
    pdf = UnifiedPDFReport()
    pdf.alias_nb_pages()
    build_unified_report(pdf, context, ml_results, None, None)
    out = bytes(pdf.output())
    assert out.startswith(b"%PDF")
    assert len(out) > 5000
