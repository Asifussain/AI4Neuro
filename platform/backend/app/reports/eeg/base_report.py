from fpdf import FPDF, XPos, YPos
from app.reports.eeg.utils import sanitize_for_helvetica
from app.reports import theme
from datetime import datetime
import pandas as pd

class BasePDFReport(FPDF):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.report_title = "EEG Analysis Report"
        # Subtle clinical palette (shared design system — see reports/theme.py)
        self.primary_color = theme.BRAND
        self.secondary_color = theme.BRAND
        self.text_color_dark = theme.INK
        self.text_color_light = theme.MUTED
        self.text_color_normal = theme.INK
        self.line_color = theme.HAIRLINE
        self.card_bg_color = theme.PANEL
        self.highlight_color_alz = theme.DANGER
        self.highlight_color_norm = theme.OK
        self.warning_bg_color = theme.ALERT_FILL
        self.warning_text_color = theme.ALERT_TEXT
        self.page_margin = 15
        self.set_margins(15, 12, 15)
        self.set_auto_page_break(auto=True, margin=16)
        self.set_line_width(0.2)
        # Store comprehensive report data
        self.comprehensive_data = None

    def _theme_sanitize(self, text):
        return sanitize_for_helvetica(text)

    def _is_bold_font(self):
        return 'B' in self.font_style

    def cell(self, w, h=0, txt="", border=0, ln=0, align="", fill=False, link=""):
        txt_to_render = sanitize_for_helvetica(txt)
        super().cell(w, h, txt_to_render, border, ln, align, fill, link)

    def multi_cell(self, w, h, txt="", border=0, align="J", fill=False, max_line_height=0, new_x=XPos.START, new_y=YPos.TOP):
        txt_to_render = sanitize_for_helvetica(txt)
        if max_line_height == 0: max_line_height = h
        super().multi_cell(w, h, txt_to_render, border, align, fill, max_line_height=max_line_height, new_x=new_x, new_y=new_y)

    def write(self, h, txt="", link=""):
        txt_to_render = sanitize_for_helvetica(txt)
        super().write(h, txt_to_render, link)

    def header(self):
        theme.draw_letterhead(self, subtitle=self.report_title)

    def footer(self):
        theme.draw_footer(self)

    def section_title(self, title_text: str):
        theme.section_heading(self, title_text)

    def key_value_pair(self, key: str, value, key_width=50):
        theme.key_value(self, key, value, key_width=key_width)

    def write_multiline(self, text: str, height=5, indent=5):
        try:
            self.set_font('Helvetica', '', 10)
            self.set_text_color(80, 80, 80)
            self.set_left_margin(self.l_margin + indent)
            self.multi_cell(0, height, sanitize_for_helvetica(text), align='L', new_x=XPos.LMARGIN, new_y=YPos.NEXT, max_line_height=self.font_size)
            self.set_left_margin(self.l_margin)
            self.ln(height / 2)
            self.set_text_color(*self.text_color_normal)
        except Exception as e:
            print(f"PDF Multiline Error: {e}")

    def metric_card(self, title: str, value, unit: str = "", description: str = ""):
        try:
            start_x = self.get_x()
            start_y = self.get_y()
            card_width = (self.w - self.l_margin - self.r_margin - 6) / 2
            card_height = 22

            # Draw card background
            self.set_fill_color(*theme.PANEL)
            self.set_draw_color(*theme.HAIRLINE)
            self.set_line_width(0.3)
            self.rect(start_x, start_y, card_width, card_height, 'DF')

            # Title
            self.set_xy(start_x + 3, start_y + 2)
            self.set_font('Helvetica', 'B', 8)
            self.set_text_color(70, 70, 70)
            self.cell(card_width - 6, 4, sanitize_for_helvetica(title.upper()), 0, 0, 'L')

            # Value
            self.set_xy(start_x + 3, start_y + 8)
            self.set_font('Helvetica', 'B', 14)
            self.set_text_color(*self.secondary_color)
            value_str = f"{sanitize_for_helvetica(str(value))}{sanitize_for_helvetica(str(unit))}"
            self.cell(card_width - 6, 7, value_str, 0, 0, 'C')

            # Description
            if description:
                self.set_xy(start_x + 3, start_y + 16)
                self.set_font('Helvetica', '', 7)
                self.set_text_color(*self.text_color_light)
                self.cell(card_width - 6, 4, sanitize_for_helvetica(description), 0, 0, 'L')

            # Position for next card. NOTE: fpdf2's set_y() always resets x to
            # l_margin as a side effect, so set_xy (not set_y then set_x) is
            # required here to preserve the horizontal offset for a 2nd card.
            self.set_xy(start_x + card_width + 6, start_y)
            self.set_text_color(*self.text_color_normal)
            self.set_line_width(0.2)
        except Exception as e:
            print(f"PDF Metric Card Error for title '{title}': {e}")

    def write_paragraph(self, text, height=4, indent=0, font_style='', font_size=8.5, text_color=None, bullet_char_override=None):
        try:
             self.set_font('Helvetica', font_style, font_size)
             current_text_color = text_color if text_color else self.text_color_dark
             self.set_text_color(*current_text_color)
             current_x_start = self.l_margin + indent
             self.set_x(current_x_start)
             sanitized_text = sanitize_for_helvetica(text)
             if bullet_char_override:
                 safe_bullet = sanitize_for_helvetica(bullet_char_override)
                 original_font_family, original_font_size, original_font_style = self.font_family, self.font_size_pt, self.font_style
                 self.set_font('Helvetica', 'B', font_size)
                 self.cell(self.get_string_width(safe_bullet) + 0.5, height, safe_bullet, ln=0)
                 self.set_font(original_font_family, original_font_style, original_font_size)
                 self.set_x(current_x_start + self.get_string_width(safe_bullet) + 1.5)
                 self.multi_cell(self.w - self.get_x() - self.r_margin, height, sanitized_text, align='L', new_x=XPos.LMARGIN, new_y=YPos.NEXT, max_line_height=self.font_size)
             else:
                 self.multi_cell(0, height, sanitized_text, align='L', new_x=XPos.LMARGIN, new_y=YPos.NEXT, max_line_height=self.font_size)
             self.ln(height / 4)
             self.set_text_color(*self.text_color_normal)
        except Exception as e:
            print(f"PDF write_paragraph Error: {e}")

    def add_image_section(self, title: str, image_data_base64: str):
        import base64
        import io
        from PIL import Image

        # Check if we need a new page BEFORE doing anything
        if self.get_y() > self.h - 100:  # Conservative check - images need lots of space
            self.add_page()

        if title:
            self.set_font('Helvetica', 'B', 9)
            self.set_text_color(*self.text_color_dark)
            self.cell(0, 6, sanitize_for_helvetica(title), ln=1, align='L')
            self.ln(2)

        if image_data_base64 and isinstance(image_data_base64, str) and image_data_base64.startswith('data:image/png;base64,'):
            try:
                img_bytes = base64.b64decode(image_data_base64.split(',', 1)[1])
                img_file = io.BytesIO(img_bytes)

                # Get ACTUAL image dimensions
                try:
                    pil_img = Image.open(io.BytesIO(img_bytes))
                    img_width_px, img_height_px = pil_img.size
                    pil_img.close()
                except:
                    # Fallback if PIL fails
                    img_width_px, img_height_px = 800, 600

                # Calculate display dimensions maintaining aspect ratio
                page_content_width = self.w - 2 * self.page_margin
                img_display_width = page_content_width * 0.90  # 90% of page width

                # Calculate actual height based on aspect ratio
                aspect_ratio = img_height_px / img_width_px if img_width_px > 0 else 0.75
                img_display_height = img_display_width * aspect_ratio

                # Check if image fits on current page
                if self.get_y() + img_display_height > self.h - self.b_margin - 5:
                    self.add_page()

                x_pos = self.l_margin + (page_content_width - img_display_width) / 2
                current_y = self.get_y()

                # Add image
                img_file.seek(0)
                self.image(img_file, x=x_pos, y=current_y, w=img_display_width)
                img_file.close()

                # Move Y position past the ACTUAL image height
                self.set_y(current_y + img_display_height + 2)
                self.ln(3)
            except Exception as e:
                error_text = f"(Error embedding image '{sanitize_for_helvetica(title)}': {sanitize_for_helvetica(str(e)[:50])})"
                self.write_paragraph(error_text, font_style='I')
                print(f"PDF Image Embed Error for '{title}': {e}")
                import traceback
                traceback.print_exc()
        else:
            if title:
                 self.write_paragraph(sanitize_for_helvetica("(Image data not available)"), font_style='I', indent=5)
        self.ln(2)

    def add_explanation_box(self, title: str, text_lines: list, icon_char: str = "",
                            bg_color=None, title_color=None, text_color_override=None,
                            font_size_text=9, line_h=5.5):
        # Delegates to the shared clinical panel style (see reports/theme.py).
        theme.info_panel(self, title, text_lines)

    def calculate_age(self, date_of_birth):
        """Calculate age from date of birth"""
        if not date_of_birth:
            return None
        try:
            if isinstance(date_of_birth, str):
                dob = pd.to_datetime(date_of_birth).date()
            else:
                dob = date_of_birth
            today = datetime.now().date()
            age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
            return age
        except Exception as e:
            print(f"Error calculating age: {e}")
            return None

    def format_date(self, date_input, format_type='full'):
        """Format date in medical standard format"""
        if not date_input:
            return 'N/A'
        try:
            if isinstance(date_input, str):
                dt_obj = pd.to_datetime(date_input)
            else:
                dt_obj = date_input

            if format_type == 'full':
                return dt_obj.strftime('%d %B %Y, %H:%M')
            elif format_type == 'date_only':
                return dt_obj.strftime('%d %B %Y')
            elif format_type == 'time_only':
                return dt_obj.strftime('%H:%M:%S')
            else:
                return dt_obj.strftime('%Y-%m-%d %H:%M:%S')
        except Exception as e:
            print(f"Error formatting date: {e}")
            return str(date_input) if date_input else 'N/A'

    def add_hospital_header(self, hospital_data):
        """Branding is rendered by the shared letterhead (reports/theme.py); the
        facility name is surfaced inside the encounter grid instead. Retained for
        API compatibility with the report builders."""
        return

    def add_report_metadata_section(self, report_type="EEG Analysis"):
        """No-op: the report subtitle and date are shown in the letterhead.
        Retained for API compatibility with the report builders."""
        return

    def _session_date_only(self):
        session = (self.comprehensive_data or {}).get('session') or {}
        raw = session.get('scan_date') or session.get('session_date')
        return self.format_date(raw, 'date_only') if raw else datetime.now().strftime('%d %B %Y')

    def add_patient_demographics_section(self):
        """Render the patient / encounter demographics as a bordered grid."""
        if not self.comprehensive_data:
            return

        patient = self.comprehensive_data.get('patient') or {}
        patient_profile = self.comprehensive_data.get('patient_profile') or {}
        hospital = self.comprehensive_data.get('hospital') or {}
        doctor = self.comprehensive_data.get('doctor') or {}
        session = self.comprehensive_data.get('session') or {}

        if not patient:
            return

        try:
            self.section_title("Patient Demographics & Encounter")

            dob = patient.get('date_of_birth') or patient_profile.get('date_of_birth')
            if dob:
                age = self.calculate_age(dob)
                dob_str = f"{self.format_date(dob, 'date_only')}"
                if age:
                    dob_str += f"  (Age {age})"
            else:
                dob_str = "-"

            gender = patient_profile.get('gender') or patient.get('gender') or "-"
            patient_id = patient.get('unique_identifier') or patient_profile.get('patient_code') or "-"

            items = [
                ("Patient Name", patient.get('full_name')),
                ("Date of Birth / Age", dob_str),
                ("Sex", gender),
                ("MRN / Patient ID", patient_id),
                ("Date of Assessment", self._session_date_only()),
                ("Status", "COMPLETED"),
                ("Referring Facility", hospital.get('name')),
                ("Ordering Provider", doctor.get('full_name')),
                ("Accession No.", session.get('session_code')),
            ]
            theme.demographics_grid(self, items, ncols=3)

            # Long / optional fields below the grid as clean key-value rows.
            address = patient.get('address')
            if address and str(address).strip() and address != 'N/A':
                self.key_value_pair("Address", address, key_width=46)

            contact_bits = []
            if patient.get('phone') and patient.get('phone') != 'N/A':
                contact_bits.append(str(patient['phone']))
            if patient.get('email') and patient.get('email') != 'N/A':
                contact_bits.append(str(patient['email']))
            if contact_bits:
                self.key_value_pair("Contact", "  |  ".join(contact_bits), key_width=46)

            blood_group = self.comprehensive_data.get('blood_group')
            if blood_group and blood_group != 'N/A':
                self.key_value_pair("Blood Group", blood_group, key_width=46)

            ec_name = patient_profile.get('emergency_contact_name')
            ec_phone = patient_profile.get('emergency_contact_phone')
            if ec_name or ec_phone:
                self.key_value_pair("Emergency Contact", f"{ec_name or '-'}, {ec_phone or '-'}", key_width=46)

            self.ln(2)
        except Exception as e:
            print(f"Error adding patient demographics: {e}")

    def add_medical_professional_info(self, role="doctor"):
        """Add doctor or radiologist information"""
        if not self.comprehensive_data:
            return

        try:
            if role == "doctor":
                user_data = self.comprehensive_data.get('doctor')
                profile_data = self.comprehensive_data.get('doctor_profile')
                qualification_data = self.comprehensive_data.get('doctor_qualification')
                title = "Referring Physician / Doctor Information"
            elif role == "radiologist":
                user_data = self.comprehensive_data.get('radiologist')
                profile_data = self.comprehensive_data.get('radiologist_profile')
                qualification_data = self.comprehensive_data.get('radiologist_qualification')
                title = "Analyzed By (EEG Technician / Radiologist)"
            else:
                return

            if not user_data:
                return

            # Check if we have enough space
            if self.get_y() > self.h - 50:
                self.add_page()

            self.section_title(title)

            # Name
            full_name = user_data.get('full_name', 'N/A')
            self.key_value_pair("Name", full_name, key_width=45)

            if profile_data:
                # License Number
                if role == "doctor":
                    license_num = profile_data.get('medical_license')
                    if license_num:
                        self.key_value_pair("Medical License", license_num, key_width=45)
                else:
                    license_num = profile_data.get('radiologist_license')
                    if license_num:
                        self.key_value_pair("License Number", license_num, key_width=45)

                # Qualification
                if qualification_data:
                    qual_name = qualification_data.get('qualification_name', '')
                    specialization = qualification_data.get('specialization', '')
                    if qual_name:
                        qual_display = f"{qual_name} ({specialization})" if specialization else qual_name
                        self.key_value_pair("Qualification", qual_display, key_width=45)

                # Specialization for doctors
                if role == "doctor":
                    specialization = profile_data.get('specialization')
                    if specialization:
                        self.key_value_pair("Specialization", specialization, key_width=45)

                    experience_years = profile_data.get('experience_years')
                    if experience_years:
                        self.key_value_pair("Experience", f"{experience_years} years", key_width=45)
                else:
                    # For radiologist
                    imaging_expertise = profile_data.get('imaging_expertise')
                    if imaging_expertise:
                        self.key_value_pair("Expertise", imaging_expertise, key_width=45)

                    experience_years = profile_data.get('experience_years')
                    if experience_years:
                        self.key_value_pair("Experience", f"{experience_years} years", key_width=45)

            # Contact
            phone = user_data.get('phone')
            if phone:
                self.key_value_pair("Phone", phone, key_width=45)

            self.ln(3)
        except Exception as e:
            print(f"Error adding medical professional info: {e}")

    def add_session_technical_details(self):
        """Add EEG session technical information"""
        if not self.comprehensive_data:
            return

        session_data = self.comprehensive_data.get('session')
        prediction_data = self.comprehensive_data.get('prediction')

        if not session_data and not prediction_data:
            return

        try:
            # Check if we have enough space, otherwise add page
            if self.get_y() > self.h - 60:
                self.add_page()

            self.section_title("EEG Recording Details")

            # Session Code
            session_code = None
            if session_data:
                session_code = session_data.get('session_code')
            elif prediction_data:
                session_code = prediction_data.get('session_code')

            if session_code:
                self.key_value_pair("Session Code", session_code, key_width=45)

            # Session Date
            session_date = None
            if session_data:
                session_date = session_data.get('session_date')
            elif prediction_data:
                session_date = prediction_data.get('created_at')

            if session_date:
                formatted_date = self.format_date(session_date, 'full')
                self.key_value_pair("Recording Date", formatted_date, key_width=45)

            # Filename
            if prediction_data:
                filename = prediction_data.get('filename', 'N/A')
                self.key_value_pair("Data File", filename, key_width=45)

            if session_data:
                # Duration
                duration = session_data.get('session_duration')
                if duration:
                    duration_str = f"{duration} seconds" if isinstance(duration, (int, float)) else str(duration)
                    self.key_value_pair("Duration", duration_str, key_width=45)

                # Sampling Rate
                sampling_rate = session_data.get('sampling_rate')
                if sampling_rate:
                    self.key_value_pair("Sampling Rate", f"{sampling_rate} Hz", key_width=45)

                # Electrodes Used
                electrodes = session_data.get('electrodes_used')
                if electrodes:
                    if isinstance(electrodes, list):
                        electrode_str = ", ".join([str(e) for e in electrodes])
                    else:
                        electrode_str = str(electrodes)
                    self.key_value_pair("Electrodes", electrode_str, key_width=45)

                # Session Notes
                notes = session_data.get('session_notes')
                if notes and str(notes).strip():
                    self.key_value_pair("Notes", notes, key_width=45)

            self.ln(3)
        except Exception as e:
            print(f"Error adding session details: {e}")

    def add_medical_disclaimer(self, disclaimer_type="standard"):
        """Add professional medical disclaimer"""
        try:
            self.ln(2)
            start_y = self.get_y()

            # Check if we need a new page
            if start_y > self.h - 55:
                self.add_page()
                start_y = self.get_y()

            self.set_fill_color(255, 250, 240)
            self.set_draw_color(200, 200, 200)

            disclaimers = {
                "standard": [
                    "This report contains information generated by AI-assisted analysis of EEG data and is intended for use by qualified healthcare professionals only.",
                    "This report does NOT constitute a medical diagnosis. All findings must be interpreted within the complete clinical context by a licensed medical practitioner.",
                    "The AI model provides pattern recognition support and should be used as an adjunct to, not a replacement for, clinical judgment and comprehensive patient evaluation.",
                    "Results should be correlated with patient history, physical examination, and other diagnostic procedures as clinically indicated."
                ],
                "patient": [
                    "This report is for informational purposes and to facilitate discussion with your healthcare provider.",
                    "The information contained herein is NOT a medical diagnosis and should not be used for self-diagnosis or self-treatment.",
                    "Always consult with your doctor or qualified healthcare professional before making any health-related decisions.",
                    "Your doctor will interpret these results in the context of your complete medical history and other clinical findings."
                ],
                "technical": [
                    "This technical report is intended for qualified medical professionals and EEG specialists.",
                    "Analysis performed using validated AI algorithms. Results represent statistical pattern recognition and require clinical correlation.",
                    "Methodology: Deep learning-based EEG classification with DTW similarity analysis against reference datasets.",
                    "Quality control measures and artifact rejection protocols were applied according to standard neurophysiological guidelines."
                ],
                "comprehensive": [
                    "This report contains AI-assisted analysis of EEG data, including clinical, technical and plain-language summaries, for the referring clinician, care team and patient/family.",
                    "This report does NOT constitute a medical diagnosis. All findings must be interpreted within the complete clinical context by a licensed medical practitioner.",
                    "The AI model provides statistical pattern-recognition support and should be used as an adjunct to, not a replacement for, clinical judgment and comprehensive evaluation.",
                    "Patients: the information in this report is not a diagnosis and should not be used for self-diagnosis or self-treatment. Please discuss these results with your doctor.",
                    "Results should be correlated with patient history, physical examination, cognitive assessment and other diagnostic procedures as clinically indicated."
                ]
            }

            disclaimer_text = disclaimers.get(disclaimer_type, disclaimers["standard"])
            theme.disclaimer(self, disclaimer_text)
        except Exception as e:
            print(f"Error adding disclaimer: {e}")

    def add_signature_section(self):
        """Add electronic-signature block for the reporting professional."""
        try:
            radiologist = self.comprehensive_data.get('radiologist') if self.comprehensive_data else None
            name = (radiologist or {}).get('full_name', 'Authorized Personnel')
            theme.signature(self, name, role="EEG Technician / Radiologist",
                            date_str=datetime.now().strftime('%d %b %Y'))
        except Exception as e:
            print(f"Error adding signature section: {e}")
