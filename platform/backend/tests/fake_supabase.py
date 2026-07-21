"""In-memory fake of the supabase-py v2 client.

Mimics just the query-builder and storage surface the backend uses, so services
can be exercised end to end in tests without a real Supabase project or secrets.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any


class _Result:
    def __init__(self, data: Any, count: int | None = None) -> None:
        self.data = data
        self.count = count


class _TableQuery:
    def __init__(self, store: dict[str, list[dict]], table: str) -> None:
        self._store = store
        self._table = table
        self._op: str | None = None
        self._payload: dict | None = None
        self._filters: list[tuple[str, str, Any]] = []
        self._single = False
        self._count_mode: str | None = None
        self._order: tuple[str, bool] | None = None
        self._range: tuple[int, int] | None = None

    # ---- terminal-ish builders ----
    def insert(self, row: dict) -> "_TableQuery":
        self._op = "insert"
        self._payload = dict(row)
        return self

    def update(self, patch: dict) -> "_TableQuery":
        self._op = "update"
        self._payload = dict(patch)
        return self

    def delete(self) -> "_TableQuery":
        self._op = "delete"
        return self

    def select(self, *_cols: str, count: str | None = None) -> "_TableQuery":
        self._op = "select"
        self._count_mode = count
        return self

    def eq(self, col: str, val: Any) -> "_TableQuery":
        self._filters.append(("eq", col, val))
        return self

    def in_(self, col: str, values: Any) -> "_TableQuery":
        self._filters.append(("in", col, set(values)))
        return self

    def lt(self, col: str, val: Any) -> "_TableQuery":
        self._filters.append(("lt", col, val))
        return self

    def order(self, column: str, *, desc: bool = False, **_kwargs: Any) -> "_TableQuery":
        self._order = (column, desc)
        return self

    def range(self, start: int, end: int) -> "_TableQuery":
        # postgrest semantics: end is inclusive.
        self._range = (start, end)
        return self

    def maybe_single(self) -> "_TableQuery":
        self._single = True
        return self

    def single(self) -> "_TableQuery":
        self._single = True
        return self

    # ---- execution ----
    def execute(self) -> _Result:
        rows = self._store.setdefault(self._table, [])
        if self._op == "insert":
            new_row = dict(self._payload or {})
            new_row.setdefault("id", str(uuid.uuid4()))
            now = datetime.now(timezone.utc).isoformat()
            new_row.setdefault("created_at", now)
            new_row.setdefault("updated_at", now)
            rows.append(new_row)
            return _Result([new_row])

        matched = [r for r in rows if self._matches(r)]

        if self._op == "update":
            for r in matched:
                r.update(self._payload or {})
            return _Result(list(matched))

        if self._op == "delete":
            remaining = [r for r in rows if not self._matches(r)]
            self._store[self._table] = remaining
            return _Result(list(matched))

        # select
        total = len(matched) if self._count_mode == "exact" else None

        if self._order is not None:
            column, desc = self._order
            matched = sorted(matched, key=lambda r: (r.get(column) is None, r.get(column)), reverse=desc)

        if self._range is not None:
            start, end = self._range
            matched = matched[start : end + 1]

        if self._single:
            return _Result(matched[0] if matched else None, count=total)
        return _Result(list(matched), count=total)

    def _matches(self, row: dict) -> bool:
        for op, col, val in self._filters:
            if op == "eq" and row.get(col) != val:
                return False
            if op == "in" and row.get(col) not in val:
                return False
            if op == "lt":
                row_val = row.get(col)
                if row_val is None or not (row_val < val):
                    return False
        return True


class _BucketOps:
    def __init__(self, store: dict[str, dict[str, bytes]], bucket: str) -> None:
        self._store = store
        self._bucket = bucket

    def upload(self, path: str, data: bytes, file_options: dict | None = None) -> dict:
        self._store.setdefault(self._bucket, {})[path] = bytes(data)
        return {"path": path}

    def download(self, path: str) -> bytes:
        try:
            return self._store[self._bucket][path]
        except KeyError:
            raise FileNotFoundError(f"{self._bucket}/{path}") from None

    def create_signed_url(self, path: str, expires_in: int = 3600) -> dict:
        # Mirrors the real supabase-py / storage-api URL shape
        # (.../storage/v1/object/sign/{bucket}/{path}?token=...) so callers
        # that parse signed URLs (see StorageService.refresh_signed_url) are
        # exercised faithfully in tests. A fresh nonce per call lets tests
        # assert that refreshing actually re-signs rather than returning a
        # cached value.
        nonce = uuid.uuid4().hex[:8]
        return {
            "signedURL": (
                f"https://fake.storage/storage/v1/object/sign/{self._bucket}/{path}"
                f"?token=fake-{nonce}&exp={expires_in}"
            )
        }


class _Storage:
    def __init__(self, store: dict[str, dict[str, bytes]]) -> None:
        self._store = store

    def from_(self, bucket: str) -> _BucketOps:
        return _BucketOps(self._store, bucket)


class FakeSupabase:
    """Drop-in stand-in for a supabase-py v2 Client."""

    def __init__(self) -> None:
        self.tables: dict[str, list[dict]] = {}
        self.buckets: dict[str, dict[str, bytes]] = {}
        self.storage = _Storage(self.buckets)

    def table(self, name: str) -> _TableQuery:
        return _TableQuery(self.tables, name)
