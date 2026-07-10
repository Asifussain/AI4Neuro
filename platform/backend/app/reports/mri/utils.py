"""
Utility functions for the MRI Platform Backend.
"""

import json
import base64
import re
from datetime import datetime, date
from typing import Any, Optional, Union
import numpy as np


class NpEncoder(json.JSONEncoder):
    """
    Custom JSON encoder that handles NumPy types.
    Use this when serializing data that may contain numpy arrays or scalars.
    """
    def default(self, obj: Any) -> Any:
        if isinstance(obj, np.integer):
            return int(obj)
        if isinstance(obj, np.floating):
            return float(obj)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        return super().default(obj)


def sanitize_for_pdf(text: str) -> str:
    """
    Sanitize text for PDF rendering with Helvetica font.
    Removes or replaces characters that cannot be rendered.

    Args:
        text: Input text string

    Returns:
        Sanitized text safe for PDF rendering
    """
    if not isinstance(text, str):
        text = str(text) if text is not None else ''

    # Replace common problematic characters
    replacements = {
        '\u2018': "'",   # Left single quote
        '\u2019': "'",   # Right single quote
        '\u201c': '"',   # Left double quote
        '\u201d': '"',   # Right double quote
        '\u2013': '-',   # En dash
        '\u2014': '--',  # Em dash
        '\u2026': '...', # Ellipsis
        '\u00b2': '2',   # Superscript 2
        '\u00b3': '3',   # Superscript 3
        '\u00b0': ' deg',  # Degree symbol
        '\u00b5': 'u',   # Micro symbol
        '\u2022': '-',   # Bullet
        '\u00a0': ' ',   # Non-breaking space
        '\u03bc': 'u',   # Greek mu
        '\u03b1': 'alpha',
        '\u03b2': 'beta',
        '\u03b3': 'gamma',
        '\u03b4': 'delta',
        '\u03b8': 'theta',
    }

    for old, new in replacements.items():
        text = text.replace(old, new)

    # Remove any remaining non-ASCII characters that might cause issues
    text = re.sub(r'[^\x00-\x7F]+', '', text)

    return text


def calculate_age(date_of_birth: Union[str, date, datetime, None]) -> Optional[int]:
    """
    Calculate age from date of birth.

    Args:
        date_of_birth: DOB as string, date, or datetime object

    Returns:
        Age in years, or None if calculation fails
    """
    if not date_of_birth:
        return None

    try:
        if isinstance(date_of_birth, str):
            # Try common date formats
            for fmt in ['%Y-%m-%d', '%d-%m-%Y', '%m/%d/%Y', '%Y/%m/%d']:
                try:
                    dob = datetime.strptime(date_of_birth.split('T')[0], fmt).date()
                    break
                except ValueError:
                    continue
            else:
                return None
        elif isinstance(date_of_birth, datetime):
            dob = date_of_birth.date()
        elif isinstance(date_of_birth, date):
            dob = date_of_birth
        else:
            return None

        today = date.today()
        age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
        return age

    except Exception as e:
        print(f"Error calculating age: {e}")
        return None


def format_date(date_input: Union[str, date, datetime, None],
                format_type: str = 'full') -> str:
    """
    Format date in a human-readable format.

    Args:
        date_input: Date as string, date, or datetime
        format_type: 'full', 'date_only', 'time_only', or 'iso'

    Returns:
        Formatted date string
    """
    if not date_input:
        return 'N/A'

    try:
        if isinstance(date_input, str):
            dt_obj = datetime.fromisoformat(date_input.replace('Z', '+00:00'))
        elif isinstance(date_input, date) and not isinstance(date_input, datetime):
            dt_obj = datetime.combine(date_input, datetime.min.time())
        else:
            dt_obj = date_input

        formats = {
            'full': '%d %B %Y, %H:%M',
            'date_only': '%d %B %Y',
            'time_only': '%H:%M:%S',
            'iso': '%Y-%m-%d %H:%M:%S',
            'short': '%d/%m/%Y'
        }

        return dt_obj.strftime(formats.get(format_type, formats['full']))

    except Exception as e:
        print(f"Error formatting date: {e}")
        return str(date_input) if date_input else 'N/A'


def decode_base64_image(base64_string: str) -> Optional[bytes]:
    """
    Decode a base64 image string to bytes.

    Args:
        base64_string: Base64 encoded image (with or without data URI prefix)

    Returns:
        Image bytes or None if decoding fails
    """
    if not isinstance(base64_string, str):
        return None

    try:
        # Remove data URI prefix if present
        if ',' in base64_string:
            base64_string = base64_string.split(',', 1)[1]

        return base64.b64decode(base64_string)

    except Exception as e:
        print(f"Error decoding base64 image: {e}")
        return None


def encode_image_to_base64(image_bytes: bytes, mime_type: str = 'image/png') -> str:
    """
    Encode image bytes to base64 string with data URI.

    Args:
        image_bytes: Raw image bytes
        mime_type: MIME type of the image

    Returns:
        Base64 encoded string with data URI prefix
    """
    encoded = base64.b64encode(image_bytes).decode('utf-8')
    return f"data:{mime_type};base64,{encoded}"


def format_volume(value: Optional[float], unit: str = 'cm³', precision: int = 2) -> str:
    """
    Format a volume measurement for display.

    Args:
        value: Volume value
        unit: Unit of measurement
        precision: Decimal places

    Returns:
        Formatted string
    """
    if value is None:
        return 'N/A'

    try:
        return f"{float(value):.{precision}f} {unit}"
    except (ValueError, TypeError):
        return 'N/A'


def format_percentage(value: Optional[float], precision: int = 1) -> str:
    """
    Format a decimal value as percentage.

    Args:
        value: Decimal value (0-1)
        precision: Decimal places

    Returns:
        Formatted percentage string
    """
    if value is None:
        return 'N/A'

    try:
        return f"{float(value) * 100:.{precision}f}%"
    except (ValueError, TypeError):
        return 'N/A'


def get_confidence_level(confidence: float) -> str:
    """
    Get a textual description of confidence level.

    Args:
        confidence: Confidence score (0-1)

    Returns:
        Textual description
    """
    if confidence >= 0.90:
        return "Very High"
    elif confidence >= 0.80:
        return "High"
    elif confidence >= 0.70:
        return "Moderate"
    elif confidence >= 0.60:
        return "Low"
    else:
        return "Very Low"


def get_volume_status(value: float, min_norm: float, max_norm: float) -> str:
    """
    Determine if a volume measurement is within normal range.

    Args:
        value: Measured volume
        min_norm: Minimum normal value
        max_norm: Maximum normal value

    Returns:
        Status string: 'Normal', 'Below Normal', or 'Above Normal'
    """
    if value < min_norm:
        return 'Below Normal'
    elif value > max_norm:
        return 'Above Normal'
    else:
        return 'Normal'


def generate_session_code() -> str:
    """
    Generate a unique session code.

    Returns:
        Session code in format MRI-YYYYMMDD-XXXX
    """
    import random
    import string

    date_part = datetime.now().strftime('%Y%m%d')
    random_part = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))

    return f"MRI-{date_part}-{random_part}"
