"""
Mock ML Model Runner for development/testing.
Returns realistic predictions without actually processing the scan.

Used when USE_MOCK_MODEL = True in config.py, or as fallback
when the real model checkpoint is not available.
"""

import random
import numpy as np
from typing import Dict, Any, List

from config import ANALYSIS_TYPES, NORMATIVE_VOLUMES


def _run_model_mock(
    scan_path: str,
    analysis_type: str = 'multi-disease'
) -> Dict[str, Any]:
    """
    Mock ML model that returns realistic results for development.
    Generates plausible predictions and volume measurements.
    """
    # Get classes for this analysis type
    classes = ANALYSIS_TYPES.get(analysis_type, ['CN', 'MCI', 'AD'])

    # Generate plausible probability distribution
    dominant_idx = random.randint(0, len(classes) - 1)
    raw_probs = []

    for i in range(len(classes)):
        if i == dominant_idx:
            raw_probs.append(random.uniform(0.5, 0.85))
        else:
            raw_probs.append(random.uniform(0.05, 0.25))

    # Normalize to sum to 1
    total = sum(raw_probs)
    probabilities = [p / total for p in raw_probs]

    # Get prediction
    prediction = classes[np.argmax(probabilities)]
    confidence = max(probabilities)

    # Generate brain volume measurements adjusted for prediction
    volumes = _generate_mock_volumes(prediction)

    return {
        # Core prediction results
        'prediction': prediction,
        'probabilities': probabilities,
        'confidence': confidence,
        'classes': classes,
        'analysis_type': analysis_type,

        # Volume measurements
        'brain_volume': volumes['brain'],
        'gm_volume': volumes['gm'],
        'wm_volume': volumes['wm'],
        'csf_volume': volumes['csf'],
        'hippocampal_volume': volumes['hippo'],
        'ventricular_volume': volumes['ventricles'],

        # Model metadata
        'model_version': 'mock-v1.0',
        'processing_time': random.randint(45, 180),
        'used_cat12': False,

        # Quality metrics
        'scan_quality': random.choice(['Excellent', 'Good', 'Acceptable']),
        'motion_artifacts': random.choice(['None', 'Minimal', 'Moderate']),

        # Status
        'status': 'success'
    }


def _generate_mock_volumes(prediction: str) -> Dict[str, float]:
    """Generate realistic brain volume measurements based on prediction."""
    base = 1300

    if prediction == 'AD':
        factor = 0.85
    elif prediction == 'MCI':
        factor = 0.92
    else:
        factor = 1.0

    return {
        'brain': round(base * factor, 2),
        'gm': round(base * 0.45 * factor, 2),
        'wm': round(base * 0.40 * factor, 2),
        'csf': round(base * 0.15 * (2 - factor), 2),
        'hippo': round(4.0 * factor, 2),
        'ventricles': round(30.0 * (2 - factor), 2)
    }
