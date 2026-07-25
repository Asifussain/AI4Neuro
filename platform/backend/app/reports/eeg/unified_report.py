"""Unified EEG PDF report. EEG only - MRI keeps its separate patient /
clinician / technical reports (app/reports/mri/).

Merges the content of the three audience-specific EEG reports (patient /
clinician / technical) into a single document. Every section that used to
be duplicated verbatim across all three copies - patient demographics,
referring physician, session details, analyst, disclaimer, signature - now
appears exactly once. Uses its own "AI4NEURO / a product by PraxiaTech"
letterhead (see ``UnifiedPDFReport.header``); every other report keeps the
PraxiaTech letterhead defined in ``app/reports/theme.py``.
"""

import traceback
from fpdf import XPos, YPos
from .base_report import BasePDFReport
from app.reports.eeg.utils import sanitize_for_helvetica
from app.reports import theme
from .technical_report import format_metric_for_pdf


class UnifiedPDFReport(BasePDFReport):
    """EEG-only unified report. Uses the AI4Neuro / "a product by PraxiaTech"
    letterhead instead of the PraxiaTech letterhead used by every other
    report (patient/clinician/technical copies, and all MRI reports)."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.report_title = "EEG Pattern Analysis - Complete Report"
        self.primary_color = theme.BRAND
        self.secondary_color = theme.BRAND

    def header(self):
        hospital = (getattr(self, "comprehensive_data", None) or {}).get("hospital") or {}
        theme.draw_clinical_letterhead(self, hospital, subtitle=self.report_title)


BAND_DESCRIPTIONS = {
    'delta': 'Deep sleep, unconscious processes',
    'theta': 'Drowsiness, meditation, memory',
    'alpha': 'Relaxed wakefulness, closed eyes',
    'beta': 'Active thinking, focus, anxiety',
    'gamma': 'Higher cognitive function, consciousness',
}

def _finding_for(prediction_label):
    if prediction_label in ("Alzheimer's", "AD"):
        return (
            "EEG Patterns Suggestive of Alzheimer's Disease",
            theme.DANGER,
            "The AI analysis identified EEG patterns consistent with those typically observed in Alzheimer's disease. "
            "These findings may indicate neurodegenerative changes affecting brain electrical activity.",
        )
    if prediction_label == "MCI":
        return (
            "EEG Patterns Suggestive of Mild Cognitive Impairment",
            theme.WARN,
            "The AI analysis identified EEG patterns consistent with those typically observed in Mild Cognitive Impairment (MCI). "
            "These findings may indicate early changes in brain electrical activity that warrant further clinical evaluation and monitoring.",
        )
    if prediction_label in ("Normal", "CN"):
        return (
            "Normal EEG Pattern",
            theme.OK,
            "The AI analysis found EEG patterns within normal parameters, showing typical healthy brain electrical activity. "
            "No significant deviations from expected normal patterns were detected.",
        )
    return ("Indeterminate", theme.MUTED, "")


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

        # Centered study title (hospital masthead already lives in the
        # clinical letterhead, so the redundant hospital header is dropped).
        pdf.set_font('Helvetica', 'B', 12.5)
        pdf.set_text_color(*theme.INK)
        pdf.cell(0, 7, "EEG PATTERN ANALYSIS - AI DIAGNOSTIC REPORT", 0, 1, 'C')
        pdf.ln(2)

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
        finding_text, finding_tone, clinical_significance = _finding_for(prediction_label)

        theme.finding_banner(pdf, finding_text, clinical_significance, tone=finding_tone)
        pdf.ln(2)

        pdf.key_value_pair("Classification Result", prediction_label, key_width=60)
        pdf.ln(1)
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

        # ---- Shared closing sections (each appears once) ------------------- #
        pdf.add_medical_disclaimer(disclaimer_type="comprehensive")

        radiologist = comprehensive_data.get('radiologist') or {}
        doctor = comprehensive_data.get('doctor') or {}
        theme.dual_signature(
            pdf,
            radiologist.get('full_name', 'Authorized Personnel'), "EEG Technician / Radiologist",
            doctor.get('full_name', 'Doctor'), "Doctor",
        )

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
