"""
Volumetric Analysis for MRI Brain Scans.
Extracts real brain tissue volumes from CAT12's own XML reports (the
authoritative source - CAT12 computes these during segmentation) and
generates appealing comparison figures for clinical/radiologist reports.
"""

import io
import re
import base64
import logging
import xml.etree.ElementTree as ET
import numpy as np
import nibabel as nib
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


# =============================================================================
# REAL VOLUME EXTRACTION (from CAT12's own XML reports)
# =============================================================================

def _parse_matlab_vector(text: str) -> list[float]:
    """Parse a MATLAB-style ``[1.2 3.4 5.6]`` or ``[1.2;3.4;5.6]`` vector."""
    inner = text.strip().strip("[]")
    parts = re.split(r"[;\s]+", inner.strip())
    return [float(p) for p in parts if p]


def _find_real_subjectmeasures(root: ET.Element) -> Optional[ET.Element]:
    """``cat_<subject>.xml`` has multiple ``<subjectmeasures>`` blocks: two are
    plain-text field-name legends (``vol_TIV`` = "total intracranial volume
    (GM+WM+VT)"), one holds the actual numbers. Return the one with a
    numeric ``vol_TIV``."""
    for node in root.iter("subjectmeasures"):
        tiv = node.find("vol_TIV")
        if tiv is None or tiv.text is None:
            continue
        try:
            float(tiv.text.strip())
        except ValueError:
            continue
        return node
    return None


def extract_volumes_from_cat12_xml(
    report_xml_path: str, roi_xml_path: Optional[str] = None
) -> Dict[str, float]:
    """Extract real tissue + regional volumes from CAT12's per-subject XML
    reports (``report/cat_<subject>.xml`` and ``label/catROI_<subject>.xml``).

    Returns the same dict shape the pipeline/report code already expects:
    brain, gm, wm, csf, hippo, ventricles (all in cm^3/ml - CAT12 reports in
    ml, which is numerically identical to cm^3).
    """
    tree = ET.parse(report_xml_path)
    root = tree.getroot()

    measures = _find_real_subjectmeasures(root)
    if measures is None:
        raise ValueError(f"No numeric <subjectmeasures> block found in {report_xml_path}")

    tiv = float(measures.find("vol_TIV").text.strip())
    # vol_abs_CGW = [CSF, GM, WM, WMH, StrokeLesion] in ml (CAT12 tissue order).
    csf, gm, wm = _parse_matlab_vector(measures.find("vol_abs_CGW").text)[:3]

    volumes = {
        "brain": round(gm + wm, 2),
        "gm": round(gm, 2),
        "wm": round(wm, 2),
        "csf": round(csf, 2),
        "tiv": round(tiv, 2),
        "hippo": 0.0,
        "ventricles": 0.0,
    }

    if roi_xml_path:
        try:
            regional = _extract_regional_volumes(roi_xml_path)
            volumes["hippo"] = regional.get("hippo", 0.0)
            volumes["ventricles"] = regional.get("ventricles", 0.0)
        except Exception as exc:  # noqa: BLE001 - regional detail is a bonus, not required
            logger.warning("ROI volume extraction failed for %s: %s", roi_xml_path, exc)

    logger.info("Extracted real CAT12 volumes: %s", volumes)
    return volumes


def _extract_regional_volumes(roi_xml_path: str) -> Dict[str, float]:
    """Sum grey-matter volume for hippocampus and CSF volume for ventricles
    across whichever ROI atlases CAT12 produced (``catROI_<subject>.xml``).
    Matches by region name substring so it's robust to atlas choice."""
    tree = ET.parse(roi_xml_path)
    root = tree.getroot()

    hippo_total = 0.0
    ventricle_total = 0.0

    for atlas in root:  # each child is one atlas, e.g. <neuromorphometrics>
        names_el = atlas.find("names")
        data_el = atlas.find("data")
        if names_el is None or data_el is None:
            continue
        names = [item.text or "" for item in names_el.findall("item")]

        vgm_el = data_el.find("Vgm")
        vcsf_el = data_el.find("Vcsf")
        vgm = _parse_matlab_vector(vgm_el.text) if vgm_el is not None and vgm_el.text else []
        vcsf = _parse_matlab_vector(vcsf_el.text) if vcsf_el is not None and vcsf_el.text else []

        for idx, name in enumerate(names):
            lname = name.lower()
            if "hippocampus" in lname and idx < len(vgm):
                hippo_total += vgm[idx]
            if "ventricle" in lname and idx < len(vcsf):
                ventricle_total += vcsf[idx]

    return {"hippo": round(hippo_total, 2), "ventricles": round(ventricle_total, 2)}


# =============================================================================
# TISSUE MAP SLICE GRIDS (mwp1/mwp2 -> report images)
# =============================================================================

def _band_indices_for_display(data: np.ndarray, axis: int, band_size: int, num_display: int) -> list[int]:
    """Mirror nifti_slicer.py's band selection (content-bbox center, axis-2
    band) so the slices shown here are drawn from the same window the
    classifier actually used, then evenly subsample ``num_display`` of them
    for a representative spread across that window."""
    brain_mask = data > 10
    idx_along_axis = np.nonzero(brain_mask)[axis]
    if len(idx_along_axis) == 0:
        lo, hi = 0, data.shape[axis] - 1
    else:
        lo, hi = int(idx_along_axis.min()), int(idx_along_axis.max())
    center = (lo + hi) // 2
    start = max(0, center - band_size // 2)
    end = min(data.shape[axis], start + band_size)
    band = list(range(start, end))
    if len(band) <= num_display:
        return band
    # Evenly-spaced positions within the band (first, last, and spread between).
    positions = np.linspace(0, len(band) - 1, num_display, dtype=int)
    return [band[p] for p in positions]


def _normalize_volume(data: np.ndarray) -> np.ndarray:
    """Same whole-volume 99th-percentile-clip normalization as
    nifti_slicer.py, for visual consistency with the classified slices."""
    p99 = np.percentile(data, 99)
    if p99 == 0:
        return data
    return np.clip(data, 0, p99) / p99 * 255.0


def _slice_grid_figure(data: np.ndarray, indices: list[int], suptitle: str):
    """Render a 2x3 grid of axial slices at ``indices`` as one matplotlib
    figure. Caller supplies already-normalized data."""
    n = len(indices)
    ncols = 3
    nrows = -(-n // ncols)  # ceil
    fig, axes = plt.subplots(nrows, ncols, figsize=(9, 3.1 * nrows))
    axes = np.atleast_1d(axes).flatten()

    for ax, idx in zip(axes, indices):
        sl = np.rot90(data[:, :, idx])
        ax.imshow(sl, cmap="gray", aspect="equal", interpolation="bilinear")
        ax.set_title(f"Slice {idx}", fontsize=9, color="#475569")
        ax.axis("off")
    for ax in axes[n:]:
        ax.axis("off")

    fig.suptitle(suptitle, fontsize=12, color="#1e293b", fontweight="bold", y=0.98)
    plt.tight_layout(rect=[0, 0, 1, 0.94])
    return fig


def generate_tissue_map_grids(
    mwp1_path: str, mwp2_path: Optional[str] = None, num_display: int = 6, band_size: int = 10
) -> tuple[Optional[str], Optional[str]]:
    """Build a 2x3 grid of representative axial slices each for the grey
    matter (mwp1) and white matter (mwp2) maps, as base64 PNG data-URIs for
    the report. Slice positions are drawn from the same content-centered
    band the classifier used (see nifti_slicer.py), and the SAME positions
    are used for both maps so they're anatomically paired side by side.
    Returns (gm_grid, wm_grid); either may be ``None`` if that file is
    missing or fails to render - this is supplementary, never worth failing
    the pipeline over."""
    gm_grid = wm_grid = None
    try:
        gm_img = nib.load(mwp1_path)
        gm_data = _normalize_volume(gm_img.get_fdata())
        indices = _band_indices_for_display(gm_data, axis=2, band_size=band_size, num_display=num_display)

        fig = _slice_grid_figure(gm_data, indices, "Grey Matter (mwp1) - Representative Slices")
        buffer = io.BytesIO()
        fig.savefig(buffer, format="png", dpi=220, bbox_inches="tight", facecolor="white")
        buffer.seek(0)
        gm_grid = f"data:image/png;base64,{base64.b64encode(buffer.getvalue()).decode('utf-8')}"
        plt.close(fig)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Could not render grey matter slice grid %s: %s", mwp1_path, exc)
        return None, None

    if mwp2_path:
        try:
            wm_img = nib.load(mwp2_path)
            wm_data = _normalize_volume(wm_img.get_fdata())
            # Reuse the GM-derived indices so both grids show the same
            # physical slice positions (mwp1/mwp2 share the same voxel grid
            # post-CAT12 registration).
            fig = _slice_grid_figure(wm_data, indices, "White Matter (mwp2) - Representative Slices")
            buffer = io.BytesIO()
            fig.savefig(buffer, format="png", dpi=220, bbox_inches="tight", facecolor="white")
            buffer.seek(0)
            wm_grid = f"data:image/png;base64,{base64.b64encode(buffer.getvalue()).decode('utf-8')}"
            plt.close(fig)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Could not render white matter slice grid %s: %s", mwp2_path, exc)

    return gm_grid, wm_grid


# =============================================================================
# FIGURE GENERATION
# =============================================================================

def generate_volumetric_comparison_figure(
    volumes: Dict[str, Any],
    normative_volumes: Dict[str, Dict]
) -> str:
    """
    Generate a polished horizontal range chart comparing patient brain volumes
    with normative ranges. Suitable for embedding in medical report PDFs.

    Args:
        volumes: Dict with keys brain_volume, gm_volume, wm_volume, etc.
        normative_volumes: Dict from config with min/max/unit per region

    Returns:
        Base64 encoded PNG (data:image/png;base64,...)
    """
    # Map volume keys
    regions = [
        {
            'label': 'Total Brain Volume',
            'value': volumes.get('brain_volume', 0),
            'norm_key': 'total_brain',
        },
        {
            'label': 'Gray Matter',
            'value': volumes.get('gm_volume', 0),
            'norm_key': 'gray_matter',
        },
        {
            'label': 'White Matter',
            'value': volumes.get('wm_volume', 0),
            'norm_key': 'white_matter',
        },
        {
            'label': 'CSF',
            'value': volumes.get('csf_volume', 0),
            'norm_key': 'csf',
        },
        {
            'label': 'Hippocampus',
            'value': volumes.get('hippocampal_volume', 0),
            'norm_key': 'hippocampus',
        },
    ]

    # Filter out regions with zero values
    regions = [r for r in regions if r['value'] and r['value'] > 0]

    if not regions:
        return _generate_fallback_chart(volumes, normative_volumes)

    n_regions = len(regions)
    fig, ax = plt.subplots(figsize=(11, max(4, n_regions * 1.1 + 1.5)))

    # Colors
    color_normal = '#10b981'     # Emerald green
    color_warning = '#f59e0b'    # Amber
    color_danger = '#ef4444'     # Red
    color_range_fill = '#d1fae5' # Light green fill
    color_range_border = '#6ee7b7'
    color_bg_bar = '#f1f5f9'     # Light slate
    color_text = '#1e293b'       # Slate 800
    color_text_light = '#64748b' # Slate 500

    y_positions = list(range(n_regions - 1, -1, -1))

    for i, region in enumerate(regions):
        y = y_positions[i]
        norm = normative_volumes.get(region['norm_key'], {})
        norm_min = norm.get('min', 0)
        norm_max = norm.get('max', 100)
        unit = norm.get('unit', 'cm\u00b3')
        patient_val = region['value']

        # Determine scale: show from 0 to max(norm_max * 1.3, patient_val * 1.15)
        scale_max = max(norm_max * 1.35, patient_val * 1.2)

        # Background bar (full scale)
        ax.barh(y, scale_max, height=0.55, color=color_bg_bar, edgecolor='none', zorder=1)

        # Normative range band
        ax.barh(y, norm_max - norm_min, left=norm_min, height=0.55,
                color=color_range_fill, edgecolor=color_range_border,
                linewidth=1.2, zorder=2)

        # Normative midpoint line
        norm_mid = (norm_min + norm_max) / 2
        ax.plot([norm_mid, norm_mid], [y - 0.275, y + 0.275],
                color=color_range_border, linewidth=1.5, zorder=3, linestyle='--', alpha=0.7)

        # Determine marker color based on patient value
        if norm_min <= patient_val <= norm_max:
            marker_color = color_normal
            status_label = 'Normal'
        elif patient_val < norm_min:
            deviation = (norm_min - patient_val) / norm_min
            if deviation <= 0.10:
                marker_color = color_warning
                status_label = 'Borderline Low'
            else:
                marker_color = color_danger
                status_label = 'Below Normal'
        else:
            deviation = (patient_val - norm_max) / norm_max
            if deviation <= 0.10:
                marker_color = color_warning
                status_label = 'Borderline High'
            else:
                marker_color = color_danger
                status_label = 'Above Normal'

        # Patient value marker (large circle)
        ax.scatter(patient_val, y, s=200, color=marker_color, edgecolors='white',
                   linewidths=2, zorder=5)

        # Value label to the right of the marker
        label_x = patient_val + scale_max * 0.03
        ax.text(label_x, y + 0.05, f'{patient_val:.1f} {unit}',
                fontsize=9, fontweight='bold', color=color_text,
                va='center', zorder=6)

        # Status label
        ax.text(label_x, y - 0.18, status_label,
                fontsize=7.5, color=marker_color, va='center',
                fontstyle='italic', zorder=6)

        # Range annotation (small text below the bar)
        ax.text(norm_min, y - 0.38, f'{norm_min}',
                fontsize=7, color=color_text_light, ha='center', va='top')
        ax.text(norm_max, y - 0.38, f'{norm_max}',
                fontsize=7, color=color_text_light, ha='center', va='top')

    # Y-axis labels
    ax.set_yticks(y_positions)
    ax.set_yticklabels([r['label'] for r in regions],
                       fontsize=10, fontweight='medium', color=color_text)

    # Title
    ax.set_title('Brain Volumetric Analysis\nSubject Measurements vs. Normative Ranges',
                 fontsize=13, fontweight='bold', color=color_text,
                 pad=15, loc='left')

    # Clean up axes
    ax.set_xlabel('')
    ax.set_xlim(0, None)
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.spines['bottom'].set_visible(False)
    ax.spines['left'].set_visible(False)
    ax.tick_params(axis='x', which='both', bottom=False, labelbottom=False)
    ax.tick_params(axis='y', which='both', left=False)
    ax.set_ylim(-0.7, n_regions - 0.3)

    # Legend
    legend_elements = [
        mpatches.Patch(facecolor=color_range_fill, edgecolor=color_range_border,
                       linewidth=1.2, label='Normative Range'),
        plt.Line2D([0], [0], marker='o', color='w', markerfacecolor=color_normal,
                   markersize=10, markeredgecolor='white', markeredgewidth=1.5,
                   label='Normal'),
        plt.Line2D([0], [0], marker='o', color='w', markerfacecolor=color_warning,
                   markersize=10, markeredgecolor='white', markeredgewidth=1.5,
                   label='Borderline'),
        plt.Line2D([0], [0], marker='o', color='w', markerfacecolor=color_danger,
                   markersize=10, markeredgecolor='white', markeredgewidth=1.5,
                   label='Abnormal'),
    ]
    ax.legend(handles=legend_elements, loc='lower right', fontsize=8,
              framealpha=0.9, edgecolor='#e2e8f0', fancybox=True)

    # Footnote
    fig.text(0.02, 0.01,
             'Normative ranges based on age-matched healthy adult reference data. '
             'All volumes in cm\u00b3.',
             fontsize=7, color=color_text_light, style='italic')

    plt.tight_layout(rect=[0, 0.04, 1, 1])

    # Convert to base64. dpi=300 (print-quality) - the PDF places this at a
    # fixed physical width regardless of source pixel count, so a low source
    # DPI here is what makes the chart look soft/blurry once embedded.
    buffer = io.BytesIO()
    plt.savefig(buffer, format='png', dpi=300, bbox_inches='tight',
                facecolor='white', edgecolor='none')
    buffer.seek(0)
    image_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
    plt.close(fig)

    return f"data:image/png;base64,{image_base64}"


def _generate_fallback_chart(
    volumes: Dict[str, Any],
    normative_volumes: Dict[str, Dict]
) -> str:
    """Fallback: simple bar chart if no valid volumes found."""
    fig, ax = plt.subplots(figsize=(10, 5))

    ax.text(0.5, 0.5, 'Volumetric data not available',
            ha='center', va='center', fontsize=14,
            color='#94a3b8', transform=ax.transAxes)
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis('off')

    plt.tight_layout()

    buffer = io.BytesIO()
    plt.savefig(buffer, format='png', dpi=300, bbox_inches='tight',
                facecolor='white', edgecolor='none')
    buffer.seek(0)
    image_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
    plt.close(fig)

    return f"data:image/png;base64,{image_base64}"
