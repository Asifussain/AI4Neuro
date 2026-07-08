"""
Base PDF Report class for MRI Analysis Reports.
Provides common functionality used by all report types.
"""

import io
import base64
from datetime import datetime
from typing import Optional, Tuple, List, Dict, Any
from fpdf import FPDF, XPos, YPos
from PIL import Image

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils import sanitize_for_pdf, calculate_age, format_date


class BaseMRIReport(FPDF):
    """
    Base class for MRI analysis PDF reports.
    Provides common methods for headers, footers, sections, and styling.
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        # Report metadata
        self.report_title = "MRI Analysis Report"
        self.comprehensive_data = None

        # Color scheme — refined palette
        self.primary_color = (30, 41, 59)        # Slate 800
        self.secondary_color = (51, 102, 204)    # Professional blue
        self.accent_color = (16, 185, 129)       # Emerald 500
        self.text_color_dark = (30, 41, 59)      # Slate 800
        self.text_color_light = (100, 116, 139)  # Slate 500
        self.text_color_normal = (15, 23, 42)    # Slate 900
        self.line_color = (226, 232, 240)        # Slate 200
        self.card_bg_color = (248, 250, 252)     # Slate 50
        self.section_bg_color = (241, 245, 249)  # Slate 100

        # Status colors
        self.color_normal = (16, 185, 129)       # Emerald 500
        self.color_warning = (245, 158, 11)      # Amber 500
        self.color_danger = (239, 68, 68)        # Red 500
        self.color_info = (59, 130, 246)         # Blue 500

        # Disease colors
        self.disease_colors = {
            'CN': (16, 185, 129),    # Emerald - Cognitively Normal
            'MCI': (245, 158, 11),   # Amber - Mild Cognitive Impairment
            'AD': (239, 68, 68)      # Red - Alzheimer's Disease
        }

        # Page settings
        self.page_margin = 15
        self.set_auto_page_break(auto=True, margin=self.page_margin)
        self.set_line_width(0.2)

    # =========================================================================
    # Text rendering with sanitization
    # =========================================================================

    def cell(self, w, h=0, txt="", border=0, ln=0, align="", fill=False, link=""):
        """Override cell to sanitize text."""
        super().cell(w, h, sanitize_for_pdf(txt), border, ln, align, fill, link)

    def multi_cell(self, w, h, txt="", border=0, align="J", fill=False,
                   max_line_height=0, new_x=XPos.LMARGIN, new_y=YPos.NEXT):
        """Override multi_cell to sanitize text."""
        if max_line_height == 0:
            max_line_height = h
        super().multi_cell(w, h, sanitize_for_pdf(txt), border, align, fill,
                          max_line_height=max_line_height, new_x=new_x, new_y=new_y)

    # =========================================================================
    # Header and Footer
    # =========================================================================

    def header(self):
        """Add report header to each page."""
        try:
            page_width = self.w - self.l_margin - self.r_margin

            # Top accent bar
            self.set_fill_color(*self.secondary_color)
            self.rect(0, 0, self.w, 3, 'F')

            self.set_y(8)

            # Title
            self.set_font('Helvetica', 'B', 13)
            self.set_text_color(*self.primary_color)
            self.cell(0, 8, sanitize_for_pdf(self.report_title), border=0, align='L')

            # Right-aligned branding
            self.set_font('Helvetica', '', 7)
            self.set_text_color(*self.text_color_light)
            self.set_x(self.w - self.r_margin - 30)
            self.cell(30, 8, "NeuroXiva Platform", 0, 0, 'R')

            self.ln(10)

            # Divider line
            self.set_draw_color(*self.line_color)
            self.set_line_width(0.4)
            self.line(self.l_margin, self.get_y(), self.w - self.r_margin, self.get_y())
            self.set_line_width(0.2)
            self.ln(6)
            self.set_text_color(*self.text_color_normal)
        except Exception as e:
            print(f"PDF Header Error: {e}")

    def footer(self):
        """Add page number footer."""
        try:
            self.set_y(-18)

            # Thin separator line
            self.set_draw_color(*self.line_color)
            self.set_line_width(0.3)
            self.line(self.l_margin, self.get_y(), self.w - self.r_margin, self.get_y())
            self.set_line_width(0.2)
            self.ln(3)

            # Footer text
            self.set_font('Helvetica', '', 7)
            self.set_text_color(*self.text_color_light)
            self.cell(0, 5, "NeuroXiva MRI Analysis Platform", 0, 0, 'L')
            self.set_font('Helvetica', '', 7.5)
            self.cell(0, 5, f'Page {self.page_no()}/{{nb}}', 0, 0, 'R')
            self.set_text_color(*self.text_color_normal)
        except Exception as e:
            print(f"PDF Footer Error: {e}")

    # =========================================================================
    # Hospital Header
    # =========================================================================

    def add_hospital_header(self, hospital_data: Optional[Dict] = None):
        """Add professional hospital header."""
        if not hospital_data:
            return

        try:
            page_width = self.w - self.l_margin - self.r_margin
            start_y = self.get_y()

            # Background card
            self.set_fill_color(*self.card_bg_color)
            self.rect(self.l_margin, start_y, page_width, 24, 'F')

            # Hospital name
            self.set_y(start_y + 3)
            self.set_font('Helvetica', 'B', 15)
            self.set_text_color(*self.primary_color)
            name = hospital_data.get('name', 'Medical Center')
            self.cell(0, 8, sanitize_for_pdf(name), 0, 1, 'C')

            # Address + Contact on one line
            self.set_font('Helvetica', '', 8)
            self.set_text_color(*self.text_color_light)

            info_parts = []
            if hospital_data.get('address'):
                info_parts.append(hospital_data['address'])
            if hospital_data.get('city'):
                info_parts.append(hospital_data['city'])
            if hospital_data.get('phone'):
                info_parts.append(f"Tel: {hospital_data['phone']}")
            if hospital_data.get('email'):
                info_parts.append(hospital_data['email'])

            if info_parts:
                self.cell(0, 5, sanitize_for_pdf('  |  '.join(info_parts)), 0, 1, 'C')

            self.set_y(start_y + 24 + 2)

            # Bottom accent line
            self.set_draw_color(*self.secondary_color)
            self.set_line_width(0.8)
            self.line(self.l_margin, self.get_y(), self.w - self.r_margin, self.get_y())
            self.set_line_width(0.2)
            self.ln(5)
            self.set_text_color(*self.text_color_normal)

        except Exception as e:
            print(f"Hospital header error: {e}")

    # =========================================================================
    # Report Metadata
    # =========================================================================

    def add_report_metadata(self, report_type: str = "MRI Analysis"):
        """Add report metadata section."""
        try:
            page_width = self.w - self.l_margin - self.r_margin
            start_y = self.get_y()
            box_height = 22

            # Blue accent top border
            self.set_fill_color(*self.secondary_color)
            self.rect(self.l_margin, start_y, page_width, 2, 'F')

            # Card background
            self.set_fill_color(239, 246, 255)  # Blue-50
            self.rect(self.l_margin, start_y + 2, page_width, box_height - 2, 'F')

            # Light border
            self.set_draw_color(191, 219, 254)  # Blue-200
            self.set_line_width(0.3)
            self.rect(self.l_margin, start_y, page_width, box_height, 'D')
            self.set_line_width(0.2)

            self.set_y(start_y + 4)
            self.set_font('Helvetica', 'B', 11)
            self.set_text_color(*self.secondary_color)
            self.cell(0, 6, sanitize_for_pdf(report_type), 0, 1, 'C')

            # Report date
            self.set_font('Helvetica', '', 8)
            self.set_text_color(*self.text_color_light)

            session = self.comprehensive_data.get('session', {}) if self.comprehensive_data else {}
            session_code = session.get('session_code', '')
            report_id = f"Session: {session_code}" if session_code else ""
            report_date = f"Generated: {datetime.now().strftime('%d %B %Y, %H:%M')}"
            meta_line = f"{report_id}  |  {report_date}" if report_id else report_date
            self.cell(0, 5, sanitize_for_pdf(meta_line), 0, 1, 'C')

            self.set_y(start_y + box_height + 4)
            self.set_text_color(*self.text_color_normal)

        except Exception as e:
            print(f"Report metadata error: {e}")

    # =========================================================================
    # Section Helpers
    # =========================================================================

    def section_title(self, title: str):
        """Add a section title with left accent bar and subtle background."""
        try:
            # Check for page break
            if self.get_y() > self.h - 40:
                self.add_page()

            page_width = self.w - self.l_margin - self.r_margin
            y = self.get_y()

            # Subtle background fill
            self.set_fill_color(*self.section_bg_color)
            self.rect(self.l_margin, y, page_width, 8, 'F')

            # Left accent bar
            self.set_fill_color(*self.secondary_color)
            self.rect(self.l_margin, y, 3, 8, 'F')

            # Title text
            self.set_font('Helvetica', 'B', 10)
            self.set_text_color(*self.primary_color)
            self.set_x(self.l_margin + 6)
            self.cell(page_width - 6, 8, sanitize_for_pdf(title), 0, 1, 'L')

            self.ln(4)
            self.set_text_color(*self.text_color_normal)
        except Exception as e:
            print(f"Section title error: {e}")

    def key_value_pair(self, key: str, value: Any, key_width: int = 50):
        """Add a key-value pair with subtle separator."""
        try:
            if self.get_y() > self.h - 20:
                self.add_page()

            page_width = self.w - self.l_margin - self.r_margin

            # Key
            self.set_font('Helvetica', 'B', 9)
            self.set_text_color(*self.text_color_light)
            self.cell(key_width, 6, sanitize_for_pdf(str(key)), 0, 0, 'L')

            # Value
            self.set_font('Helvetica', '', 9)
            self.set_text_color(*self.text_color_dark)

            value_width = page_width - key_width - 2
            value_text = sanitize_for_pdf(str(value) if value else 'N/A')

            if self.get_string_width(value_text) <= value_width:
                self.cell(value_width, 6, value_text, 0, 1, 'L')
            else:
                self.multi_cell(value_width, 6, value_text, 0, 'L', max_line_height=6)

            # Subtle dotted separator
            sep_y = self.get_y() + 0.5
            self.set_draw_color(*self.line_color)
            self.set_line_width(0.1)
            self.set_dash_pattern(dash=1, gap=1.5)
            self.line(self.l_margin + 2, sep_y, self.l_margin + page_width - 2, sep_y)
            self.set_dash_pattern()
            self.set_line_width(0.2)

            self.ln(2)
        except Exception as e:
            print(f"Key-value error: {e}")

    # =========================================================================
    # Patient Information
    # =========================================================================

    def add_patient_section(self):
        """Add patient demographics section."""
        if not self.comprehensive_data:
            return

        patient = self.comprehensive_data.get('patient', {})
        patient_profile = self.comprehensive_data.get('patient_profile', {})

        if not patient:
            return

        try:
            if self.get_y() > self.h - 70:
                self.add_page()

            self.section_title("Patient Information")

            # Patient ID
            patient_code = patient_profile.get('patient_code', 'N/A') if patient_profile else 'N/A'
            self.key_value_pair("Patient ID", patient_code, 45)

            # Full Name
            self.key_value_pair("Full Name", patient.get('full_name', 'N/A'), 45)

            # DOB and Age
            dob = patient_profile.get('date_of_birth') if patient_profile else None
            if dob:
                age = calculate_age(dob)
                dob_formatted = format_date(dob, 'date_only')
                age_str = f"{age} years" if age else "N/A"
                self.key_value_pair("Date of Birth", f"{dob_formatted} (Age: {age_str})", 45)

            # Gender
            gender = patient_profile.get('gender') if patient_profile else None
            if gender:
                self.key_value_pair("Gender", gender, 45)

            # Blood Group
            blood_group = self.comprehensive_data.get('blood_group')
            if blood_group:
                self.key_value_pair("Blood Group", blood_group, 45)

            # Contact
            phone = patient.get('phone')
            if phone:
                self.key_value_pair("Phone", phone, 45)

            # Emergency Contact
            if patient_profile:
                ec_name = patient_profile.get('emergency_contact_name')
                ec_phone = patient_profile.get('emergency_contact_phone')
                if ec_name or ec_phone:
                    ec_info = f"{ec_name or 'N/A'}, {ec_phone or 'N/A'}"
                    self.key_value_pair("Emergency Contact", ec_info, 45)

            self.ln(3)
        except Exception as e:
            print(f"Patient section error: {e}")

    # =========================================================================
    # Medical Professional Information
    # =========================================================================

    def add_professional_section(self, role: str = "doctor"):
        """Add doctor or radiologist information section."""
        if not self.comprehensive_data:
            return

        try:
            if role == "doctor":
                user_data = self.comprehensive_data.get('doctor', {})
                profile_data = self.comprehensive_data.get('doctor_profile', {})
                qualification = self.comprehensive_data.get('doctor_qualification', {})
                title = "Referring Physician"
            else:
                user_data = self.comprehensive_data.get('radiologist', {})
                profile_data = self.comprehensive_data.get('radiologist_profile', {})
                qualification = self.comprehensive_data.get('radiologist_qualification', {})
                title = "Analyzed By (Radiologist)"

            if not user_data:
                return

            if self.get_y() > self.h - 50:
                self.add_page()

            self.section_title(title)

            # Name
            self.key_value_pair("Name", user_data.get('full_name', 'N/A'), 45)

            # License
            if profile_data:
                license_num = profile_data.get('license_number')
                if license_num:
                    self.key_value_pair("License Number", license_num, 45)

                # Qualification
                if qualification:
                    qual_name = qualification.get('qualification_name', '')
                    self.key_value_pair("Qualification", qual_name, 45)

                # Specialization
                spec = profile_data.get('specialization')
                if spec:
                    self.key_value_pair("Specialization", spec, 45)

            # Contact
            phone = user_data.get('phone')
            if phone:
                self.key_value_pair("Phone", phone, 45)

            self.ln(3)
        except Exception as e:
            print(f"Professional section error: {e}")

    # =========================================================================
    # Session Details
    # =========================================================================

    def add_session_section(self):
        """Add MRI session technical details."""
        if not self.comprehensive_data:
            return

        session = self.comprehensive_data.get('session', {})
        if not session:
            return

        try:
            if self.get_y() > self.h - 60:
                self.add_page()

            self.section_title("MRI Scan Details")

            # Session code
            self.key_value_pair("Session Code", session.get('session_code', 'N/A'), 45)

            # Scan date
            scan_date = session.get('scan_date')
            if scan_date:
                self.key_value_pair("Scan Date", format_date(scan_date, 'full'), 45)

            # Analysis type
            analysis_type = session.get('analysis_type', 'N/A')
            self.key_value_pair("Analysis Type", analysis_type.replace('-', ' ').title(), 45)

            # Scanner info
            manufacturer = session.get('scanner_manufacturer')
            model = session.get('scanner_model')
            if manufacturer or model:
                scanner_info = f"{manufacturer or ''} {model or ''}".strip()
                self.key_value_pair("Scanner", scanner_info, 45)

            # Field strength
            field_strength = session.get('field_strength')
            if field_strength:
                self.key_value_pair("Field Strength", field_strength, 45)

            # Sequence type
            sequence = session.get('sequence_type')
            if sequence:
                self.key_value_pair("Sequence Type", sequence, 45)

            # Notes
            notes = session.get('notes')
            if notes:
                self.key_value_pair("Notes", notes, 45)

            self.ln(3)
        except Exception as e:
            print(f"Session section error: {e}")

    # =========================================================================
    # Image Handling
    # =========================================================================

    def add_image_section(self, title: str, image_base64: str):
        """Add an image with title."""
        if self.get_y() > self.h - 100:
            self.add_page()

        if title:
            self.set_font('Helvetica', 'B', 9)
            self.set_text_color(*self.text_color_dark)
            self.cell(0, 6, sanitize_for_pdf(title), 0, 1, 'L')
            self.ln(2)

        if not image_base64 or not isinstance(image_base64, str):
            self.set_font('Helvetica', 'I', 9)
            self.set_text_color(*self.text_color_light)
            self.cell(0, 6, "(Image not available)", 0, 1, 'L')
            self.set_text_color(*self.text_color_normal)
            return

        try:
            # Decode image
            if image_base64.startswith('data:image'):
                img_data = image_base64.split(',', 1)[1]
            else:
                img_data = image_base64

            img_bytes = base64.b64decode(img_data)
            img_buffer = io.BytesIO(img_bytes)

            # Get dimensions
            pil_img = Image.open(io.BytesIO(img_bytes))
            img_width, img_height = pil_img.size
            pil_img.close()

            # Calculate display size
            page_width = self.w - 2 * self.page_margin
            display_width = page_width * 0.90
            aspect_ratio = img_height / img_width if img_width > 0 else 0.75
            display_height = display_width * aspect_ratio

            # Check page space
            if self.get_y() + display_height > self.h - self.b_margin - 5:
                self.add_page()

            x_pos = self.l_margin + (page_width - display_width) / 2
            current_y = self.get_y()

            img_buffer.seek(0)
            self.image(img_buffer, x=x_pos, y=current_y, w=display_width)
            img_buffer.close()

            self.set_y(current_y + display_height + 4)

        except Exception as e:
            print(f"Image error: {e}")
            self.set_font('Helvetica', 'I', 9)
            self.set_text_color(*self.text_color_light)
            self.cell(0, 6, f"(Error loading image)", 0, 1, 'L')
            self.set_text_color(*self.text_color_normal)

    # =========================================================================
    # Explanation Box
    # =========================================================================

    def add_explanation_box(self, title: str, items: List, bg_color: Tuple = None,
                           accent_color: Tuple = None):
        """Add an explanation box with left accent strip and bullet points."""
        try:
            min_height = 15 + len(items) * 8
            if self.get_y() > self.h - min_height - 10:
                self.add_page()

            bg = bg_color or self.card_bg_color
            accent = accent_color or self.secondary_color
            box_x = self.l_margin
            box_width = self.w - self.l_margin - self.r_margin

            if title:
                self.set_font('Helvetica', 'B', 9.5)
                self.set_text_color(*self.primary_color)
                self.cell(0, 6, sanitize_for_pdf(title), 0, 1, 'L')
                self.ln(1)

            box_start_y = self.get_y()
            self.set_y(box_start_y + 4)

            for item in items:
                is_bullet = isinstance(item, tuple) and item[0] == "bullet"
                text = item[1] if is_bullet else item

                self.set_font('Helvetica', '', 8.5)
                self.set_text_color(*self.text_color_dark)

                if is_bullet:
                    self.set_x(self.l_margin + 8)
                    self.set_font('Helvetica', '', 8.5)
                    self.set_text_color(*self.accent_color)
                    self.cell(5, 5, ">", 0, 0, 'L')
                    self.set_text_color(*self.text_color_dark)
                    self.set_x(self.l_margin + 14)
                    self.multi_cell(box_width - 19, 5, sanitize_for_pdf(text), 0, 'L')
                else:
                    self.set_x(self.l_margin + 8)
                    self.multi_cell(box_width - 13, 5, sanitize_for_pdf(text), 0, 'L')

                self.ln(1.5)

            end_y = self.get_y()
            box_height = end_y - box_start_y + 4

            # Background fill
            self.set_fill_color(*bg)
            self.rect(box_x, box_start_y, box_width, box_height, 'F')

            # Left accent strip
            self.set_fill_color(*accent)
            self.rect(box_x, box_start_y, 2.5, box_height, 'F')

            # Light border (right, top, bottom)
            self.set_draw_color(*self.line_color)
            self.set_line_width(0.2)
            self.rect(box_x, box_start_y, box_width, box_height, 'D')

            # Re-render text on top of fill (fill was drawn after text)
            self.set_y(box_start_y + 4)
            for item in items:
                is_bullet = isinstance(item, tuple) and item[0] == "bullet"
                text = item[1] if is_bullet else item

                self.set_font('Helvetica', '', 8.5)
                self.set_text_color(*self.text_color_dark)

                if is_bullet:
                    self.set_x(self.l_margin + 8)
                    self.set_text_color(*accent)
                    self.cell(5, 5, ">", 0, 0, 'L')
                    self.set_text_color(*self.text_color_dark)
                    self.set_x(self.l_margin + 14)
                    self.multi_cell(box_width - 19, 5, sanitize_for_pdf(text), 0, 'L')
                else:
                    self.set_x(self.l_margin + 8)
                    self.multi_cell(box_width - 13, 5, sanitize_for_pdf(text), 0, 'L')

                self.ln(1.5)

            self.set_y(end_y + 5)
            self.set_text_color(*self.text_color_normal)

        except Exception as e:
            print(f"Explanation box error: {e}")

    # =========================================================================
    # Disclaimer
    # =========================================================================

    def add_disclaimer(self, disclaimer_type: str = "standard"):
        """Add medical disclaimer with amber accent."""
        try:
            if self.get_y() > self.h - 55:
                self.add_page()

            disclaimers = {
                "standard": [
                    "This report contains AI-assisted analysis of MRI data and is intended for use by qualified healthcare professionals only.",
                    "This report does NOT constitute a medical diagnosis. All findings must be interpreted by a licensed medical practitioner.",
                    "The AI model provides pattern recognition support and should be used as an adjunct to clinical judgment.",
                    "Results should be correlated with patient history, examination, and other diagnostic procedures."
                ],
                "patient": [
                    "This report is for informational purposes and to facilitate discussion with your healthcare provider.",
                    "The information herein is NOT a medical diagnosis and should not be used for self-diagnosis or self-treatment.",
                    "Always consult with your doctor before making any health-related decisions.",
                    "Your doctor will interpret these results in the context of your complete medical history."
                ],
                "technical": [
                    "This technical report is intended for qualified medical professionals and radiologists.",
                    "Analysis performed using validated AI algorithms. Results require clinical correlation.",
                    "Quality control measures and artifact rejection protocols were applied per standard guidelines.",
                    "Model validation performed on multi-center datasets with confirmed clinical diagnoses."
                ]
            }

            text_list = disclaimers.get(disclaimer_type, disclaimers["standard"])
            page_width = self.w - self.l_margin - self.r_margin

            self.ln(3)
            start_y = self.get_y()

            # Background
            self.set_fill_color(255, 251, 235)  # Amber-50
            self.rect(self.l_margin, start_y, page_width, 6, 'F')  # placeholder height

            self.set_y(start_y + 4)
            self.set_font('Helvetica', 'B', 8.5)
            self.set_text_color(180, 83, 9)  # Amber-700
            self.set_x(self.l_margin + 8)
            self.cell(0, 5, "IMPORTANT MEDICAL DISCLAIMER", 0, 1, 'L')
            self.ln(2)

            self.set_font('Helvetica', '', 7.5)
            self.set_text_color(120, 53, 15)  # Amber-800

            for point in text_list:
                self.set_x(self.l_margin + 8)
                self.multi_cell(page_width - 14, 4.5,
                               sanitize_for_pdf(point), 0, 'L')
                self.ln(1)

            end_y = self.get_y()
            box_height = end_y - start_y + 4

            # Amber background
            self.set_fill_color(255, 251, 235)
            self.rect(self.l_margin, start_y, page_width, box_height, 'F')

            # Left amber accent strip
            self.set_fill_color(*self.color_warning)
            self.rect(self.l_margin, start_y, 2.5, box_height, 'F')

            # Light border
            self.set_draw_color(253, 230, 138)  # Amber-200
            self.set_line_width(0.3)
            self.rect(self.l_margin, start_y, page_width, box_height, 'D')
            self.set_line_width(0.2)

            # Re-render text over background
            self.set_y(start_y + 4)
            self.set_font('Helvetica', 'B', 8.5)
            self.set_text_color(180, 83, 9)
            self.set_x(self.l_margin + 8)
            self.cell(0, 5, "IMPORTANT MEDICAL DISCLAIMER", 0, 1, 'L')
            self.ln(2)

            self.set_font('Helvetica', '', 7.5)
            self.set_text_color(120, 53, 15)

            for point in text_list:
                self.set_x(self.l_margin + 8)
                self.multi_cell(page_width - 14, 4.5,
                               sanitize_for_pdf(point), 0, 'L')
                self.ln(1)

            self.set_y(end_y + 5)
            self.set_text_color(*self.text_color_normal)

        except Exception as e:
            print(f"Disclaimer error: {e}")

    # =========================================================================
    # Signature Section
    # =========================================================================

    def add_signature_section(self):
        """Add signature section."""
        try:
            if self.get_y() > self.h - 50:
                self.add_page()

            self.ln(10)

            radiologist = self.comprehensive_data.get('radiologist', {}) if self.comprehensive_data else {}

            if radiologist:
                self.set_font('Helvetica', '', 9)
                self.set_text_color(*self.text_color_dark)

                # Signature line
                sig_y = self.get_y()
                self.line(self.l_margin + 10, sig_y, self.l_margin + 90, sig_y)
                self.ln(2)

                self.set_x(self.l_margin + 10)
                self.set_font('Helvetica', 'B', 9)
                self.cell(80, 5, sanitize_for_pdf(radiologist.get('full_name', 'Authorized Personnel')), 0, 1, 'L')

                self.set_x(self.l_margin + 10)
                self.set_font('Helvetica', '', 8)
                self.set_text_color(*self.text_color_light)
                self.cell(80, 4, "Radiologist", 0, 1, 'L')

                self.set_x(self.l_margin + 10)
                self.cell(80, 4, f"Date: {datetime.now().strftime('%d %B %Y')}", 0, 1, 'L')

            self.set_text_color(*self.text_color_normal)

        except Exception as e:
            print(f"Signature error: {e}")
