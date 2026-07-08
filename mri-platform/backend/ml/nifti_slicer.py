"""
NIfTI Slicer for MRI Platform
Extracts middle axial slices from NIfTI brain volumes for model input.
Also supports extracting slices for web viewer with Supabase upload.
"""

import os
import io
import logging
import numpy as np
import nibabel as nib
from PIL import Image
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)


class NIfTISlicer:
    """
    Robust NIfTI Slicer.
    Features:
    1. Auto-Reorientation: Forces standard radiological alignment (RAS+).
    2. Smart Centering: Finds the actual brain (ignores empty space).
    3. Adaptive Contrast: Normalizes brightness so images aren't black.
    4. Dual Mode: Can save to local disk (for ML) or upload to Supabase (for Viewer).
    """

    def __init__(self, output_format: str = 'png', normalize: bool = True):
        self.output_format = output_format.lower()
        self.normalize = normalize

        if self.output_format not in ['png', 'jpg', 'jpeg', 'npy']:
            raise ValueError(f"Unsupported output format: {self.output_format}")

    def _load_and_prepare(self, nifti_path: str):
        """
        Load NIfTI file, reorient to RAS+, normalize intensity.
        Returns (data, shape) tuple.
        """
        if not os.path.exists(nifti_path):
            raise FileNotFoundError(f"NIfTI file not found: {nifti_path}")

        logger.info(f"Loading NIfTI file: {nifti_path}")
        img = nib.load(nifti_path)

        # Force Standard Orientation (RAS+)
        img = nib.as_closest_canonical(img)
        data = img.get_fdata()

        logger.info(f"NIfTI shape: {data.shape}, range: [{data.min():.2f}, {data.max():.2f}]")

        # Robust Normalization (Fixes Black/Dark Images from mwp1 files)
        if self.normalize:
            data = self._normalize_intensity(data)

        return data

    def _find_brain_center(self, data: np.ndarray) -> Dict[str, int]:
        """
        Find the center of the actual brain content (ignores empty space).
        Returns dict mapping plane name -> center index.
        """
        brain_mask = data > 10  # Threshold for non-black pixels
        if np.any(brain_mask):
            x_idx, y_idx, z_idx = np.where(brain_mask)
            return {
                'sagittal': int((x_idx.min() + x_idx.max()) // 2),  # Axis 0
                'coronal':  int((y_idx.min() + y_idx.max()) // 2),  # Axis 1
                'axial':    int((z_idx.min() + z_idx.max()) // 2),  # Axis 2
            }
        else:
            # Fallback if image is empty/weird
            return {
                'sagittal': data.shape[0] // 2,
                'coronal':  data.shape[1] // 2,
                'axial':    data.shape[2] // 2,
            }

    def _extract_slice(self, data: np.ndarray, axis: int, index: int) -> np.ndarray:
        """Extract a single 2D slice from 3D volume."""
        if axis == 0:
            slice_data = data[index, :, :]
        elif axis == 1:
            slice_data = data[:, index, :]
        else:
            slice_data = data[:, :, index]

        # Rotate to "Head Up" orientation
        slice_data = np.rot90(slice_data)
        return slice_data

    def _slice_to_pil(self, slice_data: np.ndarray) -> Image.Image:
        """Convert numpy slice to PIL Image."""
        return Image.fromarray(slice_data.astype(np.uint8))

    def extract_middle_slices(
        self,
        nifti_path: str,
        num_slices: int = 5,
        output_dir: str = None,
        view_plane: str = 'axial',
        prefix: str = 'slice'
    ) -> List[str]:
        """
        Extract middle slices and save to disk (for ML pipeline).

        Args:
            nifti_path: Path to NIfTI file
            num_slices: Number of slices to extract
            output_dir: Directory to save slices
            view_plane: 'axial', 'sagittal', or 'coronal'
            prefix: Filename prefix

        Returns:
            List of saved file paths
        """
        try:
            data = self._load_and_prepare(nifti_path)
            center_map = self._find_brain_center(data)

            axis_map = {'sagittal': 0, 'coronal': 1, 'axial': 2}
            axis = axis_map.get(view_plane.lower(), 2)
            center = center_map.get(view_plane.lower(), data.shape[axis] // 2)

            # Calculate slice indices around center
            start_idx = max(0, center - (num_slices // 2))
            end_idx = min(data.shape[axis], start_idx + num_slices)
            indices = list(range(start_idx, end_idx))

            logger.info(f"Extracting slices at indices: {indices}")

            results = []
            if output_dir:
                os.makedirs(output_dir, exist_ok=True)

            for i, slice_idx in enumerate(indices):
                slice_data = self._extract_slice(data, axis, slice_idx)
                img_pil = self._slice_to_pil(slice_data)

                if output_dir:
                    filename = f"{prefix}_{i + 1}.{self.output_format}"
                    save_path = os.path.join(output_dir, filename)
                    img_pil.save(save_path)
                    results.append(save_path)
                    logger.info(f"Saved slice {i + 1}/{len(indices)}: {save_path}")

            logger.info(f"Extracted {len(results)} slices to {output_dir}")
            return results

        except Exception as e:
            logger.error(f"Slice extraction failed: {str(e)}")
            import traceback
            traceback.print_exc()
            return []

    def _normalize_intensity(self, data: np.ndarray) -> np.ndarray:
        """
        Smart contrast stretching.
        Clips the top 1% brightest pixels to remove spikes,
        then scales the rest to 0-255.
        """
        p99 = np.percentile(data, 99)
        if p99 == 0:
            return data  # Avoid divide by zero

        data = np.clip(data, 0, p99)
        data = (data / p99) * 255.0
        return data


# =========================================================================
# Standalone function for viewer slice upload (used by predict_api.py)
# =========================================================================

def extract_and_upload_viewer_slices(
    nifti_path: str,
    session_code: str,
    supabase_client,
    num_slices: int = 20,
    orientations: List[str] = None,
    bucket_name: str = 'mri-scans'
) -> Dict[str, List[str]]:
    """
    Extract slices from a NIfTI file and upload to Supabase Storage
    for the web-based MRI viewer.

    Args:
        nifti_path: Path to NIfTI file
        session_code: Session identifier for storage path
        supabase_client: Initialized Supabase client
        num_slices: Number of slices per orientation
        orientations: List of planes to extract ('axial', 'sagittal', 'coronal')
        bucket_name: Supabase storage bucket name

    Returns:
        Dict mapping orientation -> list of public URLs
        Example: {'axial': ['url1', 'url2', ...], 'sagittal': [...]}
    """
    if orientations is None:
        orientations = ['axial', 'sagittal', 'coronal']

    slicer = NIfTISlicer(output_format='png', normalize=True)
    result_urls = {}

    try:
        # Load and prepare data once
        data = slicer._load_and_prepare(nifti_path)
        center_map = slicer._find_brain_center(data)

        # Verify bucket access
        try:
            logger.info(f"Verifying access to bucket: {bucket_name}")
            supabase_client.storage.from_(bucket_name).list()
            logger.info(f"Bucket '{bucket_name}' is accessible")
        except Exception as bucket_err:
            logger.error(f"Cannot access bucket '{bucket_name}': {bucket_err}")
            return {}

        axis_map = {'sagittal': 0, 'coronal': 1, 'axial': 2}

        for orientation in orientations:
            axis = axis_map.get(orientation, 2)
            center = center_map.get(orientation, data.shape[axis] // 2)

            # Calculate slice indices spread across the brain
            start_idx = max(0, center - (num_slices // 2))
            end_idx = min(data.shape[axis], start_idx + num_slices)
            indices = list(range(start_idx, end_idx))

            logger.info(f"Processing {orientation} slices (axis {axis})")

            urls = []
            for i, slice_idx in enumerate(indices):
                if slice_idx >= data.shape[axis]:
                    continue

                slice_data = slicer._extract_slice(data, axis, slice_idx)
                img_pil = slicer._slice_to_pil(slice_data)

                # Upload to Supabase
                url = _upload_slice_to_supabase(
                    supabase_client,
                    img_pil,
                    session_code,
                    i,
                    orientation,
                    bucket_name,
                    'png'
                )
                if url:
                    urls.append(url)

            result_urls[orientation] = urls
            logger.info(f"Uploaded {len(urls)} {orientation} slices")

        total = sum(len(v) for v in result_urls.values())
        logger.info(f"Total slices uploaded: {total}")
        return result_urls

    except Exception as e:
        logger.error(f"Viewer slice extraction failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return {}


def _upload_slice_to_supabase(
    supabase_client,
    img_pil: Image.Image,
    session_code: str,
    index: int,
    plane: str,
    bucket_name: str,
    fmt: str = 'png'
) -> Optional[str]:
    """
    Upload a single slice image to Supabase Storage.

    Returns:
        Public URL string, or None on failure
    """
    try:
        # Convert PIL Image to bytes
        buf = io.BytesIO()
        pil_format = 'JPEG' if fmt.lower() in ('jpg', 'jpeg') else 'PNG'
        img_pil.save(buf, format=pil_format)
        file_bytes = buf.getvalue()

        # Storage path: slices/{session_code}/{plane}/slice_000.png
        storage_path = f"slices/{session_code}/{plane}/slice_{index:03d}.{fmt}"

        logger.info(f"Uploading slice to: {storage_path}")

        # Upload (overwrite if exists)
        try:
            supabase_client.storage.from_(bucket_name).upload(
                path=storage_path,
                file=file_bytes,
                file_options={"content-type": f"image/{fmt}", "upsert": "true"}
            )
        except Exception as upload_err:
            # If duplicate error, try to update instead
            error_msg = str(upload_err).lower()
            if 'duplicate' in error_msg or 'already exists' in error_msg:
                logger.info(f"File exists, updating: {storage_path}")
                supabase_client.storage.from_(bucket_name).update(
                    path=storage_path,
                    file=file_bytes,
                    file_options={"content-type": f"image/{fmt}"}
                )
            else:
                raise

        # Get public URL - returns a string directly
        public_url = supabase_client.storage.from_(bucket_name).get_public_url(storage_path)
        logger.info(f"Slice uploaded successfully: {public_url}")
        return public_url

    except Exception as e:
        logger.error(f"Supabase upload failed for slice {index}: {e}")
        return None
