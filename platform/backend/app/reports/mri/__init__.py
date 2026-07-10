"""
PDF Generation Module for MRI Analysis Reports.
Provides report generation for Patient, Clinician, and Technical audiences.
"""

from .base_report import BaseMRIReport
from .patient_report import PatientPDFReport, build_patient_report
from .clinician_report import ClinicianPDFReport, build_clinician_report
from .technical_report import TechnicalPDFReport, build_technical_report

__all__ = [
    'BaseMRIReport',
    'PatientPDFReport', 'build_patient_report',
    'ClinicianPDFReport', 'build_clinician_report',
    'TechnicalPDFReport', 'build_technical_report'
]
