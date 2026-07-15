"""Unit tests for the unified EEG preprocessing module.

Pure numpy/scipy — no torch, checkpoints, or subprocess involved, so these
run everywhere (unlike test_eeg_pipeline.py, which is skipped without the
real EEG stack).
"""

from __future__ import annotations

import os

import numpy as np
import pytest

from app.core.config import get_settings
from app.pipelines.eeg.checkpoint_registry import get_spec
from app.pipelines.eeg.preprocessing import (
    EegMetadata,
    EegPreprocessingError,
    parse_eeg_metadata,
    preprocess_eeg,
)

_SPEC = get_spec("multiclass")
_settings = get_settings()
_REF_DIR = os.path.join(_settings.eeg_reference_dir, "representative")
_CN_REPR = os.path.join(_REF_DIR, "cn repr.npy")
_FEATURE_02 = os.path.join(_settings.eeg_siddhi_dir, "Sample", "feature_02.npy")


def test_matching_shape_passthrough():
    if not os.path.exists(_CN_REPR):
        pytest.skip("representative reference file not available")
    raw = np.load(_CN_REPR, allow_pickle=True)
    out = preprocess_eeg(raw, EegMetadata(), _SPEC)
    assert out.shape == (raw.shape[0], _SPEC.seq_len, _SPEC.channels)
    assert out.dtype == np.float32


def test_128_seqlen_needs_resample_no_metadata():
    if not os.path.exists(_FEATURE_02):
        pytest.skip("sample feature_02.npy not available")
    raw = np.load(_FEATURE_02, allow_pickle=True)
    assert raw.shape[1] == 128  # sanity check on the fixture
    out = preprocess_eeg(raw, EegMetadata(), _SPEC)
    assert out.shape == (raw.shape[0], _SPEC.seq_len, _SPEC.channels)


def test_128_seqlen_with_source_fs_resamples_to_256():
    pytest.importorskip("scipy.signal")
    n_trials = 3
    t = np.linspace(0, 1, 128, endpoint=False)
    sine = np.sin(2 * np.pi * 5 * t).astype(np.float32)
    raw = np.tile(sine[None, :, None], (n_trials, 1, _SPEC.channels))
    metadata = EegMetadata(sampling_rate=128.0)
    out = preprocess_eeg(raw, metadata, _SPEC)
    assert out.shape == (n_trials, _SPEC.seq_len, _SPEC.channels)


def test_channel_count_mismatch_pad_truncate():
    raw_under = np.random.randn(2, 256, 16).astype(np.float32)
    out_under = preprocess_eeg(raw_under, EegMetadata(), _SPEC)
    assert out_under.shape == (2, 256, _SPEC.channels)

    raw_over = np.random.randn(2, 256, 22).astype(np.float32)
    out_over = preprocess_eeg(raw_over, EegMetadata(), _SPEC)
    assert out_over.shape == (2, 256, _SPEC.channels)


def test_channel_count_wildly_wrong_raises():
    raw = np.random.randn(2, 256, 2).astype(np.float32)
    with pytest.raises(EegPreprocessingError):
        preprocess_eeg(raw, EegMetadata(), _SPEC)


def test_named_channels_full_alias_resolution():
    names = list(_SPEC.channel_names)
    # Swap in old-style names for the ones with aliases.
    replacements = {"T7": "T3", "T8": "T4", "P7": "T5", "P8": "T6"}
    aliased_names = [replacements.get(n, n) for n in names]
    raw = np.random.randn(1, 256, len(aliased_names)).astype(np.float32)
    metadata = EegMetadata(channel_names=aliased_names)
    out = preprocess_eeg(raw, metadata, _SPEC)
    assert out.shape == (1, 256, _SPEC.channels)


def test_named_channels_missing_electrode_raises():
    names = list(_SPEC.channel_names)[:-1]  # drop one required channel
    raw = np.random.randn(1, 256, len(names)).astype(np.float32)
    metadata = EegMetadata(channel_names=names)
    with pytest.raises(EegPreprocessingError):
        preprocess_eeg(raw, metadata, _SPEC)


def test_missing_metadata_fallback_is_backward_compatible():
    assert parse_eeg_metadata(None) == EegMetadata(channel_names=None, sampling_rate=None)
    assert parse_eeg_metadata({}) == EegMetadata(channel_names=None, sampling_rate=None)
    assert parse_eeg_metadata({"channel_names": "not-a-list"}) == EegMetadata()

    raw = np.random.randn(2, 256, 19).astype(np.float32)
    out = preprocess_eeg(raw, parse_eeg_metadata(None), _SPEC)
    assert out.shape == (2, 256, 19)


def test_parse_eeg_metadata_valid_payload():
    metadata = parse_eeg_metadata({"channel_names": ["Fp1", "Fp2"], "sampling_rate": 128})
    assert metadata.channel_names == ["Fp1", "Fp2"]
    assert metadata.sampling_rate == 128.0
