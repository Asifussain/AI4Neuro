"""Unified EEG PDF report.

Merges the content of the three audience-specific reports (patient /
clinician / technical) into a single document, in the same PraxiaTech
clinical styling (see ``app/reports/theme.py``). Every section that used to
be duplicated verbatim across all three copies — letterhead, patient
demographics, referring physician, session details, analyst, disclaimer,
signature — now appears exactly once. Content that was genuinely unique to
one audience (e.g. the technical confusion matrix, or the patient's
"questions to ask your doctor") is kept, organised so a single reader can
move from clinical findings through technical detail to a plain-language
summary without re-reading the same paragraph three times.
"""

import traceback
from fpdf import XPos, YPos
from .base_report import BasePDFReport
from app.reports.eeg.utils import sanitize_for_helvetica
from app.reports import theme
from .technical_report import format_metric_for_pdf


class UnifiedPDFReport(BasePDFReport):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.report_title = "EEG Pattern Analysis - Complete Report"
        self.primary_color = theme.BRAND
        self.secondary_color = theme.BRAND


BAND_DESCRIPTIONS = {
    'delta': 'Deep sleep, unconscious processes',
    'theta': 'Drowsiness, meditation, memory',
    'alpha': 'Relaxed wakefulness, closed eyes',
    'beta': 'Active thinking, focus, anxiety',
    'gamma': 'Higher cognitive function, consciousness',
}

CLINICAL_RECOMMENDATIONS = {
    ("Alzheimer's", "AD"): [
        ("bullet", "**Comprehensive Clinical Evaluation**: Conduct thorough neurological examination and cognitive assessment (e.g., MMSE, MoCA)."),
        ("bullet", "**Neuroimaging Correlation**: Consider MRI or PET scan to assess structural and functional brain changes."),
        ("bullet", "**Differential Diagnosis**: Rule out other causes of cognitive decline (depression, vitamin deficiencies, thyroid disorders, etc.)."),
        ("bullet", "**Neuropsychological Testing**: Detailed cognitive testing to assess specific domains affected."),
        ("bullet", "**Family History Review**: Evaluate genetic risk factors and family history of dementia."),
        ("bullet", "**Longitudinal Monitoring**: Consider follow-up EEG and cognitive assessments to track progression."),
        ("bullet", "**Specialist Referral**: Referral to neurology or memory clinic may be appropriate for specialized evaluation."),
    ],
    ("MCI",): [
        ("bullet", "**Comprehensive Cognitive Assessment**: Conduct detailed neuropsychological testing to characterize specific cognitive domains affected."),
        ("bullet", "**Neuroimaging Studies**: Consider MRI to assess hippocampal atrophy and PET scan for amyloid/tau pathology if available."),
        ("bullet", "**Differential Diagnosis**: Rule out reversible causes (medications, sleep disorders, depression, metabolic issues)."),
        ("bullet", "**Cardiovascular Risk Management**: Address vascular risk factors (hypertension, diabetes, hyperlipidemia)."),
        ("bullet", "**Lifestyle Interventions**: Recommend cognitive engagement, physical exercise, Mediterranean diet, and social activity."),
        ("bullet", "**Regular Monitoring**: Schedule follow-up assessments every 6-12 months to monitor for progression to dementia."),
        ("bullet", "**Patient & Family Education**: Discuss MCI prognosis, progression risk, and importance of early intervention."),
        ("bullet", "**Clinical Trial Consideration**: Evaluate eligibility for MCI intervention trials if appropriate."),
    ],
    ("Normal", "CN"): [
        ("bullet", "**Clinical Correlation**: Interpret normal EEG findings in context of patient symptoms and clinical presentation."),
        ("bullet", "**Follow-up if Symptomatic**: If patient has cognitive concerns despite normal EEG, consider additional diagnostic workup."),
        ("bullet", "**Preventive Care**: Discuss lifestyle factors for brain health (exercise, diet, cognitive engagement, sleep)."),
        ("bullet", "**Baseline Documentation**: This study may serve as a baseline for future comparison if needed."),
        ("bullet", "**Address Other Concerns**: Evaluate and address any non-neurological factors affecting cognition or quality of life."),
    ],
}
DEFAULT_RECOMMENDATIONS = [
    ("bullet", "**Repeat Study**: Consider repeating EEG under optimal conditions if initial results are inconclusive."),
    ("bullet", "**Clinical Assessment**: Base clinical decisions on comprehensive evaluation rather than AI analysis alone."),
    ("bullet", "**Additional Testing**: May require additional diagnostic studies based on clinical presentation."),
]

# Deduplicated union of the clinician-copy "Important Clinical Considerations"
# and technical-copy "Important Clinical Notes" lists (each point kept once,
# using whichever original phrasing was more complete).
CLINICAL_CONSIDERATIONS = [
    ("bullet", "**AI as Adjunct Tool**: This AI analysis is a decision-support tool and should not replace comprehensive clinical judgment."),
    ("bullet", "**Context is Critical**: Always interpret results within the full clinical context, including symptoms, examination findings, cognitive assessments, patient history and other imaging studies."),
    ("bullet", "**Limitations**: AI models recognize statistical patterns learned from training data and may not account for atypical presentations, comorbidities, or artifacts in the recording."),
    ("bullet", "**Quality Dependent**: Results assume adequate EEG signal quality; artifacts, technical issues, or non-standard montages may affect accuracy."),
    ("bullet", "**Not Definitive**: A normal EEG does not rule out cognitive disorders; abnormal patterns require clinical correlation."),
    ("bullet", "**Follow-up Recommendations**: Consider correlation with MRI/CT imaging, neuropsychological testing, and longitudinal monitoring as clinically indicated."),
]


def _finding_for(prediction_label):
    if prediction_label in ("Alzheimer's", "AD"):
        return (
            "EEG Patterns Suggestive of Alzheimer's Disease",
            theme.DANGER,
            "The AI analysis identified EEG patterns consistent with those typically observed in Alzheimer's disease. "
            "These findings may indicate neurodegenerative changes affecting brain electrical activity.",
            "Patterns Suggestive of Alzheimer's Characteristics",
        )
    if prediction_label == "MCI":
        return (
            "EEG Patterns Suggestive of Mild Cognitive Impairment",
            theme.WARN,
            "The AI analysis identified EEG patterns consistent with those typically observed in Mild Cognitive Impairment (MCI). "
            "These findings may indicate early changes in brain electrical activity that warrant further clinical evaluation and monitoring.",
            "Patterns Suggestive of Mild Cognitive Impairment",
        )
    if prediction_label in ("Normal", "CN"):
        return (
            "Normal EEG Pattern",
            theme.OK,
            "The AI analysis found EEG patterns within normal parameters, showing typical healthy brain electrical activity. "
            "No significant deviations from expected normal patterns were detected.",
            "Normal Brainwave Patterns Observed",
        )
    return ("Indeterminate", theme.MUTED, "", "Pattern assessment inconclusive")


def build_unified_pdf_report_content(pdf: UnifiedPDFReport, comprehensive_data, stats_data,
                                     similarity_data, consistency_metrics,
                                     ts_img_data, psd_img_data, similarity_plot_data):
    """
    Build a single EEG report combining the patient, clinician and technical
    content with no repeated sections.

    Args: identical to ``build_technical_pdf_report_content`` (the superset of
    the three original builders' inputs).
    """
    try:
        pdf.comprehensive_data = comprehensive_data
        prediction_data = comprehensive_data.get('prediction', {})
        patient_profile = comprehensive_data.get('patient_profile')
        hospital_data = comprehensive_data.get('hospital')

        pdf.add_page()

        if hospital_data:
            pdf.add_hospital_header(hospital_data)
        pdf.add_report_metadata_section("EEG COMPLETE ANALYSIS REPORT")
        pdf.ln(3)

        # ---- Shared administrative sections (each appears once) --------- #
        pdf.add_patient_demographics_section()

        if patient_profile:
            medical_history = patient_profile.get('medical_history')
            current_medications = patient_profile.get('current_medications')
            allergies = patient_profile.get('allergies')
            if medical_history or current_medications or allergies:
                if pdf.get_y() > pdf.h - 70:
                    pdf.add_page()
                pdf.section_title("Medical History & Context")
                pdf.ln(2)
                if medical_history and str(medical_history).strip():
                    pdf.key_value_pair("Medical History", str(medical_history), key_width=45)
                    pdf.ln(1)
                if current_medications and str(current_medications).strip():
                    pdf.key_value_pair("Current Medications", str(current_medications), key_width=45)
                    pdf.ln(1)
                if allergies and str(allergies).strip():
                    pdf.key_value_pair("Allergies", str(allergies), key_width=45)
                pdf.ln(4)

        pdf.add_medical_professional_info(role="doctor")
        pdf.add_session_technical_details()
        pdf.add_medical_professional_info(role="radiologist")

        # ---- Clinical Findings (clinician framing + technical numbers) -- #
        if pdf.get_y() > pdf.h - 60:
            pdf.add_page()
        pdf.section_title("Clinical Findings")
        pdf.ln(2)

        prediction_label = prediction_data.get('prediction', 'Not Determined')
        analysis_type = prediction_data.get('analysis_type', 'binary')
        finding_text, finding_tone, clinical_significance, patient_finding_text = _finding_for(prediction_label)

        theme.finding_banner(pdf, finding_text, clinical_significance, tone=finding_tone)
        pdf.ln(2)

        pdf.key_value_pair("Analysis Type", analysis_type.upper(), key_width=60)
        pdf.ln(1)

        probabilities = prediction_data.get('probabilities')
        max_conf = None
        if isinstance(probabilities, list):
            try:
                if len(probabilities) == 2:
                    prob_str = f"Normal: {format_metric_for_pdf(probabilities[0], 'percent', 2)} | Alzheimer's: {format_metric_for_pdf(probabilities[1], 'percent', 2)}"
                elif len(probabilities) == 3:
                    prob_str = f"CN: {format_metric_for_pdf(probabilities[0], 'percent', 2)} | MCI: {format_metric_for_pdf(probabilities[1], 'percent', 2)} | AD: {format_metric_for_pdf(probabilities[2], 'percent', 2)}"
                else:
                    prob_str = sanitize_for_helvetica(str(probabilities))
                pdf.key_value_pair("Model Confidence Distribution", prob_str, key_width=60)
                pdf.ln(1)
                max_conf = max(probabilities) * 100
                pdf.key_value_pair("Primary Classification Confidence", f"{max_conf:.2f}%", key_width=60)
                pdf.ln(1)
            except Exception as e:
                print(f"Error formatting probabilities: {e}")

        created_at = prediction_data.get('created_at')
        if created_at:
            try:
                import pandas as pd
                dt_obj = pd.to_datetime(created_at)
                pdf.key_value_pair("Analysis Completed", dt_obj.strftime('%Y-%m-%d %H:%M:%S UTC'), key_width=60)
            except Exception:
                pdf.key_value_pair("Analysis Completed", str(created_at), key_width=60)
            pdf.ln(1)

        pdf.ln(5)

        # ---- Model Reliability — Internal Consistency -------------------- #
        if pdf.get_y() > pdf.h - 60:
            pdf.add_page()
        pdf.section_title("Model Reliability - Internal Consistency Analysis")
        pdf.ln(2)

        theme.info_panel(pdf, "About Consistency Metrics", [
            "The following metrics reflect model stability across EEG segments **within this sample**.",
            "These are **internal consistency checks**, NOT diagnostic accuracy against ground truth.",
            "High consistency indicates stable pattern recognition throughout the recording.",
            "Metrics calculated by comparing segment-level predictions to the overall file prediction.",
        ])
        pdf.ln(3)

        if consistency_metrics and not consistency_metrics.get('error') and consistency_metrics.get('num_trials', 0) > 0:
            metrics = consistency_metrics
            page_width = pdf.w - pdf.l_margin - pdf.r_margin

            def add_metric_row(m1, m2=None):
                pdf.metric_card(*m1)
                if m2:
                    # metric_card already leaves the cursor positioned for a
                    # 2nd card - do not set_y() here, it resets x to l_margin.
                    pdf.metric_card(*m2)
                else:
                    pdf.set_x(pdf.l_margin)
                pdf.ln(25)

            add_metric_row(
                ("Overall Accuracy", format_metric_for_pdf(metrics.get('accuracy'), 'percent', 1), "", "Segment agreement rate"),
                ("Segments Analyzed", str(metrics.get('num_trials', 'N/A')), "", "Total EEG segments processed"),
            )
            add_metric_row(
                ("Precision (Alz)", format_metric_for_pdf(metrics.get('precision'), 'float', 3), "", "TP/(TP+FP) for Alzheimer's"),
                ("Recall/Sensitivity (Alz)", format_metric_for_pdf(metrics.get('recall_sensitivity'), 'float', 3), "", "TP/(TP+FN) for Alzheimer's"),
            )
            add_metric_row(
                ("Specificity (Normal)", format_metric_for_pdf(metrics.get('specificity'), 'float', 3), "", "TN/(TN+FP) for Normal"),
                ("F1-Score (Alz)", format_metric_for_pdf(metrics.get('f1_score'), 'float', 3), "", "Harmonic mean P & R"),
            )

            pdf.set_font('Helvetica', 'B', 10)
            pdf.set_text_color(*pdf.text_color_dark)
            pdf.cell(0, 6, "Confusion Matrix (Internal Consistency):", ln=1)
            pdf.ln(1)
            pdf.set_font('Helvetica', '', 9)
            pdf.set_text_color(*pdf.text_color_light)
            cm_ref = metrics.get('majority_label_used_as_reference', '?')
            cm_ref_label = "Alzheimer's" if cm_ref == 1 else "Normal" if cm_ref == 0 else "Unknown"
            for line in [
                f"Reference Prediction: {cm_ref_label}",
                f"True Positives (TP): {metrics.get('true_positives', 'N/A')} | True Negatives (TN): {metrics.get('true_negatives', 'N/A')}",
                f"False Positives (FP): {metrics.get('false_positives', 'N/A')} | False Negatives (FN): {metrics.get('false_negatives', 'N/A')}",
            ]:
                pdf.cell(5)
                pdf.cell(0, 5, sanitize_for_helvetica(line), ln=1)
            pdf.set_text_color(*pdf.text_color_normal)
            pdf.ln(4)

            accuracy = metrics.get('accuracy', 0) or 0
            accuracy_pct = format_metric_for_pdf(accuracy, 'percent', 0)
            num_trials = metrics.get('num_trials', 'multiple')
            if accuracy >= 0.85:
                reliability_word = "High"
            elif accuracy >= 0.70:
                reliability_word = "Moderate"
            else:
                reliability_word = "Low"

            theme.info_panel(pdf, "Interpreting the Consistency Score", [
                ("bullet", "High (>85%): the pattern was consistently present throughout the recording."),
                ("bullet", "Moderate (70-85%): the pattern was present but with some variation."),
                ("bullet", "Low (<70%): patterns were inconsistent and should be interpreted with caution."),
                f"At {accuracy_pct} agreement across {num_trials} segments, this recording falls in the **{reliability_word}** reliability range.",
            ])
        elif consistency_metrics and consistency_metrics.get('message'):
            pdf.set_font('Helvetica', 'I', 10)
            pdf.set_text_color(*pdf.text_color_light)
            pdf.cell(0, 6, f"Consistency Check: {consistency_metrics['message']}", ln=1)
            pdf.set_text_color(*pdf.text_color_normal)
        else:
            pdf.set_font('Helvetica', 'I', 10)
            pdf.set_text_color(*pdf.text_color_light)
            pdf.cell(0, 6, "Internal consistency metrics not calculated or not applicable for this recording.", ln=1)
            pdf.set_text_color(*pdf.text_color_normal)

        pdf.ln(6)

        # ---- EEG Pattern Characteristics — DTW Similarity ---------------- #
        if pdf.get_y() > pdf.h - 110:
            pdf.add_page()
        pdf.section_title("EEG Pattern Characteristics - Waveform & Similarity Analysis")
        pdf.ln(2)

        if similarity_data and not similarity_data.get('error'):
            classification_type = similarity_data.get('classification_type', 'binary')
            interpretation = similarity_data.get('interpretation', '')
            interpretation_clean = (
                interpretation.split("Disclaimer:")[0]
                .replace("Similarity Analysis (DTW):", "")
                .replace("Multiclass Similarity Analysis (DTW):", "")
                .replace("Overall Assessment:", "")
                .strip()
            )
            if interpretation_clean:
                pdf.set_font('Helvetica', '', 9)
                pdf.set_text_color(*pdf.text_color_dark)
                for line in interpretation_clean.split('\n'):
                    line_text = line.strip()
                    if line_text:
                        if pdf.get_y() > pdf.h - 15:
                            pdf.add_page()
                        pdf.multi_cell(0, 6, sanitize_for_helvetica(line_text), align='L', max_line_height=6, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
                        pdf.ln(1.5)
                pdf.ln(2)

            if similarity_plot_data:
                if pdf.get_y() > pdf.h - 100:
                    pdf.add_page()
                plotted_ch_idx = similarity_data.get('plotted_channel_index')
                if classification_type == 'multiclass':
                    plot_title = f"EEG Waveform Comparison - Multiclass (CN vs MCI vs AD) - Channel {plotted_ch_idx + 1 if plotted_ch_idx is not None else 'Selected'}"
                else:
                    plot_title = f"EEG Waveform Comparison - Binary (Normal vs Alzheimer's) - Channel {plotted_ch_idx + 1 if plotted_ch_idx is not None else 'Selected'}"
                pdf.add_image_section(plot_title, similarity_plot_data)

                if classification_type == 'multiclass':
                    dtw_cn = similarity_data.get('dtw_distance_to_cn')
                    dtw_mci = similarity_data.get('dtw_distance_to_mci')
                    dtw_ad = similarity_data.get('dtw_distance_to_ad')
                    if dtw_cn is not None and dtw_mci is not None and dtw_ad is not None:
                        pdf.ln(2)
                        pdf.set_font('Helvetica', 'B', 9)
                        pdf.set_text_color(*pdf.text_color_dark)
                        pdf.cell(0, 6, "DTW Distance Metrics (Multiclass):", ln=1)
                        pdf.ln(2)
                        pdf.set_font('Helvetica', '', 9)
                        pdf.key_value_pair("Distance to CN (Normal) Reference", f"{dtw_cn:.4f}", key_width=65)
                        pdf.ln(1)
                        pdf.key_value_pair("Distance to MCI Reference", f"{dtw_mci:.4f}", key_width=65)
                        pdf.ln(1)
                        pdf.key_value_pair("Distance to AD (Alzheimer's) Reference", f"{dtw_ad:.4f}", key_width=65)
                        pdf.ln(2)
                else:
                    dtw_alz = similarity_data.get('dtw_distance_to_alz')
                    dtw_norm = similarity_data.get('dtw_distance_to_norm')
                    if dtw_alz is not None and dtw_norm is not None:
                        pdf.ln(2)
                        pdf.set_font('Helvetica', 'B', 9)
                        pdf.set_text_color(*pdf.text_color_dark)
                        pdf.cell(0, 6, "DTW Distance Metrics (Binary):", ln=1)
                        pdf.ln(2)
                        pdf.set_font('Helvetica', '', 9)
                        pdf.key_value_pair("Distance to Alzheimer's Reference", f"{dtw_alz:.4f}", key_width=65)
                        pdf.ln(1)
                        pdf.key_value_pair("Distance to Normal Reference", f"{dtw_norm:.4f}", key_width=65)
                        pdf.ln(2)
        else:
            err_msg = similarity_data.get('error', 'Data not available') if similarity_data else 'Analysis not performed'
            pdf.set_font('Helvetica', 'I', 9)
            pdf.set_text_color(*pdf.text_color_light)
            pdf.cell(0, 6, f"DTW Analysis Error: {err_msg}", ln=1)
            pdf.set_text_color(*pdf.text_color_normal)

        pdf.ln(6)

        # ---- Brainwave Frequency Analysis (merged table) ------------------ #
        if pdf.get_y() > pdf.h - 65:
            pdf.add_page()
        pdf.section_title("Brainwave Frequency Analysis")
        pdf.ln(2)

        if stats_data and not stats_data.get('error') and stats_data.get('avg_band_power'):
            avg_power = stats_data.get('avg_band_power', {})
            rows = []
            for band_name, powers in avg_power.items():
                rel_power = powers.get('relative')
                if rel_power is None:
                    continue
                abs_power = powers.get('absolute')
                rows.append([
                    band_name.capitalize(),
                    format_metric_for_pdf(rel_power, 'percent', 2),
                    format_metric_for_pdf(abs_power, 'float', 4) if abs_power is not None else 'N/A',
                    BAND_DESCRIPTIONS.get(band_name.lower(), 'Brain activity'),
                ])
            if rows:
                theme.data_table(
                    pdf,
                    [("Band", 30), ("Relative Power", 35), ("Absolute Power (uV2)", 45), ("Associated Activity", 0)],
                    rows,
                    aligns=["L", "C", "C", "L"],
                )
            else:
                pdf.set_font('Helvetica', 'I', 9)
                pdf.set_text_color(*pdf.text_color_light)
                pdf.cell(0, 5, "(No band power data available)", ln=1)
                pdf.set_text_color(*pdf.text_color_normal)
            pdf.ln(4)

            std_devs = stats_data.get('std_dev_per_channel')
            if std_devs:
                pdf.set_font('Helvetica', 'B', 10)
                pdf.set_text_color(*pdf.text_color_dark)
                pdf.cell(0, 6, "Channel-wise Signal Standard Deviation (microV):", ln=1)
                pdf.ln(1)
                pdf.set_font('Helvetica', '', 9)
                std_dev_str = ", ".join([f"Ch{i+1}: {format_metric_for_pdf(s, 'float', 2)}" for i, s in enumerate(std_devs)])
                pdf.multi_cell(0, 5, sanitize_for_helvetica(std_dev_str), align='L')
                pdf.ln(3)
        else:
            pdf.set_font('Helvetica', 'I', 9)
            pdf.set_text_color(*pdf.text_color_light)
            pdf.cell(0, 6, "Frequency band analysis not available.", ln=1)
            pdf.set_text_color(*pdf.text_color_normal)

        pdf.ln(6)

        # ---- EEG Signal Visualizations ------------------------------------ #
        if pdf.get_y() > pdf.h - 120:
            pdf.add_page()
        pdf.section_title("EEG Signal Visualizations")
        pdf.ln(2)
        if pdf.get_y() > pdf.h - 100:
            pdf.add_page()
        pdf.add_image_section("Multi-channel EEG Traces", ts_img_data)
        if pdf.get_y() > pdf.h - 95:
            pdf.add_page()
        pdf.add_image_section("Power Spectral Density - Frequency Domain", psd_img_data)
        pdf.ln(6)

        # ---- Clinical Recommendations -------------------------------------- #
        if pdf.get_y() > pdf.h - 85:
            pdf.add_page()
        pdf.section_title("Clinical Recommendations & Next Steps")
        pdf.ln(2)

        recommendations = DEFAULT_RECOMMENDATIONS
        for labels, recs in CLINICAL_RECOMMENDATIONS.items():
            if prediction_label in labels:
                recommendations = recs
                break

        theme.info_panel(pdf, "Suggested Clinical Actions", recommendations)
        pdf.ln(6)

        # ---- Important Clinical Considerations (deduped) ------------------- #
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
            ("bullet", "**AI Model**: Deep learning-based EEG classification using ADformer (Alzheimer's Detection Transformer) architecture."),
            ("bullet", "**Analysis Pipeline**: Multi-trial prediction with majority voting, internal consistency validation, and DTW-based similarity assessment."),
            ("bullet", "**Frequency Analysis**: Band power computation (Delta, Theta, Alpha, Beta, Gamma) using Welch's method with appropriate windowing."),
            ("bullet", "**Signal Processing**: Standard preprocessing including filtering, artifact detection, and normalization per neurophysiological guidelines."),
            ("bullet", "**Reference Database**: Model trained on validated EEG datasets with confirmed clinical diagnoses."),
        ])
        pdf.ln(6)

        # ---- Patient & Family Summary (condensed, unique content) --------- #
        if pdf.get_y() > pdf.h - 90:
            pdf.add_page()
        pdf.section_title("Patient & Family Summary")
        pdf.ln(2)

        pdf.set_font('Helvetica', '', 9)
        pdf.set_text_color(*pdf.text_color_dark)
        pdf.multi_cell(0, 5.5, sanitize_for_helvetica(
            f"In plain terms: {patient_finding_text}."
            + (f" The AI model is {max_conf:.1f}% confident in this finding." if max_conf is not None else "")
        ), align='L')
        pdf.ln(4)

        theme.info_panel(pdf, "What This Means", [
            ("bullet", "**This is NOT a diagnosis** - only a doctor can diagnose medical conditions, after considering the complete medical history, symptoms and other tests."),
            ("bullet", "**This is a screening tool** - the AI helps identify brain wave patterns that may need further medical evaluation."),
            ("bullet", "**Further evaluation may be needed** - the doctor will determine if additional tests or follow-up appointments are necessary."),
        ])
        pdf.ln(4)

        theme.info_panel(pdf, "Suggested Questions for the Doctor", [
            "What do these EEG results mean in the context of the patient's symptoms and medical history?",
            "Are any additional tests or evaluations needed?",
            "What are the next steps in the care plan?",
            "Are there lifestyle changes or treatments to consider?",
            "How often should follow-up appointments occur?",
            "Should family members be concerned or get tested?",
        ])
        pdf.ln(6)

        # ---- Shared closing sections (each appears once) ------------------- #
        pdf.add_medical_disclaimer(disclaimer_type="comprehensive")
        pdf.add_signature_section()

        pdf.set_font('Helvetica', 'I', 8)
        pdf.set_text_color(*pdf.text_color_light)
        pdf.cell(0, 5, "CONFIDENTIAL MEDICAL REPORT - COMBINED CLINICAL, TECHNICAL & PATIENT SUMMARY", 0, 1, 'C')
        pdf.set_text_color(*pdf.text_color_normal)

    except Exception as pdf_build_e:
        print(f"Critical Error building Unified PDF content: {pdf_build_e}")
        traceback.print_exc()
        try:
            if pdf.page_no() == 0:
                pdf.add_page()
            elif pdf.get_y() > pdf.h - 30:
                pdf.add_page()
            pdf.set_font("Helvetica", 'B', 12)
            pdf.set_text_color(255, 0, 0)
            pdf.multi_cell(0, 10, f"Critical Error Building PDF Content:\n{sanitize_for_helvetica(str(pdf_build_e))}", align='C')
            pdf.set_text_color(*pdf.text_color_normal)
        except Exception as pdf_err_fallback:
            print(f"Fallback error writing critical error to Unified PDF failed: {pdf_err_fallback}")
