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
# Local viewer-slice extraction (Supabase-decoupled).
#
# Replaces the legacy extract_and_upload_viewer_slices(): the pipeline never
# touches Supabase. Slices are written to local per-orientation folders; the
# storage service uploads them to the viewer-slices bucket afterwards.
# =========================================================================

def extract_viewer_slices_local(
    nifti_path: str,
    output_root: str,
    num_slices: int = 20,
    orientations: Optional[List[str]] = None,
) -> Dict[str, List[str]]:
    """
    Extract viewer slices from a NIfTI volume to local disk.

    Returns {orientation: [local_png_path, ...]} (empty on failure), with files
    written to ``<output_root>/<orientation>/slice_NNN.png``.
    """
    if orientations is None:
        orientations = ['axial', 'sagittal', 'coronal']

    slicer = NIfTISlicer(output_format='png', normalize=True)
    result: Dict[str, List[str]] = {}

    try:
        data = slicer._load_and_prepare(nifti_path)
        center_map = slicer._find_brain_center(data)
        axis_map = {'sagittal': 0, 'coronal': 1, 'axial': 2}

        for orientation in orientations:
            axis = axis_map.get(orientation, 2)
            center = center_map.get(orientation, data.shape[axis] // 2)
            start_idx = max(0, center - (num_slices // 2))
            end_idx = min(data.shape[axis], start_idx + num_slices)
            indices = list(range(start_idx, end_idx))

            plane_dir = os.path.join(output_root, orientation)
            os.makedirs(plane_dir, exist_ok=True)

            paths: List[str] = []
            for i, slice_idx in enumerate(indices):
                slice_data = slicer._extract_slice(data, axis, slice_idx)
                img_pil = slicer._slice_to_pil(slice_data)
                save_path = os.path.join(plane_dir, f"slice_{i:03d}.png")
                img_pil.save(save_path)
                paths.append(save_path)

            result[orientation] = paths
            logger.info(f"Extracted {len(paths)} {orientation} viewer slices")

        return result

    except Exception as e:
        logger.error(f"Local viewer slice extraction failed: {e}")
        import traceback
        traceback.print_exc()
        return {}
