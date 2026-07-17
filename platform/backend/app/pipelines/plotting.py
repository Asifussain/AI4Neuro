"""Process-wide lock guarding matplotlib's ``pyplot`` global state.

``matplotlib.pyplot`` keeps a single current-figure/current-axes state for the
whole process, even with the non-interactive ``Agg`` backend. It is not
thread-safe: two threads calling ``plt.figure()``/``plt.plot()``/etc.
concurrently can interleave and silently draw onto each other's figure.

The EEG and MRI runners each used to define their own ``threading.Lock()`` for
this, which only serialized *same-modality* jobs — an EEG job and an MRI job
running at the same time (both start a `ThreadPoolExecutor` job) could still
race on the shared pyplot state, corrupting or hanging whichever job's plotting
call got interleaved. One shared lock, held by every pipeline's plotting
section, actually serializes all matplotlib use process-wide.
"""

from __future__ import annotations

import threading

PLOT_LOCK = threading.Lock()
