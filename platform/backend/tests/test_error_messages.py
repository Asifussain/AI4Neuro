"""User-facing analysis error messages."""

from __future__ import annotations

from app.services.error_messages import public_analysis_error


def test_eeg_shape_error_is_actionable():
    message = public_analysis_error(
        ValueError(
            "EEG input sequence length is 256, but binary analysis expects 128. "
            "Select EEG multiclass if this file belongs to that pipeline."
        )
    )

    assert "256" in message
    assert "binary" in message
    assert "multiclass" in message


def test_pytorch_shape_error_is_sanitized():
    message = public_analysis_error(
        RuntimeError("mat1 and mat2 shapes cannot be multiplied (16720x256 and 128x128)")
    )

    assert "mat1" not in message
    assert "selected analysis type" in message


def test_mri_invalid_nifti_error_is_sanitized():
    message = public_analysis_error(
        RuntimeError("Slice extraction failed: File scan.nii.gz is not a gzip file")
    )

    assert "gzip" not in message
    assert "valid .nii or .nii.gz" in message
