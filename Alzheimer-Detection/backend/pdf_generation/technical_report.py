import base64
import io
import pandas as pd
import traceback
from fpdf import XPos, YPos
from .base_report import BasePDFReport
from utils import sanitize_for_helvetica

class TechnicalPDFReport(BasePDFReport):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.report_title = "Technical EEG Analysis Report - Radiologist Copy"
        self.primary_color = (40, 60, 80)
        self.secondary_color = (52, 152, 219)

def format_metric_for_pdf(value, type='float', precision=1):
    """Format metric values for PDF display"""
    if value is None or (isinstance(value, float) and (pd.isna(value) or not pd.Series(value).notna().all())):
        return 'N/A'
    try:
        if type == 'percent':
            return f"{float(value) * 100:.{precision}f}%"
        if type == 'float':
            return f"{float(value):.{precision}f}"
        return sanitize_for_helvetica(str(value))
    except (ValueError, TypeError):
        return 'N/A'

def build_technical_pdf_report_content(pdf: TechnicalPDFReport, comprehensive_data, stats_data,
                                       similarity_data, consistency_metrics,
                                       ts_img_data, psd_img_data, similarity_plot_data):
    """
    Build technical/radiologist PDF report with comprehensive medical and technical information

    Args:
        pdf: TechnicalPDFReport instance
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
        hospital_data = comprehensive_data.get('hospital')

        pdf.add_page()

        # Professional Hospital Header
        if hospital_data:
            pdf.add_hospital_header(hospital_data)

        # Report Metadata Section
        pdf.add_report_metadata_section("TECHNICAL EEG ANALYSIS REPORT")
        pdf.ln(3)

        # Patient Demographics
        pdf.add_patient_demographics_section()

        # Referring Physician
        pdf.add_medical_professional_info(role="doctor")

        # EEG Session Technical Details
        pdf.add_session_technical_details()

        # Analysis Performed By
        pdf.add_medical_professional_info(role="radiologist")

        # ML Analysis Summary
        pdf.section_title("AI Model Analysis Summary")
        pdf.ln(2)

        prediction_label = prediction_data.get('prediction', 'N/A')
        analysis_type = prediction_data.get('analysis_type', 'binary')

        pdf.key_value_pair("Classification Result", prediction_label, key_width=50)
        pdf.ln(1)
        pdf.key_value_pair("Analysis Type", analysis_type.upper(), key_width=50)
        pdf.ln(1)

        # Model Confidence
        probabilities = prediction_data.get('probabilities')
        if isinstance(probabilities, list):
            try:
                if analysis_type == 'multiclass' and len(probabilities) == 3:
                    # Multiclass: CN, MCI, AD
                    prob_str = f"CN: {format_metric_for_pdf(probabilities[0], 'percent', 2)} | MCI: {format_metric_for_pdf(probabilities[1], 'percent', 2)} | AD: {format_metric_for_pdf(probabilities[2], 'percent', 2)}"
                    pdf.key_value_pair("Model Confidence Distribution", prob_str, key_width=60)
                    pdf.ln(1)
                elif len(probabilities) == 2:
                    # Binary: Normal, Alzheimer's
                    prob_str = f"Normal: {format_metric_for_pdf(probabilities[0], 'percent', 2)} | Alzheimer's: {format_metric_for_pdf(probabilities[1], 'percent', 2)}"
                    pdf.key_value_pair("Model Confidence Distribution", prob_str, key_width=60)
                    pdf.ln(1)
                else:
                    # Fallback for unexpected probability array length
                    pdf.key_value_pair("Probabilities", sanitize_for_helvetica(str(probabilities)), key_width=50)
                    pdf.ln(1)

                # Dominant class confidence (works for both binary and multiclass)
                max_conf = max(probabilities) * 100
                pdf.key_value_pair("Primary Classification Confidence", f"{max_conf:.2f}%", key_width=60)
                pdf.ln(1)
            except Exception as e:
                print(f"Error formatting probabilities: {e}")
                pdf.key_value_pair("Probabilities", sanitize_for_helvetica(str(probabilities)), key_width=50)
                pdf.ln(1)
        elif probabilities:
            pdf.key_value_pair("Probabilities", sanitize_for_helvetica(str(probabilities)), key_width=50)
            pdf.ln(1)

        # Analysis timestamp
        created_at = prediction_data.get('created_at')
        if created_at:
            try:
                dt_obj = pd.to_datetime(created_at)
                date_str = dt_obj.strftime('%Y-%m-%d %H:%M:%S UTC')
                pdf.key_value_pair("Analysis Completed", date_str, key_width=50)
                pdf.ln(1)
            except:
                pdf.key_value_pair("Analysis Completed", str(created_at), key_width=50)
                pdf.ln(1)

        pdf.ln(6)

        # Internal Consistency Metrics
        if pdf.get_y() > pdf.h - 60:
            pdf.add_page()

        pdf.section_title("Model Internal Consistency Analysis")
        pdf.ln(2)

        pdf.add_explanation_box(
            "About Consistency Metrics",
            [
                "The following metrics reflect model stability across EEG segments **within this sample**.",
                "These are **internal consistency checks**, NOT diagnostic accuracy against ground truth.",
                "High consistency indicates stable pattern recognition throughout the recording.",
                "Metrics calculated by comparing segment-level predictions to the overall file prediction."
            ],
            icon_char="",
            bg_color=(240, 248, 255),
            font_size_text=8.5
        )
        pdf.ln(5)

        if consistency_metrics and not consistency_metrics.get('error') and consistency_metrics.get('num_trials', 0) > 0:
            metrics = consistency_metrics

            # Metrics in cards
            col_width = page_width / 2 - 2

            def add_metric_row(metric1_args, metric2_args=None):
                current_y = pdf.get_y()
                pdf.metric_card(*metric1_args)
                if metric2_args:
                    pdf.set_y(current_y)
                    pdf.metric_card(*metric2_args)
                else:
                    # Reset X for next row if only one card
                    pdf.set_x(pdf.l_margin)
                pdf.ln(25)

            add_metric_row(
                ("Overall Accuracy", format_metric_for_pdf(metrics.get('accuracy'), 'percent', 1), "", "Segment agreement rate"),
                ("Segments Analyzed", str(metrics.get('num_trials', 'N/A')), "", "Total EEG segments processed")
            )

            add_metric_row(
                ("Precision (Alz)", format_metric_for_pdf(metrics.get('precision'), 'float', 3), "", "TP/(TP+FP) for Alzheimer's"),
                ("Recall/Sensitivity (Alz)", format_metric_for_pdf(metrics.get('recall_sensitivity'), 'float', 3), "", "TP/(TP+FN) for Alzheimer's")
            )

            add_metric_row(
                ("Specificity (Normal)", format_metric_for_pdf(metrics.get('specificity'), 'float', 3), "", "TN/(TN+FP) for Normal"),
                ("F1-Score (Alz)", format_metric_for_pdf(metrics.get('f1_score'), 'float', 3), "", "Harmonic mean P & R")
            )

            # Confusion Matrix Details
            pdf.set_font('Helvetica', 'B', 10)
            pdf.set_text_color(*pdf.text_color_dark)
            pdf.cell(0, 6, "Confusion Matrix (Internal Consistency):", ln=1)
            pdf.ln(1)

            pdf.set_font('Helvetica', '', 9)
            pdf.set_text_color(*pdf.text_color_light)
            cm_ref = metrics.get('majority_label_used_as_reference', '?')
            cm_ref_label = "Alzheimer's" if cm_ref == 1 else "Normal" if cm_ref == 0 else "Unknown"

            conf_matrix_data = [
                f"Reference Prediction: {cm_ref_label}",
                f"True Positives (TP): {metrics.get('true_positives', 'N/A')} | True Negatives (TN): {metrics.get('true_negatives', 'N/A')}",
                f"False Positives (FP): {metrics.get('false_positives', 'N/A')} | False Negatives (FN): {metrics.get('false_negatives', 'N/A')}"
            ]

            for line in conf_matrix_data:
                pdf.cell(5)
                pdf.cell(0, 5, sanitize_for_helvetica(line), ln=1)

            pdf.set_text_color(*pdf.text_color_normal)
            pdf.ln(3)

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

        # DTW Similarity Analysis
        if pdf.get_y() > pdf.h - 110:
            pdf.add_page()

        pdf.section_title("Dynamic Time Warping (DTW) Similarity Analysis")
        pdf.ln(2)

        if similarity_data and not similarity_data.get('error'):
            classification_type = similarity_data.get('classification_type', 'binary')

            pdf.set_font('Helvetica', '', 9)
            pdf.set_text_color(*pdf.text_color_dark)

            interpretation = similarity_data.get('interpretation', 'No interpretation available.')
            # Remove disclaimer part for technical report
            interpretation_clean = interpretation.split("Disclaimer:")[0].strip()

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
                # Check space before adding image
                if pdf.get_y() > pdf.h - 100:
                    pdf.add_page()

                plotted_ch_idx = similarity_data.get('plotted_channel_index')

                # Different titles based on classification type
                if classification_type == 'multiclass':
                    plot_title = f"DTW Waveform Comparison (CN vs MCI vs AD) - Channel {plotted_ch_idx + 1 if plotted_ch_idx is not None else 'N/A'}"
                else:
                    plot_title = f"DTW Waveform Comparison (Normal vs Alzheimer's) - Channel {plotted_ch_idx + 1 if plotted_ch_idx is not None else 'N/A'}"

                pdf.add_image_section(plot_title, similarity_plot_data)

                # Technical DTW metrics based on classification type
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
                    # Binary classification
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
                pdf.set_font('Helvetica', 'I', 9)
                pdf.set_text_color(*pdf.text_color_light)
                pdf.cell(0, 6, "(Similarity visualization not generated)", ln=1)
                pdf.set_text_color(*pdf.text_color_normal)
        else:
            err_msg = similarity_data.get('error', 'Data not available') if similarity_data else 'Analysis not performed'
            pdf.set_font('Helvetica', 'I', 9)
            pdf.set_text_color(*pdf.text_color_light)
            pdf.cell(0, 6, f"DTW Analysis Error: {err_msg}", ln=1)
            pdf.set_text_color(*pdf.text_color_normal)

        pdf.ln(6)

        # Descriptive Statistics
        if pdf.get_y() > pdf.h - 65:
            pdf.add_page()

        pdf.section_title("EEG Descriptive Statistics & Band Power Analysis")
        pdf.ln(2)

        if stats_data and not stats_data.get('error'):
            # Band Power Analysis
            pdf.set_font('Helvetica', 'B', 10)
            pdf.set_text_color(*pdf.text_color_dark)
            pdf.cell(0, 6, "Average Relative Band Power Distribution:", ln=1)
            pdf.ln(3)

            avg_power = stats_data.get('avg_band_power', {})
            if avg_power:
                # Display in table format
                pdf.set_font('Helvetica', '', 9)

                bands_data = []
                for band_name, powers in avg_power.items():
                    rel_power = powers.get('relative')
                    abs_power = powers.get('absolute')
                    if rel_power is not None:
                        rel_str = format_metric_for_pdf(rel_power, 'percent', 2)
                        abs_str = format_metric_for_pdf(abs_power, 'float', 4) if abs_power is not None else 'N/A'
                        bands_data.append((band_name.capitalize(), rel_str, abs_str))

                if bands_data:
                    # Header
                    pdf.set_font('Helvetica', 'B', 9)
                    pdf.set_fill_color(230, 230, 230)
                    pdf.cell(40, 6, "Band", 1, 0, 'C', True)
                    pdf.cell(50, 6, "Relative Power", 1, 0, 'C', True)
                    pdf.cell(50, 6, "Absolute Power (uV^2)", 1, 1, 'C', True)

                    # Data rows
                    pdf.set_font('Helvetica', '', 9)
                    for band, rel_pwr, abs_pwr in bands_data:
                        pdf.cell(40, 6, band, 1, 0, 'L')
                        pdf.cell(50, 6, rel_pwr, 1, 0, 'C')
                        pdf.cell(50, 6, abs_pwr, 1, 1, 'C')

                    pdf.ln(3)
                else:
                    pdf.set_font('Helvetica', 'I', 9)
                    pdf.set_text_color(*pdf.text_color_light)
                    pdf.cell(0, 5, "(No band power data available)", ln=1)
                    pdf.set_text_color(*pdf.text_color_normal)
            else:
                pdf.set_font('Helvetica', 'I', 9)
                pdf.set_text_color(*pdf.text_color_light)
                pdf.cell(0, 5, "(Band power analysis not available)", ln=1)
                pdf.set_text_color(*pdf.text_color_normal)

            pdf.ln(5)

            # Channel-wise Standard Deviation
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
            err_msg = stats_data.get('error', 'Unknown') if stats_data else 'Not available'
            pdf.set_font('Helvetica', 'I', 9)
            pdf.set_text_color(*pdf.text_color_light)
            pdf.cell(0, 6, f"Statistics Error: {err_msg}", ln=1)
            pdf.set_text_color(*pdf.text_color_normal)

        pdf.ln(6)

        # EEG Visualizations
        if pdf.get_y() > pdf.h - 120:
            pdf.add_page()

        pdf.section_title("EEG Signal Visualizations")
        pdf.ln(2)

        # Check space before first image
        if pdf.get_y() > pdf.h - 100:
            pdf.add_page()

        pdf.add_image_section("Stacked Time Series - Multi-channel EEG Traces", ts_img_data)

        # Check space before second image
        if pdf.get_y() > pdf.h - 95:
            pdf.add_page()

        pdf.add_image_section("Average Power Spectral Density (PSD) - Frequency Domain Analysis", psd_img_data)

        pdf.ln(6)

        # Clinical Interpretation Guidelines
        if pdf.get_y() > pdf.h - 75:
            pdf.add_page()

        pdf.section_title("Clinical Interpretation & Recommendations")
        pdf.ln(2)

        interp_guidelines = [
            ("bullet", "**Algorithmic Support Tool**: This AI analysis serves as a decision support tool and should not replace clinical judgment."),
            ("bullet", "**Clinical Correlation Required**: Results must be interpreted within the full clinical context including patient history, symptoms, cognitive assessments, and other imaging studies."),
            ("bullet", "**Pattern Recognition Limitations**: AI models recognize statistical patterns learned from training data. Unusual presentations may not be accurately classified."),
            ("bullet", "**Quality Considerations**: Analysis assumes adequate signal quality. Artifacts, technical issues, or non-standard montages may affect results."),
            ("bullet", "**Follow-up Recommendations**: Consider correlation with MRI/CT imaging, neuropsychological testing, and longitudinal monitoring as clinically indicated.")
        ]

        pdf.add_explanation_box(
            "Important Clinical Notes",
            interp_guidelines,
            icon_char="",
            bg_color=(255, 250, 240),
            font_size_text=8.5,
            line_h=4.8
        )

        pdf.ln(6)

        # Technical Methodology
        if pdf.get_y() > pdf.h - 65:
            pdf.add_page()

        pdf.section_title("Methodology & Technical Details")
        pdf.ln(2)

        methodology_points = [
            ("bullet", "**AI Model**: Deep learning-based EEG classification using ADformer (Alzheimer's Detection Transformer) architecture."),
            ("bullet", "**Analysis Pipeline**: Multi-trial prediction with majority voting, internal consistency validation, and DTW-based similarity assessment."),
            ("bullet", "**Frequency Analysis**: Band power computation (Delta, Theta, Alpha, Beta, Gamma) using Welch's method with appropriate windowing."),
            ("bullet", "**Signal Processing**: Standard preprocessing including filtering, artifact detection, and normalization per neurophysiological guidelines."),
            ("bullet", "**Reference Database**: Model trained on validated EEG datasets with confirmed clinical diagnoses.")
        ]

        pdf.add_explanation_box(
            "Technical Specifications",
            methodology_points,
            icon_char="",
            bg_color=(248, 248, 255),
            font_size_text=8.5,
            line_h=4.8
        )

        pdf.ln(6)

        # Medical Disclaimer
        pdf.add_medical_disclaimer(disclaimer_type="technical")

        # Signature Section
        pdf.add_signature_section()

        # Report footer
        pdf.set_font('Helvetica', 'I', 8)
        pdf.set_text_color(*pdf.text_color_light)
        pdf.cell(0, 5, "CONFIDENTIAL MEDICAL DOCUMENT - AUTHORIZED PERSONNEL ONLY", 0, 1, 'C')
        pdf.set_text_color(*pdf.text_color_normal)

    except Exception as pdf_build_e:
        print(f"Critical Error building Technical PDF content: {pdf_build_e}")
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
            print(f"Fallback error writing to Technical PDF failed: {pdf_err_fallback}")
