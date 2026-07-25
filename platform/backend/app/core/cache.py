"""Small in-process TTL cache for hot, read-heavy Supabase list queries
(hospital directories, clinical pickers) - the Python equivalent of a
Caffeine cache for a single-process service.

Single process today (JOB_BACKEND=local, one uvicorn worker), so an
in-process cache stays consistent across every request. If this backend
ever runs as multiple replicas/processes behind a load balancer, this MUST
move to a shared cache (Redis) instead - each process would otherwise cache
independently, and a write handled by one process would leave stale data
cached on the others.
"""

from __future__ import annotations

import threading
from typing import Callable, TypeVar

from cachetools import TTLCache

T = TypeVar("T")

_cache: TTLCache = TTLCache(maxsize=2048, ttl=30)
_lock = threading.Lock()


def cached(key: str, fn: Callable[[], T]) -> T:
    """Return the cached value for ``key`` (30s TTL), computing and storing
    it via ``fn`` on a miss."""
    with _lock:
        if key in _cache:
            return _cache[key]
    value = fn()
    with _lock:
        _cache[key] = value
    return value


def invalidate_prefix(prefix: str) -> None:
    """Drop every cached key starting with ``prefix``. Call this after any
    write that could change a cached list (creating/suspending a user,
    assigning a doctor, etc.)."""
    with _lock:
        stale = [k for k in _cache.keys() if k.startswith(prefix)]
        for k in stale:
            del _cache[k]
