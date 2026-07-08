"""
Technical/Radiologist PDF Report for MRI Analysis.
Detailed technical data and methodology for radiologists.
"""

import traceback
from typing import Dict, Any, Optional, List
from .base_report import BaseMRIReport

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils import sanitize_for_pdf, format_percentage
from config import DISEASE_INFO, NORMATIVE_VOLUMES, MODEL_VERSION


class TechnicalPDFReport(BaseMRIReport):
    """Technical MRI analysis report for radiologists."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.report_title = "Technical MRI Analysis Report"
        self.primary_color = (40, 60, 80)
        self.secondary_color = (52, 152, 219)


def build_technical_report(
    pdf: TechnicalPDFReport,
    comprehensive_data: Dict[str, Any],
    ml_results: Dict[str, Any],
    similarity_data: Dict[str, Any],
    similarity_plot: Optional[str] = None,
    volume_chart: Optional[str] = None,
    confidence_chart: Optional[str] = None
) -> None:
    """
    Build technical PDF report for radiologists.

    Args:
        pdf: TechnicalPDFReport instance
        comprehensive_data: All medical/patient data
        ml_results: ML model prediction results
        similarity_data: Similarity analysis results
        similarity_plot: Base64 similarity visualization
        volume_chart: Base64 volume comparison chart
        confidence_chart: Base64 confidence distribution chart
    """
    try:
        pdf.comprehensive_data = comprehensive_data
        prediction_data = ml_results or {}
        hospital_data = comprehensive_data.get('hospital')
        session_data = comprehensive_data.get('session', {})

        pdf.add_page()

        # Hospital Header
        if hospital_data:
            pdf.add_hospital_header(hospital_data)

        # Report Metadata
        pdf.add_report_metadata("TECHNICAL MRI ANALYSIS REPORT")
        pdf.ln(3)

        # Patient Demographics
        pdf.add_patient_section()

        # Referring Physician
        pdf.add_professional_section(role="doctor")

        # Session Technical Details
        pdf.add_session_section()

        # Additional Technical Details
        _add_extended_session_info(pdf, session_data)

        # Analyzed By
        pdf.add_professional_section(role="radiologist")

        # =====================================================================
        # AI Model Analysis Summary
        # =====================================================================
        if pdf.get_y() > pdf.h - 60:
            pdf.add_page()

        pdf.section_title("AI Model Analysis Summary")
        pdf.ln(2)

        prediction = prediction_data.get('prediction', 'N/A')
        confidence = prediction_data.get('confidence', 0)
        probabilities = prediction_data.get('probabilities', [])
        classes = prediction_data.get('classes', ['AD', 'CN', 'MCI'])
        analysis_type = prediction_data.get('analysis_type', 'multi-disease')

        pdf.key_value_pair("Classification Result", prediction, 50)
        pdf.key_value_pair("Analysis Type", analysis_type.upper(), 50)
        pdf.key_value_pair("Model Version", prediction_data.get('model_version', MODEL_VERSION), 50)
        pdf.key_value_pair("Processing Time", f"{prediction_data.get('processing_time', 0)} seconds", 50)

        # Probability distribution
        if probabilities and classes:
            pdf.ln(2)
            # Handle both dict and list formats
            if isinstance(probabilities, dict):
                prob_str = " | ".join([f"{c}: {float(p)*100:.2f}%" for c, p in probabilities.items()])
            else:
                prob_str = " | ".join([f"{c}: {float(p)*100:.2f}%" for c, p in zip(classes, probabilities)])
            pdf.key_value_pair("Confidence Distribution", prob_str, 50)
            pdf.key_value_pair("Primary Confidence", f"{float(confidence)*100:.2f}%", 50)

        # Scan quality metrics
        scan_quality = prediction_data.get('scan_quality', 'N/A')
        motion_artifacts = prediction_data.get('motion_artifacts', 'N/A')
        pdf.key_value_pair("Scan Quality", scan_quality, 50)
        pdf.key_value_pair("Motion Artifacts", motion_artifacts, 50)

        pdf.ln(6)

        # =====================================================================
        # Internal Consistency Metrics
        # =====================================================================
        if pdf.get_y() > pdf.h - 80:
            pdf.add_page()

        pdf.section_title("Model Internal Consistency Analysis")
        pdf.ln(2)

        # Explanation box
        consistency_info = [
            "The following metrics reflect model stability across multiple scan slices within this sample.",
            "These are internal consistency checks, NOT diagnostic accuracy against ground truth.",
            "High consistency indicates stable pattern recognition throughout the scan volume.",
            "Metrics calculated by comparing slice-level predictions to the overall volume prediction."
        ]
        pdf.add_explanation_box("About Consistency Metrics", consistency_info, (240, 248, 255))
        pdf.ln(4)

        consistency = prediction_data.get('consistency_metrics', {})
        if consistency and consistency.get('num_trials', 0) > 0:
            _add_consistency_metrics(pdf, consistency)
        else:
            pdf.set_font('Helvetica', 'I', 9)
            pdf.set_text_color(*pdf.text_color_light)
            pdf.cell(0, 6, "Internal consistency metrics not available for this analysis.", 0, 1, 'L')
            pdf.set_text_color(*pdf.text_color_normal)

        pdf.ln(6)

        # =====================================================================
        # Similarity Analysis (DTW/Feature-Based)
        # =====================================================================
        if pdf.get_y() > pdf.h - 100:
            pdf.add_page()

        pdf.section_title("Pattern Similarity Analysis")
        pdf.ln(2)

        if similarity_data and not similarity_data.get('error'):
            # Interpretation
            interpretation = similarity_data.get('interpretation', '')
            if interpretation:
                pdf.set_font('Helvetica', '', 9)
                pdf.set_text_color(*pdf.text_color_dark)

                lines = interpretation.split('\n')
                for line in lines[:8]:  # Limit lines
                    if line.strip():
                        pdf.multi_cell(0, 5, sanitize_for_pdf(line), 0, 'L')
                        pdf.ln(1)

                pdf.ln(3)

            # Similarity plot
            if similarity_plot:
                pdf.add_image_section("Pattern Similarity Comparison", similarity_plot)

            # Similarity scores
            pdf.ln(3)
            pdf.set_font('Helvetica', 'B', 9)
            pdf.cell(0, 6, "Similarity Scores:", 0, 1, 'L')
            pdf.ln(2)

            pdf.set_font('Helvetica', '', 9)
            for cls in classes:
                key = f'{cls.lower()}_similarity'
                score = similarity_data.get(key)
                if score is not None:
                    disease_name = DISEASE_INFO.get(cls, {}).get('full_name', cls)
                    pdf.key_value_pair(f"Similarity to {cls}", f"{score*100:.2f}%", 60)

        else:
            pdf.set_font('Helvetica', 'I', 9)
            pdf.set_text_color(*pdf.text_color_light)
            err = similarity_data.get('error', 'Not available') if similarity_data else 'Not available'
            pdf.cell(0, 6, f"Similarity analysis: {err}", 0, 1, 'L')
            pdf.set_text_color(*pdf.text_color_normal)

        pdf.ln(6)

        # =====================================================================
        # Volumetric Statistics
        # =====================================================================
        if pdf.get_y() > pdf.h - 80:
            pdf.add_page()

        pdf.section_title("Volumetric Analysis & Statistics")
        pdf.ln(2)

        _add_detailed_volume_table(pdf, prediction_data)

        if volume_chart:
            pdf.ln(4)
            pdf.add_image_section("Volume Comparison with Normative Ranges", volume_chart)

        pdf.ln(6)

        # =====================================================================
        # Regional Analysis
        # =====================================================================
        affected_regions = prediction_data.get('affected_regions', [])
        if affected_regions:
            if pdf.get_y() > pdf.h - 60:
                pdf.add_page()

            pdf.section_title("Regional Volumetric Analysis")
            pdf.ln(2)

            # Table header
            pdf.set_font('Helvetica', 'B', 8.5)
            pdf.set_fill_color(*pdf.primary_color)
            pdf.set_text_color(255, 255, 255)
            pdf.cell(50, 7, " Region", 0, 0, 'L', True)
            pdf.cell(35, 7, "Severity", 0, 0, 'C', True)
            pdf.cell(0, 7, "Observation", 0, 1, 'L', True)
            pdf.set_text_color(*pdf.text_color_normal)

            pdf.set_font('Helvetica', '', 8.5)
            for i, region in enumerate(affected_regions):
                if i % 2 == 0:
                    pdf.set_fill_color(*pdf.card_bg_color)
                else:
                    pdf.set_fill_color(255, 255, 255)
                pdf.set_text_color(*pdf.text_color_dark)
                pdf.cell(50, 6, sanitize_for_pdf(f" {region['name']}"), 0, 0, 'L', True)
                pdf.cell(35, 6, sanitize_for_pdf(region.get('severity', 'N/A')), 0, 0, 'C', True)
                pdf.cell(0, 6, sanitize_for_pdf(region.get('description', '')), 0, 1, 'L', True)

            pdf.ln(6)

        # =====================================================================
        # Technical Methodology
        # =====================================================================
        if pdf.get_y() > pdf.h - 70:
            pdf.add_page()

        pdf.section_title("Methodology & Technical Specifications")
        pdf.ln(2)

        methodology = [
            ("bullet", f"AI Model: Deep learning-based MRI classification using 3D CNN architecture (Version: {MODEL_VERSION})."),
            ("bullet", "Analysis Pipeline: Multi-slice prediction with majority voting, volumetric segmentation, and pattern similarity assessment."),
            ("bullet", "Volumetric Analysis: Automated brain segmentation using validated algorithms for GM/WM/CSF quantification."),
            ("bullet", "Similarity Matching: Feature-based comparison against reference patterns from validated multi-center datasets."),
            ("bullet", "Quality Control: Automated motion artifact detection and signal quality assessment applied.")
        ]

        pdf.add_explanation_box("Technical Specifications", methodology, (248, 248, 255))
        pdf.ln(6)

        # =====================================================================
        # Clinical Interpretation Guidelines
        # =====================================================================
        if pdf.get_y() > pdf.h - 70:
            pdf.add_page()

        guidelines = [
            ("bullet", "Algorithmic Support Tool: This AI analysis serves as decision support and should not replace clinical judgment."),
            ("bullet", "Clinical Correlation Required: Results must be interpreted with patient history, symptoms, and other imaging."),
            ("bullet", "Pattern Recognition Limitations: AI models recognize statistical patterns; atypical cases may not be accurately classified."),
            ("bullet", "Quality Considerations: Analysis assumes adequate signal quality; artifacts may affect results."),
            ("bullet", "Follow-up Recommendations: Correlate with additional imaging, neuropsychological testing, and longitudinal monitoring as indicated.")
        ]

        pdf.add_explanation_box("Clinical Interpretation Guidelines", guidelines, (255, 250, 240))
        pdf.ln(6)

        # Disclaimer
        pdf.add_disclaimer("technical")

        # Signature
        pdf.add_signature_section()

        # Footer
        pdf.set_font('Helvetica', 'I', 8)
        pdf.set_text_color(*pdf.text_color_light)
        pdf.cell(0, 5, "CONFIDENTIAL MEDICAL DOCUMENT - AUTHORIZED PERSONNEL ONLY", 0, 1, 'C')

    except Exception as e:
        print(f"Error building technical report: {e}")
        traceback.print_exc()
        _add_error_page(pdf, e)


def _add_extended_session_info(pdf: TechnicalPDFReport, session_data: Dict):
    """Add extended technical session information."""
    if not session_data:
        return

    # Check for additional fields
    duration = session_data.get('session_duration')
    num_channels = session_data.get('num_channels')

    if duration or num_channels:
        if duration:
            pdf.key_value_pair("Scan Duration", f"{duration} seconds", 45)
        if num_channels:
            pdf.key_value_pair("Number of Slices", str(num_channels), 45)

        pdf.ln(3)


def _add_consistency_metrics(pdf: TechnicalPDFReport, consistency: Dict):
    """Add detailed consistency metrics."""
    # Metrics in grid
    page_width = pdf.w - pdf.l_margin - pdf.r_margin

    metrics = [
        ("Overall Accuracy", f"{consistency.get('accuracy', 0)*100:.1f}%", "Slice agreement rate"),
        ("Slices Analyzed", str(consistency.get('num_trials', 'N/A')), "Total slices processed"),
        ("Precision", f"{consistency.get('precision', 0):.3f}", "TP/(TP+FP)"),
        ("Recall/Sensitivity", f"{consistency.get('recall_sensitivity', 0):.3f}", "TP/(TP+FN)"),
        ("Specificity", f"{consistency.get('specificity', 0):.3f}", "TN/(TN+FP)"),
        ("F1-Score", f"{consistency.get('f1_score', 0):.3f}", "Harmonic mean P & R")
    ]

    # Render as key-value pairs
    for title, value, desc in metrics:
        pdf.set_font('Helvetica', 'B', 9)
        pdf.cell(50, 5, sanitize_for_pdf(title), 0, 0, 'L')
        pdf.set_font('Helvetica', '', 9)
        pdf.cell(30, 5, sanitize_for_pdf(value), 0, 0, 'L')
        pdf.set_font('Helvetica', 'I', 8)
        pdf.set_text_color(*pdf.text_color_light)
        pdf.cell(0, 5, sanitize_for_pdf(f"({desc})"), 0, 1, 'L')
        pdf.set_text_color(*pdf.text_color_normal)

    pdf.ln(3)

    # Confusion Matrix
    pdf.set_font('Helvetica', 'B', 9)
    pdf.cell(0, 6, "Confusion Matrix (Internal Consistency):", 0, 1, 'L')
    pdf.ln(2)

    pdf.set_font('Helvetica', '', 9)
    tp = consistency.get('true_positives', 'N/A')
    tn = consistency.get('true_negatives', 'N/A')
    fp = consistency.get('false_positives', 'N/A')
    fn = consistency.get('false_negatives', 'N/A')

    pdf.cell(5)
    pdf.cell(0, 5, f"True Positives (TP): {tp}  |  True Negatives (TN): {tn}", 0, 1, 'L')
    pdf.cell(5)
    pdf.cell(0, 5, f"False Positives (FP): {fp}  |  False Negatives (FN): {fn}", 0, 1, 'L')


def _add_detailed_volume_table(pdf: TechnicalPDFReport, ml_results: Dict):
    """Add detailed volumetric measurements table with modern styling."""
    volumes = [
        ('Total Brain Volume', ml_results.get('brain_volume'), 'total_brain'),
        ('Gray Matter (GM)', ml_results.get('gm_volume'), 'gray_matter'),
        ('White Matter (WM)', ml_results.get('wm_volume'), 'white_matter'),
        ('Cerebrospinal Fluid (CSF)', ml_results.get('csf_volume'), 'csf'),
        ('Hippocampus', ml_results.get('hippocampal_volume'), 'hippocampus'),
        ('Ventricular System', ml_results.get('ventricular_volume'), 'ventricles')
    ]

    page_width = pdf.w - pdf.l_margin - pdf.r_margin

    # Table header — dark background
    pdf.set_font('Helvetica', 'B', 8)
    pdf.set_fill_color(*pdf.primary_color)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(48, 7, " Structure", 0, 0, 'L', True)
    pdf.cell(28, 7, "Measured", 0, 0, 'C', True)
    pdf.cell(32, 7, "Normal Range", 0, 0, 'C', True)
    pdf.cell(25, 7, "Status", 0, 0, 'C', True)
    pdf.cell(0, 7, "Deviation", 0, 1, 'C', True)
    pdf.set_text_color(*pdf.text_color_normal)

    pdf.set_font('Helvetica', '', 8)
    row_idx = 0

    for name, value, norm_key in volumes:
        if value is None:
            continue

        norm = NORMATIVE_VOLUMES.get(norm_key, {})
        min_v = norm.get('min', 0)
        max_v = norm.get('max', 0)
        unit = norm.get('unit', 'cm3')

        mid = (min_v + max_v) / 2

        if value < min_v:
            status = 'Below'
            deviation = f"-{((min_v - value) / min_v * 100):.1f}%"
            status_color = pdf.color_warning
        elif value > max_v:
            status = 'Above'
            deviation = f"+{((value - max_v) / max_v * 100):.1f}%"
            status_color = pdf.color_warning
        else:
            status = 'Normal'
            deviation = f"{((value - mid) / mid * 100):+.1f}%"
            status_color = pdf.color_normal

        # Alternating row backgrounds
        if row_idx % 2 == 0:
            pdf.set_fill_color(*pdf.card_bg_color)
        else:
            pdf.set_fill_color(255, 255, 255)

        pdf.set_text_color(*pdf.text_color_dark)
        pdf.set_font('Helvetica', '', 8)
        pdf.cell(48, 6, sanitize_for_pdf(f" {name}"), 0, 0, 'L', True)
        pdf.set_font('Helvetica', 'B', 8)
        pdf.cell(28, 6, f"{value:.2f}", 0, 0, 'C', True)
        pdf.set_font('Helvetica', '', 8)
        pdf.set_text_color(*pdf.text_color_light)
        pdf.cell(32, 6, f"{min_v}-{max_v}", 0, 0, 'C', True)

        pdf.set_font('Helvetica', 'B', 8)
        pdf.set_text_color(*status_color)
        pdf.cell(25, 6, sanitize_for_pdf(status), 0, 0, 'C', True)
        pdf.set_text_color(*pdf.text_color_dark)
        pdf.set_font('Helvetica', '', 8)
        pdf.cell(0, 6, sanitize_for_pdf(deviation), 0, 1, 'C', True)
        row_idx += 1

    # Bottom border
    pdf.set_draw_color(*pdf.line_color)
    pdf.line(pdf.l_margin, pdf.get_y(), pdf.l_margin + page_width, pdf.get_y())

    pdf.ln(2)
    pdf.set_font('Helvetica', 'I', 7)
    pdf.set_text_color(*pdf.text_color_light)
    pdf.cell(0, 4, f"All volumes in {NORMATIVE_VOLUMES.get('total_brain', {}).get('unit', 'cm3')}. Normal ranges based on age-matched reference data.", 0, 1, 'L')
    pdf.set_text_color(*pdf.text_color_normal)


def _add_error_page(pdf: TechnicalPDFReport, error: Exception):
    """Add error page if report generation fails."""
    try:
        if pdf.page_no() == 0:
            pdf.add_page()

        pdf.set_font("Helvetica", 'B', 12)
        pdf.set_text_color(255, 0, 0)
        pdf.cell(0, 10, "Error Generating Technical Report", 0, 1, 'C')
        pdf.set_font("Helvetica", '', 10)
        pdf.cell(0, 8, sanitize_for_pdf(str(error)[:100]), 0, 1, 'C')
    except:
        pass
