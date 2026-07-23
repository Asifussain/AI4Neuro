"""Shared visual design system for PraxiaTech clinical PDF reports.

This module centralises the "authentic hospital report" look shared by the EEG
and MRI report families: a branded letterhead, a patient/encounter demographics
grid, clean typographic section headings, data tables, informational panels,
disclaimers and an electronic-signature block.

Everything here is deliberately subtle — a near-black ink, muted grey labels,
hairline rules and a single deep-navy brand accent, with colour reserved for
genuine clinical alerts. Helpers operate on any ``fpdf.FPDF`` instance (they
only call public FPDF methods), so both report base classes can delegate to
them and stay visually identical.
"""

from __future__ import annotations

from datetime import datetime

# --------------------------------------------------------------------------- #
#  Palette  (subtle, clinical)
# --------------------------------------------------------------------------- #
INK = (33, 37, 41)          # near-black — headings & primary values
BODY = (55, 61, 69)         # body copy
MUTED = (110, 116, 125)     # field labels / secondary text
FAINT = (150, 156, 163)     # very light captions
HAIRLINE = (208, 213, 219)  # thin rules & borders
GRIDLINE = (198, 204, 211)  # grid separators
PANEL = (241, 243, 245)     # table header / panel fill
LABEL_FILL = (244, 245, 247)  # grid label cell fill
ZEBRA = (249, 250, 251)     # alternating row fill
WHITE = (255, 255, 255)

BRAND = (26, 54, 93)        # deep navy — logo & subtle accents
BRAND_SOFT = (92, 112, 143)

# Clinical status (muted, print-friendly)
OK = (34, 116, 71)          # normal / low concern
WARN = (176, 120, 20)       # amber / mild-moderate
DANGER = (176, 45, 45)      # red / severe / alert
INFO = (43, 92, 150)

# Alert / warning callout
ALERT_TEXT = (176, 96, 20)
ALERT_BORDER = (224, 158, 52)
ALERT_FILL = (255, 250, 236)


def content_width(pdf) -> float:
    return pdf.w - pdf.l_margin - pdf.r_margin


def _txt(pdf, s) -> str:
    """Best-effort sanitise using whatever sanitiser the report class provides."""
    try:
        return pdf._theme_sanitize(str(s))
    except Exception:
        return str(s)


# --------------------------------------------------------------------------- #
#  Letterhead (drawn on every page via header())
# --------------------------------------------------------------------------- #

def draw_letterhead(pdf, subtitle: str = "", brand_tagline: str = "NEURODIAGNOSTIC ASSESSMENT",
                     brand_name: str = "PRAXIATECH", monogram: str | None = None,
                     tagline_spaced: bool = True):
    """Draw the branded letterhead: logo + wordmark (left), CONFIDENTIAL REPORT
    block (right), closed by a strong rule. Repeats on each page like a real
    laboratory report.

    ``brand_name``/``monogram``/``tagline_spaced`` let a specific report
    (e.g. the unified EEG report) swap in different letterhead branding
    without affecting every other report class, which keep the defaults.
    """
    try:
        left = pdf.l_margin
        right = pdf.w - pdf.r_margin
        top = 11
        mono_char = (monogram or brand_name[:1] or "P").upper()

        # ---- Logo mark: outlined navy roundel with monogram + circuit dots ---
        cx, cy, d = left + 7.5, top + 7, 15.0
        pdf.set_draw_color(*BRAND)
        pdf.set_line_width(0.7)
        pdf.ellipse(cx - d / 2, cy - d / 2, d, d, style="D")
        pdf.set_line_width(0.2)
        pdf.set_font("Helvetica", "B", 15)
        pdf.set_text_color(*BRAND)
        pdf.set_xy(cx - d / 2, cy - 3.3)
        pdf.cell(d, 6, mono_char, align="C")
        # small circuit nodes
        pdf.set_fill_color(*BRAND)
        for dx, dy in ((4.6, -4.2), (5.4, -1.2), (4.2, 3.9)):
            pdf.ellipse(cx + dx, cy + dy, 0.9, 0.9, style="F")

        # ---- Wordmark ----
        tx = left + 18
        pdf.set_xy(tx, top + 1.2)
        pdf.set_font("Helvetica", "B", 17)
        pdf.set_text_color(*INK)
        pdf.cell(90, 7, brand_name)
        pdf.set_xy(tx, top + 9)
        pdf.set_font("Helvetica", "", 7.4)
        pdf.set_text_color(*MUTED)
        pdf.cell(90, 4, _spaced(brand_tagline) if tagline_spaced else brand_tagline)

        # ---- Right block: CONFIDENTIAL REPORT / subtitle / date ----
        pdf.set_xy(right - 90, top)
        pdf.set_font("Helvetica", "B", 12.5)
        pdf.set_text_color(*INK)
        pdf.cell(90, 6, "CONFIDENTIAL REPORT", align="R")
        if subtitle:
            pdf.set_xy(right - 110, top + 7)
            pdf.set_font("Helvetica", "", 8.3)
            pdf.set_text_color(*MUTED)
            pdf.cell(110, 4.5, _txt(pdf, subtitle), align="R")
        pdf.set_xy(right - 110, top + 11.5)
        pdf.set_font("Helvetica", "", 8.3)
        pdf.set_text_color(*MUTED)
        pdf.cell(110, 4.5, "Report Date: " + datetime.now().strftime("%d-%b-%Y"), align="R")

        # ---- Rule ----
        rule_y = top + 18
        pdf.set_draw_color(*INK)
        pdf.set_line_width(0.7)
        pdf.line(left, rule_y, right, rule_y)
        pdf.set_line_width(0.2)
        pdf.set_draw_color(*HAIRLINE)

        pdf.set_text_color(*INK)
        pdf.set_y(rule_y + 5)
    except Exception as exc:  # pragma: no cover - header must never crash render
        print(f"letterhead error: {exc}")


def _spaced(s: str) -> str:
    """Add light letter-spacing to a short caption (poor-man's tracking)."""
    return " ".join(list(s))


def draw_clinical_letterhead(pdf, hospital: dict | None, subtitle: str = "",
                             platform_line: str = "AI4NEURO  -  AI-Assisted Neurodiagnostics"):
    """Professional radiology-style letterhead: the **hospital** is the masthead
    (name, service line, address on the left; phone/email on the right), closed
    by a navy accent bar carrying the AI platform mark. Featured on every page so
    the report reads like an authentic imaging-centre document.

    Falls back gracefully when hospital fields are missing (blank lines, never a
    crash) and works for both MRI and EEG unified reports.
    """
    try:
        hospital = hospital or {}
        left = pdf.l_margin
        right = pdf.w - pdf.r_margin
        top = 9

        name = str(hospital.get("name") or "Neurodiagnostic Centre")
        parts = [hospital.get("address"), hospital.get("city"), hospital.get("state"), hospital.get("pincode")]
        address = ", ".join(str(p) for p in parts if p)
        phone = hospital.get("phone")
        email = hospital.get("email")

        # ---- Medical roundel (navy ring + cross) ----
        cx, cy, d = left + 7.5, top + 6.5, 14.0
        pdf.set_draw_color(*BRAND)
        pdf.set_line_width(0.8)
        pdf.ellipse(cx - d / 2, cy - d / 2, d, d, style="D")
        pdf.set_fill_color(*BRAND)
        cw = 1.7
        pdf.rect(cx - cw / 2, cy - 4.2, cw, 8.4, style="F")
        pdf.rect(cx - 4.2, cy - cw / 2, 8.4, cw, style="F")
        pdf.set_line_width(0.2)

        # ---- Hospital masthead (left) ----
        tx = left + 17
        pdf.set_xy(tx, top - 0.5)
        pdf.set_font("Helvetica", "B", 16)
        pdf.set_text_color(*BRAND)
        pdf.cell(115, 7, _txt(pdf, name.upper()))
        pdf.set_xy(tx, top + 6.6)
        pdf.set_font("Helvetica", "B", 6.8)
        pdf.set_text_color(*BRAND_SOFT)
        pdf.cell(115, 3.6, _spaced("MRI  |  EEG  |  AI NEURODIAGNOSTIC ANALYSIS"))
        if address:
            pdf.set_xy(tx, top + 10.6)
            pdf.set_font("Helvetica", "", 7)
            pdf.set_text_color(*MUTED)
            pdf.cell(150, 3.6, _txt(pdf, address))

        # ---- Contact block (right) ----
        pdf.set_font("Helvetica", "", 7.6)
        pdf.set_text_color(*BODY)
        if phone:
            pdf.set_xy(right - 90, top + 0.5)
            pdf.cell(90, 4, _txt(pdf, str(phone)), align="R")
        if email:
            pdf.set_xy(right - 90, top + 5)
            pdf.cell(90, 4, _txt(pdf, str(email)), align="R")

        # ---- Navy accent bar with the AI platform mark + subtitle ----
        bar_y = top + 15.5
        bar_h = 6.4
        pdf.set_fill_color(*BRAND)
        pdf.rect(left, bar_y, right - left, bar_h, style="F")
        pdf.set_xy(left + 2.5, bar_y + 1.1)
        pdf.set_font("Helvetica", "B", 7.6)
        pdf.set_text_color(*WHITE)
        pdf.cell(120, 4.2, _txt(pdf, platform_line))
        if subtitle:
            pdf.set_xy(right - 122, bar_y + 1.1)
            pdf.set_font("Helvetica", "", 7.6)
            pdf.set_text_color(*WHITE)
            pdf.cell(120, 4.2, _txt(pdf, subtitle) + "    ", align="R")

        pdf.set_draw_color(*HAIRLINE)
        pdf.set_text_color(*INK)
        pdf.set_y(bar_y + bar_h + 4)
    except Exception as exc:  # pragma: no cover - header must never crash render
        print(f"clinical letterhead error: {exc}")


def patient_info_strip(pdf, *, name: str, left_pairs, mid_pairs, right_pairs):
    """DRLOGY-style compact patient band: bold patient name with a stack of
    label:value pairs beneath, and two more labelled columns (IDs, timestamps),
    all inside a single hairline-bordered strip.

    ``left_pairs``/``mid_pairs``/``right_pairs`` are lists of ``(label, value)``.
    """
    try:
        left = pdf.l_margin
        usable = content_width(pdf)
        x0 = left
        col1 = usable * 0.40
        col2 = usable * 0.32
        col3 = usable * 0.28
        y0 = pdf.get_y()
        rows = max(len(left_pairs), len(mid_pairs), len(right_pairs), 1)
        height = 8.5 + rows * 4.6

        pdf.set_draw_color(*GRIDLINE)
        pdf.set_line_width(0.3)
        pdf.rect(x0, y0, usable, height, style="D")
        pdf.line(x0 + col1, y0, x0 + col1, y0 + height)
        pdf.line(x0 + col1 + col2, y0, x0 + col1 + col2, y0 + height)
        pdf.set_line_width(0.2)

        # Column 1: big name + its pairs.
        pdf.set_xy(x0 + 3, y0 + 2)
        pdf.set_font("Helvetica", "B", 12)
        pdf.set_text_color(*INK)
        pdf.cell(col1 - 6, 6, _txt(pdf, name or "-"))
        _strip_pairs(pdf, left_pairs, x0 + 3, y0 + 9, col1 - 6)
        _strip_pairs(pdf, mid_pairs, x0 + col1 + 3, y0 + 2.5, col2 - 6)
        _strip_pairs(pdf, right_pairs, x0 + col1 + col2 + 3, y0 + 2.5, col3 - 6)

        pdf.set_xy(left, y0 + height + 2)
        pdf.set_text_color(*INK)
    except Exception as exc:  # pragma: no cover
        print(f"patient strip error: {exc}")
        pdf.ln(2)


def _strip_pairs(pdf, pairs, x, y, w):
    for i, (label, value) in enumerate(pairs or []):
        yy = y + i * 4.6
        pdf.set_xy(x, yy)
        pdf.set_font("Helvetica", "", 6.6)
        pdf.set_text_color(*MUTED)
        pdf.cell(20, 4, _txt(pdf, f"{label}"))
        pdf.set_xy(x + 20, yy)
        pdf.set_font("Helvetica", "B", 8)
        pdf.set_text_color(*INK)
        pdf.cell(max(w - 20, 10), 4, ": " + _txt(pdf, str(value if value not in (None, "") else "-")))


def draw_footer(pdf, note: str = "Confidential clinical document - for the intended recipient only"):
    try:
        pdf.set_y(-14)
        pdf.set_draw_color(*HAIRLINE)
        pdf.set_line_width(0.3)
        pdf.line(pdf.l_margin, pdf.get_y(), pdf.w - pdf.r_margin, pdf.get_y())
        pdf.set_line_width(0.2)
        pdf.ln(1.5)
        pdf.set_font("Helvetica", "", 7)
        pdf.set_text_color(*FAINT)
        pdf.cell(0, 4, _txt(pdf, note), align="L")
        pdf.set_font("Helvetica", "", 7)
        pdf.set_text_color(*MUTED)
        pdf.cell(0, 4, f"Page {pdf.page_no()}/{{nb}}", align="R")
        pdf.set_text_color(*INK)
    except Exception as exc:  # pragma: no cover
        print(f"footer error: {exc}")


# --------------------------------------------------------------------------- #
#  Section heading
# --------------------------------------------------------------------------- #

def section_heading(pdf, title: str, min_space: float = 34):
    """Uppercase bold heading closed by a full-width hairline rule."""
    try:
        if pdf.get_y() > pdf.h - min_space:
            pdf.add_page()
        pdf.ln(1)
        pdf.set_font("Helvetica", "B", 10.5)
        pdf.set_text_color(*INK)
        pdf.cell(0, 6, _txt(pdf, title).upper(), ln=1)
        y = pdf.get_y() + 0.4
        pdf.set_draw_color(*HAIRLINE)
        pdf.set_line_width(0.4)
        pdf.line(pdf.l_margin, y, pdf.w - pdf.r_margin, y)
        pdf.set_line_width(0.2)
        pdf.ln(3.5)
        pdf.set_text_color(*INK)
    except Exception as exc:
        print(f"section_heading error: {exc}")


# --------------------------------------------------------------------------- #
#  Key / value row
# --------------------------------------------------------------------------- #

def key_value(pdf, key: str, value, key_width: float = 46):
    try:
        if pdf.get_y() > pdf.h - 18:
            pdf.add_page()
        vw = content_width(pdf) - key_width
        value_text = _txt(pdf, value if (value is not None and str(value).strip()) else "-")

        # Label
        pdf.set_font("Helvetica", "", 9)
        pdf.set_text_color(*MUTED)
        pdf.cell(key_width, 5.6, _txt(pdf, key), 0, 0, "L")

        # Value (manual wrap so we never depend on multi_cell's cursor mode,
        # which differs between the two report base classes).
        pdf.set_font("Helvetica", "B", 9)
        pdf.set_text_color(*INK)
        value_x = pdf.l_margin + key_width
        lines = _wrap_lines(pdf, value_text, vw) or ["-"]
        pdf.cell(vw, 5.6, lines[0], 0, 1, "L")
        for extra in lines[1:]:
            pdf.set_x(value_x)
            pdf.cell(vw, 5.2, extra, 0, 1, "L")
        pdf.ln(1.4)
        pdf.set_text_color(*INK)
    except Exception as exc:
        print(f"key_value error: {exc}")


# --------------------------------------------------------------------------- #
#  Encounter / demographics grid
# --------------------------------------------------------------------------- #

def demographics_grid(pdf, items, ncols: int = 3):
    """Render (label, value) items as a bordered grid — ``ncols`` per row.

    Each cell shows a small muted label above a bold value, on a faint fill with
    hairline separators. This is the signature "hospital encounter header".
    """
    try:
        items = [(str(k), ("-" if v is None or str(v).strip() == "" else str(v))) for k, v in items]
        if not items:
            return
        cw = content_width(pdf)
        col_w = cw / ncols
        row_h = 13.0
        rows = (len(items) + ncols - 1) // ncols

        if pdf.get_y() > pdf.h - (rows * row_h + 12):
            pdf.add_page()

        x0 = pdf.l_margin
        y0 = pdf.get_y()

        for r in range(rows):
            for c in range(ncols):
                idx = r * ncols + c
                x = x0 + c * col_w
                y = y0 + r * row_h
                # cell fill + border
                pdf.set_fill_color(*LABEL_FILL)
                pdf.set_draw_color(*GRIDLINE)
                pdf.set_line_width(0.2)
                pdf.rect(x, y, col_w, row_h, "DF")
                if idx >= len(items):
                    continue
                label, value = items[idx]
                # label
                pdf.set_xy(x + 3, y + 2.2)
                pdf.set_font("Helvetica", "", 7.3)
                pdf.set_text_color(*MUTED)
                pdf.cell(col_w - 6, 3.4, _txt(pdf, label).upper())
                # value (auto-fit)
                pdf.set_xy(x + 3, y + 6.2)
                val = _fit(pdf, _txt(pdf, value), col_w - 6, "Helvetica", "B", 9.5, 7.5)
                pdf.set_text_color(*INK)
                pdf.cell(col_w - 6, 5, val)

        pdf.set_y(y0 + rows * row_h)
        pdf.ln(3)
        pdf.set_text_color(*INK)
        pdf.set_line_width(0.2)
    except Exception as exc:
        print(f"demographics_grid error: {exc}")


def _fit(pdf, text, width, family, style, size, min_size):
    """Shrink font until text fits ``width``; truncate with ellipsis if needed."""
    size = float(size)
    while size >= min_size:
        pdf.set_font(family, style, size)
        if pdf.get_string_width(text) <= width:
            return text
        size -= 0.5
    pdf.set_font(family, style, min_size)
    if pdf.get_string_width(text) <= width:
        return text
    ell = "..."
    t = text
    while t and pdf.get_string_width(t + ell) > width:
        t = t[:-1]
    return (t + ell) if t else text


# --------------------------------------------------------------------------- #
#  Data table
# --------------------------------------------------------------------------- #

def data_table(pdf, columns, rows, aligns=None, zebra=True, header_fill=PANEL):
    """Generic table.

    ``columns`` = list of (title, width). ``rows`` = list of row-lists; a cell
    may be a plain string or a ``(text, rgb)`` tuple to colour that cell.
    """
    try:
        aligns = aligns or ["L"] * len(columns)
        total = sum(w for _, w in columns)
        # header
        _table_check_space(pdf, 16)
        pdf.set_font("Helvetica", "B", 8.6)
        pdf.set_fill_color(*header_fill)
        pdf.set_draw_color(*GRIDLINE)
        pdf.set_line_width(0.2)
        pdf.set_text_color(*INK)
        for (title, w), a in zip(columns, aligns):
            pdf.cell(w, 8, _txt(pdf, title), border="B", align=a, fill=True)
        pdf.ln(8)
        # body
        pdf.set_font("Helvetica", "", 8.6)
        for i, row in enumerate(rows):
            _table_check_space(pdf, 8)
            fill = zebra and (i % 2 == 1)
            if fill:
                pdf.set_fill_color(*ZEBRA)
            for (col, a), cell in zip(zip(columns, aligns), row):
                (title, w), align = col, a
                if isinstance(cell, tuple):
                    text, rgb = cell
                    bold = True
                else:
                    text, rgb, bold = cell, INK, False
                pdf.set_font("Helvetica", "B" if bold else "", 8.6)
                pdf.set_text_color(*rgb)
                pdf.cell(w, 7, _txt(pdf, text), border="B", align=align, fill=fill)
            pdf.ln(7)
        pdf.set_text_color(*INK)
        pdf.set_line_width(0.2)
    except Exception as exc:
        print(f"data_table error: {exc}")


def _table_check_space(pdf, need):
    if pdf.get_y() > pdf.h - pdf.b_margin - need:
        pdf.add_page()


# --------------------------------------------------------------------------- #
#  Clinical impression / finding banner
# --------------------------------------------------------------------------- #

def finding_banner(pdf, headline: str, body: str = "", tone=INK, score=None, score_max=None):
    """A framed clinical-impression block. Optional big score chip on the left
    (mirrors the sample's overall-score box)."""
    try:
        cw = content_width(pdf)
        x = pdf.l_margin
        y = pdf.get_y()
        pad = 5
        has_score = score is not None
        chip = 30 if has_score else 0
        text_x = x + chip + (pad if has_score else pad)
        text_w = cw - chip - (pad * 2 if has_score else pad * 2)

        # measure body height
        pdf.set_font("Helvetica", "", 9)
        lines = _wrap_lines(pdf, _txt(pdf, body), text_w) if body else []
        box_h = max(24 if has_score else 16, 10 + len(lines) * 5.0 + 6)

        _table_check_space(pdf, box_h + 4)
        y = pdf.get_y()

        # panel
        pdf.set_fill_color(*PANEL)
        pdf.set_draw_color(*HAIRLINE)
        pdf.set_line_width(0.2)
        pdf.rect(x, y, cw, box_h, "DF")
        # left tone accent
        pdf.set_fill_color(*tone)
        pdf.rect(x, y, 2.4, box_h, "F")

        if has_score:
            # score chip
            sx = x + 6
            sy = y + (box_h - 20) / 2
            pdf.set_draw_color(*tone)
            pdf.set_line_width(0.6)
            pdf.rect(sx, sy, 22, 20, "D")
            pdf.set_line_width(0.2)
            pdf.set_font("Helvetica", "B", 19)
            pdf.set_text_color(*tone)
            pdf.set_xy(sx, sy + 3.5)
            pdf.cell(22, 9, _txt(pdf, str(score)), align="C")
            if score_max is not None:
                pdf.set_font("Helvetica", "", 7)
                pdf.set_text_color(*MUTED)
                pdf.set_xy(sx, sy + 13.5)
                pdf.cell(22, 4, f"/ {score_max}", align="C")

        # headline
        pdf.set_xy(text_x, y + 4)
        pdf.set_font("Helvetica", "B", 12)
        pdf.set_text_color(*tone)
        pdf.cell(text_w, 6.5, _txt(pdf, headline))
        # body
        if lines:
            pdf.set_font("Helvetica", "", 9)
            pdf.set_text_color(*BODY)
            ty = y + 11.5
            for ln in lines:
                pdf.set_xy(text_x, ty)
                pdf.cell(text_w, 5, ln)
                ty += 5

        pdf.set_y(y + box_h + 4)
        pdf.set_text_color(*INK)
    except Exception as exc:
        print(f"finding_banner error: {exc}")


def _wrap_lines(pdf, text, width):
    words = text.split()
    lines, cur = [], ""
    for w in words:
        trial = (cur + " " + w).strip()
        if pdf.get_string_width(trial) <= width:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


# --------------------------------------------------------------------------- #
#  Info panel (bulleted) + alert callout
# --------------------------------------------------------------------------- #

def info_panel(pdf, title, items, accent=BRAND):
    """Light neutral panel with an optional title and bullet/paragraph items.

    ``items`` entries: a string (paragraph) or ``("bullet", text)``. Bold spans
    written as ``**word**`` are rendered bold.
    """
    try:
        cw = content_width(pdf)
        x = pdf.l_margin
        inner_x = x + 6
        inner_w = cw - 11

        # rough height estimate for page-break decision
        est = 8 + (len(items) * 9) + (7 if title else 0)
        if pdf.get_y() > pdf.h - min(est, pdf.h * 0.5) - 8:
            if est < pdf.h - pdf.t_margin - pdf.b_margin - 20:
                pdf.add_page()

        if title:
            pdf.ln(1)
            pdf.set_font("Helvetica", "B", 9.5)
            pdf.set_text_color(*INK)
            pdf.cell(0, 5.5, _txt(pdf, title), ln=1)
            pdf.ln(1)

        y0 = pdf.get_y()
        pdf.set_y(y0 + 3)

        for item in items:
            is_bullet = isinstance(item, tuple) and item[0] == "bullet"
            text = item[1] if is_bullet else item
            if is_bullet:
                pdf.set_x(inner_x)
                pdf.set_font("Helvetica", "B", 9)
                pdf.set_text_color(*accent)
                pdf.cell(4, 5, "-", 0, 0, "L")
                _rich(pdf, _txt(pdf, text), inner_x + 4, inner_w - 4, 5, BODY)
            else:
                _rich(pdf, _txt(pdf, text), inner_x, inner_w, 5, BODY)
            pdf.ln(1.6)

        y1 = pdf.get_y()
        h = y1 - y0 + 3
        # draw fill behind (re-render text on top)
        pdf.set_fill_color(*PANEL)
        pdf.set_draw_color(*HAIRLINE)
        pdf.set_line_width(0.2)
        pdf.rect(x, y0, cw, h, "DF")
        pdf.set_fill_color(*accent)
        pdf.rect(x, y0, 2.2, h, "F")

        pdf.set_y(y0 + 3)
        for item in items:
            is_bullet = isinstance(item, tuple) and item[0] == "bullet"
            text = item[1] if is_bullet else item
            if is_bullet:
                pdf.set_x(inner_x)
                pdf.set_font("Helvetica", "B", 9)
                pdf.set_text_color(*accent)
                pdf.cell(4, 5, "-", 0, 0, "L")
                _rich(pdf, _txt(pdf, text), inner_x + 4, inner_w - 4, 5, BODY)
            else:
                _rich(pdf, _txt(pdf, text), inner_x, inner_w, 5, BODY)
            pdf.ln(1.6)

        pdf.set_y(y0 + h + 4)
        pdf.set_text_color(*INK)
    except Exception as exc:
        print(f"info_panel error: {exc}")


def _rich(pdf, text, x, width, lh, color):
    """Render text with **bold** spans, wrapping within ``width`` from ``x``.

    Leaves the cursor on the line *below* the last rendered line so callers can
    keep stacking content (FPDF ``cell`` with ln=0 does not advance Y itself)."""
    pdf.set_text_color(*color)
    parts = text.split("**")
    start_y = pdf.get_y()
    pdf.set_xy(x, start_y)
    cur_x = x
    for i, part in enumerate(parts):
        if part == "":
            continue
        bold = (i % 2 == 1)
        pdf.set_font("Helvetica", "B" if bold else "", 9)
        for word in _tokenize(part):
            ww = pdf.get_string_width(word)
            if cur_x + ww > x + width and word.strip():
                pdf.ln(lh)
                pdf.set_x(x)
                cur_x = x
                if word == " ":
                    continue
            pdf.cell(ww, lh, word)
            cur_x += ww
    # Advance to the next line baseline (Y did not move for the final line).
    pdf.set_xy(x, pdf.get_y() + lh)


def _tokenize(s):
    out, cur = [], ""
    for ch in s:
        if ch == " ":
            if cur:
                out.append(cur)
                cur = ""
            out.append(" ")
        else:
            cur += ch
    if cur:
        out.append(cur)
    return out


def alert_callout(pdf, title, text):
    """Amber warning callout (pale fill, amber left border) — for clinical flags."""
    try:
        cw = content_width(pdf)
        x = pdf.l_margin
        if title:
            pdf.set_font("Helvetica", "B", 9.5)
            pdf.set_text_color(*DANGER)
            pdf.cell(0, 5.5, _txt(pdf, title).upper(), ln=1)
            pdf.ln(1)
        y0 = pdf.get_y()
        pdf.set_font("Helvetica", "", 9)
        lines = _wrap_lines(pdf, _txt(pdf, text), cw - 12)
        h = 5 + len(lines) * 5 + 3
        _table_check_space(pdf, h + 2)
        y0 = pdf.get_y()
        pdf.set_fill_color(*ALERT_FILL)
        pdf.set_draw_color(*ALERT_BORDER)
        pdf.set_line_width(0.4)
        pdf.rect(x, y0, cw, h, "DF")
        pdf.set_fill_color(*ALERT_BORDER)
        pdf.rect(x, y0, 2.4, h, "F")
        pdf.set_line_width(0.2)
        pdf.set_text_color(*ALERT_TEXT)
        ty = y0 + 3.5
        for ln in lines:
            pdf.set_xy(x + 6, ty)
            pdf.cell(cw - 12, 5, ln)
            ty += 5
        pdf.set_y(y0 + h + 4)
        pdf.set_text_color(*INK)
    except Exception as exc:
        print(f"alert_callout error: {exc}")


# --------------------------------------------------------------------------- #
#  Disclaimer + signature
# --------------------------------------------------------------------------- #

def disclaimer(pdf, lines, heading="DISCLAIMER"):
    try:
        cw = content_width(pdf)
        x = pdf.l_margin
        body = "  ".join(str(l) for l in lines) if isinstance(lines, (list, tuple)) else str(lines)
        text = f"{heading}: {body}"
        pdf.ln(2)
        pdf.set_font("Helvetica", "I", 7.8)
        wrapped = _wrap_lines(pdf, _txt(pdf, text), cw - 10)
        h = 4 + len(wrapped) * 4.4 + 3
        _table_check_space(pdf, h + 2)
        y0 = pdf.get_y()
        pdf.set_fill_color(*PANEL)
        pdf.set_draw_color(*HAIRLINE)
        pdf.set_line_width(0.2)
        pdf.rect(x, y0, cw, h, "DF")
        pdf.set_text_color(*MUTED)
        ty = y0 + 3
        for ln in wrapped:
            pdf.set_xy(x + 5, ty)
            pdf.cell(cw - 10, 4.4, ln)
            ty += 4.4
        pdf.set_y(y0 + h + 4)
        pdf.set_text_color(*INK)
    except Exception as exc:
        print(f"disclaimer error: {exc}")


def _signature_block(pdf, x, width, y, name, role="", date_str=None):
    """Draw one electronic-signature block (line, name, role, optional date)
    at a fixed x/width, without moving the shared cursor."""
    pdf.set_draw_color(*INK)
    pdf.set_line_width(0.4)
    pdf.line(x, y, x + width, y)
    pdf.set_line_width(0.2)
    pdf.set_xy(x, y + 1.5)
    pdf.set_font("Helvetica", "", 7.5)
    pdf.set_text_color(*MUTED)
    pdf.cell(width, 4, "Electronically Signed By", align="C")
    pdf.set_xy(x, y + 6)
    pdf.set_font("Helvetica", "B", 9.5)
    pdf.set_text_color(*INK)
    pdf.cell(width, 5, _txt(pdf, name or "-"), align="C")
    if role:
        pdf.set_xy(x, y + 11)
        pdf.set_font("Helvetica", "", 7.8)
        pdf.set_text_color(*MUTED)
        pdf.cell(width, 4, _txt(pdf, role), align="C")
    if date_str:
        pdf.set_xy(x, y + 15)
        pdf.set_font("Helvetica", "", 7.8)
        pdf.set_text_color(*MUTED)
        pdf.cell(width, 4, _txt(pdf, "Date: " + date_str), align="C")


_SIGNATURE_BLOCK_HEIGHT = 20  # line + caption + name + role/date, see _signature_block


def _ensure_room_for_signature(pdf, gap=14):
    """Force a page break BEFORE drawing a signature block if it wouldn't
    fully fit, rather than relying on fpdf2's automatic page break (which
    can fire between the individual cell() calls inside one block and split
    a single signature across two pages)."""
    needed = gap + _SIGNATURE_BLOCK_HEIGHT
    if pdf.get_y() + needed > pdf.h - pdf.b_margin:
        pdf.add_page()
    pdf.ln(gap)


def signature(pdf, name, role="", date_str=None):
    try:
        _ensure_room_for_signature(pdf)
        right = pdf.w - pdf.r_margin
        line_w = 74
        lx = right - line_w
        y = pdf.get_y()
        _signature_block(pdf, lx, line_w, y, name, role, date_str)
        pdf.set_y(y + _SIGNATURE_BLOCK_HEIGHT)
        pdf.set_text_color(*INK)
    except Exception as exc:
        print(f"signature error: {exc}")


def dual_signature(pdf, left_name, left_role, right_name, right_role):
    """Two electronic-signature blocks on the same line, no dates: the
    analyst/technician on the left, the referring doctor on the right."""
    try:
        _ensure_room_for_signature(pdf)
        y = pdf.get_y()
        line_w = 74
        left_x = pdf.l_margin
        right_x = pdf.w - pdf.r_margin - line_w
        _signature_block(pdf, left_x, line_w, y, left_name, left_role)
        _signature_block(pdf, right_x, line_w, y, right_name, right_role)
        pdf.set_y(y + _SIGNATURE_BLOCK_HEIGHT)
        pdf.set_text_color(*INK)
    except Exception as exc:
        print(f"dual_signature error: {exc}")


def image_caption(pdf, title):
    pdf.set_font("Helvetica", "B", 8.6)
    pdf.set_text_color(*INK)
    pdf.cell(0, 5.5, _txt(pdf, title), ln=1)
    pdf.ln(1.5)
