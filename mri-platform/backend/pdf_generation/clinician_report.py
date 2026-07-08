"""
Clinician/Doctor PDF Report for MRI Analysis.
Designed for doctors with clinical focus and actionable insights.
"""

import traceback
from typing import Dict, Any, Optional, List
from .base_report import BaseMRIReport

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils import sanitize_for_pdf, format_percentage, format_volume
from config import DISEASE_INFO, NORMATIVE_VOLUMES


class ClinicianPDFReport(BaseMRIReport):
    """Clinician-focused MRI analysis report."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.report_title = "MRI Brain Analysis - Clinical Report"
        self.primary_color = (41, 128, 185)
        self.secondary_color = (52, 152, 219)


def build_clinician_report(
    pdf: ClinicianPDFReport,
    comprehensive_data: Dict[str, Any],
    ml_results: Dict[str, Any],
    similarity_data: Dict[str, Any],
    similarity_plot: Optional[str] = None,
    volume_chart: Optional[str] = None,
    confidence_chart: Optional[str] = None
) -> None:
    """
    Build clinician/doctor PDF report.

    Args:
        pdf: ClinicianPDFReport instance
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
        patient_profile = comprehensive_data.get('patient_profile', {})

        pdf.add_page()

        # Hospital Header
        if hospital_data:
            pdf.add_hospital_header(hospital_data)

        # Report Metadata
        pdf.add_report_metadata("MRI CLINICAL ANALYSIS REPORT")
        pdf.ln(3)

        # Patient Demographics
        pdf.add_patient_section()

        # Medical History (if available)
        if patient_profile and patient_profile.get('medical_history'):
            if pdf.get_y() > pdf.h - 50:
                pdf.add_page()

            pdf.section_title("Medical History")
            pdf.set_font('Helvetica', '', 9)
            pdf.set_text_color(*pdf.text_color_dark)
            pdf.multi_cell(0, 5, sanitize_for_pdf(patient_profile['medical_history']), 0, 'L')
            pdf.ln(3)

        # Referring Physician
        pdf.add_professional_section(role="doctor")

        # MRI Session Details
        pdf.add_session_section()

        # Analyzed By
        pdf.add_professional_section(role="radiologist")

        # =====================================================================
        # Clinical Findings Section
        # =====================================================================
        if pdf.get_y() > pdf.h - 60:
            pdf.add_page()

        pdf.section_title("Clinical Findings")
        pdf.ln(2)

        prediction = prediction_data.get('prediction', 'Not Determined')
        confidence = prediction_data.get('confidence', 0)
        probabilities = prediction_data.get('probabilities', [])
        classes = prediction_data.get('classes', ['AD', 'CN', 'MCI'])

        # Get disease info
        pred_info = DISEASE_INFO.get(prediction, {})
        pred_color = pred_info.get('color', pdf.text_color_dark)
        pred_name = pred_info.get('full_name', prediction)

        # Clinical significance based on prediction
        clinical_significance = _get_clinical_significance(prediction)

        # Primary Classification Box
        pdf.set_font('Helvetica', 'B', 9)
        pdf.set_text_color(*pdf.text_color_light)
        pdf.cell(0, 6, "PRIMARY CLASSIFICATION", 0, 1, 'L')
        pdf.ln(1)

        box_x = pdf.l_margin
        box_y = pdf.get_y()
        box_width = pdf.w - pdf.l_margin - pdf.r_margin
        box_height = 14

        # Soft tinted background
        r, g, b = pred_color
        pdf.set_fill_color(min(255, r + 180), min(255, g + 180), min(255, b + 180))
        pdf.rect(box_x, box_y, box_width, box_height, 'F')

        # Left accent bar matching prediction color
        pdf.set_fill_color(*pred_color)
        pdf.rect(box_x, box_y, 3, box_height, 'F')

        pdf.set_font('Helvetica', 'B', 12)
        pdf.set_text_color(*pred_color)
        pdf.set_xy(box_x + 6, box_y + 1)
        pdf.cell(box_width - 6, 6, sanitize_for_pdf(pred_name), 0, 0, 'L')

        pdf.set_font('Helvetica', '', 9)
        pdf.set_text_color(*pdf.text_color_light)
        pdf.set_xy(box_x + 6, box_y + 7)
        pdf.cell(box_width - 6, 5, sanitize_for_pdf(f"Classification: {prediction}"), 0, 0, 'L')

        pdf.set_y(box_y + box_height + 4)
        pdf.set_text_color(*pdf.text_color_normal)

        # Clinical Significance
        pdf.set_font('Helvetica', '', 9)
        pdf.set_text_color(*pdf.text_color_dark)
        pdf.multi_cell(0, 5.5, sanitize_for_pdf(clinical_significance), 0, 'L')
        pdf.ln(6)

        # Confidence Distribution
        if probabilities and classes:
            pdf.set_font('Helvetica', 'B', 9)
            pdf.cell(0, 6, "Model Confidence Distribution:", 0, 1, 'L')
            pdf.ln(2)

            pdf.set_font('Helvetica', '', 9)
            prob_parts = []
            # Handle both dict and list formats
            if isinstance(probabilities, dict):
                for cls, prob in probabilities.items():
                    prob_parts.append(f"{cls}: {float(prob)*100:.1f}%")
            else:
                for cls, prob in zip(classes, probabilities):
                    prob_parts.append(f"{cls}: {float(prob)*100:.1f}%")

            pdf.key_value_pair("Probabilities", " | ".join(prob_parts), 50)
            pdf.key_value_pair("Primary Confidence", f"{float(confidence)*100:.1f}%", 50)
            pdf.ln(4)

        # Consistency Assessment
        consistency = prediction_data.get('consistency_metrics', {})
        if consistency and consistency.get('accuracy'):
            acc = consistency['accuracy']
            if acc >= 0.85:
                reliability = "High reliability - stable pattern recognition"
            elif acc >= 0.70:
                reliability = "Moderate reliability - reasonable pattern detection"
            else:
                reliability = "Lower reliability - interpret with caution"

            pdf.key_value_pair("Internal Consistency", f"{acc*100:.1f}%", 50)
            pdf.key_value_pair("Reliability Assessment", reliability, 50)

        pdf.ln(6)

        # =====================================================================
        # Volumetric Analysis
        # =====================================================================
        if pdf.get_y() > pdf.h - 80:
            pdf.add_page()

        pdf.section_title("Volumetric Analysis")
        pdf.ln(2)

        _add_volume_table(pdf, prediction_data)

        if volume_chart:
            pdf.ln(4)
            pdf.add_image_section("Brain Volume Comparison with Normative Ranges", volume_chart)

        pdf.ln(6)

        # =====================================================================
        # Regional Analysis
        # =====================================================================
        affected_regions = prediction_data.get('affected_regions', [])
        if affected_regions:
            if pdf.get_y() > pdf.h - 60:
                pdf.add_page()

            pdf.section_title("Regional Analysis - Affected Areas")
            pdf.ln(2)

            for region in affected_regions:
                pdf.set_font('Helvetica', 'B', 9)
                pdf.set_text_color(*pdf.text_color_dark)
                pdf.cell(60, 5, sanitize_for_pdf(region['name']), 0, 0, 'L')

                pdf.set_font('Helvetica', '', 9)
                severity = region.get('severity', 'Unknown')

                # Color code severity
                if 'Severe' in severity:
                    pdf.set_text_color(*pdf.color_danger)
                elif 'Moderate' in severity:
                    pdf.set_text_color(*pdf.color_warning)
                else:
                    pdf.set_text_color(*pdf.color_info)

                pdf.cell(40, 5, sanitize_for_pdf(severity), 0, 0, 'L')
                pdf.set_text_color(*pdf.text_color_light)
                pdf.cell(0, 5, sanitize_for_pdf(region.get('description', '')), 0, 1, 'L')
                pdf.set_text_color(*pdf.text_color_normal)

            pdf.ln(6)

        # =====================================================================
        # Pattern Similarity Analysis
        # =====================================================================
        if similarity_plot:
            if pdf.get_y() > pdf.h - 100:
                pdf.add_page()

            pdf.section_title("Pattern Similarity Analysis")
            pdf.ln(2)

            pdf.add_image_section("Brain Pattern Comparison with Reference Groups", similarity_plot)

            # Add interpretation
            interpretation = similarity_data.get('interpretation', '')
            if interpretation:
                pdf.ln(2)
                pdf.set_font('Helvetica', '', 9)
                pdf.set_text_color(*pdf.text_color_dark)
                # Take first few lines of interpretation
                lines = interpretation.split('\n')[:5]
                for line in lines:
                    if line.strip():
                        pdf.multi_cell(0, 5, sanitize_for_pdf(line), 0, 'L')

        pdf.ln(6)

        # =====================================================================
        # Clinical Recommendations
        # =====================================================================
        if pdf.get_y() > pdf.h - 80:
            pdf.add_page()

        pdf.section_title("Clinical Recommendations")
        pdf.ln(2)

        recommendations = _get_clinical_recommendations(prediction)
        pdf.add_explanation_box("Suggested Clinical Actions", recommendations, (240, 255, 240))
        pdf.ln(6)

        # =====================================================================
        # Clinical Considerations
        # =====================================================================
        if pdf.get_y() > pdf.h - 70:
            pdf.add_page()

        considerations = [
            ("bullet", "AI as Adjunct Tool: This analysis is supplementary and should not replace comprehensive clinical judgment."),
            ("bullet", "Context is Critical: Interpret results within full clinical context including symptoms and patient history."),
            ("bullet", "Limitations: AI models may not account for atypical presentations or comorbidities."),
            ("bullet", "Quality Dependent: Results assume adequate scan quality; technical issues may affect accuracy."),
            ("bullet", "Not Definitive: Normal findings do not rule out pathology; abnormal patterns require clinical correlation.")
        ]

        pdf.add_explanation_box("Important Clinical Considerations", considerations, (255, 250, 240))
        pdf.ln(6)

        # Disclaimer
        pdf.add_disclaimer("standard")

        # Signature
        pdf.add_signature_section()

        # Footer
        pdf.set_font('Helvetica', 'I', 8)
        pdf.set_text_color(*pdf.text_color_light)
        pdf.cell(0, 5, "CONFIDENTIAL MEDICAL REPORT - FOR PROFESSIONAL USE ONLY", 0, 1, 'C')

    except Exception as e:
        print(f"Error building clinician report: {e}")
        traceback.print_exc()
        _add_error_page(pdf, e)


def _get_clinical_significance(prediction: str) -> str:
    """Get clinical significance text based on prediction."""
    significance = {
        'CN': (
            "AI analysis identified brain patterns within normal parameters for the patient's age group. "
            "No significant neurodegenerative changes were detected. Standard follow-up protocols apply."
        ),
        'MCI': (
            "AI analysis identified patterns consistent with Mild Cognitive Impairment (MCI). "
            "MCI represents a transitional state between normal aging and dementia. Some individuals "
            "with MCI remain stable or improve, while others progress to dementia. Regular monitoring "
            "and cognitive assessment are recommended."
        ),
        'AD': (
            "AI analysis identified patterns consistent with Alzheimer's disease pathology, including "
            "hippocampal volume reduction and temporal lobe changes. These findings warrant comprehensive "
            "neurological evaluation and cognitive assessment."
        )
    }
    return significance.get(prediction, "Analysis results require clinical review and interpretation.")


def _get_clinical_recommendations(prediction: str) -> List:
    """Get clinical recommendations based on prediction."""
    recommendations = {
        'CN': [
            ("bullet", "Clinical Correlation: Interpret normal findings in context of presenting symptoms."),
            ("bullet", "If Symptomatic: Consider additional diagnostic workup if cognitive concerns persist."),
            ("bullet", "Preventive Counseling: Discuss brain health lifestyle factors."),
            ("bullet", "Baseline Documentation: This study may serve as baseline for future comparison.")
        ],
        'MCI': [
            ("bullet", "Cognitive Assessment: Administer standardized tests (MMSE, MoCA) to characterize deficits."),
            ("bullet", "Reversible Causes: Rule out depression, medication effects, B12/thyroid abnormalities."),
            ("bullet", "Lifestyle Modifications: Discuss exercise, cognitive stimulation, social engagement."),
            ("bullet", "Risk Factor Management: Address vascular risk factors (hypertension, diabetes)."),
            ("bullet", "Regular Monitoring: Schedule follow-up assessments every 6-12 months."),
            ("bullet", "Family Education: Discuss MCI prognosis and warning signs of progression.")
        ],
        'AD': [
            ("bullet", "Comprehensive Evaluation: Conduct thorough neurological exam and cognitive assessment (MMSE, MoCA)."),
            ("bullet", "Additional Imaging: Consider PET scan for amyloid/tau assessment if available."),
            ("bullet", "Differential Diagnosis: Rule out reversible causes (depression, B12, thyroid)."),
            ("bullet", "Neuropsychological Testing: Detailed cognitive domain assessment recommended."),
            ("bullet", "Specialist Referral: Memory clinic or neurology consultation may be appropriate."),
            ("bullet", "Family Counseling: Discuss findings and care planning with patient and family.")
        ]
    }
    return recommendations.get(prediction, [
        ("bullet", "Repeat Study: Consider repeat imaging if findings are inconclusive."),
        ("bullet", "Clinical Assessment: Base decisions on comprehensive clinical evaluation.")
    ])


def _add_volume_table(pdf: ClinicianPDFReport, ml_results: Dict):
    """Add volumetric measurements table with modern styling."""
    volumes = [
        ('Total Brain Volume', ml_results.get('brain_volume'), 'total_brain'),
        ('Gray Matter', ml_results.get('gm_volume'), 'gray_matter'),
        ('White Matter', ml_results.get('wm_volume'), 'white_matter'),
        ('CSF Volume', ml_results.get('csf_volume'), 'csf'),
        ('Hippocampal Volume', ml_results.get('hippocampal_volume'), 'hippocampus')
    ]

    # Table header
    pdf.set_font('Helvetica', 'B', 8.5)
    pdf.set_fill_color(*pdf.primary_color)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(55, 7, "Measurement", 0, 0, 'L', True)
    pdf.cell(35, 7, "Value", 0, 0, 'C', True)
    pdf.cell(45, 7, "Normal Range", 0, 0, 'C', True)
    pdf.cell(35, 7, "Status", 0, 1, 'C', True)
    pdf.set_text_color(*pdf.text_color_normal)

    pdf.set_font('Helvetica', '', 8.5)
    row_idx = 0

    for name, value, norm_key in volumes:
        if value is None:
            continue

        norm = NORMATIVE_VOLUMES.get(norm_key, {})
        min_v = norm.get('min', 0)
        max_v = norm.get('max', 0)
        unit = norm.get('unit', 'cm3')

        if value < min_v:
            status = 'Below Normal'
            status_color = pdf.color_warning
        elif value > max_v:
            status = 'Above Normal'
            status_color = pdf.color_warning
        else:
            status = 'Normal'
            status_color = pdf.color_normal

        # Alternating row background
        if row_idx % 2 == 0:
            pdf.set_fill_color(*pdf.card_bg_color)
        else:
            pdf.set_fill_color(255, 255, 255)

        pdf.set_text_color(*pdf.text_color_dark)
        pdf.cell(55, 6.5, sanitize_for_pdf(name), 0, 0, 'L', True)
        pdf.set_font('Helvetica', 'B', 8.5)
        pdf.cell(35, 6.5, f"{value:.1f} {unit}", 0, 0, 'C', True)
        pdf.set_font('Helvetica', '', 8.5)
        pdf.set_text_color(*pdf.text_color_light)
        pdf.cell(45, 6.5, f"{min_v}-{max_v} {unit}", 0, 0, 'C', True)

        pdf.set_font('Helvetica', 'B', 8.5)
        pdf.set_text_color(*status_color)
        pdf.cell(35, 6.5, sanitize_for_pdf(status), 0, 1, 'C', True)
        pdf.set_text_color(*pdf.text_color_normal)
        pdf.set_font('Helvetica', '', 8.5)
        row_idx += 1

    # Bottom border
    page_width = pdf.w - pdf.l_margin - pdf.r_margin
    pdf.set_draw_color(*pdf.line_color)
    pdf.line(pdf.l_margin, pdf.get_y(), pdf.l_margin + page_width, pdf.get_y())
    pdf.ln(3)


def _add_error_page(pdf: ClinicianPDFReport, error: Exception):
    """Add error page if report generation fails."""
    try:
        if pdf.page_no() == 0:
            pdf.add_page()

        pdf.set_font("Helvetica", 'B', 12)
        pdf.set_text_color(255, 0, 0)
        pdf.cell(0, 10, "Error Generating Report", 0, 1, 'C')
        pdf.set_font("Helvetica", '', 10)
        pdf.cell(0, 8, sanitize_for_pdf(str(error)[:100]), 0, 1, 'C')
    except:
        pass
