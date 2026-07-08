"""
CAT12 Preprocessing Wrapper for Windows
Handles MRI segmentation using CAT12 Standalone with MATLAB Compiler Runtime (MCR).

Required setup:
1. Install MCR R2017b (v9.3) to C:\MCR\v93
2. Install CAT12 standalone to C:\CAT12\CAT12.8.2_R2017b_MCR_Win64
3. Update paths in config.py if using different locations
"""

import os
import subprocess
import shutil
import time
import logging
from pathlib import Path
from typing import Optional, Dict

logger = logging.getLogger(__name__)


class CAT12Processor:
    """
    Wrapper for CAT12 Standalone preprocessing on Windows.
    Handles batch file generation, execution, and output management.

    Output: Modulated normalized grey matter (mwp1*.nii) for ML classification
    """

    def __init__(
        self,
        cat12_path: str = None,
        mcr_path: str = None,
        working_dir: str = None
    ):
        """
        Initialize CAT12 processor.

        Args:
            cat12_path: Path to CAT12 standalone installation
            mcr_path: Path to MATLAB Runtime
            working_dir: Base directory for processing files
        """
        # Default Windows paths
        if cat12_path is None:
            cat12_path = os.environ.get(
                'CAT12_PATH',
                r'C:\CAT12\CAT12.8.2_R2017b_MCR_Win64'
            )
        if mcr_path is None:
            mcr_path = os.environ.get('MCR_PATH', r'C:\MCR\v93')
        if working_dir is None:
            working_dir = os.path.join(
                os.path.dirname(os.path.dirname(__file__)),
                'processing'
            )

        self.cat12_path = Path(cat12_path)
        self.mcr_path = Path(mcr_path)
        self.working_dir = Path(working_dir)

        # Validate paths exist
        self._validated = False
        self._validate_paths()

        # Create working directory if needed
        self.working_dir.mkdir(parents=True, exist_ok=True)

        logger.info(f"CAT12Processor initialized")
        logger.info(f"  CAT12 path: {self.cat12_path}")
        logger.info(f"  MCR path: {self.mcr_path}")
        logger.info(f"  Working dir: {self.working_dir}")

    def _validate_paths(self):
        """Validate that CAT12 and MCR are installed correctly."""
        errors = []

        # Check CAT12 path
        if not self.cat12_path.exists():
            errors.append(f"CAT12 path not found: {self.cat12_path}")
        else:
            # Check for spm12.exe (Windows executable)
            spm_exe = self.cat12_path / 'spm12.exe'
            if not spm_exe.exists():
                errors.append(f"spm12.exe not found in: {self.cat12_path}")
            self.spm_exe = spm_exe

        # Check MCR path
        if not self.mcr_path.exists():
            errors.append(f"MCR path not found: {self.mcr_path}")
        else:
            # Check for runtime DLLs
            runtime_dir = self.mcr_path / 'runtime' / 'win64'
            if not runtime_dir.exists():
                errors.append(f"MCR runtime not found: {runtime_dir}")

        if errors:
            for err in errors:
                logger.warning(err)
            logger.warning("CAT12 preprocessing will not be available")
            self._validated = False
        else:
            self._validated = True
            logger.info("CAT12 installation validated successfully")

    def is_available(self) -> bool:
        """Check if CAT12 is available for preprocessing."""
        return self._validated

    def _generate_batch_script(
        self,
        input_nifti: str,
        output_dir: str,
        disable_surface: bool = True
    ) -> str:
        """
        Generate MATLAB batch script for CAT12 segmentation.

        Args:
            input_nifti: Path to input NIfTI file (use forward slashes)
            output_dir: Directory for CAT12 output (use forward slashes)
            disable_surface: Disable surface reconstruction (faster)

        Returns:
            Path to generated batch script
        """
        # Convert paths to forward slashes for MATLAB
        input_nifti_matlab = str(input_nifti).replace('\\', '/')
        output_dir_matlab = str(output_dir).replace('\\', '/')
        cat12_path_matlab = str(self.cat12_path).replace('\\', '/')

        # CAT12 batch template for segmentation
        batch_template = f"""
% CAT12 Segmentation Batch Script
% Auto-generated for NeuroXiva MRI Platform

matlabbatch{{1}}.spm.tools.cat.estwrite.data = {{'{input_nifti_matlab},1'}};
matlabbatch{{1}}.spm.tools.cat.estwrite.data_wmh = {{''}};
matlabbatch{{1}}.spm.tools.cat.estwrite.nproc = 0;
matlabbatch{{1}}.spm.tools.cat.estwrite.useprior = '';
matlabbatch{{1}}.spm.tools.cat.estwrite.opts.tpm = {{'{cat12_path_matlab}/spm12_mcr/home/gaser/gaser/spm/spm12/tpm/TPM.nii'}};
matlabbatch{{1}}.spm.tools.cat.estwrite.opts.affreg = 'mni';
matlabbatch{{1}}.spm.tools.cat.estwrite.opts.biasacc = 0.5;
matlabbatch{{1}}.spm.tools.cat.estwrite.extopts.APP = 1070;
matlabbatch{{1}}.spm.tools.cat.estwrite.extopts.spm_kamap = 0;
matlabbatch{{1}}.spm.tools.cat.estwrite.extopts.LASstr = 0.5;
matlabbatch{{1}}.spm.tools.cat.estwrite.extopts.gcutstr = 2;
matlabbatch{{1}}.spm.tools.cat.estwrite.extopts.WMHC = 1;
matlabbatch{{1}}.spm.tools.cat.estwrite.extopts.registration.shooting.shootingtpm = {{'{cat12_path_matlab}/spm12_mcr/home/gaser/gaser/spm/spm12/toolbox/cat12/templates_MNI152NLin2009cAsym/Template_0_GS1mm.nii'}};
matlabbatch{{1}}.spm.tools.cat.estwrite.extopts.registration.shooting.regstr = 0.5;
matlabbatch{{1}}.spm.tools.cat.estwrite.extopts.vox = 1.5;
matlabbatch{{1}}.spm.tools.cat.estwrite.extopts.bb = 12;
matlabbatch{{1}}.spm.tools.cat.estwrite.extopts.SRP = 22;
matlabbatch{{1}}.spm.tools.cat.estwrite.extopts.ignoreErrors = 1;

% Output options - save to specific directory
matlabbatch{{1}}.spm.tools.cat.estwrite.output.BIDS.BIDSno = 1;

% Disable surface reconstruction for speed
matlabbatch{{1}}.spm.tools.cat.estwrite.output.surface = {0 if disable_surface else 1};

% Disable ROI atlases for speed
matlabbatch{{1}}.spm.tools.cat.estwrite.output.ROImenu.noROI = struct([]);

% Grey matter output - MODULATED NORMALIZED (what we need for ML)
matlabbatch{{1}}.spm.tools.cat.estwrite.output.GM.native = 0;
matlabbatch{{1}}.spm.tools.cat.estwrite.output.GM.mod = 1;
matlabbatch{{1}}.spm.tools.cat.estwrite.output.GM.dartel = 0;

% White matter output
matlabbatch{{1}}.spm.tools.cat.estwrite.output.WM.native = 0;
matlabbatch{{1}}.spm.tools.cat.estwrite.output.WM.mod = 1;
matlabbatch{{1}}.spm.tools.cat.estwrite.output.WM.dartel = 0;

% CSF output - disabled
matlabbatch{{1}}.spm.tools.cat.estwrite.output.CSF.native = 0;
matlabbatch{{1}}.spm.tools.cat.estwrite.output.CSF.mod = 0;
matlabbatch{{1}}.spm.tools.cat.estwrite.output.CSF.dartel = 0;

% Other outputs - all disabled for speed
matlabbatch{{1}}.spm.tools.cat.estwrite.output.ct.native = 0;
matlabbatch{{1}}.spm.tools.cat.estwrite.output.ct.warped = 0;
matlabbatch{{1}}.spm.tools.cat.estwrite.output.ct.dartel = 0;
matlabbatch{{1}}.spm.tools.cat.estwrite.output.pp.native = 0;
matlabbatch{{1}}.spm.tools.cat.estwrite.output.pp.warped = 0;
matlabbatch{{1}}.spm.tools.cat.estwrite.output.pp.dartel = 0;
matlabbatch{{1}}.spm.tools.cat.estwrite.output.warps = [0 0];
matlabbatch{{1}}.spm.tools.cat.estwrite.output.jacobianwarped = 0;
matlabbatch{{1}}.spm.tools.cat.estwrite.output.label.native = 0;
matlabbatch{{1}}.spm.tools.cat.estwrite.output.label.warped = 0;
matlabbatch{{1}}.spm.tools.cat.estwrite.output.label.dartel = 0;
matlabbatch{{1}}.spm.tools.cat.estwrite.output.labelnative = 0;
"""

        # Save batch script
        batch_file = Path(output_dir) / 'cat12_segment_batch.m'
        with open(batch_file, 'w') as f:
            f.write(batch_template)

        logger.info(f"Generated batch script: {batch_file}")
        return str(batch_file)

    def process(
        self,
        input_nifti: str,
        job_id: str,
        timeout: int = 3600
    ) -> Dict[str, any]:
        """
        Run CAT12 segmentation on input NIfTI file.

        Args:
            input_nifti: Path to input T1-weighted MRI NIfTI file
            job_id: Unique identifier for this processing job
            timeout: Maximum processing time in seconds (default: 1 hour)

        Returns:
            Dictionary with paths to output files:
            {
                'mwp1': path to modulated normalized grey matter,
                'mwp2': path to modulated normalized white matter,
                'status': 'success' or 'failed',
                'error': error message if failed
            }
        """
        if not self.is_available():
            return {
                'status': 'failed',
                'error': 'CAT12 is not available. Check installation paths.'
            }

        logger.info(f"Starting CAT12 processing for job {job_id}")

        # Create job-specific directories
        job_dir = self.working_dir / job_id
        input_dir = job_dir / 'input'
        output_dir = job_dir / 'output'

        input_dir.mkdir(parents=True, exist_ok=True)
        output_dir.mkdir(parents=True, exist_ok=True)

        # Copy input file to processing directory
        input_basename = Path(input_nifti).name
        job_input_file = input_dir / input_basename
        shutil.copy2(input_nifti, job_input_file)

        logger.info(f"Copied input file to: {job_input_file}")

        # Generate batch script
        batch_script = self._generate_batch_script(
            str(job_input_file),
            str(output_dir),
            disable_surface=True
        )

        # Prepare CAT12 command for Windows
        # spm12.exe <mcr_path> batch <batch_script>
        cmd = [
            str(self.spm_exe),
            str(self.mcr_path),
            'batch',
            batch_script
        ]

        logger.info(f"Executing CAT12 command: {' '.join(cmd)}")

        try:
            start_time = time.time()

            # Run CAT12 processing
            result = subprocess.run(
                cmd,
                cwd=str(output_dir),
                capture_output=True,
                text=True,
                timeout=timeout
            )

            processing_time = time.time() - start_time
            logger.info(f"CAT12 completed in {processing_time:.2f} seconds")

            # Check return code
            if result.returncode != 0:
                logger.error(f"CAT12 failed with code {result.returncode}")
                logger.error(f"STDOUT: {result.stdout[:1000]}")
                logger.error(f"STDERR: {result.stderr[:1000]}")
                return {
                    'status': 'failed',
                    'error': f"CAT12 returned code {result.returncode}",
                    'stdout': result.stdout[:2000],
                    'stderr': result.stderr[:2000]
                }

            # Find output files (mwp1 = modulated normalized grey matter)
            mwp1_file = self._find_output_file(input_dir, 'mwp1*.nii')
            mwp2_file = self._find_output_file(input_dir, 'mwp2*.nii')

            # CAT12 puts output in same directory as input
            if not mwp1_file:
                # Also check output_dir/mri subdirectory
                mwp1_file = self._find_output_file(output_dir / 'mri', 'mwp1*.nii')
                mwp2_file = self._find_output_file(output_dir / 'mri', 'mwp2*.nii')

            if not mwp1_file:
                logger.error("mwp1 file not found in output")
                logger.error(f"Input dir contents: {list(input_dir.glob('*'))}")
                return {
                    'status': 'failed',
                    'error': 'mwp1 grey matter file not generated'
                }

            logger.info(f"CAT12 processing successful for job {job_id}")
            logger.info(f"  mwp1 (grey matter): {mwp1_file}")
            if mwp2_file:
                logger.info(f"  mwp2 (white matter): {mwp2_file}")

            return {
                'status': 'success',
                'mwp1': str(mwp1_file),
                'mwp2': str(mwp2_file) if mwp2_file else None,
                'processing_time': processing_time,
                'job_dir': str(job_dir)
            }

        except subprocess.TimeoutExpired:
            logger.error(f"CAT12 timed out after {timeout} seconds")
            return {
                'status': 'failed',
                'error': f'Processing timeout after {timeout} seconds'
            }

        except Exception as e:
            logger.error(f"Error during CAT12 processing: {str(e)}")
            import traceback
            traceback.print_exc()
            return {
                'status': 'failed',
                'error': str(e)
            }

    def _find_output_file(self, directory: Path, pattern: str) -> Optional[Path]:
        """Find output file matching pattern in directory."""
        if not directory.exists():
            return None

        files = list(directory.glob(pattern))
        if files:
            return files[0]
        return None

    def cleanup(self, job_id: str, keep_outputs: bool = True):
        """
        Clean up processing files for a job.

        Args:
            job_id: Job identifier
            keep_outputs: If True, keep mwp1 output, delete only temp files
        """
        job_dir = self.working_dir / job_id

        if not job_dir.exists():
            logger.warning(f"Job directory not found: {job_dir}")
            return

        if keep_outputs:
            # Delete only input copy and temp files
            input_dir = job_dir / 'input'
            if input_dir.exists():
                shutil.rmtree(input_dir)
            logger.info(f"Cleaned up temporary files for job {job_id}")
        else:
            # Delete entire job directory
            shutil.rmtree(job_dir)
            logger.info(f"Deleted all files for job {job_id}")


# Global CAT12 processor instance
_processor: Optional[CAT12Processor] = None


def get_cat12_processor() -> CAT12Processor:
    """Get or create the global CAT12 processor instance."""
    global _processor
    if _processor is None:
        _processor = CAT12Processor()
    return _processor


def preprocess_mri(
    input_nifti: str,
    session_code: str
) -> Dict[str, any]:
    """
    Convenience function to preprocess an MRI scan with CAT12.

    Args:
        input_nifti: Path to raw T1-weighted NIfTI file
        session_code: Unique session identifier

    Returns:
        Dict with 'mwp1' path on success, or 'error' on failure
    """
    processor = get_cat12_processor()

    if not processor.is_available():
        logger.warning("CAT12 not available, skipping preprocessing")
        return {
            'status': 'skipped',
            'error': 'CAT12 not installed',
            'mwp1': input_nifti  # Return original file as fallback
        }

    return processor.process(input_nifti, session_code)


# Test script
if __name__ == '__main__':
    import sys

    print("=" * 60)
    print("CAT12 Processor Test")
    print("=" * 60)

    processor = CAT12Processor()

    if processor.is_available():
        print("✓ CAT12 is available")

        if len(sys.argv) > 1:
            test_file = sys.argv[1]
            print(f"\nProcessing: {test_file}")
            result = processor.process(test_file, 'test_job')
            print(f"Result: {result}")
        else:
            print("\nUsage: python cat12_processor.py <path_to_nifti_file>")
    else:
        print("✗ CAT12 is NOT available")
        print("\nSetup instructions:")
        print("1. Install MCR R2017b to C:\\MCR\\v93")
        print("2. Install CAT12 standalone to C:\\CAT12\\CAT12.8.2_R2017b_MCR_Win64")
        print("3. Or set environment variables: CAT12_PATH, MCR_PATH")
