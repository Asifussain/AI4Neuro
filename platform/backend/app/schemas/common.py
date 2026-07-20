"""Shared response envelopes used across API modules."""

from __future__ import annotations

from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    """Uniform pagination envelope for every list endpoint.

    ``total`` is the count of matching items before slicing (see callers —
    several underlying DB service methods fetch-then-filter in Python, so
    ``total`` is computed as ``len()`` of the filtered-but-unpaginated list;
    this matches the existing non-scalable list pattern and is not a
    regression introduced by pagination).
    """

    items: list[T]
    total: int
    limit: int
    offset: int
