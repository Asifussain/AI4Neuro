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

from app.reports.mri.utils import sanitize_for_pdf, calculate_age, format_date
from app.reports import theme


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

        # Subtle clinical palette (shared design system — see reports/theme.py)
        self.primary_color = theme.BRAND
        self.secondary_color = theme.BRAND
        self.accent_color = theme.BRAND_SOFT
        self.text_color_dark = theme.INK
        self.text_color_light = theme.MUTED
        self.text_color_normal = theme.INK
        self.line_color = theme.HAIRLINE
        self.card_bg_color = theme.PANEL
        self.section_bg_color = theme.PANEL

        # Status colors (muted, print-friendly)
        self.color_normal = theme.OK
        self.color_warning = theme.WARN
        self.color_danger = theme.DANGER
        self.color_info = theme.INFO

        # Disease colors (kept muted for status text)
        self.disease_colors = {
            'CN': theme.OK,
            'MCI': theme.WARN,
            'AD': theme.DANGER,
        }

        # Page settings
        self.page_margin = 15
        self.set_margins(15, 12, 15)
        self.set_auto_page_break(auto=True, margin=16)
        self.set_line_width(0.2)

    def _theme_sanitize(self, text):
        return sanitize_for_pdf(text)

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
        """Branded PraxiaTech letterhead (shared — see reports/theme.py)."""
        theme.draw_letterhead(self, subtitle=self.report_title)

    def footer(self):
        """Page footer (shared design system)."""
        theme.draw_footer(self)

    def _legacy_footer(self):
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
        """Branding is rendered by the shared letterhead; the facility name is
        surfaced inside the encounter grid. Retained for builder compatibility."""
        return

    # =========================================================================
    # Report Metadata
    # =========================================================================

    def add_report_metadata(self, report_type: str = "MRI Analysis"):
        """No-op: the report subtitle and date are shown in the letterhead.
        Retained for builder compatibility."""
        return

    # =========================================================================
    # Section Helpers
    # =========================================================================

    def section_title(self, title: str):
        """Uppercase heading closed by a hairline rule (shared design)."""
        theme.section_heading(self, title)

    def key_value_pair(self, key: str, value: Any, key_width: int = 50):
        """Two-column key/value row (shared design)."""
        theme.key_value(self, key, value, key_width=key_width)

    # =========================================================================
    # Patient Information
    # =========================================================================

    def _session_date_only(self):
        session = (self.comprehensive_data or {}).get('session') or {}
        raw = session.get('scan_date') or session.get('session_date')
        return format_date(raw, 'date_only') if raw else datetime.now().strftime('%d %B %Y')

    def add_patient_section(self):
        """Render patient / encounter demographics as a bordered grid."""
        if not self.comprehensive_data:
            return

        patient = self.comprehensive_data.get('patient', {})
        patient_profile = self.comprehensive_data.get('patient_profile', {}) or {}
        hospital = self.comprehensive_data.get('hospital', {}) or {}
        doctor = self.comprehensive_data.get('doctor', {}) or {}
        session = self.comprehensive_data.get('session', {}) or {}

        if not patient:
            return

        try:
            self.section_title("Patient Demographics & Encounter")

            dob = patient_profile.get('date_of_birth') or patient.get('date_of_birth')
            if dob:
                age = calculate_age(dob)
                dob_str = format_date(dob, 'date_only')
                if age:
                    dob_str += f"  (Age {age})"
            else:
                dob_str = "-"

            gender = patient_profile.get('gender') or patient.get('gender') or "-"
            patient_id = patient_profile.get('patient_code') or patient.get('unique_identifier') or "-"

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

            contact_bits = []
            if patient.get('phone'):
                contact_bits.append(str(patient['phone']))
            if patient.get('email'):
                contact_bits.append(str(patient['email']))
            if contact_bits:
                self.key_value_pair("Contact", "  |  ".join(contact_bits), 46)

            blood_group = self.comprehensive_data.get('blood_group')
            if blood_group:
                self.key_value_pair("Blood Group", blood_group, 46)

            ec_name = patient_profile.get('emergency_contact_name')
            ec_phone = patient_profile.get('emergency_contact_phone')
            if ec_name or ec_phone:
                self.key_value_pair("Emergency Contact", f"{ec_name or '-'}, {ec_phone or '-'}", 46)

            self.ln(2)
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
        """Clinical panel with title + bullet points (shared design system)."""
        theme.info_panel(self, title, items)

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
                ],
                "comprehensive": [
                    "This report contains AI-assisted analysis of MRI data, including clinical, technical and plain-language summaries, for the referring clinician, care team and patient/family.",
                    "This report does NOT constitute a medical diagnosis. All findings must be interpreted within the complete clinical context by a licensed medical practitioner.",
                    "The AI model provides statistical pattern-recognition support and should be used as an adjunct to, not a replacement for, clinical judgment and comprehensive evaluation.",
                    "Patients: the information in this report is not a diagnosis and should not be used for self-diagnosis or self-treatment. Please discuss these results with your doctor.",
                    "Results should be correlated with patient history, physical examination, cognitive assessment and other diagnostic procedures as clinically indicated."
                ]
            }

            text_list = disclaimers.get(disclaimer_type, disclaimers["standard"])
            theme.disclaimer(self, text_list)
        except Exception as e:
            print(f"Disclaimer error: {e}")

    # =========================================================================
    # Signature Section
    # =========================================================================

    def add_signature_section(self):
        """Add electronic-signature block for the reporting professional."""
        try:
            radiologist = self.comprehensive_data.get('radiologist', {}) if self.comprehensive_data else {}
            name = (radiologist or {}).get('full_name', 'Authorized Personnel')
            theme.signature(self, name, role="Radiologist",
                            date_str=datetime.now().strftime('%d %b %Y'))
        except Exception as e:
            print(f"Signature error: {e}")
