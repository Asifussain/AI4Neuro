import pandas as pd
import traceback
from fpdf import XPos, YPos
from .base_report import BasePDFReport
from app.reports.eeg.utils import sanitize_for_helvetica
from .technical_report import format_metric_for_pdf

class PatientPDFReport(BasePDFReport):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.report_title = "EEG Pattern Analysis Report - Patient Copy"
        self.primary_color = (74, 144, 226)
        self.highlight_color_alz = (231, 76, 60)
        self.highlight_color_norm = (46, 204, 113)

def build_patient_pdf_report_content(pdf: PatientPDFReport, comprehensive_data,
                                     similarity_data, consistency_metrics,
                                     similarity_plot_data):
    """
    Build patient-friendly PDF report with comprehensive medical information

    Args:
        pdf: PatientPDFReport instance
        comprehensive_data: Dict with all medical data (hospital, patient, doctor, radiologist, prediction, session)
        similarity_data: Similarity analysis results
        consistency_metrics: Model consistency metrics
        similarity_plot_data: Base64 encoded similarity plot
    """
    try:
        # Store comprehensive data in PDF object for use by utility methods
        pdf.comprehensive_data = comprehensive_data
        prediction_data = comprehensive_data.get('prediction', {})
        hospital_data = comprehensive_data.get('hospital')

        pdf.add_page()

        # Professional Hospital Header
        if hospital_data:
            pdf.add_hospital_header(hospital_data)

        # Report Metadata Section
        pdf.add_report_metadata_section("EEG PATTERN ANALYSIS REPORT")
        pdf.ln(2)

        # Patient Demographics
        pdf.add_patient_demographics_section()

        # Referring Doctor Information
        pdf.add_medical_professional_info(role="doctor")

        # EEG Session Details
        pdf.add_session_technical_details()

        # Analysis performed by
        pdf.add_medical_professional_info(role="radiologist")

        # Main Findings Section - Force new page for clean layout
        pdf.add_page()
        pdf.section_title("Analysis Results & Findings")
        pdf.ln(2)

        prediction_label = prediction_data.get('prediction', 'Not Determined')
        pred_display_text = "Pattern assessment inconclusive"
        pred_color = pdf.text_color_dark
        interpretation_text = ""

        if prediction_label == "Alzheimer's" or prediction_label == "AD":
            pred_display_text = "Patterns Suggestive of Alzheimer's Characteristics"
            pred_color = pdf.highlight_color_alz
            interpretation_text = "The AI analysis found brain wave patterns that are similar to those typically seen in individuals with Alzheimer's disease."
        elif prediction_label == "MCI":
            pred_display_text = "Patterns Suggestive of Mild Cognitive Impairment"
            pred_color = (243, 156, 18)  # Orange color for MCI
            interpretation_text = "The AI analysis found brain wave patterns that are similar to those seen in individuals with Mild Cognitive Impairment (MCI), which represents early changes in brain activity."
        elif prediction_label == "Normal" or prediction_label == "CN":
            pred_display_text = "Normal Brainwave Patterns Observed"
            pred_color = pdf.highlight_color_norm
            interpretation_text = "The AI analysis found brain wave patterns that are similar to typical healthy brain activity."

        pdf.set_font('Helvetica', 'B', 9)
        pdf.set_text_color(*pdf.text_color_dark)
        pdf.cell(0, 6, "Primary Finding:", 0, 1, 'L')
        pdf.ln(3)

        # Finding Box
        box_x = pdf.l_margin
        box_y = pdf.get_y()
        box_width = pdf.w - pdf.l_margin - pdf.r_margin
        box_height = 11

        pdf.set_draw_color(*pred_color)
        pdf.set_line_width(0.7)
        pdf.rect(box_x, box_y, box_width, box_height, 'D')
        pdf.set_line_width(0.2)

        pdf.set_font('Helvetica', 'B', 10)
        pdf.set_text_color(*pred_color)
        pdf.set_xy(box_x, box_y + 3)
        pdf.cell(box_width, 5, pred_display_text, 0, 0, 'C')

        pdf.set_y(box_y + box_height + 3)
        pdf.set_text_color(*pdf.text_color_normal)

        # Interpretation
        if interpretation_text:
            pdf.set_font('Helvetica', '', 9)
            pdf.set_text_color(*pdf.text_color_dark)
            pdf.multi_cell(0, 6, sanitize_for_helvetica(interpretation_text), align='L', max_line_height=6)
            pdf.ln(8)

        # Model Confidence Level
        probabilities = prediction_data.get('probabilities')
        if isinstance(probabilities, list):
            try:
                if len(probabilities) == 2:
                    # Binary classification
                    conf_val_idx = 1 if prediction_label == "Alzheimer's" else 0
                    conf_val = probabilities[conf_val_idx] * 100
                elif len(probabilities) == 3:
                    # Multiclass classification
                    label_map = {"CN": 0, "MCI": 1, "AD": 2}
                    conf_val_idx = label_map.get(prediction_label, 0)
                    conf_val = probabilities[conf_val_idx] * 100
                else:
                    conf_val = None

                if conf_val is not None:
                    pdf.set_font('Helvetica', 'B', 9)
                    pdf.set_text_color(*pdf.primary_color)
                    pdf.cell(0, 6, "Model Confidence Level:", 0, 1, 'L')
                    pdf.ln(2)

                    pdf.set_font('Helvetica', '', 9)
                    pdf.set_text_color(*pdf.text_color_normal)
                    confidence_text = f"The AI model is {conf_val:.1f}% confident in this finding based on EEG pattern analysis."
                    pdf.multi_cell(0, 5.5, sanitize_for_helvetica(confidence_text), align='L')
                    pdf.ln(5)
            except Exception as e:
                print(f"Error formatting confidence: {e}")

        # Internal Consistency Check
        if pdf.get_y() > pdf.h - 65:
            pdf.add_page()

        pdf.ln(4)
        pdf.set_font('Helvetica', 'B', 9)
        pdf.set_text_color(*pdf.secondary_color)
        pdf.cell(0, 6, "How Reliable is This Finding?", 0, 1, 'L')
        pdf.ln(3)

        if consistency_metrics and not consistency_metrics.get('error') and isinstance(consistency_metrics.get('num_trials'), int) and consistency_metrics.get('num_trials', 0) > 0:
            num_segments = consistency_metrics.get('num_trials', 'multiple')
            accuracy_val = format_metric_for_pdf(consistency_metrics.get('accuracy'), 'percent', 0)

            pdf.set_font('Helvetica', '', 10)
            pdf.set_text_color(*pdf.text_color_normal)

            consistency_explanation = [
                f"To verify its findings, the AI analyzed your EEG data in **{num_segments} smaller segments**.",
                f"The AI found **consistent patterns** in {accuracy_val} of these segments.",
                "Higher consistency suggests the finding is more stable across your entire brain wave recording.",
                ("bullet", "A high consistency score (>85%) indicates the pattern was consistently present throughout the recording."),
                ("bullet", "A moderate score (70-85%) suggests the pattern was present but with some variation."),
                ("bullet", "A lower score (<70%) may indicate inconsistent patterns and should be interpreted with caution.")
            ]

            pdf.add_explanation_box(
                "Understanding Consistency",
                consistency_explanation,
                icon_char="",
                bg_color=(248, 252, 255),
                font_size_text=9
            )
        else:
            pdf.set_font('Helvetica', 'I', 9)
            pdf.set_text_color(*pdf.text_color_light)
            pdf.cell(0, 6, "Detailed consistency metrics not available for this analysis.", 0, 1, 'L')
            pdf.set_text_color(*pdf.text_color_normal)

        pdf.ln(10)

        # Brainwave Shape Comparison - ensure enough space for title + description + image
        if pdf.get_y() > pdf.h - 130:
            pdf.add_page()

        if similarity_data and not similarity_data.get('error') and similarity_plot_data:
            classification_type = similarity_data.get('classification_type', 'binary')

            pdf.section_title("How Your Brain Waves Compare")
            pdf.ln(2)

            pdf.set_font('Helvetica', '', 9)
            pdf.set_text_color(*pdf.text_color_normal)

            if classification_type == 'multiclass':
                comparison_text = (
                    "The AI compared the shape and pattern of your brain waves to three reference patterns from previous studies: "
                    "Normal (CN), Mild Cognitive Impairment (MCI), and Alzheimer's Disease (AD). "
                    "This helps verify the main finding by looking at how similar your brain wave patterns are to each known pattern."
                )
            else:
                comparison_text = (
                    "The AI compared the shape and pattern of your brain waves to reference patterns from previous studies. "
                    "This helps verify the main finding by looking at how similar your brain wave patterns are to known patterns."
                )

            pdf.multi_cell(0, 5.5, sanitize_for_helvetica(comparison_text), align='L')
            pdf.ln(8)

            plotted_ch_idx = similarity_data.get('plotted_channel_index')
            plot_title = f"Brain Wave Pattern Comparison (Channel {plotted_ch_idx + 1 if plotted_ch_idx is not None else 'Selected'})"
            pdf.add_image_section(plot_title, similarity_plot_data)

            # Similarity interpretation
            overall_sim = similarity_data.get('overall_similarity', '')
            if overall_sim:
                pdf.ln(2)
                pdf.set_font('Helvetica', '', 9)
                pdf.set_text_color(*pdf.text_color_dark)

                # Handle both binary and multiclass interpretations
                if "Higher Similarity to AD Pattern" in overall_sim:
                    sim_text = "Your brain wave patterns showed greater similarity to the Alzheimer's Disease (AD) reference patterns."
                elif "Higher Similarity to MCI Pattern" in overall_sim:
                    sim_text = "Your brain wave patterns showed greater similarity to the Mild Cognitive Impairment (MCI) reference patterns."
                elif "Higher Similarity to CN Pattern" in overall_sim:
                    sim_text = "Your brain wave patterns showed greater similarity to the Cognitively Normal (CN) reference patterns."
                elif "Higher Similarity to Alzheimer's Pattern" in overall_sim:
                    sim_text = "Your brain wave patterns showed greater similarity to the Alzheimer's reference patterns."
                elif "Higher Similarity to Normal Pattern" in overall_sim:
                    sim_text = "Your brain wave patterns showed greater similarity to the normal healthy brain reference patterns."
                else:
                    sim_text = "Your brain wave patterns showed mixed similarity when compared to reference patterns."

                pdf.multi_cell(0, 5.5, sanitize_for_helvetica(sim_text), align='L')
                pdf.ln(5)
        else:
            pdf.section_title("Brain Wave Pattern Comparison")
            pdf.set_font('Helvetica', 'I', 9)
            pdf.set_text_color(*pdf.text_color_light)
            pdf.cell(0, 6, "Brainwave shape comparison visualization is not available for this report.", 0, 1, 'L')
            pdf.set_text_color(*pdf.text_color_normal)

        pdf.ln(8)

        # What Do These Results Mean?
        if pdf.get_y() > pdf.h - 85:
            pdf.add_page()

        pdf.section_title("What Do These Results Mean For Me?")
        pdf.ln(2)

        meaning_points = [
            ("bullet", "**This is NOT a diagnosis** - Only your doctor can diagnose medical conditions after considering your complete medical history, symptoms, and other tests."),
            ("bullet", "**This is a screening tool** - The AI helps identify brain wave patterns that may need further medical evaluation."),
            ("bullet", f"**Your result: {pred_display_text}** - This means the AI found patterns in your brain waves that are similar to the indicated category."),
            ("bullet", "**Further evaluation may be needed** - Your doctor will determine if additional tests or follow-up appointments are necessary."),
        ]

        pdf.add_explanation_box(
            "Important Points",
            meaning_points,
            icon_char="",
            bg_color=(255, 250, 240),
            title_color=(184, 134, 11)
        )

        pdf.ln(6)

        # Next Steps
        if pdf.get_y() > pdf.h - 75:
            pdf.add_page()

        pdf.section_title("Your Next Steps")
        pdf.ln(2)

        pdf.set_font('Helvetica', 'B', 10)
        pdf.set_text_color(*pdf.text_color_dark)
        pdf.cell(0, 6, "What Should I Do Now?", 0, 1, 'L')
        pdf.ln(2)

        next_steps = [
            ("bullet", "**Schedule an appointment** with your doctor to discuss these results in detail."),
            ("bullet", "**Bring this report** to your doctor's appointment for their review."),
            ("bullet", "**Prepare questions** about what these findings mean for your health and care plan."),
            ("bullet", "**Follow your doctor's advice** regarding any additional tests or treatment recommendations."),
            ("bullet", "**Don't panic** - Many factors affect brain wave patterns, and your doctor will provide proper context.")
        ]

        pdf.add_explanation_box(
            "",
            next_steps,
            icon_char="",
            bg_color=(240, 255, 240),
            font_size_text=9.5
        )

        pdf.ln(6)

        # Questions to Ask Your Doctor
        if pdf.get_y() > pdf.h - 75:
            pdf.add_page()

        pdf.set_font('Helvetica', 'B', 10)
        pdf.set_text_color(*pdf.secondary_color)
        pdf.cell(0, 6, "Suggested Questions for Your Doctor:", 0, 1, 'L')
        pdf.ln(3)

        questions = [
            "What do these EEG results mean in the context of my symptoms and medical history?",
            "Do I need any additional tests or evaluations?",
            "What are the next steps in my care plan?",
            "Are there any lifestyle changes or treatments you recommend?",
            "How often should I have follow-up appointments?",
            "Should family members be concerned or get tested?"
        ]

        pdf.set_font('Helvetica', '', 9)
        pdf.set_text_color(*pdf.text_color_dark)
        for i, question in enumerate(questions, 1):
            # Check space before each question
            if pdf.get_y() > pdf.h - 25:
                pdf.add_page()

            current_y = pdf.get_y()
            pdf.set_xy(pdf.l_margin, current_y)
            pdf.cell(8, 5.5, f"{i}.", 0, 0, 'L')
            pdf.set_x(pdf.l_margin + 8)
            pdf.multi_cell(pdf.w - pdf.l_margin - pdf.r_margin - 8, 5.5, sanitize_for_helvetica(question), align='L', new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            pdf.ln(1)

        pdf.ln(6)

        # Medical Disclaimer
        pdf.add_medical_disclaimer(disclaimer_type="patient")

        # Signature Section
        pdf.add_signature_section()

        # Footer note
        pdf.set_font('Helvetica', 'I', 8)
        pdf.set_text_color(*pdf.text_color_light)
        pdf.cell(0, 5, "This is an official medical report. Please keep it for your records.", 0, 1, 'C')
        pdf.set_text_color(*pdf.text_color_normal)

    except Exception as e:
        print(f"Critical Error building Patient PDF content: {e}")
        traceback.print_exc()
        try:
            if pdf.page_no() == 0:
                pdf.add_page()
            elif pdf.get_y() > pdf.h - 30:
                pdf.add_page()

            pdf.set_font("Helvetica", 'B', 12)
            pdf.set_text_color(255, 0, 0)
            x = pdf.get_x()
            y = pdf.get_y()
            pdf.rect(x + 5, y, pdf.w - 20, 25, 'D')
            pdf.set_xy(x + 10, y + 5)
            pdf.cell(pdf.w - 30, 8, "Critical Error Building PDF Content:", 0, 1, 'C')
            pdf.set_xy(x + 10, y + 12)
            pdf.set_font("Helvetica", '', 10)
            pdf.cell(pdf.w - 30, 8, sanitize_for_helvetica(str(e)), 0, 1, 'C')
            pdf.set_text_color(*pdf.text_color_normal)
        except Exception as pdf_err_fallback:
            print(f"Fallback error writing to Patient PDF failed: {pdf_err_fallback}")
