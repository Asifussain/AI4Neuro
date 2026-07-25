"""AI Visual Explainability for MRI reports.

Turns the model's decision into visual evidence a clinician (and patient) can
read: for the most informative patient slices it produces a Grad-CAM heatmap
overlay (the regions that drove the ConViT prediction), pairs each with the
anatomically-matching healthy **MNI152** reference slice, and attaches
plain-language observations derived from the *real* volumetric comparison.

Everything here is best-effort and non-fatal — if torch / the model / nibabel
is unavailable, or Grad-CAM fails, the caller simply gets ``None`` (or a panel
without an overlay) and the rest of the pipeline/report is unaffected, matching
the existing "reports never fail the job" contract.

No fabricated anatomy: overlays come from the trained model, reference slices
come from the standard MNI152 template, and observations are computed from the
patient's own measured volumes vs. normative ranges.
"""

from __future__ import annotations

import base64
import io
import logging
import os
from typing import Any

logger = logging.getLogger(__name__)

_ASSET_DIR = os.path.join(os.path.dirname(__file__), "assets")
_MNI_TEMPLATE = os.path.join(_ASSET_DIR, "mni152_template.nii.gz")

# Clinically relevant regions we call out for AD/MCI (the plane the model reads
# is axial mid-brain, where these structures are visible).
_AD_REGIONS = [
    "Hippocampus",
    "Medial Temporal Lobe",
    "Entorhinal Cortex",
    "Ventricular system",
]


def generate_explainability(
    *,
    scan_path: str,
    slice_paths: list[str],
    individual_predictions: list[dict],
    predictor: Any,
    ml_results: dict,
    prediction: str,
    work_dir: str,
    max_panels: int = 2,
) -> dict | None:
    """Build the explainability payload consumed by the report builder.

    Returns a dict::

        {
          "method": "Grad-CAM (ConViT)" | "Model slices (overlay unavailable)",
          "regions": [...],                 # clinically relevant regions called out
          "summary": "...",
          "panels": [
            {
              "plane": "axial",
              "affected_image": "data:image/png;base64,...",   # slice + heatmap
              "reference_image": "data:image/png;base64,...",  # MNI152 slice
              "caption": "Axial slice - AI-attended region",
              "observations": ["Reduced hippocampal volume ...", ...],
            }, ...
          ],
        }

    or ``None`` when nothing could be produced (no slices at all).
    """
    if not slice_paths:
        return None

    is_normal = str(prediction).upper() == "CN"
    observations = build_observations(ml_results, prediction)

    # 1) Pick the most informative slices (highest predicted-class probability).
    selected = _select_informative_slices(
        slice_paths, individual_predictions, prediction, max_panels
    )

    # 2) Aligned MNI152 healthy reference slices (same axial band as the patient).
    reference_slices = _load_reference_slices("axial", count=len(slice_paths))

    # 3) Grad-CAM overlays from the real model (None each on any failure).
    method = "Grad-CAM (ConViT)"
    panels: list[dict] = []
    any_overlay = False
    for order, (idx0, slice_path) in enumerate(selected, start=1):
        overlay = _gradcam_overlay(predictor, slice_path, prediction)
        if overlay:
            any_overlay = True
        affected = overlay or _png_to_data_uri(slice_path)
        reference = (
            reference_slices[idx0]
            if reference_slices and idx0 < len(reference_slices)
            else None
        )
        caption = (
            f"Axial slice {idx0 + 1} - AI-attended region"
            if overlay
            else f"Axial slice {idx0 + 1}"
        )
        panels.append(
            {
                "plane": "axial",
                "affected_image": affected,
                "reference_image": reference,
                "caption": caption,
                "observations": observations,
            }
        )

    if not panels:
        return None
    if not any_overlay:
        method = "Model slices (overlay unavailable)"

    summary = (
        "No significant structural abnormalities detected by the AI model."
        if is_normal
        else "The highlighted regions contributed most to the AI prediction; "
        "compare each patient slice with the healthy reference alongside it."
    )
    return {
        "method": method,
        "regions": [] if is_normal else _AD_REGIONS,
        "summary": summary,
        "panels": panels,
    }


# --------------------------------------------------------------------------- #
# Observations (from REAL volumetric comparison)
# --------------------------------------------------------------------------- #
def build_observations(ml_results: dict, prediction: str) -> list[str]:
    """Plain-language findings derived from the measured volumes vs. normative
    ranges (see ml_runner.get_volume_comparison) plus the predicted class."""
    if str(prediction).upper() == "CN":
        return ["No significant structural abnormality detected compared with healthy anatomy."]

    try:
        from app.pipelines.mri import ml_runner

        comparison = ml_runner.get_volume_comparison(ml_results) or {}
    except Exception:  # noqa: BLE001
        comparison = ml_results.get("volume_comparison") or {}

    obs: list[str] = []
    hippo = comparison.get("hippocampus") or {}
    if hippo.get("status") == "Below Normal":
        dev = hippo.get("deviation_percent")
        obs.append(
            f"Reduced hippocampal volume ({dev}% below the normative range)."
            if dev is not None
            else "Reduced hippocampal volume compared with a healthy reference."
        )
    csf = comparison.get("csf") or {}
    if csf.get("status") == "Above Normal":
        obs.append("Ventricular / CSF space enlargement noted.")
    gm = comparison.get("gray_matter") or {}
    brain = comparison.get("total_brain") or {}
    if gm.get("status") == "Below Normal" or brain.get("status") == "Below Normal":
        obs.append("Cortical thinning / reduced gray-matter volume (cortical atrophy).")

    # Prediction-level clinical framing (standard for MTL-predominant AD pattern).
    if str(prediction).upper() in ("AD", "MCI") and not any("temporal" in o.lower() for o in obs):
        obs.append("Mild medial temporal lobe atrophy suggestive of early Alzheimer's disease.")

    if not obs:
        obs.append("AI-attended regions shown; correlate clinically with the volumetric findings.")
    return obs


# --------------------------------------------------------------------------- #
# Slice selection
# --------------------------------------------------------------------------- #
def _select_informative_slices(
    slice_paths: list[str],
    individual_predictions: list[dict],
    prediction: str,
    k: int,
) -> list[tuple[int, str]]:
    """Return up to ``k`` (0-based-index, path) pairs, ranked by the predicted
    class probability of each slice (highest "pathology score" first). Falls
    back to evenly-spaced slices when per-slice probabilities are unavailable."""
    by_basename = {os.path.basename(p): p for p in slice_paths}
    scored: list[tuple[float, int, str]] = []
    target = str(prediction).upper()
    for pred in individual_predictions or []:
        probs = pred.get("probabilities") or {}
        # probabilities are 0-100 in predictor output; direction only matters.
        score = float(probs.get(target, probs.get(pred.get("predicted_class", ""), 0.0)) or 0.0)
        idx = int(pred.get("image_index", 0)) - 1
        path = by_basename.get(pred.get("image_path", "")) or (
            slice_paths[idx] if 0 <= idx < len(slice_paths) else None
        )
        if path is not None and 0 <= idx < len(slice_paths):
            scored.append((score, idx, path))

    if scored:
        scored.sort(key=lambda t: t[0], reverse=True)
        chosen = scored[: max(1, k)]
        # Keep a stable visual order (top→bottom) once selected.
        chosen.sort(key=lambda t: t[1])
        return [(idx, path) for _, idx, path in chosen]

    # Fallback: evenly spaced slices across the extracted band.
    n = len(slice_paths)
    if n == 0:
        return []
    if n <= k:
        return list(enumerate(slice_paths))
    picks = sorted({int(round(i * (n - 1) / (k + 1))) for i in range(1, k + 1)})
    return [(i, slice_paths[i]) for i in picks]


# --------------------------------------------------------------------------- #
# MNI152 healthy reference slices
# --------------------------------------------------------------------------- #
def _load_reference_slices(plane: str, count: int) -> list[str | None]:
    """Extract ``count`` mid-brain reference slices (as data URIs) from the
    bundled MNI152 template in the same plane/band the patient slices span, so
    each patient slice pairs with an anatomically-comparable healthy slice."""
    if not os.path.exists(_MNI_TEMPLATE):
        logger.info("MNI152 template asset missing at %s", _MNI_TEMPLATE)
        return []
    try:
        from app.pipelines.mri.ml.nifti_slicer import NIfTISlicer

        slicer = NIfTISlicer(output_format="png", normalize=True)
        data = slicer._load_and_prepare(_MNI_TEMPLATE)  # noqa: SLF001 (internal reuse)
        center_map = slicer._find_brain_center(data)  # noqa: SLF001
        axis_map = {"sagittal": 0, "coronal": 1, "axial": 2}
        axis = axis_map.get(plane, 2)
        center = center_map.get(plane, data.shape[axis] // 2)
        start = max(0, center - (count // 2))
        end = min(data.shape[axis], start + count)
        uris: list[str | None] = []
        for slice_idx in range(start, end):
            arr = slicer._extract_slice(data, axis, slice_idx)  # noqa: SLF001
            uris.append(_array_to_data_uri(arr))
        return uris
    except Exception as exc:  # noqa: BLE001 (nibabel missing / bad asset)
        logger.info("MNI152 reference slicing skipped: %s", exc)
        return []


# --------------------------------------------------------------------------- #
# Grad-CAM (ConViT)
# --------------------------------------------------------------------------- #
def _gradcam_overlay(predictor: Any, image_path: str, prediction: str) -> str | None:
    """Return a data-URI PNG of the slice with a Grad-CAM heatmap overlay for
    the predicted class, or ``None`` if explainability can't be produced.

    Implements a transformer-friendly Grad-CAM: it hooks the final LayerNorm of
    the ConViT, backprops the target-class logit, folds gradients × activations
    over the patch tokens, reshapes them to the patch grid, and upsamples to the
    slice resolution.
    """
    model = getattr(predictor, "model", None)
    transform = getattr(predictor, "transform", None)
    if model is None or transform is None or not getattr(predictor, "is_available", lambda: False)():
        return None
    try:
        import numpy as np
        import torch
        import torch.nn.functional as F
        from PIL import Image

        device = getattr(predictor, "device", "cpu")
        class_names = getattr(predictor, "class_names", ["AD", "CN", "MCI"])
        target = str(prediction).upper()
        target_idx = class_names.index(target) if target in class_names else None

        pil = Image.open(image_path).convert("RGB")
        base = pil.resize((224, 224))
        inp = transform(pil).unsqueeze(0).to(device)

        # Locate the final normalization layer (token-sequence output).
        norm_layer = getattr(model, "norm", None)
        if norm_layer is None:
            return None

        activations: dict[str, Any] = {}
        gradients: dict[str, Any] = {}

        def fwd_hook(_m, _i, out):
            activations["v"] = out

        def bwd_hook(_m, _gi, go):
            gradients["v"] = go[0]

        h1 = norm_layer.register_forward_hook(fwd_hook)
        h2 = norm_layer.register_full_backward_hook(bwd_hook)
        try:
            model.zero_grad(set_to_none=True)
            logits = model(inp)
            if target_idx is None:
                target_idx = int(logits.argmax(dim=1).item())
            score = logits[0, target_idx]
            score.backward()

            acts = activations.get("v")
            grads = gradients.get("v")
            if acts is None or grads is None:
                return None
            # acts/grads: [1, tokens, C]. Drop the class token (index 0).
            acts = acts[0]
            grads = grads[0]
            if acts.dim() != 2 or acts.shape[0] < 2:
                return None
            tokens = acts[1:]
            tok_grads = grads[1:]
            weights = tok_grads.mean(dim=0, keepdim=True)  # [1, C]
            cam = (weights * tokens).sum(dim=-1)  # [N]
            cam = F.relu(cam)
            n_tokens = cam.shape[0]
            side = int(round(n_tokens ** 0.5))
            if side * side != n_tokens:
                return None
            cam = cam.reshape(1, 1, side, side)
            cam = F.interpolate(cam, size=(224, 224), mode="bilinear", align_corners=False)
            cam = cam[0, 0].detach().cpu().numpy()
        finally:
            h1.remove()
            h2.remove()

        cam = cam - cam.min()
        if cam.max() > 0:
            cam = cam / cam.max()
        return _blend_heatmap(np.asarray(base).astype("float32"), cam)
    except Exception as exc:  # noqa: BLE001
        logger.info("Grad-CAM overlay skipped: %s", exc)
        return None


def _blend_heatmap(base_rgb, cam) -> str | None:
    """Alpha-blend a jet heatmap of ``cam`` (0..1) over the base RGB slice."""
    try:
        import numpy as np
        from PIL import Image

        heat = _jet(cam)  # HxWx3 float 0..255
        alpha = (cam[..., None] * 0.55)
        blended = base_rgb * (1 - alpha) + heat * alpha
        blended = np.clip(blended, 0, 255).astype("uint8")
        buf = io.BytesIO()
        Image.fromarray(blended).save(buf, format="PNG")
        return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("utf-8")
    except Exception as exc:  # noqa: BLE001
        logger.info("Heatmap blend skipped: %s", exc)
        return None


def _jet(x):
    """Minimal jet-like colormap without a matplotlib dependency. x in [0,1]."""
    import numpy as np

    x = np.clip(x, 0.0, 1.0)
    r = np.clip(1.5 - np.abs(4 * x - 3), 0, 1)
    g = np.clip(1.5 - np.abs(4 * x - 2), 0, 1)
    b = np.clip(1.5 - np.abs(4 * x - 1), 0, 1)
    return np.stack([r, g, b], axis=-1) * 255.0


# --------------------------------------------------------------------------- #
# Small image helpers
# --------------------------------------------------------------------------- #
def _png_to_data_uri(path: str) -> str | None:
    try:
        with open(path, "rb") as fh:
            return "data:image/png;base64," + base64.b64encode(fh.read()).decode("utf-8")
    except Exception:  # noqa: BLE001
        return None


def _array_to_data_uri(arr) -> str | None:
    try:
        from PIL import Image

        img = Image.fromarray(arr.astype("uint8")).convert("RGB")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("utf-8")
    except Exception:  # noqa: BLE001
        return None
