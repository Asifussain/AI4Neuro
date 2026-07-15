"""User-facing analysis failure messages.

Raw pipeline exceptions stay in the application logs. The messages here are
safe to show in the UI and in status polling responses.
"""

from __future__ import annotations

import subprocess

from app.pipelines.eeg.preprocessing import EegPreprocessingError


def public_analysis_error(exc: Exception) -> str:
    """Return a concise, non-technical message for failed analysis sessions."""
    if isinstance(exc, EegPreprocessingError):
        return str(exc)

    text = _exception_text(exc).lower()

    if isinstance(exc, TimeoutError) or "timed out" in text:
        return (
            "Analysis took longer than expected and was stopped. Please try again, "
            "or contact support if this file repeatedly times out."
        )

    if "eeg input sequence length" in text:
        return str(exc)

    if "unsupported eeg data dimension" in text:
        return (
            "The EEG file format is not supported. Upload a .npy file shaped as "
            "segments by time points by 19 channels."
        )

    if "eeg input has" in text and "channels" in text:
        return (
            "The EEG file does not have the expected 19-channel layout. Please "
            "check the exported EEG .npy file and try again."
        )

    if "mat1 and mat2 shapes cannot be multiplied" in text:
        return (
            "The EEG file shape does not match the selected analysis type. Try "
            "switching between EEG binary and EEG multiclass, then upload again."
        )

    if "checkpoint" in text and ("not found" in text or "no such file" in text):
        return (
            "The required AI model checkpoint is not available on this backend. "
            "Please ask the technical team to verify the model files."
        )

    if "slice extraction failed" in text or "not a gzip file" in text:
        return (
            "The MRI scan could not be read as a valid NIfTI file. Please upload "
            "a valid .nii or .nii.gz MRI scan and try again."
        )

    if "model inference failed" in text:
        return (
            "The AI model could not complete inference for this file. Please "
            "verify the file type and selected analysis flow, then try again."
        )

    return (
        "Analysis could not be completed for this file. Please verify the upload "
        "and selected analysis type, then try again."
    )


def _exception_text(exc: Exception) -> str:
    if isinstance(exc, subprocess.CalledProcessError):
        parts = [str(exc), exc.stderr or "", exc.stdout or ""]
        return "\n".join(parts)
    return str(exc)
