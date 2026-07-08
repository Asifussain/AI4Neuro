"""
Patient-Friendly PDF Report for MRI Analysis.
Designed for patients with non-technical, understandable language.
"""

import traceback
from typing import Dict, Any, Optional
from .base_report import BaseMRIReport

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils import sanitize_for_pdf, format_percentage
from config import DISEASE_INFO


class PatientPDFReport(BaseMRIReport):
    """Patient-friendly MRI analysis report."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.report_title = "MRI Brain Scan Analysis - Patient Report"
        self.primary_color = (74, 144, 226)
        self.secondary_color = (52, 152, 219)


def build_patient_report(
    pdf: PatientPDFReport,
    comprehensive_data: Dict[str, Any],
    ml_results: Dict[str, Any],
    similarity_data: Dict[str, Any],
    similarity_plot: Optional[str] = None,
    volume_chart: Optional[str] = None
) -> None:
    """
    Build patient-friendly PDF report.

    Args:
        pdf: PatientPDFReport instance
        comprehensive_data: All medical/patient data
        ml_results: ML model prediction results
        similarity_data: Similarity analysis results
        similarity_plot: Base64 similarity visualization
        volume_chart: Base64 volume comparison chart
    """
    try:
        pdf.comprehensive_data = comprehensive_data
        prediction_data = ml_results or {}
        hospital_data = comprehensive_data.get('hospital')

        pdf.add_page()

        # Hospital Header
        if hospital_data:
            pdf.add_hospital_header(hospital_data)

        # Report Metadata
        pdf.add_report_metadata("MRI BRAIN SCAN ANALYSIS REPORT")
        pdf.ln(3)

        # Patient Information
        pdf.add_patient_section()

        # Doctor Information
        pdf.add_professional_section(role="doctor")

        # Scan Details (simplified)
        _add_simplified_scan_info(pdf, comprehensive_data)

        # Radiologist Info
        pdf.add_professional_section(role="radiologist")

        # =====================================================================
        # Main Findings Section - New Page
        # =====================================================================
        pdf.add_page()
        pdf.section_title("Analysis Results & Findings")
        pdf.ln(2)

        prediction = prediction_data.get('prediction', 'Not Determined')
        confidence = prediction_data.get('confidence', 0)

        # Get display info for prediction
        pred_info = DISEASE_INFO.get(prediction, {})
        pred_color = pred_info.get('color', pdf.text_color_dark)
        pred_name = pred_info.get('full_name', prediction)

        # Determine display text and interpretation
        if prediction == 'CN':
            display_text = "Normal Brain Patterns Observed"
            interpretation = (
                "The AI analysis found brain patterns that are similar to typical healthy brain structure. "
                "No significant abnormalities were detected in this scan."
            )
        elif prediction == 'MCI':
            display_text = "Patterns Suggestive of Mild Cognitive Changes"
            interpretation = (
                "The AI analysis found brain patterns that may indicate Mild Cognitive Impairment (MCI). "
                "MCI is a condition where thinking abilities are slightly below normal for your age. "
                "Many people with MCI remain stable or even improve over time. Lifestyle factors like "
                "exercise, diet, and staying mentally active can help maintain brain health."
            )
        elif prediction == 'AD':
            display_text = "Patterns Suggestive of Alzheimer's Characteristics"
            interpretation = (
                "The AI analysis found brain patterns that may be associated with Alzheimer's disease. "
                "This includes changes in certain brain regions that are commonly affected by this condition."
            )
        else:
            display_text = "Analysis Results Require Review"
            interpretation = "The analysis results require further review by your healthcare provider."

        # Primary Finding Box
        pdf.set_font('Helvetica', 'B', 9)
        pdf.set_text_color(*pdf.text_color_light)
        pdf.cell(0, 6, "PRIMARY FINDING", 0, 1, 'L')
        pdf.ln(1)

        box_x = pdf.l_margin
        box_y = pdf.get_y()
        box_width = pdf.w - pdf.l_margin - pdf.r_margin
        box_height = 14

        # Soft tinted background
        r, g, b = pred_color
        pdf.set_fill_color(min(255, r + 180), min(255, g + 180), min(255, b + 180))
        pdf.rect(box_x, box_y, box_width, box_height, 'F')

        # Left accent bar
        pdf.set_fill_color(*pred_color)
        pdf.rect(box_x, box_y, 3, box_height, 'F')

        pdf.set_font('Helvetica', 'B', 11)
        pdf.set_text_color(*pred_color)
        pdf.set_xy(box_x + 6, box_y + 2)
        pdf.cell(box_width - 6, 9, sanitize_for_pdf(display_text), 0, 0, 'L')

        pdf.set_y(box_y + box_height + 4)
        pdf.set_text_color(*pdf.text_color_normal)

        # Interpretation
        pdf.set_font('Helvetica', '', 9)
        pdf.set_text_color(*pdf.text_color_dark)
        pdf.multi_cell(0, 5.5, sanitize_for_pdf(interpretation), 0, 'L')
        pdf.ln(8)

        # Confidence Level
        if confidence:
            pdf.set_font('Helvetica', 'B', 9)
            pdf.set_text_color(*pdf.secondary_color)
            pdf.cell(0, 6, "How Confident is the Analysis?", 0, 1, 'L')
            pdf.ln(2)

            pdf.set_font('Helvetica', '', 9)
            pdf.set_text_color(*pdf.text_color_normal)
            conf_text = f"The AI model is {float(confidence)*100:.1f}% confident in this finding based on the patterns detected in your brain scan."
            pdf.multi_cell(0, 5.5, sanitize_for_pdf(conf_text), 0, 'L')
            pdf.ln(6)

        # =====================================================================
        # Brain Pattern Comparison
        # =====================================================================
        if pdf.get_y() > pdf.h - 120:
            pdf.add_page()

        if similarity_plot:
            pdf.section_title("How Your Brain Patterns Compare")
            pdf.ln(2)

            pdf.set_font('Helvetica', '', 9)
            pdf.set_text_color(*pdf.text_color_normal)
            comparison_text = (
                "The AI compared your brain scan patterns with reference patterns from medical databases. "
                "The chart below shows how similar your patterns are to different reference groups."
            )
            pdf.multi_cell(0, 5.5, sanitize_for_pdf(comparison_text), 0, 'L')
            pdf.ln(4)

            pdf.add_image_section("Brain Pattern Similarity Comparison", similarity_plot)

            # Similarity interpretation
            overall_sim = similarity_data.get('overall_similarity', '')
            if overall_sim:
                pdf.ln(2)
                pdf.set_font('Helvetica', '', 9)
                pdf.set_text_color(*pdf.text_color_dark)
                pdf.multi_cell(0, 5.5, sanitize_for_pdf(f"Result: {overall_sim}"), 0, 'L')

        pdf.ln(8)

        # =====================================================================
        # What This Means Section
        # =====================================================================
        if pdf.get_y() > pdf.h - 80:
            pdf.add_page()

        pdf.section_title("What Do These Results Mean For Me?")
        pdf.ln(2)

        meaning_points = [
            ("bullet", "This is NOT a diagnosis - Only your doctor can diagnose medical conditions after considering your complete medical history and other tests."),
            ("bullet", "This is a screening tool - The AI helps identify brain patterns that may need further medical evaluation."),
            ("bullet", f"Your result: {display_text} - This means the AI found patterns similar to this category."),
            ("bullet", "Further evaluation may be needed - Your doctor will determine if additional tests are necessary.")
        ]

        pdf.add_explanation_box("Important Points to Remember", meaning_points, (255, 250, 240))
        pdf.ln(6)

        # =====================================================================
        # Next Steps Section
        # =====================================================================
        if pdf.get_y() > pdf.h - 75:
            pdf.add_page()

        pdf.section_title("Your Next Steps")
        pdf.ln(2)

        next_steps = [
            ("bullet", "Schedule an appointment with your doctor to discuss these results in detail."),
            ("bullet", "Bring this report to your doctor's appointment for their review."),
            ("bullet", "Prepare questions about what these findings mean for your health."),
            ("bullet", "Follow your doctor's advice regarding any additional tests or treatments."),
            ("bullet", "Don't panic - Many factors affect brain patterns, and your doctor will provide proper context.")
        ]

        pdf.add_explanation_box("What Should I Do Now?", next_steps, (240, 255, 240))
        pdf.ln(6)

        # =====================================================================
        # Questions for Doctor
        # =====================================================================
        if pdf.get_y() > pdf.h - 80:
            pdf.add_page()

        pdf.set_font('Helvetica', 'B', 10)
        pdf.set_text_color(*pdf.secondary_color)
        pdf.cell(0, 6, "Suggested Questions for Your Doctor:", 0, 1, 'L')
        pdf.ln(3)

        questions = [
            "What do these MRI results mean in the context of my symptoms?",
            "Do I need any additional tests or imaging studies?",
            "What are the next steps in my care plan?",
            "Are there any lifestyle changes I should consider?",
            "How often should I have follow-up appointments?",
            "Should family members be aware of these findings?"
        ]

        pdf.set_font('Helvetica', '', 9)
        pdf.set_text_color(*pdf.text_color_dark)

        for i, question in enumerate(questions, 1):
            if pdf.get_y() > pdf.h - 20:
                pdf.add_page()

            pdf.set_x(pdf.l_margin)
            pdf.cell(8, 5.5, f"{i}.", 0, 0, 'L')
            pdf.set_x(pdf.l_margin + 8)
            pdf.multi_cell(pdf.w - pdf.l_margin - pdf.r_margin - 8, 5.5,
                          sanitize_for_pdf(question), 0, 'L')
            pdf.ln(1)

        pdf.ln(6)

        # Disclaimer
        pdf.add_disclaimer("patient")

        # Signature
        pdf.add_signature_section()

        # Footer note
        pdf.set_font('Helvetica', 'I', 8)
        pdf.set_text_color(*pdf.text_color_light)
        pdf.cell(0, 5, "This is an official medical report. Please keep it for your records.", 0, 1, 'C')

    except Exception as e:
        print(f"Error building patient report: {e}")
        traceback.print_exc()
        _add_error_page(pdf, e)


def _add_simplified_scan_info(pdf: PatientPDFReport, comprehensive_data: Dict):
    """Add simplified scan information for patients."""
    session = comprehensive_data.get('session', {})
    if not session:
        return

    if pdf.get_y() > pdf.h - 40:
        pdf.add_page()

    pdf.section_title("Your Brain Scan")

    scan_date = session.get('scan_date')
    if scan_date:
        from utils import format_date
        pdf.key_value_pair("Scan Date", format_date(scan_date, 'date_only'), 45)

    session_code = session.get('session_code')
    if session_code:
        pdf.key_value_pair("Reference Number", session_code, 45)

    pdf.ln(3)


def _add_error_page(pdf: PatientPDFReport, error: Exception):
    """Add error page if report generation fails."""
    try:
        if pdf.page_no() == 0:
            pdf.add_page()
        elif pdf.get_y() > pdf.h - 30:
            pdf.add_page()

        pdf.set_font("Helvetica", 'B', 12)
        pdf.set_text_color(255, 0, 0)
        pdf.cell(0, 10, "Error Generating Report", 0, 1, 'C')
        pdf.set_font("Helvetica", '', 10)
        pdf.cell(0, 8, sanitize_for_pdf(str(error)[:100]), 0, 1, 'C')
        pdf.set_text_color(0, 0, 0)
    except:
        pass
