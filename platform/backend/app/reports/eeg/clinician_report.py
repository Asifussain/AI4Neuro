import base64
import io
import pandas as pd
import traceback
from fpdf import XPos, YPos
from .base_report import BasePDFReport
from app.reports.eeg.utils import sanitize_for_helvetica
from .technical_report import format_metric_for_pdf

class ClinicianPDFReport(BasePDFReport):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.report_title = "EEG Pattern Analysis Report - Clinician Copy"
        self.primary_color = (41, 128, 185)
        self.secondary_color = (52, 152, 219)

def build_clinician_pdf_report_content(pdf: ClinicianPDFReport, comprehensive_data, stats_data,
                                       similarity_data, consistency_metrics,
                                       ts_img_data, psd_img_data, similarity_plot_data):
    """
    Build clinician/doctor PDF report with comprehensive medical information
    Focuses on clinical interpretation and actionable insights

    Args:
        pdf: ClinicianPDFReport instance
        comprehensive_data: Dict with all medical data (hospital, patient, doctor, radiologist, prediction, session)
        stats_data: EEG statistics
        similarity_data: Similarity analysis results
        consistency_metrics: Model consistency metrics
        ts_img_data: Time series plot base64
        psd_img_data: PSD plot base64
        similarity_plot_data: Similarity plot base64
    """
    page_width = pdf.w - pdf.l_margin - pdf.r_margin

    try:
        # Store comprehensive data in PDF object
        pdf.comprehensive_data = comprehensive_data
        prediction_data = comprehensive_data.get('prediction', {})
        patient_profile = comprehensive_data.get('patient_profile')
        hospital_data = comprehensive_data.get('hospital')

        pdf.add_page()

        # Professional Hospital Header
        if hospital_data:
            pdf.add_hospital_header(hospital_data)

        # Report Metadata Section
        pdf.add_report_metadata_section("EEG CLINICAL ANALYSIS REPORT")
        pdf.ln(3)

        # Patient Demographics
        pdf.add_patient_demographics_section()

        # Medical History Context (if available)
        if patient_profile:
            medical_history = patient_profile.get('medical_history')
            current_medications = patient_profile.get('current_medications')
            allergies = patient_profile.get('allergies')

            if medical_history or current_medications or allergies:
                # Check if we have enough space
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

        # Referring Physician Information (if different from current viewer)
        pdf.add_medical_professional_info(role="doctor")

        # EEG Session Details
        pdf.add_session_technical_details()

        # Analysis Performed By
        pdf.add_medical_professional_info(role="radiologist")

        # Clinical Findings Summary
        # Check space for clinical findings section
        if pdf.get_y() > pdf.h - 60:
            pdf.add_page()

        pdf.section_title("Clinical Findings")
        pdf.ln(2)

        prediction_label = prediction_data.get('prediction', 'Not Determined')
        analysis_type = prediction_data.get('analysis_type', 'binary')

        # Primary Finding
        primary_finding_text = "Indeterminate"
        finding_color = pdf.text_color_dark
        clinical_significance = ""

        if prediction_label == "Alzheimer's" or prediction_label == "AD":
            primary_finding_text = "EEG Patterns Suggestive of Alzheimer's Disease"
            finding_color = (192, 57, 43)
            clinical_significance = (
                "The AI analysis identified EEG patterns consistent with those typically observed in Alzheimer's disease. "
                "These findings may indicate neurodegenerative changes affecting brain electrical activity."
            )
        elif prediction_label == "MCI":
            primary_finding_text = "EEG Patterns Suggestive of Mild Cognitive Impairment"
            finding_color = (243, 156, 18)  # Orange color for MCI
            clinical_significance = (
                "The AI analysis identified EEG patterns consistent with those typically observed in Mild Cognitive Impairment (MCI). "
                "These findings may indicate early changes in brain electrical activity that warrant further clinical evaluation and monitoring."
            )
        elif prediction_label == "Normal" or prediction_label == "CN":
            primary_finding_text = "Normal EEG Pattern"
            finding_color = (39, 174, 96)
            clinical_significance = (
                "The AI analysis found EEG patterns within normal parameters, showing typical healthy brain electrical activity. "
                "No significant deviations from expected normal patterns were detected."
            )

        pdf.set_font('Helvetica', 'B', 9)
        pdf.set_text_color(*pdf.text_color_dark)
        pdf.cell(0, 6, "Primary Classification:", 0, 1, 'L')
        pdf.ln(2)

        # Finding box - aligned to margins
        box_x = pdf.l_margin
        box_y = pdf.get_y()
        box_width = pdf.w - pdf.l_margin - pdf.r_margin
        box_height = 11

        pdf.set_draw_color(*finding_color)
        pdf.set_line_width(0.7)
        pdf.rect(box_x, box_y, box_width, box_height, 'D')
        pdf.set_line_width(0.2)

        pdf.set_font('Helvetica', 'B', 10)
        pdf.set_text_color(*finding_color)
        pdf.set_xy(box_x, box_y + 3)
        pdf.cell(box_width, 5, primary_finding_text, 0, 0, 'C')

        pdf.set_y(box_y + box_height + 3)
        pdf.set_text_color(*pdf.text_color_normal)

        # Clinical Significance
        if clinical_significance:
            pdf.set_font('Helvetica', '', 9)
            pdf.set_text_color(*pdf.text_color_dark)
            pdf.multi_cell(0, 6, sanitize_for_helvetica(clinical_significance), align='L', max_line_height=6)
            pdf.ln(12)

        # Model Confidence & Reliability
        # Check space before this section
        if pdf.get_y() > pdf.h - 50:
            pdf.add_page()

        probabilities = prediction_data.get('probabilities')
        if isinstance(probabilities, list):
            try:
                if len(probabilities) == 2:
                    # Binary classification
                    conf_val_idx = 1 if prediction_label == "Alzheimer's" else 0
                    conf_val = probabilities[conf_val_idx] * 100

                    pdf.key_value_pair("Primary Classification Confidence", f"{conf_val:.1f}%", key_width=60)
                    pdf.ln(1)
                    pdf.key_value_pair("Confidence Distribution",
                                     f"Normal: {probabilities[0]*100:.1f}% | Alzheimer's: {probabilities[1]*100:.1f}%",
                                     key_width=60)
                    pdf.ln(1)
                elif len(probabilities) == 3:
                    # Multiclass classification
                    label_map = {"CN": 0, "MCI": 1, "AD": 2}
                    conf_val_idx = label_map.get(prediction_label, 0)
                    conf_val = probabilities[conf_val_idx] * 100

                    pdf.key_value_pair("Primary Classification Confidence", f"{conf_val:.1f}%", key_width=60)
                    pdf.ln(1)
                    pdf.key_value_pair("Confidence Distribution",
                                     f"CN: {probabilities[0]*100:.1f}% | MCI: {probabilities[1]*100:.1f}% | AD: {probabilities[2]*100:.1f}%",
                                     key_width=60)
                    pdf.ln(1)
            except Exception as e:
                print(f"Error formatting confidence: {e}")

        # Consistency Assessment
        if consistency_metrics and not consistency_metrics.get('error'):
            num_trials = consistency_metrics.get('num_trials', 0)
            if num_trials > 1:
                accuracy = consistency_metrics.get('accuracy', 0)
                accuracy_pct = format_metric_for_pdf(accuracy, 'percent', 0)

                pdf.key_value_pair("Internal Consistency", accuracy_pct, key_width=60)
                pdf.ln(1)
                pdf.key_value_pair("Segments Analyzed", f"{num_trials} EEG segments", key_width=60)
                pdf.ln(1)

                if accuracy >= 0.85:
                    reliability = "High reliability - stable pattern recognition across recording"
                elif accuracy >= 0.70:
                    reliability = "Moderate reliability - reasonable but variable pattern detection"
                else:
                    reliability = "Low reliability - interpret with caution, correlate with clinical findings"

                pdf.key_value_pair("Interpretation", reliability, key_width=60)
                pdf.ln(1)
            elif consistency_metrics.get('message'):
                pdf.key_value_pair("Internal Consistency", consistency_metrics.get('message'), key_width=60)
                pdf.ln(1)
        else:
            pdf.key_value_pair("Internal Consistency", "Not assessed", key_width=60)

        pdf.ln(6)

        # EEG Pattern Characteristics
        if pdf.get_y() > pdf.h - 85:
            pdf.add_page()

        pdf.section_title("EEG Pattern Characteristics & Waveform Analysis")
        pdf.ln(2)

        if similarity_data and not similarity_data.get('error'):
            classification_type = similarity_data.get('classification_type', 'binary')

            interpretation = similarity_data.get('interpretation', '')
            # Clean interpretation text
            interpretation_clean = interpretation.split("Disclaimer:")[0].replace("Similarity Analysis (DTW):", "").replace("Multiclass Similarity Analysis (DTW):", "").replace("Overall Assessment:", "").strip()

            if interpretation_clean:
                pdf.set_font('Helvetica', '', 9)
                pdf.set_text_color(*pdf.text_color_dark)

                # Split into lines to handle bullet points properly
                lines = interpretation_clean.split('\n')
                for line in lines:
                    line_text = line.strip()
                    if line_text:
                        # Check if current line will fit
                        if pdf.get_y() > pdf.h - 15:
                            pdf.add_page()
                        pdf.multi_cell(0, 6, sanitize_for_helvetica(line_text), align='L', max_line_height=6, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
                        pdf.ln(1.5)

                pdf.ln(2)

            if similarity_plot_data:
                plotted_ch_idx = similarity_data.get('plotted_channel_index')

                # Different titles based on classification type
                if classification_type == 'multiclass':
                    plot_title = f"Representative EEG Waveform Comparison - Multiclass (CN vs MCI vs AD) - Channel {plotted_ch_idx + 1 if plotted_ch_idx is not None else 'Selected'}"
                else:
                    plot_title = f"Representative EEG Waveform Comparison - Binary (Normal vs Alzheimer's) - Channel {plotted_ch_idx + 1 if plotted_ch_idx is not None else 'Selected'}"

                pdf.add_image_section(plot_title, similarity_plot_data)
        else:
            pdf.set_font('Helvetica', 'I', 9)
            pdf.set_text_color(*pdf.text_color_light)
            pdf.cell(0, 6, "Detailed waveform characteristic analysis not available.", ln=1)
            pdf.set_text_color(*pdf.text_color_normal)

        pdf.ln(6)

        # Frequency Spectrum Analysis
        if pdf.get_y() > pdf.h - 75:
            pdf.add_page()

        pdf.section_title("Brainwave Frequency Analysis")
        pdf.ln(2)

        if stats_data and not stats_data.get('error') and stats_data.get('avg_band_power'):
            pdf.set_font('Helvetica', '', 10)
            pdf.set_text_color(*pdf.text_color_dark)
            pdf.cell(0, 6, "Relative Distribution of EEG Frequency Bands:", 0, 1, 'L')
            pdf.ln(3)

            avg_power = stats_data.get('avg_band_power', {})
            band_descriptions = {
                'delta': 'Deep sleep, unconscious processes',
                'theta': 'Drowsiness, meditation, memory',
                'alpha': 'Relaxed wakefulness, closed eyes',
                'beta': 'Active thinking, focus, anxiety',
                'gamma': 'Higher cognitive function, consciousness'
            }

            for band_name, powers in avg_power.items():
                rel_power = powers.get('relative')
                if rel_power is not None:
                    rel_str = format_metric_for_pdf(rel_power, 'percent', 1)
                    band_desc = band_descriptions.get(band_name.lower(), 'Brain activity')

                    pdf.set_font('Helvetica', 'B', 9)
                    pdf.cell(35, 5.5, f"{band_name.capitalize()}:", 0, 0, 'L')
                    pdf.set_font('Helvetica', '', 9)
                    pdf.cell(20, 5.5, rel_str, 0, 0, 'L')
                    pdf.set_font('Helvetica', 'I', 8)
                    pdf.set_text_color(*pdf.text_color_light)
                    pdf.cell(0, 5.5, f"({band_desc})", 0, 1, 'L')
                    pdf.set_text_color(*pdf.text_color_dark)

            pdf.ln(4)
        else:
            pdf.set_font('Helvetica', 'I', 9)
            pdf.set_text_color(*pdf.text_color_light)
            pdf.cell(0, 6, "Frequency band analysis not available.", ln=1)
            pdf.set_text_color(*pdf.text_color_normal)

        pdf.ln(6)

        # EEG Visualizations - ensure heading stays with content
        if pdf.get_y() > pdf.h - 120:
            pdf.add_page()

        pdf.section_title("EEG Signal Visualizations")
        pdf.ln(2)

        # Check if we have enough space for first image
        if pdf.get_y() > pdf.h - 100:
            pdf.add_page()

        pdf.add_image_section("Multi-channel EEG Traces", ts_img_data)

        # Check space for second image
        if pdf.get_y() > pdf.h - 95:
            pdf.add_page()

        pdf.add_image_section("Power Spectral Density - Frequency Domain", psd_img_data)

        pdf.ln(6)

        # Clinical Recommendations
        if pdf.get_y() > pdf.h - 85:
            pdf.add_page()

        pdf.section_title("Clinical Recommendations & Next Steps")
        pdf.ln(2)

        recommendations = []

        if prediction_label == "Alzheimer's" or prediction_label == "AD":
            recommendations = [
                ("bullet", "**Comprehensive Clinical Evaluation**: Conduct thorough neurological examination and cognitive assessment (e.g., MMSE, MoCA)."),
                ("bullet", "**Neuroimaging Correlation**: Consider MRI or PET scan to assess structural and functional brain changes."),
                ("bullet", "**Differential Diagnosis**: Rule out other causes of cognitive decline (depression, vitamin deficiencies, thyroid disorders, etc.)."),
                ("bullet", "**Neuropsychological Testing**: Detailed cognitive testing to assess specific domains affected."),
                ("bullet", "**Family History Review**: Evaluate genetic risk factors and family history of dementia."),
                ("bullet", "**Longitudinal Monitoring**: Consider follow-up EEG and cognitive assessments to track progression."),
                ("bullet", "**Specialist Referral**: Referral to neurology or memory clinic may be appropriate for specialized evaluation.")
            ]
        elif prediction_label == "MCI":
            recommendations = [
                ("bullet", "**Comprehensive Cognitive Assessment**: Conduct detailed neuropsychological testing to characterize specific cognitive domains affected."),
                ("bullet", "**Neuroimaging Studies**: Consider MRI to assess hippocampal atrophy and PET scan for amyloid/tau pathology if available."),
                ("bullet", "**Differential Diagnosis**: Rule out reversible causes (medications, sleep disorders, depression, metabolic issues)."),
                ("bullet", "**Cardiovascular Risk Management**: Address vascular risk factors (hypertension, diabetes, hyperlipidemia)."),
                ("bullet", "**Lifestyle Interventions**: Recommend cognitive engagement, physical exercise, Mediterranean diet, and social activity."),
                ("bullet", "**Regular Monitoring**: Schedule follow-up assessments every 6-12 months to monitor for progression to dementia."),
                ("bullet", "**Patient & Family Education**: Discuss MCI prognosis, progression risk, and importance of early intervention."),
                ("bullet", "**Clinical Trial Consideration**: Evaluate eligibility for MCI intervention trials if appropriate.")
            ]
        elif prediction_label == "Normal" or prediction_label == "CN":
            recommendations = [
                ("bullet", "**Clinical Correlation**: Interpret normal EEG findings in context of patient symptoms and clinical presentation."),
                ("bullet", "**Follow-up if Symptomatic**: If patient has cognitive concerns despite normal EEG, consider additional diagnostic workup."),
                ("bullet", "**Preventive Care**: Discuss lifestyle factors for brain health (exercise, diet, cognitive engagement, sleep)."),
                ("bullet", "**Baseline Documentation**: This study may serve as a baseline for future comparison if needed."),
                ("bullet", "**Address Other Concerns**: Evaluate and address any non-neurological factors affecting cognition or quality of life.")
            ]
        else:
            recommendations = [
                ("bullet", "**Repeat Study**: Consider repeating EEG under optimal conditions if initial results are inconclusive."),
                ("bullet", "**Clinical Assessment**: Base clinical decisions on comprehensive evaluation rather than AI analysis alone."),
                ("bullet", "**Additional Testing**: May require additional diagnostic studies based on clinical presentation.")
            ]

        pdf.add_explanation_box(
            "Suggested Clinical Actions",
            recommendations,
            icon_char="",
            bg_color=(240, 255, 240),
            font_size_text=9
        )

        pdf.ln(6)

        # Important Clinical Considerations
        if pdf.get_y() > pdf.h - 75:
            pdf.add_page()

        clinical_considerations = [
            ("bullet", "**AI as Adjunct Tool**: This AI analysis is a supplementary tool and should not replace comprehensive clinical judgment."),
            ("bullet", "**Context is Critical**: Always interpret results within the full clinical context including symptoms, examination findings, and patient history."),
            ("bullet", "**Limitations**: AI models may not account for atypical presentations, comorbidities, or artifacts in the recording."),
            ("bullet", "**Quality Dependent**: Results assume adequate EEG quality; technical issues may affect accuracy."),
            ("bullet", "**Not Definitive**: Normal EEG does not rule out cognitive disorders; abnormal patterns require clinical correlation.")
        ]

        pdf.add_explanation_box(
            "Important Clinical Considerations",
            clinical_considerations,
            icon_char="",
            bg_color=(255, 250, 240),
            font_size_text=8.5,
            title_color=(184, 134, 11),
            line_h=4.8
        )

        pdf.ln(6)

        # Medical Disclaimer
        pdf.add_medical_disclaimer(disclaimer_type="standard")

        # Signature Section
        pdf.add_signature_section()

        # Report footer
        pdf.set_font('Helvetica', 'I', 8)
        pdf.set_text_color(*pdf.text_color_light)
        pdf.cell(0, 5, "CONFIDENTIAL MEDICAL REPORT - FOR PROFESSIONAL MEDICAL USE ONLY", 0, 1, 'C')
        pdf.set_text_color(*pdf.text_color_normal)

    except Exception as pdf_build_e:
        print(f"Critical Error building Clinician PDF content: {pdf_build_e}")
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
            print(f"Fallback error writing critical error to Clinician PDF failed: {pdf_err_fallback}")
