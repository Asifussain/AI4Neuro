"""MRI pipeline config shim.

The ported MRI modules were written against the legacy ``mri-platform/backend/
config.py`` (``from config import ...``). This shim provides the same names so the
modules port with only their import lines rewired:

  * **static clinical constants** (analysis types, normative volumes, disease
    info) are copied verbatim from the legacy config;
  * **env-driven values** (ConViT checkpoint, CAT12/MATLAB paths) are sourced
    from the unified settings.

The runtime pipeline (``ml_runner.py``) treats the uploaded scan as already
preprocessed and does not run CAT12, and is multiclass-only (CN/MCI/AD) since
the ConViT checkpoint is trained multiclass-only. CAT12_ROOT/CAT12_EXE/
MCR_ROOT/CAT12_OUTPUT_DIR are kept here only for the standalone
``cat12_manager.py`` / ``scripts/check_cat12_setup.py`` tooling.
"""

from __future__ import annotations

import os

from app.core.config import get_settings

_settings = get_settings()

# ---- Env-driven ----
CONVIT_CHECKPOINT_PATH: str = _settings.convit_checkpoint_path
CAT12_ROOT: str = _settings.cat12_root
CAT12_EXE: str = _settings.cat12_exe
MCR_ROOT: str = _settings.mcr_root
MODEL_VERSION: str = _settings.mri_model_version
CAT12_OUTPUT_DIR: str = _settings.cat12_output_dir or os.path.join(
    _settings.local_tmp_dir, "mri"
)
os.makedirs(CAT12_OUTPUT_DIR, exist_ok=True)

# ---- Static clinical constants (verbatim from legacy config) ----
PREDICTION_CLASSES = ["CN", "MCI", "AD"]
ANALYSIS_TYPES = {
    "multiclass": ["CN", "MCI", "AD"],
}

NORMATIVE_VOLUMES = {
    "total_brain": {"min": 1100, "max": 1400, "unit": "cm³"},
    "gray_matter": {"min": 450, "max": 600, "unit": "cm³"},
    "white_matter": {"min": 400, "max": 550, "unit": "cm³"},
    "csf": {"min": 150, "max": 300, "unit": "cm³"},
    "hippocampus": {"min": 3.0, "max": 4.5, "unit": "cm³"},
    "ventricles": {"min": 20, "max": 50, "unit": "cm³"},
}

DISEASE_INFO = {
    "CN": {
        "full_name": "Cognitively Normal",
        "description": "No significant neurodegenerative patterns detected",
        "color": (46, 204, 113),
        "hex_color": "#2ecc71",
    },
    "MCI": {
        "full_name": "Mild Cognitive Impairment",
        "description": "Early signs of cognitive decline, may or may not progress to dementia",
        "color": (241, 196, 15),
        "hex_color": "#f1c40f",
    },
    "AD": {
        "full_name": "Alzheimer's Disease",
        "description": "Patterns consistent with Alzheimer's disease pathology",
        "color": (231, 76, 60),
        "hex_color": "#e74c3c",
    },
}
