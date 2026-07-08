"""
Configuration settings for the MRI Platform Backend.
"""

import os
from dotenv import load_dotenv

load_dotenv()

# =============================================================================
# Supabase Configuration
# =============================================================================
SUPABASE_URL = os.getenv('SUPABASE_URL', '')
SUPABASE_ANON_KEY = os.getenv('SUPABASE_ANON_KEY', '')
SUPABASE_SERVICE_ROLE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY', '')

# Storage Buckets
MRI_SCANS_BUCKET = 'mri-scans'
REPORT_ASSETS_BUCKET = 'report-assets'

# =============================================================================
# CAT12 & MATLAB Runtime Paths
# =============================================================================
# Path to the folder containing spm25.exe and the 'standalone' folder
CAT12_ROOT = r"C:\CAT12\CAT12.8.2_R2017b_MCR_Win64\CAT12.9_R2023b_MCR_Win"
CAT12_EXE = os.path.join(CAT12_ROOT, "spm25.exe")

# Path to the MATLAB Runtime root
MCR_ROOT = r"C:\Program Files\MATLAB\MATLAB Runtime\R2023b"

# Processing Settings
USE_CAT12_PREPROCESSING = True  # Set to True to enable the pipeline

# =============================================================================
# File Paths
# =============================================================================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
CAT12_OUTPUT_DIR = os.path.join(UPLOAD_FOLDER, 'mri') # Output inside uploads/mri

# Ensure upload folder exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(CAT12_OUTPUT_DIR, exist_ok=True)

# =============================================================================
# ML Model Configuration
# =============================================================================
USE_MOCK_MODEL = False  # Set False to use real pipeline
MODEL_VERSION = 'ConViT-v1.0'
CONVIT_CHECKPOINT_PATH = os.path.join(BASE_DIR, 'checkpoints', 'ConViT_model.pth')

# =============================================================================
# Standard Constants (Required for Reports & Analysis)
# =============================================================================
PREDICTION_CLASSES = ['CN', 'MCI', 'AD']
ANALYSIS_TYPES = {
    'multi-disease': ['CN', 'MCI', 'AD'], 
    'ad-only': ['CN', 'AD']
}

# Normative Brain Volume Ranges (cm³)
NORMATIVE_VOLUMES = {
    'total_brain': {'min': 1100, 'max': 1400, 'unit': 'cm³'},
    'gray_matter': {'min': 450, 'max': 600, 'unit': 'cm³'},
    'white_matter': {'min': 400, 'max': 550, 'unit': 'cm³'},
    'csf': {'min': 150, 'max': 300, 'unit': 'cm³'},
    'hippocampus': {'min': 3.0, 'max': 4.5, 'unit': 'cm³'},
    'ventricles': {'min': 20, 'max': 50, 'unit': 'cm³'}
}

# --- MISSING SECTION RESTORED BELOW ---
DISEASE_INFO = {
    'CN': {
        'full_name': 'Cognitively Normal',
        'description': 'No significant neurodegenerative patterns detected',
        'color': (46, 204, 113),  # Green
        'hex_color': '#2ecc71'
    },
    'MCI': {
        'full_name': 'Mild Cognitive Impairment',
        'description': 'Early signs of cognitive decline, may or may not progress to dementia',
        'color': (241, 196, 15),  # Yellow
        'hex_color': '#f1c40f'
    },
    'AD': {
        'full_name': "Alzheimer's Disease",
        'description': 'Patterns consistent with Alzheimer\'s disease pathology',
        'color': (231, 76, 60),  # Red
        'hex_color': '#e74c3c'
    }
}

# =============================================================================
# Flask Configuration
# =============================================================================
FLASK_DEBUG = True
FLASK_HOST = '0.0.0.0'
FLASK_PORT = 5000
MAX_CONTENT_LENGTH = 500 * 1024 * 1024
CORS_ORIGINS = ['http://localhost:3000', 'http://127.0.0.1:3000']