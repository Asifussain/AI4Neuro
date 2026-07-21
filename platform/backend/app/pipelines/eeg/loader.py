"""EEG .npy loading for visualization/stats.

Replicates the shape-normalization from the legacy
``Alzheimer-Detection/backend/database.py:get_prediction_and_eeg`` so the unified
runner produces byte-identical plots/stats to the old pipeline. The SIDDHI model
subprocess reads the raw .npy itself; this loader is only for the
visualization/similarity/stats side.
"""

from __future__ import annotations

import numpy as np


def first_trial_2d(arr: np.ndarray) -> np.ndarray:
    """Normalize an already-loaded EEG array to 2D ``(samples, channels)``.

    - 3D ``(trials, seq, ch)`` → first trial (matches legacy behaviour).
    - Transpose if channels-major so rows are samples.
    - Raises if the result is not 2D.

    Pure array -> array, no I/O: lets callers reuse an already in-memory
    (e.g. preprocessed) array instead of re-reading it from disk.
    """
    eeg = arr[0, :, :] if arr.ndim == 3 else arr

    if eeg.ndim != 2:
        raise ValueError(
            f"Unsupported EEG data dimension {eeg.ndim} (expected 2D or 3D)."
        )

    # Ensure orientation is (samples, channels): the model uses 19 channels, so the
    # smaller axis is channels.
    if eeg.shape[0] < eeg.shape[1]:
        eeg = eeg.T

    return eeg.astype(np.double)


def load_eeg_2d(npy_path: str) -> np.ndarray:
    """Load an EEG .npy and normalize to a 2D ``(samples, channels)`` float array."""
    # allow_pickle intentionally False — see runner.py's load of the same
    # upload for why (untrusted-input RCE vector, not needed for plain arrays).
    eeg = np.load(npy_path, allow_pickle=False)
    return first_trial_2d(eeg)
