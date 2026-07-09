from fpdf import FPDF, XPos, YPos
from app.reports.eeg.utils import sanitize_for_helvetica
from datetime import datetime
import pandas as pd

class BasePDFReport(FPDF):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.report_title = "EEG Analysis Report"
        self.primary_color = (52, 73, 94)
        self.secondary_color = (74, 144, 226)
        self.text_color_dark = (30, 30, 30)
        self.text_color_light = (100, 100, 100)
        self.text_color_normal = (0,0,0)
        self.line_color = (220, 220, 220)
        self.card_bg_color = (248, 249, 250)
        self.highlight_color_alz = (220, 60, 60)
        self.highlight_color_norm = (60, 179, 113)
        self.warning_bg_color = (255, 243, 205)
        self.warning_text_color = (133, 100, 4)
        self.page_margin = 15
        self.set_auto_page_break(auto=True, margin=self.page_margin)
        self.set_line_width(0.2)
        # Store comprehensive report data
        self.comprehensive_data = None

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
        try:
            self.set_font('Helvetica', 'B', 15)
            title = sanitize_for_helvetica(self.report_title)
            title_w = self.get_string_width(title) + 6
            doc_w = self.w
            self.set_x((doc_w - title_w) / 2)
            self.set_text_color(*self.secondary_color)
            self.cell(title_w, 10, title, border=0, align='C', ln=1)
            self.set_text_color(*self.text_color_normal)
            self.ln(5)
            self.set_draw_color(*self.line_color)
            self.line(self.l_margin, self.get_y(), self.w - self.r_margin, self.get_y())
            self.ln(8)
        except Exception as e:
            print(f"PDF Header Error: {e}")

    def footer(self):
        try:
            self.set_y(-15)
            self.set_font('Helvetica', 'I', 8)
            self.set_text_color(128, 128, 128)
            self.cell(0, 10, f'Page {self.page_no()}/{{nb}}', align='C')
            self.set_text_color(*self.text_color_normal)
        except Exception as e:
            print(f"PDF Footer Error: {e}")

    def section_title(self, title_text: str):
        try:
            # Prevent orphaned section titles - ensure at least 30mm space after title
            if self.get_y() > self.h - 40:
                self.add_page()

            self.set_font('Helvetica', 'B', 12)
            self.set_fill_color(80, 227, 194)
            self.set_text_color(10, 15, 26)
            self.cell(0, 9, " " + sanitize_for_helvetica(title_text), border='B', align='L', fill=True, ln=1)
            self.set_text_color(*self.text_color_normal)
            self.ln(5)
        except Exception as e:
            print(f"PDF Section Title Error for '{title_text}': {e}")

    def key_value_pair(self, key: str, value, key_width=50):
        try:
            # Check if we need a new page to avoid orphaned content
            if self.get_y() > self.h - 25:
                self.add_page()

            current_y = self.get_y()
            self.set_font('Helvetica', 'B', 9)
            self.set_text_color(*self.text_color_dark)

            # Key on left
            self.cell(key_width, 6, sanitize_for_helvetica(str(key))+":", 0, 0, 'L')

            # Value on right
            self.set_font('Helvetica', '', 9)
            self.set_text_color(*self.text_color_normal)

            # Calculate available width for value
            value_width = self.w - self.l_margin - self.r_margin - key_width - 2
            value_text = sanitize_for_helvetica(str(value))

            # Check if value fits in one line
            if self.get_string_width(value_text) <= value_width:
                self.cell(value_width, 6, value_text, 0, 1, 'L')
            else:
                # Multi-line value - save position and render properly
                value_x = self.get_x()
                self.multi_cell(value_width, 6, value_text, 0, 'L', max_line_height=6)

            self.ln(1.5)
        except Exception as e:
            print(f"PDF Key/Value Error for key '{key}': {e}")

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
            self.set_fill_color(245, 248, 252)
            self.set_draw_color(180, 200, 220)
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

            # Position for next card
            self.set_y(start_y)
            self.set_x(start_x + card_width + 6)
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
        from fpdf import XPos, YPos
        try:
            # Check space - need more room for boxes
            estimated_min_height = 15 + (len(text_lines) * 10)
            if self.get_y() > self.h - estimated_min_height - 10:
                self.add_page()

            self.ln(2)
            current_bg_color = bg_color if bg_color else self.card_bg_color
            current_title_color = title_color if title_color else self.primary_color
            current_text_color = text_color_override if text_color_override else self.text_color_dark

            # Title
            if title:
                self.set_font('Helvetica', 'B', 10)
                self.set_text_color(*current_title_color)
                self.cell(0, 6, sanitize_for_helvetica(title), 0, 1, 'L')
                self.ln(1)

            # Calculate box parameters
            box_start_y = self.get_y()
            box_x = self.l_margin
            box_width = self.w - self.l_margin - self.r_margin
            content_x = box_x + 5
            content_width = box_width - 10

            # Render content using multi_cell for proper text wrapping
            self.set_y(box_start_y + 4)

            for item in text_lines:
                is_list_item = isinstance(item, tuple) and item[0] == "bullet"
                actual_text = item[1] if is_list_item else item
                text_str = sanitize_for_helvetica(str(actual_text))

                if is_list_item:
                    self.set_font('Helvetica', '', font_size_text)
                    self.set_text_color(*current_text_color)

                    # Handle bold text (**text**)
                    if "**" in text_str:
                        # Custom rendering for bold
                        current_y = self.get_y()
                        self.set_x(content_x)
                        self.cell(4, line_h, "-", 0, 0, 'L')
                        self.set_x(content_x + 6)

                        parts = text_str.split("**")
                        x_pos = self.get_x()
                        text_width = content_width - 6

                        for i, part in enumerate(parts):
                            if not part:
                                continue
                            is_bold = (i % 2 == 1)
                            self.set_font('Helvetica', 'B' if is_bold else '', font_size_text)

                            part_width = self.get_string_width(part)
                            if x_pos + part_width > content_x + text_width:
                                self.ln(line_h)
                                self.set_x(content_x + 6)
                                x_pos = self.get_x()

                            self.cell(part_width, line_h, part, 0, 0, 'L')
                            x_pos += part_width

                        self.set_xy(self.l_margin, self.get_y() + line_h + 1.5)
                    else:
                        # Simple bullet with multi_cell
                        current_y = self.get_y()
                        self.set_x(content_x)
                        self.cell(4, line_h, "-", 0, 0, 'L')
                        self.set_xy(content_x + 6, current_y)
                        self.multi_cell(content_width - 6, line_h, text_str, align='L', max_line_height=line_h, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
                        self.ln(1.5)
                else:
                    # Regular text (non-bullet)
                    self.set_x(content_x)
                    self.set_font('Helvetica', '', font_size_text)
                    self.set_text_color(*current_text_color)
                    self.multi_cell(content_width, line_h, text_str, align='L', max_line_height=line_h, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
                    self.ln(1.5)

            # Get actual content height
            content_end_y = self.get_y()
            actual_box_height = content_end_y - box_start_y + 4

            # Check if box would go off page - if so, add page and re-render
            if box_start_y + actual_box_height > self.h - self.b_margin:
                self.add_page()
                # Don't re-render, just note that box is incomplete
                self.set_text_color(*self.text_color_normal)
                return

            # Draw box border (not filled, so text shows through)
            self.set_draw_color(200, 200, 200)
            self.set_line_width(0.3)
            self.rect(box_x, box_start_y, box_width, actual_box_height, 'D')
            self.set_line_width(0.2)

            # Position after box
            self.set_y(content_end_y + 2)
            self.set_text_color(*self.text_color_normal)

        except Exception as e:
            print(f"Error in add_explanation_box: {e}")
            import traceback
            traceback.print_exc()
            self.ln(5)

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
        """Add professional hospital header to the report"""
        if not hospital_data:
            return

        try:
            self.set_font('Helvetica', 'B', 16)
            self.set_text_color(*self.primary_color)
            hospital_name = hospital_data.get('name', 'Medical Center')
            self.cell(0, 8, sanitize_for_helvetica(hospital_name), 0, 1, 'C')

            self.set_font('Helvetica', '', 9)
            self.set_text_color(*self.text_color_dark)

            # Address
            address = hospital_data.get('address', '')
            if address:
                self.cell(0, 5, sanitize_for_helvetica(address), 0, 1, 'C')

            # Contact info on one line
            contact_parts = []
            phone = hospital_data.get('phone')
            email = hospital_data.get('email')
            if phone:
                contact_parts.append(f"Phone: {phone}")
            if email:
                contact_parts.append(f"Email: {email}")

            if contact_parts:
                self.cell(0, 5, sanitize_for_helvetica(" | ".join(contact_parts)), 0, 1, 'C')

            # License number
            license_num = hospital_data.get('license_number')
            if license_num:
                self.set_font('Helvetica', '', 8)
                self.set_text_color(*self.text_color_light)
                self.cell(0, 4, sanitize_for_helvetica(f"License No: {license_num}"), 0, 1, 'C')

            self.ln(3)
            self.set_draw_color(*self.primary_color)
            self.set_line_width(0.5)
            self.line(self.l_margin, self.get_y(), self.w - self.r_margin, self.get_y())
            self.ln(3)
            self.set_line_width(0.2)
            self.set_text_color(*self.text_color_normal)
        except Exception as e:
            print(f"Error adding hospital header: {e}")

    def add_report_metadata_section(self, report_type="EEG Analysis"):
        """Add report metadata section with report type, ID, and generation date"""
        try:
            start_y = self.get_y()
            self.set_fill_color(240, 248, 255)
            box_height = 22

            # Draw background box
            self.rect(self.l_margin, start_y, self.w - self.l_margin - self.r_margin, box_height, 'F')

            self.set_y(start_y + 3)

            # Report Type
            self.set_font('Helvetica', 'B', 12)
            self.set_text_color(*self.secondary_color)
            self.cell(0, 6, sanitize_for_helvetica(report_type), 0, 1, 'C')

            # Report ID and Date
            self.set_font('Helvetica', '', 8)
            self.set_text_color(*self.text_color_dark)

            report_id = ""
            if self.comprehensive_data and self.comprehensive_data.get('prediction'):
                pred_id = self.comprehensive_data['prediction'].get('id', '')
                if pred_id:
                    report_id = f"Report ID: {pred_id[:8].upper()}"

            report_date = f"Generated: {datetime.now().strftime('%d %B %Y, %H:%M')}"

            meta_line = f"{report_id}  |  {report_date}" if report_id else report_date
            self.cell(0, 5, sanitize_for_helvetica(meta_line), 0, 1, 'C')

            self.set_y(start_y + box_height + 2)
            self.set_text_color(*self.text_color_normal)
            self.ln(3)
        except Exception as e:
            print(f"Error adding report metadata: {e}")

    def add_patient_demographics_section(self):
        """Add comprehensive patient demographics section"""
        if not self.comprehensive_data:
            return

        patient = self.comprehensive_data.get('patient')
        patient_profile = self.comprehensive_data.get('patient_profile')

        if not patient:
            return

        try:
            # Check if we have enough space for patient section
            if self.get_y() > self.h - 70:
                self.add_page()

            self.section_title("Patient Information")

            # Calculate age if DOB available
            age_str = "N/A"
            dob = patient.get('date_of_birth')
            if dob:
                age = self.calculate_age(dob)
                age_str = f"{age} years" if age else "N/A"
                dob_formatted = self.format_date(dob, 'date_only')
            else:
                dob_formatted = "N/A"

            # Patient ID
            patient_id = patient.get('unique_identifier', 'N/A')
            self.key_value_pair("Patient ID", patient_id, key_width=45)

            # Full Name
            full_name = patient.get('full_name', 'N/A')
            self.key_value_pair("Full Name", full_name, key_width=45)

            # DOB and Age
            self.key_value_pair("Date of Birth", f"{dob_formatted} (Age: {age_str})", key_width=45)

            # Blood Group
            blood_group = self.comprehensive_data.get('blood_group')
            if blood_group and blood_group != 'N/A':
                self.key_value_pair("Blood Group", blood_group, key_width=45)

            # Contact Information
            phone = patient.get('phone')
            if phone and phone != 'N/A':
                self.key_value_pair("Phone", phone, key_width=45)

            email = patient.get('email')
            if email and email != 'N/A':
                self.key_value_pair("Email", email, key_width=45)

            # Address
            address = patient.get('address')
            if address and str(address).strip() and address != 'N/A':
                self.key_value_pair("Address", address, key_width=45)

            # Emergency Contact
            if patient_profile:
                emergency_contact_name = patient_profile.get('emergency_contact_name')
                emergency_contact_phone = patient_profile.get('emergency_contact_phone')

                if emergency_contact_name or emergency_contact_phone:
                    ec_name = emergency_contact_name if emergency_contact_name else 'N/A'
                    ec_phone = emergency_contact_phone if emergency_contact_phone else 'N/A'
                    self.key_value_pair("Emergency Contact", f"{ec_name}, {ec_phone}", key_width=45)

            self.ln(3)
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
                ]
            }

            disclaimer_text = disclaimers.get(disclaimer_type, disclaimers["standard"])

            # Calculate actual height needed by rendering text first
            temp_y = start_y + 8
            content_width = self.w - self.l_margin - self.r_margin - 10

            self.set_font('Helvetica', '', 8)
            for point in disclaimer_text:
                text_content = f"* {sanitize_for_helvetica(point)}"
                # Estimate lines needed for this point
                text_width = self.get_string_width(text_content)
                lines_needed = max(1, int(text_width / content_width) + 1)
                temp_y += (lines_needed * 4.8) + 1

            actual_height = temp_y - start_y + 4

            # Draw box with actual height
            self.rect(self.l_margin, start_y, self.w - self.l_margin - self.r_margin, actual_height, 'D')

            self.set_y(start_y + 3)
            self.set_x(self.l_margin + 3)

            # Title
            self.set_font('Helvetica', 'B', 9)
            self.set_text_color(139, 69, 19)
            self.cell(0, 5, "IMPORTANT MEDICAL DISCLAIMER", 0, 1, 'C')
            self.ln(1)

            # Disclaimer points
            self.set_font('Helvetica', '', 8)
            self.set_text_color(*self.text_color_dark)

            for point in disclaimer_text:
                self.set_x(self.l_margin + 5)
                self.multi_cell(self.w - self.l_margin - self.r_margin - 10, 4.8,
                              f"* {sanitize_for_helvetica(point)}",
                              align='L', new_x=XPos.LMARGIN, new_y=YPos.NEXT)
                self.ln(0.5)

            self.set_y(start_y + actual_height + 2)
            self.set_text_color(*self.text_color_normal)
            self.ln(3)
        except Exception as e:
            print(f"Error adding disclaimer: {e}")

    def add_signature_section(self):
        """Add signature section for medical professionals"""
        try:
            # Check if we need a new page
            if self.get_y() > self.h - 60:
                self.add_page()

            self.ln(10)
            start_y = self.get_y()

            # Radiologist/Technician signature
            radiologist = self.comprehensive_data.get('radiologist') if self.comprehensive_data else None
            if radiologist:
                self.set_font('Helvetica', '', 9)
                self.set_text_color(*self.text_color_dark)

                # Signature line
                sig_line_y = self.get_y()
                self.line(self.l_margin + 10, sig_line_y, self.l_margin + 90, sig_line_y)
                self.ln(2)

                self.set_x(self.l_margin + 10)
                self.set_font('Helvetica', 'B', 9)
                radiologist_name = radiologist.get('full_name', 'Authorized Personnel')
                self.cell(80, 5, sanitize_for_helvetica(radiologist_name), 0, 1, 'L')

                self.set_x(self.l_margin + 10)
                self.set_font('Helvetica', '', 8)
                self.set_text_color(*self.text_color_light)
                self.cell(80, 4, "EEG Technician / Radiologist", 0, 1, 'L')

                # Date
                self.set_x(self.l_margin + 10)
                self.cell(80, 4, f"Date: {datetime.now().strftime('%d %B %Y')}", 0, 1, 'L')

            self.set_text_color(*self.text_color_normal)
            self.ln(5)
        except Exception as e:
            print(f"Error adding signature section: {e}")
