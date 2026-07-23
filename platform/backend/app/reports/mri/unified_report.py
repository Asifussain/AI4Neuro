"""Unified MRI PDF report. Merges the patient / clinician / technical MRI
reports into a single document. Every section that used to be duplicated
verbatim across all three copies - patient demographics, referring
physician, session details, analyst, disclaimer, signature - now appears
exactly once. Unlike the EEG unified report, nothing was asked to be
dropped here: every distinct point from all three originals is kept,
including the plain-language "what this means for you" patient content and
the clinical recommendations / considerations / methodology sections.

Uses the same "AI4NEURO / a product by PraxiaTech" letterhead and
left/right dual signature (radiologist/analyst left, doctor right, no
dates) as the EEG unified report.
"""

import traceback
from typing import Any, Dict, Optional
from .base_report import BaseMRIReport

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.reports.mri.utils import sanitize_for_pdf, calculate_age, format_date
from app.pipelines.mri.config import DISEASE_INFO, NORMATIVE_VOLUMES, MODEL_VERSION
from app.reports import theme
from datetime import datetime as _dt


def _add_patient_strip(pdf, data: Dict[str, Any]) -> None:
    """Render the compact radiology-style patient information band from the real
    patient / doctor / session records in ``comprehensive_data``."""
    patient = (data or {}).get('patient') or {}
    profile = (data or {}).get('patient_profile') or {}
    doctor = (data or {}).get('doctor') or {}
    session = (data or {}).get('session') or {}

    dob = profile.get('date_of_birth') or patient.get('date_of_birth')
    age = calculate_age(dob) if dob else None
    sex = profile.get('gender') or patient.get('gender') or '-'
    scan_date = session.get('scan_date') or session.get('session_date')

    left_pairs = [
        ("Age", f"{age} yrs" if age else "-"),
        ("Sex", sex),
    ]
    if data.get('blood_group'):
        left_pairs.append(("Blood", data.get('blood_group')))
    mid_pairs = [
        ("PID", profile.get('patient_code') or patient.get('unique_identifier') or "-"),
        ("Study No", session.get('session_code') or "-"),
        ("Ref By", doctor.get('full_name') or "-"),
    ]
    right_pairs = [
        ("Reg. on", format_date(scan_date, 'date_only') if scan_date else "-"),
        ("Reported", _dt.now().strftime("%d %b, %Y")),
    ]
    theme.patient_info_strip(
        pdf,
        name=patient.get('full_name') or "Patient (Pending Identification)",
        left_pairs=left_pairs,
        mid_pairs=mid_pairs,
        right_pairs=right_pairs,
    )


class UnifiedPDFReport(BaseMRIReport):
    """MRI-only unified report. Uses the AI4Neuro / "a product by PraxiaTech"
    letterhead instead of the PraxiaTech letterhead used by the standalone
    MRI patient/clinician/technical copies (and all EEG reports other than
    its own unified report)."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.report_title = "MRI Brain Analysis - Complete Report"
        self.primary_color = theme.BRAND
        self.secondary_color = theme.BRAND

    def header(self):
        hospital = (getattr(self, "comprehensive_data", None) or {}).get("hospital") or {}
        theme.draw_clinical_letterhead(self, hospital, subtitle=self.report_title)

    def add_signature_section(self):
        """Two dateless signature blocks: radiologist on the left, doctor on
        the right (overrides the single radiologist-only signature used by
        every other MRI report)."""
        try:
            radiologist = self.comprehensive_data.get('radiologist') if self.comprehensive_data else None
            doctor = self.comprehensive_data.get('doctor') if self.comprehensive_data else None
            theme.dual_signature(
                self,
                (radiologist or {}).get('full_name', 'Authorized Personnel'), "Radiologist",
                (doctor or {}).get('full_name', 'Doctor'), "Doctor",
            )
        except Exception as e:
            print(f"Signature error: {e}")


def build_unified_report(
    pdf: UnifiedPDFReport,
    comprehensive_data: Dict[str, Any],
    ml_results: Dict[str, Any],
    volume_chart: Optional[str] = None,
    confidence_chart: Optional[str] = None,
) -> None:
    """
    Build a single MRI report combining the patient, clinician and technical
    content with no repeated sections.

    Args: identical to ``build_technical_report`` (the superset of the three
    original builders' inputs).
    """
    try:
        pdf.comprehensive_data = comprehensive_data
        prediction_data = ml_results or {}
        hospital_data = comprehensive_data.get('hospital')
        patient_profile = comprehensive_data.get('patient_profile') or {}
        session_data = comprehensive_data.get('session') or {}

        pdf.add_page()

        # Centered study title (the hospital masthead is already in the
        # letterhead, so the redundant hospital header/metadata is dropped).
        pdf.set_font('Helvetica', 'B', 12.5)
        pdf.set_text_color(*theme.INK)
        pdf.cell(0, 7, "MRI BRAIN ANALYSIS - AI DIAGNOSTIC REPORT", 0, 1, 'C')
        pdf.ln(1)

        # ---- Patient information strip (radiology-report style) ---------- #
        _add_patient_strip(pdf, comprehensive_data)

        if patient_profile.get('medical_history'):
            if pdf.get_y() > pdf.h - 50:
                pdf.add_page()
            pdf.section_title("Medical History")
            pdf.set_font('Helvetica', '', 9)
            pdf.set_text_color(*pdf.text_color_dark)
            pdf.multi_cell(0, 5, sanitize_for_pdf(patient_profile['medical_history']), 0, 'L')
            pdf.ln(3)

        pdf.add_professional_section(role="doctor")
        pdf.add_session_section()
        _add_extended_session_info(pdf, session_data)
        pdf.add_professional_section(role="radiologist")

        # ---- Clinical Findings (clinician framing + technical numbers) -- #
        if pdf.get_y() > pdf.h - 60:
            pdf.add_page()
        pdf.section_title("Clinical Findings")
        pdf.ln(2)

        prediction = prediction_data.get('prediction', 'Not Determined')
        confidence = prediction_data.get('confidence', 0)
        probabilities = prediction_data.get('probabilities', [])
        classes = prediction_data.get('classes', ['AD', 'CN', 'MCI'])
        analysis_type = prediction_data.get('analysis_type', 'multiclass')

        pred_info = DISEASE_INFO.get(prediction, {})
        pred_name = pred_info.get('full_name', prediction)
        pred_tone = pdf.disease_colors.get(prediction, theme.MUTED)
        clinical_significance = _get_clinical_significance(prediction)

        theme.finding_banner(pdf, f"{pred_name}  ({prediction})", clinical_significance, tone=pred_tone)
        pdf.ln(2)

        pdf.key_value_pair("Classification Result", prediction, 55)
        pdf.key_value_pair("Analysis Type", str(analysis_type).upper(), 55)
        pdf.key_value_pair("Model Version", prediction_data.get('model_version', MODEL_VERSION), 55)
        processing_time = prediction_data.get('processing_time')
        if processing_time:
            pdf.key_value_pair("Processing Time", f"{processing_time} seconds", 55)

        if probabilities and classes:
            if isinstance(probabilities, dict):
                prob_str = " | ".join(f"{c}: {float(p)*100:.2f}%" for c, p in probabilities.items())
            else:
                prob_str = " | ".join(f"{c}: {float(p)*100:.2f}%" for c, p in zip(classes, probabilities))
            pdf.key_value_pair("Confidence Distribution", prob_str, 55)
            pdf.key_value_pair("Primary Confidence", f"{float(confidence)*100:.2f}%", 55)

        scan_quality = prediction_data.get('scan_quality')
        motion_artifacts = prediction_data.get('motion_artifacts')
        if scan_quality:
            pdf.key_value_pair("Scan Quality", scan_quality, 55)
        if motion_artifacts:
            pdf.key_value_pair("Motion Artifacts", motion_artifacts, 55)

        pdf.ln(5)

        # ---- Model Reliability - Internal Consistency -------------------- #
        consistency = prediction_data.get('consistency_metrics', {})
        if pdf.get_y() > pdf.h - 60:
            pdf.add_page()
        pdf.section_title("Model Reliability - Internal Consistency Analysis")
        pdf.ln(2)

        theme.info_panel(pdf, "About Consistency Metrics", [
            "The following metrics reflect model stability across multiple scan slices within this sample.",
            "These are internal consistency checks, NOT diagnostic accuracy against ground truth.",
            "High consistency indicates stable pattern recognition throughout the scan volume.",
            "Metrics calculated by comparing slice-level predictions to the overall volume prediction.",
        ])
        pdf.ln(3)

        if consistency and consistency.get('num_trials', 0) > 0:
            _add_consistency_metrics(pdf, consistency)
            acc = consistency.get('accuracy', 0) or 0
            if acc >= 0.85:
                reliability_word = "High"
            elif acc >= 0.70:
                reliability_word = "Moderate"
            else:
                reliability_word = "Low"
            pdf.ln(2)
            pdf.set_font('Helvetica', '', 9)
            pdf.set_text_color(*pdf.text_color_dark)
            pdf.multi_cell(0, 5.5, sanitize_for_pdf(
                f"Reliability assessment: {reliability_word} reliability - "
                f"{'stable pattern recognition' if reliability_word == 'High' else 'reasonable pattern detection' if reliability_word == 'Moderate' else 'interpret with caution'}."
            ), align='L')
        else:
            pdf.set_font('Helvetica', 'I', 9)
            pdf.set_text_color(*pdf.text_color_light)
            pdf.cell(0, 6, "Internal consistency metrics not available for this analysis.", 0, 1, 'L')
            pdf.set_text_color(*pdf.text_color_normal)

        pdf.ln(6)

        # ---- Volumetric Analysis & Statistics ----------------------------- #
        if pdf.get_y() > pdf.h - 80:
            pdf.add_page()
        pdf.section_title("Volumetric Analysis & Statistics")
        pdf.ln(2)

        _add_detailed_volume_table(pdf, prediction_data)

        if volume_chart:
            pdf.ln(4)
            pdf.add_image_section("Brain Volume Comparison with Normative Ranges", volume_chart)

        pdf.ln(6)

        # ---- Regional Analysis -------------------------------------------- #
        affected_regions = prediction_data.get('affected_regions', [])
        if affected_regions:
            if pdf.get_y() > pdf.h - 60:
                pdf.add_page()
            pdf.section_title("Regional Analysis - Affected Areas")
            pdf.ln(2)

            pdf.set_font('Helvetica', 'B', 8.5)
            pdf.set_fill_color(*theme.PANEL)
            pdf.set_text_color(*theme.INK)
            pdf.cell(50, 7, " Region", 0, 0, 'L', True)
            pdf.cell(35, 7, "Severity", 0, 0, 'C', True)
            pdf.cell(0, 7, "Observation", 0, 1, 'L', True)
            pdf.set_text_color(*pdf.text_color_normal)

            pdf.set_font('Helvetica', '', 8.5)
            for i, region in enumerate(affected_regions):
                pdf.set_fill_color(*(theme.ZEBRA if i % 2 == 0 else (255, 255, 255)))
                pdf.set_text_color(*pdf.text_color_dark)
                pdf.cell(50, 6, sanitize_for_pdf(f" {region.get('name', '')}"), 0, 0, 'L', True)
                severity = region.get('severity', 'Unknown')
                if 'Severe' in severity:
                    pdf.set_text_color(*pdf.color_danger)
                elif 'Moderate' in severity:
                    pdf.set_text_color(*pdf.color_warning)
                else:
                    pdf.set_text_color(*pdf.color_info)
                pdf.cell(35, 6, sanitize_for_pdf(severity), 0, 0, 'C', True)
                pdf.set_text_color(*pdf.text_color_dark)
                pdf.cell(0, 6, sanitize_for_pdf(region.get('description', '')), 0, 1, 'L', True)
            pdf.set_text_color(*pdf.text_color_normal)
            pdf.ln(6)

        # ---- AI Visual Explainability ------------------------------------- #
        _add_explainability_section(pdf, prediction_data.get('explainability'))

        # ---- Clinical Recommendations -------------------------------------- #
        if pdf.get_y() > pdf.h - 80:
            pdf.add_page()
        pdf.section_title("Clinical Recommendations")
        pdf.ln(2)
        recommendations = _get_clinical_recommendations(prediction)
        theme.info_panel(pdf, "Suggested Clinical Actions", recommendations)
        pdf.ln(6)

        # ---- Important Clinical Considerations (deduped) -------------------- #
        if pdf.get_y() > pdf.h - 75:
            pdf.add_page()
        theme.info_panel(pdf, "Important Clinical Considerations & Limitations", CLINICAL_CONSIDERATIONS, accent=theme.WARN)
        pdf.ln(6)

        # ---- Technical Methodology ------------------------------------------ #
        if pdf.get_y() > pdf.h - 65:
            pdf.add_page()
        pdf.section_title("Methodology & Technical Specifications")
        pdf.ln(2)
        theme.info_panel(pdf, "Technical Specifications", [
            ("bullet", f"**AI Model**: Deep learning-based MRI classification using 3D CNN architecture (Version: {MODEL_VERSION})."),
            ("bullet", "**Analysis Pipeline**: Multi-slice prediction with majority voting and volumetric segmentation."),
            ("bullet", "**Volumetric Analysis**: Automated brain segmentation using validated algorithms for GM/WM/CSF quantification."),
            ("bullet", "**Quality Control**: Automated motion artifact detection and signal quality assessment applied."),
        ])
        pdf.ln(6)

        # ---- Patient & Family Summary (condensed, unique content) --------- #
        if pdf.get_y() > pdf.h - 90:
            pdf.add_page()
        pdf.section_title("Patient & Family Summary")
        pdf.ln(2)

        patient_display, patient_interpretation = _patient_framing(prediction)
        pdf.set_font('Helvetica', '', 9)
        pdf.set_text_color(*pdf.text_color_dark)
        conf_sentence = f" The AI model is {float(confidence)*100:.1f}% confident in this finding." if confidence else ""
        pdf.multi_cell(0, 5.5, sanitize_for_pdf(f"In plain terms: {patient_display}.{conf_sentence}"), align='L')
        pdf.ln(4)

        theme.info_panel(pdf, "What This Means", [
            ("bullet", "**This is NOT a diagnosis** - only a doctor can diagnose medical conditions, after considering the complete medical history and other tests."),
            ("bullet", "**This is a screening tool** - the AI helps identify brain patterns that may need further medical evaluation."),
            ("bullet", "**Further evaluation may be needed** - the doctor will determine if additional tests are necessary."),
        ])
        pdf.ln(4)

        theme.info_panel(pdf, "Your Next Steps", [
            ("bullet", "**Schedule an appointment** with the doctor to discuss these results in detail."),
            ("bullet", "**Bring this report** to the doctor's appointment for their review."),
            ("bullet", "**Prepare questions** about what these findings mean for the patient's health."),
            ("bullet", "**Follow the doctor's advice** regarding any additional tests or treatments."),
            ("bullet", "**Don't panic** - many factors affect brain patterns, and the doctor will provide proper context."),
        ])
        pdf.ln(4)

        theme.info_panel(pdf, "Suggested Questions for the Doctor", [
            "What do these MRI results mean in the context of the patient's symptoms?",
            "Are any additional tests or imaging studies needed?",
            "What are the next steps in the care plan?",
            "Are there lifestyle changes to consider?",
            "How often should follow-up appointments occur?",
            "Should family members be aware of these findings?",
        ])
        pdf.ln(6)

        # ---- Shared closing sections (each appears once) ------------------- #
        pdf.add_disclaimer("comprehensive")
        pdf.add_signature_section()

        pdf.set_font('Helvetica', 'I', 8)
        pdf.set_text_color(*pdf.text_color_light)
        pdf.cell(0, 5, "CONFIDENTIAL MEDICAL REPORT - COMBINED CLINICAL, TECHNICAL & PATIENT SUMMARY", 0, 1, 'C')
        pdf.set_text_color(*pdf.text_color_normal)

    except Exception as e:
        print(f"Error building unified MRI report: {e}")
        traceback.print_exc()
        _add_error_page(pdf, e)


def _add_explainability_section(pdf, explainability) -> None:
    """Render the AI Visual Explainability section: for each informative slice,
    the Grad-CAM-highlighted patient image beside its healthy MNI152 reference,
    with plain-language observations derived from the volumetric findings."""
    if not explainability or not explainability.get('panels'):
        return
    try:
        if pdf.get_y() > pdf.h - 100:
            pdf.add_page()
        pdf.section_title("AI Visual Explainability")
        pdf.ln(2)

        method = explainability.get('method', 'Grad-CAM (ConViT)')
        regions = explainability.get('regions') or []
        intro = [
            ("bullet", f"**Method**: {method}. The colored heatmap marks the regions that contributed most to the AI prediction."),
            ("bullet", "Each **patient slice (left)** is shown beside the anatomically-matched **healthy MNI152 reference (right)**."),
        ]
        if regions:
            intro.append(("bullet", "**Clinically relevant regions assessed**: " + ", ".join(regions) + "."))
        theme.info_panel(pdf, "How To Read This Section", intro)
        pdf.ln(3)

        for panel in explainability['panels']:
            _render_explainability_panel(pdf, panel)

        # Analysis-level observations (derived from the real volumetric
        # comparison) shown once beneath the comparisons.
        panels = explainability['panels']
        observations = panels[0].get('observations') if panels else None
        if observations:
            if pdf.get_y() > pdf.h - 45:
                pdf.add_page()
            pdf.set_font('Helvetica', 'B', 9)
            pdf.set_text_color(*pdf.text_color_dark)
            pdf.cell(0, 5.5, "AI Observations", 0, 1, 'L')
            pdf.set_font('Helvetica', '', 8.7)
            pdf.set_text_color(*pdf.text_color_normal)
            for obs in observations:
                pdf.multi_cell(0, 4.8, sanitize_for_pdf(f"- {obs}"), align='L')
            pdf.ln(1)

        summary = explainability.get('summary')
        if summary:
            pdf.set_font('Helvetica', 'I', 8.3)
            pdf.set_text_color(*pdf.text_color_light)
            pdf.multi_cell(0, 4.6, sanitize_for_pdf(summary), align='L')
            pdf.set_text_color(*pdf.text_color_normal)
        pdf.ln(6)
    except Exception as e:  # noqa: BLE001 - visual section must never fail the report
        print(f"Explainability section error: {e}")


def _render_explainability_panel(pdf, panel) -> None:
    """One comparison row: affected patient slice (left) vs healthy reference
    (right), column headers above and the slice caption below."""
    gap = 6.0
    usable = pdf.w - pdf.l_margin - pdf.r_margin
    col_w = (usable - gap) / 2.0

    # Ensure the whole row fits; otherwise start a fresh page.
    if pdf.get_y() > pdf.h - (col_w + 30):
        pdf.add_page()

    left_x = pdf.l_margin
    right_x = pdf.l_margin + col_w + gap

    # Column headers.
    y_top = pdf.get_y()
    pdf.set_font('Helvetica', 'B', 8.3)
    pdf.set_text_color(*pdf.text_color_dark)
    pdf.set_xy(left_x, y_top)
    pdf.cell(col_w, 5, "Patient MRI Slice (Affected)", 0, 0, 'C')
    pdf.set_xy(right_x, y_top)
    pdf.cell(col_w, 5, "Healthy Reference (MNI152)", 0, 1, 'C')

    img_y = pdf.get_y() + 1
    left_h = _place_data_uri_image(pdf, panel.get('affected_image'), left_x, img_y, col_w)
    right_h = _place_data_uri_image(pdf, panel.get('reference_image'), right_x, img_y, col_w)
    pdf.set_y(img_y + max(left_h, right_h, 12) + 2)

    caption = panel.get('caption')
    if caption:
        pdf.set_font('Helvetica', 'I', 8)
        pdf.set_text_color(*pdf.text_color_light)
        pdf.cell(0, 4.5, sanitize_for_pdf(caption), 0, 1, 'L')
        pdf.set_text_color(*pdf.text_color_normal)
    pdf.ln(3)


def _place_data_uri_image(pdf, data_uri, x: float, y: float, w: float) -> float:
    """Place a base64 data-URI image at (x, y) with width ``w``; returns the
    rendered height. Draws a light placeholder box when the image is missing."""
    import base64
    import io as _io

    if not data_uri or not isinstance(data_uri, str):
        pdf.set_draw_color(210, 210, 210)
        pdf.rect(x, y, w, w * 0.9)
        pdf.set_font('Helvetica', 'I', 7)
        pdf.set_text_color(*pdf.text_color_light)
        pdf.set_xy(x, y + w * 0.42)
        pdf.cell(w, 5, "(image unavailable)", 0, 0, 'C')
        pdf.set_text_color(*pdf.text_color_normal)
        return w * 0.9
    try:
        raw = data_uri.split(',', 1)[1] if data_uri.startswith('data:') else data_uri
        img_bytes = base64.b64decode(raw)
        from PIL import Image
        pil = Image.open(_io.BytesIO(img_bytes))
        iw, ih = pil.size
        pil.close()
        aspect = (ih / iw) if iw else 0.9
        pdf.image(_io.BytesIO(img_bytes), x=x, y=y, w=w)
        return w * aspect
    except Exception as e:  # noqa: BLE001
        print(f"Explainability image error: {e}")
        return 12.0


def _patient_framing(prediction: str):
    if prediction == 'CN':
        return (
            "Normal Brain Patterns Observed",
            "The AI analysis found brain patterns that are similar to typical healthy brain structure. "
            "No significant abnormalities were detected in this scan.",
        )
    if prediction == 'MCI':
        return (
            "Patterns Suggestive of Mild Cognitive Changes",
            "The AI analysis found brain patterns that may indicate Mild Cognitive Impairment (MCI). "
            "Many people with MCI remain stable or even improve over time.",
        )
    if prediction == 'AD':
        return (
            "Patterns Suggestive of Alzheimer's Characteristics",
            "The AI analysis found brain patterns that may be associated with Alzheimer's disease, "
            "including changes in certain brain regions that are commonly affected by this condition.",
        )
    return ("Analysis Results Require Review", "The analysis results require further review by your healthcare provider.")


def _get_clinical_significance(prediction: str) -> str:
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
        ),
    }
    return significance.get(prediction, "Analysis results require clinical review and interpretation.")


def _get_clinical_recommendations(prediction: str):
    recommendations = {
        'CN': [
            ("bullet", "**Clinical Correlation**: Interpret normal findings in context of presenting symptoms."),
            ("bullet", "**If Symptomatic**: Consider additional diagnostic workup if cognitive concerns persist."),
            ("bullet", "**Preventive Counseling**: Discuss brain health lifestyle factors."),
            ("bullet", "**Baseline Documentation**: This study may serve as baseline for future comparison."),
        ],
        'MCI': [
            ("bullet", "**Cognitive Assessment**: Administer standardized tests (MMSE, MoCA) to characterize deficits."),
            ("bullet", "**Reversible Causes**: Rule out depression, medication effects, B12/thyroid abnormalities."),
            ("bullet", "**Lifestyle Modifications**: Discuss exercise, cognitive stimulation, social engagement."),
            ("bullet", "**Risk Factor Management**: Address vascular risk factors (hypertension, diabetes)."),
            ("bullet", "**Regular Monitoring**: Schedule follow-up assessments every 6-12 months."),
            ("bullet", "**Family Education**: Discuss MCI prognosis and warning signs of progression."),
        ],
        'AD': [
            ("bullet", "**Comprehensive Evaluation**: Conduct thorough neurological exam and cognitive assessment (MMSE, MoCA)."),
            ("bullet", "**Additional Imaging**: Consider PET scan for amyloid/tau assessment if available."),
            ("bullet", "**Differential Diagnosis**: Rule out reversible causes (depression, B12, thyroid)."),
            ("bullet", "**Neuropsychological Testing**: Detailed cognitive domain assessment recommended."),
            ("bullet", "**Specialist Referral**: Memory clinic or neurology consultation may be appropriate."),
            ("bullet", "**Family Counseling**: Discuss findings and care planning with patient and family."),
        ],
    }
    return recommendations.get(prediction, [
        ("bullet", "**Repeat Study**: Consider repeat imaging if findings are inconclusive."),
        ("bullet", "**Clinical Assessment**: Base decisions on comprehensive clinical evaluation."),
    ])


# Deduplicated union of the clinician-copy "Important Clinical Considerations"
# and technical-copy "Clinical Interpretation Guidelines" lists (each point
# kept once, using whichever original phrasing was more complete).
CLINICAL_CONSIDERATIONS = [
    ("bullet", "**AI as Adjunct Tool**: This AI analysis is a decision-support tool and should not replace comprehensive clinical judgment."),
    ("bullet", "**Context is Critical**: Interpret results within the full clinical context, including symptoms, patient history and other imaging."),
    ("bullet", "**Limitations**: AI models recognize statistical patterns learned from training data and may not account for atypical presentations or comorbidities."),
    ("bullet", "**Quality Dependent**: Results assume adequate scan quality; artifacts or technical issues may affect accuracy."),
    ("bullet", "**Not Definitive**: Normal findings do not rule out pathology; abnormal patterns require clinical correlation."),
    ("bullet", "**Follow-up Recommendations**: Correlate with additional imaging, neuropsychological testing, and longitudinal monitoring as clinically indicated."),
]


def _add_extended_session_info(pdf: UnifiedPDFReport, session_data: Dict):
    """Extended technical session fields (scan duration / slice count)."""
    if not session_data:
        return
    duration = session_data.get('session_duration')
    num_channels = session_data.get('num_channels')
    if duration or num_channels:
        if duration:
            pdf.key_value_pair("Scan Duration", f"{duration} seconds", 45)
        if num_channels:
            pdf.key_value_pair("Number of Slices", str(num_channels), 45)
        pdf.ln(3)


def _add_consistency_metrics(pdf: UnifiedPDFReport, consistency: Dict):
    """Detailed consistency metrics grid + confusion matrix (technical's
    superset version)."""
    metrics = [
        ("Overall Accuracy", f"{consistency.get('accuracy', 0)*100:.1f}%", "Slice agreement rate"),
        ("Slices Analyzed", str(consistency.get('num_trials', 'N/A')), "Total slices processed"),
        ("Precision", f"{consistency.get('precision', 0):.3f}", "TP/(TP+FP)"),
        ("Recall/Sensitivity", f"{consistency.get('recall_sensitivity', 0):.3f}", "TP/(TP+FN)"),
        ("Specificity", f"{consistency.get('specificity', 0):.3f}", "TN/(TN+FP)"),
        ("F1-Score", f"{consistency.get('f1_score', 0):.3f}", "Harmonic mean P & R"),
    ]
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


def _add_detailed_volume_table(pdf: UnifiedPDFReport, ml_results: Dict):
    """Detailed volumetric measurements table (technical's superset, with
    the Deviation column)."""
    volumes = [
        ('Total Brain Volume', ml_results.get('brain_volume'), 'total_brain'),
        ('Gray Matter (GM)', ml_results.get('gm_volume'), 'gray_matter'),
        ('White Matter (WM)', ml_results.get('wm_volume'), 'white_matter'),
        ('Cerebrospinal Fluid (CSF)', ml_results.get('csf_volume'), 'csf'),
        ('Hippocampus', ml_results.get('hippocampal_volume'), 'hippocampus'),
        ('Ventricular System', ml_results.get('ventricular_volume'), 'ventricles'),
    ]
    page_width = pdf.w - pdf.l_margin - pdf.r_margin

    pdf.set_font('Helvetica', 'B', 8)
    pdf.set_fill_color(*theme.PANEL)
    pdf.set_text_color(*theme.INK)
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
        mid = (min_v + max_v) / 2

        if value < min_v:
            status, deviation, status_color = 'Below', f"-{((min_v - value) / min_v * 100):.1f}%", pdf.color_warning
        elif value > max_v:
            status, deviation, status_color = 'Above', f"+{((value - max_v) / max_v * 100):.1f}%", pdf.color_warning
        else:
            status, deviation, status_color = 'Normal', f"{((value - mid) / mid * 100):+.1f}%", pdf.color_normal

        pdf.set_fill_color(*(theme.ZEBRA if row_idx % 2 == 0 else (255, 255, 255)))
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

    pdf.set_draw_color(*pdf.line_color)
    pdf.line(pdf.l_margin, pdf.get_y(), pdf.l_margin + page_width, pdf.get_y())
    pdf.ln(2)
    pdf.set_font('Helvetica', 'I', 7)
    pdf.set_text_color(*pdf.text_color_light)
    pdf.cell(0, 4, f"All volumes in {NORMATIVE_VOLUMES.get('total_brain', {}).get('unit', 'cm3')}. Normal ranges based on age-matched reference data.", 0, 1, 'L')
    pdf.set_text_color(*pdf.text_color_normal)


def _add_error_page(pdf: UnifiedPDFReport, error: Exception):
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
    except Exception:
        pass
