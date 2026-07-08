"""
Test script to verify slice extraction and upload is working.
Run this after:
1. pip install nibabel
2. Running database/12-complete-setup.sql in Supabase

Usage:
    python test_slice_extraction.py <path_to_nifti_file>

Example:
    python test_slice_extraction.py test_brain.nii.gz
"""

import os
import sys

# Add parent dir to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def test_nibabel():
    """Test if nibabel is installed"""
    print("\n=== Testing nibabel installation ===")
    try:
        import nibabel as nib
        print(f"✓ nibabel version: {nib.__version__}")
        return True
    except ImportError as e:
        print(f"✗ nibabel NOT installed: {e}")
        print("  Run: pip install nibabel")
        return False

def test_pillow():
    """Test if Pillow is installed"""
    print("\n=== Testing Pillow installation ===")
    try:
        from PIL import Image
        print(f"✓ Pillow is installed")
        return True
    except ImportError as e:
        print(f"✗ Pillow NOT installed: {e}")
        print("  Run: pip install Pillow")
        return False

def test_supabase_connection():
    """Test Supabase connection"""
    print("\n=== Testing Supabase connection ===")
    try:
        from supabase_client import get_supabase_client
        supabase = get_supabase_client()
        print("✓ Supabase client created")
        return supabase
    except Exception as e:
        print(f"✗ Supabase connection failed: {e}")
        return None

def test_bucket_access(supabase):
    """Test if mri-scans bucket exists and is accessible"""
    print("\n=== Testing storage bucket access ===")
    bucket_name = 'mri-scans'
    try:
        # Try to list files in the bucket
        result = supabase.storage.from_(bucket_name).list()
        print(f"✓ Bucket '{bucket_name}' is accessible")
        print(f"  Files in bucket: {len(result)}")
        return True
    except Exception as e:
        print(f"✗ Bucket '{bucket_name}' NOT accessible: {e}")
        print("  Run database/12-complete-setup.sql in Supabase SQL Editor!")
        return False

def test_slice_extraction(nifti_path, supabase):
    """Test slice extraction from a NIfTI file"""
    print(f"\n=== Testing slice extraction from {nifti_path} ===")

    if not os.path.exists(nifti_path):
        print(f"✗ File not found: {nifti_path}")
        return False

    print(f"✓ File exists: {nifti_path}")
    print(f"  File size: {os.path.getsize(nifti_path) / 1024 / 1024:.2f} MB")

    try:
        import nibabel as nib
        nifti_img = nib.load(nifti_path)
        data = nifti_img.get_fdata()
        print(f"✓ NIfTI loaded successfully")
        print(f"  Shape: {data.shape}")
        print(f"  Data type: {data.dtype}")
        print(f"  Value range: [{data.min():.2f}, {data.max():.2f}]")
    except Exception as e:
        print(f"✗ Failed to load NIfTI: {e}")
        return False

    # Try extracting slices
    try:
        from ml.nifti_slicer import extract_and_upload_viewer_slices

        test_session_code = f"TEST-{int(__import__('time').time())}"
        print(f"\n  Extracting slices for session: {test_session_code}")

        slice_urls = extract_and_upload_viewer_slices(
            nifti_path=nifti_path,
            session_code=test_session_code,
            supabase_client=supabase,
            num_slices=5,  # Just 5 for testing
            orientations=['axial']  # Just axial for testing
        )

        if slice_urls and slice_urls.get('axial'):
            print(f"✓ Slices extracted and uploaded successfully!")
            print(f"  Axial slices: {len(slice_urls['axial'])}")
            print(f"  First URL: {slice_urls['axial'][0]}")
            return True
        else:
            print(f"✗ No slices were extracted")
            return False

    except Exception as e:
        print(f"✗ Slice extraction failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    print("=" * 60)
    print("MRI Platform - Slice Extraction Test")
    print("=" * 60)

    # Get NIfTI file path from command line
    nifti_path = None
    if len(sys.argv) > 1:
        nifti_path = sys.argv[1]

    # Run tests
    results = {}

    results['nibabel'] = test_nibabel()
    results['pillow'] = test_pillow()

    supabase = test_supabase_connection()
    results['supabase'] = supabase is not None

    if supabase:
        results['bucket'] = test_bucket_access(supabase)

        if nifti_path and results['bucket']:
            results['extraction'] = test_slice_extraction(nifti_path, supabase)
        elif not nifti_path:
            print("\n=== Skipping slice extraction test (no NIfTI file provided) ===")
            print("  Usage: python test_slice_extraction.py <path_to_nifti_file>")

    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)

    all_passed = True
    for test, passed in results.items():
        status = "✓ PASS" if passed else "✗ FAIL"
        print(f"  {test}: {status}")
        if not passed:
            all_passed = False

    if all_passed:
        print("\n✓ All tests passed! Slice extraction should work.")
    else:
        print("\n✗ Some tests failed. Fix the issues above.")

    if not results.get('bucket', True):
        print("\n*** IMPORTANT: Run database/12-complete-setup.sql in Supabase! ***")

    return 0 if all_passed else 1

if __name__ == '__main__':
    sys.exit(main())
