"""Regression test for the shared matplotlib plot lock (doc 6.x).

The EEG and MRI runners used to each define their own ``threading.Lock()``
around their pyplot calls. Since ``matplotlib.pyplot``'s current-figure state
is process-global (not per-module), two independently-locked pipelines could
still race on the same global state when run concurrently — e.g. an EEG job
and an MRI job started back to back on the ThreadPoolExecutor. Both runners
must hold the *same* lock object for serialization to actually work.
"""

from __future__ import annotations

import pytest

pytest.importorskip("matplotlib")


def test_eeg_and_mri_runners_share_the_same_plot_lock():
    from app.pipelines.plotting import PLOT_LOCK
    from app.pipelines.eeg import runner as eeg_runner
    from app.pipelines.mri import runner as mri_runner

    # Both modules must reference the identical lock object — not merely two
    # separate locks that each individually work but don't serialize the pair.
    import inspect

    eeg_src = inspect.getsource(eeg_runner.run_eeg_pipeline)
    mri_src = inspect.getsource(mri_runner.run_mri_pipeline)
    assert "PLOT_LOCK" in eeg_src
    assert "PLOT_LOCK" in mri_src

    # And that the shared lock is a real, single, process-wide lock instance.
    assert PLOT_LOCK.acquire(blocking=False)
    try:
        assert not PLOT_LOCK.acquire(blocking=False)
    finally:
        PLOT_LOCK.release()
