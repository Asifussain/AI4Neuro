"""
Chart generation for MRI Brain Scan analysis.
Renders real data (volume vs. normative range, per-class prediction confidence)
as PNG charts embedded in the pipeline result and PDF reports.
"""

import io
import base64
from typing import Dict, Any, List
import numpy as np
import matplotlib
matplotlib.use('Agg')  # Non-interactive backend
import matplotlib.pyplot as plt
from app.pipelines.mri.config import DISEASE_INFO


def generate_volume_comparison_chart(ml_results: Dict[str, Any]) -> str:
    """
    Generate a chart comparing patient brain volumes with normative ranges.

    Args:
        ml_results: ML model results containing volume measurements

    Returns:
        Base64 encoded PNG image
    """
    from app.pipelines.mri.volumetric_analyzer import generate_volumetric_comparison_figure
    from app.pipelines.mri.config import NORMATIVE_VOLUMES

    volumes = {
        'brain_volume': ml_results.get('brain_volume', 0),
        'gm_volume': ml_results.get('gm_volume', 0),
        'wm_volume': ml_results.get('wm_volume', 0),
        'csf_volume': ml_results.get('csf_volume', 0),
        'hippocampal_volume': ml_results.get('hippocampal_volume', 0),
        'ventricular_volume': ml_results.get('ventricular_volume', 0),
    }

    return generate_volumetric_comparison_figure(volumes, NORMATIVE_VOLUMES)


def generate_confidence_chart(probabilities: List[float], classes: List[str]) -> str:
    """
    Generate a horizontal bar chart showing prediction confidence for each class.

    Args:
        probabilities: List of probabilities for each class
        classes: List of class names

    Returns:
        Base64 encoded PNG image
    """
    fig, ax = plt.subplots(figsize=(8, 4))

    y_pos = np.arange(len(classes))
    values = [p * 100 for p in probabilities]

    # Colors based on disease
    colors = [DISEASE_INFO.get(cls, {}).get('hex_color', '#808080') for cls in classes]

    bars = ax.barh(y_pos, values, color=colors, edgecolor='white', height=0.6)

    ax.set_yticks(y_pos)
    ax.set_yticklabels([DISEASE_INFO.get(c, {}).get('full_name', c) for c in classes], fontsize=10)
    ax.set_xlabel('Confidence (%)', fontsize=11)
    ax.set_title('AI Prediction Confidence Distribution', fontsize=12, fontweight='bold')
    ax.set_xlim(0, 100)

    # Add value labels
    for bar, val in zip(bars, values):
        ax.text(val + 1, bar.get_y() + bar.get_height()/2,
                f'{val:.1f}%', va='center', fontsize=10, fontweight='bold')

    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.grid(axis='x', alpha=0.3)

    plt.tight_layout()

    buffer = io.BytesIO()
    plt.savefig(buffer, format='png', dpi=150, bbox_inches='tight',
                facecolor='white', edgecolor='none')
    buffer.seek(0)
    image_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
    plt.close(fig)

    return f"data:image/png;base64,{image_base64}"
