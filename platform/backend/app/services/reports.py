"""Report service seam.

Phase 4 merges the two ``pdf_generation/`` packages behind this interface
(one base builder + modality-specific sections). For the foundation a no-op
implementation returns empty URLs so the job loop completes end to end without
report generation wired yet.
"""

from __future__ import annotations

from typing import Protocol

from app.pipelines.base import PipelineResult


class GeneratedReports:
    def __init__(
        self,
        *,
        patient_pdf_url: str | None = None,
        clinician_pdf_url: str | None = None,
        technical_pdf_url: str | None = None,
        asset_urls: dict | None = None,
    ) -> None:
        self.patient_pdf_url = patient_pdf_url
        self.clinician_pdf_url = clinician_pdf_url
        self.technical_pdf_url = technical_pdf_url
        self.asset_urls = asset_urls or {}


class ReportService(Protocol):
    def generate_reports(
        self, session: dict, result: PipelineResult, uploaded_assets: dict
    ) -> GeneratedReports: ...


class NoopReportService:
    """Foundation default: generates no reports."""

    def generate_reports(
        self, session: dict, result: PipelineResult, uploaded_assets: dict
    ) -> GeneratedReports:
        return GeneratedReports(asset_urls=uploaded_assets)
