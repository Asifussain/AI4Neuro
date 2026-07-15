"""Single source of truth for EEG checkpoint metadata.

Replaces the previously duplicated hardcoded dicts in ``runner.py`` and
``ml_runner.py``. Only the ADFD-Indep (multiclass, CN/MCI/AD) checkpoint is
registered: EEG analysis is ADFD-only going forward, and the retired binary
ADSZ-Indep checkpoint is intentionally absent here (not merely disabled) so
no code path can accidentally route to it. Its files remain on disk,
unreferenced.

``channel_names`` assumes the standard 19-channel 10-20 clinical montage in
the model's expected order. This is an UNVERIFIED ASSUMPTION: the original
ADFD training pipeline is not documented anywhere in this repository, so the
true channel identity/order has not been confirmed against the source
dataset. Treat it as best-effort until validated.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class EegCheckpointSpec:
    key: str
    model_id: str
    data_type: str
    num_classes: int
    seq_len: int
    channels: int
    channel_names: tuple[str, ...]
    target_fs: float
    patch_len_list: str
    up_dim_list: str
    swa: bool
    labels: dict[int, str]
    classes: tuple[str, ...]
    model_version: str


REGISTRY: dict[str, EegCheckpointSpec] = {
    "multiclass": EegCheckpointSpec(
        key="multiclass",
        model_id="ADFD-Indep",
        data_type="ADFDIndep",
        num_classes=3,
        seq_len=256,
        channels=19,
        channel_names=(
            "Fp1", "Fp2", "F7", "F3", "Fz", "F4", "F8", "T7",
            "C3", "Cz", "C4", "T8", "P7", "P3", "Pz", "P4",
            "P8", "O1", "O2",
        ),
        target_fs=256.0,
        patch_len_list="2,2,2,4,4,4",
        up_dim_list="19,38,76,152",
        swa=True,
        labels={0: "CN", 1: "MCI", 2: "AD"},
        classes=("CN", "MCI", "AD"),
        model_version="ADFormer-ADFD-Indep",
    ),
}


def get_spec(analysis_type: str) -> EegCheckpointSpec:
    """Look up the checkpoint spec for a normalized ``analysis_type``.

    Callers are expected to have already normalized ``analysis_type`` to
    ``"multiclass"`` upstream (see ``analysis.py:_normalize_analysis_type``),
    so a miss here indicates a bug in the caller, not user input.
    """
    return REGISTRY[analysis_type]
