"""Adapt an arbitrary uploaded EEG ``.npy`` array to a checkpoint's expected shape.

Previously, any EEG upload whose channel count or timepoint count didn't
exactly match the target checkpoint was rejected outright
(``runner.py:_validate_eeg_input_shape``, now removed). This module instead
tries to *align* the input: reordering/padding/truncating channels, resampling
or interpolating the time axis, so a reasonably-shaped real-world EEG sample
can be analyzed instead of hard-failing on any mismatch.

Channel alignment assumes the standard 19-channel 10-20 clinical montage
(see ``checkpoint_registry.py``) as the target identity/order — this is an
unverified assumption pending confirmation against the original ADFD
training data.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from app.pipelines.eeg.checkpoint_registry import EegCheckpointSpec

# scipy is only installed in the EEG worker image (requirements/eeg.txt), not
# in the base API/test environment (requirements/dev.txt). Import it lazily
# inside _resample_time_axis so this module — and error_messages.py, which
# imports EegPreprocessingError unconditionally — stays importable without
# scipy; only actually resampling a sample requires it to be present.

# Plausible band for channel-count pad/truncate when no channel names are
# supplied: close enough to 19 that guessing a positional alignment is
# reasonable. Outside this band we refuse rather than guess.
_MIN_PLAUSIBLE_CHANNELS = 15
_MAX_PLAUSIBLE_CHANNELS = 23

# Old <-> new 10-20 nomenclature aliases (both directions are registered
# programmatically below).
_CHANNEL_ALIAS_PAIRS = (
    ("t3", "t7"),
    ("t4", "t8"),
    ("t5", "p7"),
    ("t6", "p8"),
)


def _build_alias_map() -> dict[str, str]:
    aliases: dict[str, str] = {}
    for old, new in _CHANNEL_ALIAS_PAIRS:
        aliases[old] = new
        aliases[new] = old
    return aliases


_CHANNEL_ALIASES = _build_alias_map()


class EegPreprocessingError(ValueError):
    """Raised when uploaded EEG data cannot be confidently aligned to a
    checkpoint's expected shape. Subclasses ``ValueError`` so existing
    generic exception handling still catches it, while remaining distinctly
    ``isinstance``-checkable for user-facing error messages."""


@dataclass
class EegMetadata:
    channel_names: list[str] | None = None
    sampling_rate: float | None = None


def parse_eeg_metadata(raw: dict | None) -> EegMetadata:
    """Leniently parse the optional uploader-supplied EEG metadata dict.

    Anything missing or malformed degrades to "unknown" rather than raising:
    a bad/absent metadata payload should fall back to the positional/assumed-
    rate behavior, not fail the whole analysis.
    """
    if not isinstance(raw, dict):
        return EegMetadata()

    channel_names: list[str] | None = None
    names = raw.get("channel_names")
    if isinstance(names, list) and names and all(isinstance(n, str) for n in names):
        channel_names = names

    sampling_rate: float | None = None
    rate = raw.get("sampling_rate")
    if isinstance(rate, (int, float)) and not isinstance(rate, bool) and rate > 0:
        sampling_rate = float(rate)

    return EegMetadata(channel_names=channel_names, sampling_rate=sampling_rate)


def preprocess_eeg(
    raw: np.ndarray,
    metadata: EegMetadata,
    spec: EegCheckpointSpec,
    *,
    apply_zscore: bool = False,
) -> np.ndarray:
    """Transform ``raw`` into a ``(trials, spec.seq_len, spec.channels)``
    float32 array ready for the model, regardless of the input's original
    shape, channel order, or sampling rate.

    Raises ``EegPreprocessingError`` when the input cannot be confidently
    aligned (e.g. channel count/names too far from the expected montage).
    """
    arr = _to_trials_seq_ch(raw)
    arr = _align_channels(arr, metadata.channel_names, spec.channel_names)
    arr = _resample_time_axis(arr, metadata.sampling_rate, spec.target_fs)
    arr = _fit_seq_len(arr, spec.seq_len)
    if apply_zscore:
        arr = _maybe_zscore(arr)
    return arr.astype(np.float32)


def _to_trials_seq_ch(raw: np.ndarray) -> np.ndarray:
    """Normalize 2D/3D input to canonical ``(trials, seq, channels)``."""
    if not isinstance(raw, np.ndarray) or not np.issubdtype(raw.dtype, np.number):
        raise EegPreprocessingError(
            "EEG file does not contain a numeric array; expected a .npy file "
            "with float EEG samples."
        )

    if raw.ndim == 3:
        return raw

    if raw.ndim == 2:
        eeg = raw
        # Smaller axis is channels (matches loader.py's existing heuristic).
        if eeg.shape[0] < eeg.shape[1]:
            eeg = eeg.T
        return np.expand_dims(eeg, axis=0)

    raise EegPreprocessingError(
        f"Unsupported EEG array with {raw.ndim} dimensions; expected a 2D "
        "(time, channels) or 3D (trials, time, channels) .npy array."
    )


def _resolve_channel_name(name: str, target_lookup: dict[str, int]) -> int | None:
    key = name.strip().lower()
    if key in target_lookup:
        return target_lookup[key]
    alias = _CHANNEL_ALIASES.get(key)
    if alias is not None and alias in target_lookup:
        return target_lookup[alias]
    return None


def _align_channels(
    arr: np.ndarray,
    channel_names: list[str] | None,
    target: tuple[str, ...],
) -> np.ndarray:
    """Reorder/pad/truncate the channel axis (last axis) to match ``target``."""
    n_target = len(target)

    if channel_names:
        target_lookup = {name.lower(): idx for idx, name in enumerate(target)}
        source_positions: dict[int, int] = {}  # target_idx -> source column
        for source_idx, name in enumerate(channel_names):
            target_idx = _resolve_channel_name(name, target_lookup)
            if target_idx is not None:
                source_positions[target_idx] = source_idx

        missing = [target[i] for i in range(n_target) if i not in source_positions]
        if missing:
            raise EegPreprocessingError(
                "EEG channel names were supplied but do not cover the required "
                f"{n_target}-channel 10-20 montage; missing: {', '.join(missing)}."
            )

        n_source_channels = arr.shape[-1]
        column_order = [source_positions[i] for i in range(n_target)]
        if max(column_order) >= n_source_channels:
            raise EegPreprocessingError(
                "EEG channel names reference more channels than are present in "
                "the uploaded array."
            )
        return arr[:, :, column_order]

    # No channel names supplied: positional fallback.
    n_source_channels = arr.shape[-1]
    if n_source_channels == n_target:
        return arr

    if _MIN_PLAUSIBLE_CHANNELS <= n_source_channels <= _MAX_PLAUSIBLE_CHANNELS:
        if n_source_channels > n_target:
            return arr[:, :, :n_target]
        pad_width = n_target - n_source_channels
        return np.pad(arr, ((0, 0), (0, 0), (0, pad_width)), mode="constant")

    raise EegPreprocessingError(
        f"EEG input has {n_source_channels} channels with no channel names "
        f"supplied; AI4Neuro requires {n_target}-channel 10-20 montage EEG "
        "data and cannot confidently pad/truncate this file. Supply channel "
        "names, or upload a compatible recording."
    )


def _resample_time_axis(
    arr: np.ndarray, source_fs: float | None, target_fs: float
) -> np.ndarray:
    """Resample the time axis (axis=1) per trial when the source sampling
    rate is known and differs from ``target_fs``. No-op otherwise (the
    subsequent ``_fit_seq_len`` step handles the exact-length correction)."""
    if source_fs is None or source_fs == target_fs:
        return arr

    from scipy.signal import resample

    _, seq_len, _ = arr.shape
    new_len = max(1, round(seq_len * target_fs / source_fs))
    return resample(arr, new_len, axis=1)


def _fit_seq_len(arr: np.ndarray, target_seq_len: int) -> np.ndarray:
    """Final exact-length correction on the time axis (axis=1)."""
    n_trials, seq_len, n_channels = arr.shape
    if seq_len == target_seq_len:
        return arr

    if seq_len > target_seq_len:
        return arr[:, :target_seq_len, :]

    # Shorter than target: linearly interpolate rather than zero-pad, to
    # avoid injecting a flatline discontinuity the model wasn't trained on.
    source_x = np.linspace(0.0, 1.0, num=seq_len)
    target_x = np.linspace(0.0, 1.0, num=target_seq_len)
    out = np.empty((n_trials, target_seq_len, n_channels), dtype=arr.dtype)
    for trial in range(n_trials):
        for ch in range(n_channels):
            out[trial, :, ch] = np.interp(target_x, source_x, arr[trial, :, ch])
    return out


def _maybe_zscore(arr: np.ndarray) -> np.ndarray:
    """Per-(trial, channel) z-score standardization across the time axis.

    Off by default (``Settings.eeg_apply_zscore``): the ADFD checkpoint's
    original training-time normalization is unverified, so silently changing
    input scale could shift accuracy in an unconfirmed direction. Only enable
    after validating against the original ADFD preprocessing.
    """
    mean = arr.mean(axis=1, keepdims=True)
    std = arr.std(axis=1, keepdims=True)
    std = np.where(std == 0, 1.0, std)
    return (arr - mean) / std


def write_preprocessed_npy(arr: np.ndarray, dest_path: str) -> str:
    """Persist the preprocessed array to disk for the subprocess file-boundary
    handoff (the SIDDHI model subprocess does its own independent ``np.load``,
    so the transformed array must be materialized as a real file)."""
    np.save(dest_path, arr)
    return dest_path
