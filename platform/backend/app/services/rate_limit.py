"""Minimal in-memory rate limiter.

Per-identity fixed-window counter — no new dependency, matching this
codebase's existing preference for small, auditable, hand-rolled services
over pulling in a framework for something this contained (see
LocalJobService for the same philosophy applied to background jobs).

Known limitation, stated plainly: this is per-process. It does not
coordinate across multiple app instances/workers, so it's a real but
partial mitigation — good enough to stop a single compromised or careless
client from hammering an endpoint, not a substitute for a shared store
(Redis) if this backend is ever scaled to multiple processes.
"""

from __future__ import annotations

import time
from collections import defaultdict
from threading import Lock

from fastapi import HTTPException, status


class RateLimiter:
    def __init__(self) -> None:
        self._hits: dict[str, list[float]] = defaultdict(list)
        self._lock = Lock()

    def check(self, key: str, *, max_requests: int, window_seconds: int) -> None:
        """Raise 429 if `key` has exceeded max_requests within window_seconds."""
        now = time.monotonic()
        cutoff = now - window_seconds
        with self._lock:
            hits = [t for t in self._hits[key] if t > cutoff]
            if len(hits) >= max_requests:
                self._hits[key] = hits
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail={
                        "code": "rate_limited",
                        "message": f"Too many requests. Limit is {max_requests} per {window_seconds}s.",
                    },
                )
            hits.append(now)
            self._hits[key] = hits


_limiter = RateLimiter()


def get_rate_limiter() -> RateLimiter:
    return _limiter
