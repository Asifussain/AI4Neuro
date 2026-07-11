import logging
import os
import shutil
import subprocess
from pathlib import Path
from typing import Dict, List

from app.pipelines.mri.config import CAT12_EXE, MCR_ROOT, CAT12_OUTPUT_DIR, CAT12_ROOT

logger = logging.getLogger(__name__)


def validate_cat12_config() -> List[str]:
    """Return human-readable setup problems for CAT12/MATLAB Runtime."""
    issues: List[str] = []

    if not CAT12_ROOT:
        issues.append("CAT12_ROOT is not set.")
    elif not Path(CAT12_ROOT).exists():
        issues.append(f"CAT12_ROOT does not exist: {CAT12_ROOT}")

    if not CAT12_EXE:
        issues.append("CAT12_EXE is not set.")
    elif not Path(CAT12_EXE).exists():
        issues.append(f"CAT12_EXE does not exist: {CAT12_EXE}")

    if not MCR_ROOT:
        issues.append("MCR_ROOT is not set.")
    elif not Path(MCR_ROOT).exists():
        issues.append(f"MCR_ROOT does not exist: {MCR_ROOT}")

    if not CAT12_OUTPUT_DIR:
        issues.append("CAT12_OUTPUT_DIR is not set.")

    return issues


def _matlab_runtime_paths(mcr_root: str) -> List[str]:
    """Detect MATLAB Runtime binary/library directories across OS builds."""
    root = Path(mcr_root)
    paths: List[Path] = []

    # Common MATLAB Runtime architecture directory names:
    # Windows: win64, Linux: glnxa64, macOS Intel: maci64, macOS ARM: maca64.
    for relative in ("runtime", "bin", "sys/os", "sys/opengl/lib"):
        base = root.joinpath(*relative.split("/"))
        if not base.exists():
            continue
        paths.extend(child for child in base.iterdir() if child.is_dir())

    return [str(path) for path in paths]


def _cat12_environment() -> Dict[str, str]:
    env = os.environ.copy()
    runtime_paths = _matlab_runtime_paths(MCR_ROOT)

    if runtime_paths:
        env["PATH"] = os.pathsep.join(runtime_paths + [env.get("PATH", "")])

        if os.name != "nt":
            existing_ld = env.get("LD_LIBRARY_PATH", "")
            env["LD_LIBRARY_PATH"] = os.pathsep.join(
                [*runtime_paths, existing_ld] if existing_ld else runtime_paths
            )

            existing_dyld = env.get("DYLD_LIBRARY_PATH", "")
            env["DYLD_LIBRARY_PATH"] = os.pathsep.join(
                [*runtime_paths, existing_dyld] if existing_dyld else runtime_paths
            )

    return env


def _write_cat12_batch(input_nii_path: str, script_path: str) -> None:
    clean_nii_path = input_nii_path.replace("\\", "/")

    matlab_code = f"""
%% Generated CAT12 Job
spm_jobman('initcfg');
matlabbatch = {{}};
matlabbatch{{1}}.spm.tools.cat.estwrite.data = {{'{clean_nii_path},1'}};
matlabbatch{{1}}.spm.tools.cat.estwrite.nproc = 0;

% OUTPUT OPTIONS
matlabbatch{{1}}.spm.tools.cat.estwrite.output.surface = 0;
matlabbatch{{1}}.spm.tools.cat.estwrite.output.GM.native = 0;
matlabbatch{{1}}.spm.tools.cat.estwrite.output.GM.mod = 1; % mwp1
matlabbatch{{1}}.spm.tools.cat.estwrite.output.WM.native = 0;
matlabbatch{{1}}.spm.tools.cat.estwrite.output.WM.mod = 1; % mwp2

% Run
spm_jobman('run', matlabbatch);
exit;
"""

    with open(script_path, "w", encoding="utf-8") as handle:
        handle.write(matlab_code)


def _expected_mwp1_locations(input_nii_path: str) -> List[str]:
    input_dir = os.path.dirname(input_nii_path)
    filename = os.path.basename(input_nii_path)
    return [
        os.path.join(input_dir, "mri", f"mwp1{filename}"),
        os.path.join(input_dir, f"mwp1{filename}"),
        os.path.join(CAT12_OUTPUT_DIR, f"mwp1{filename}"),
    ]


def run_cat12_preprocessing(input_nii_path):
    """
    Step 1: Runs CAT12 on the input NIfTI file.
    Returns the path to the processed Grey Matter file (mwp1...).
    """
    input_nii_path = os.path.abspath(input_nii_path)

    config_issues = validate_cat12_config()
    if config_issues:
        logger.error("CAT12 is not configured: %s", " ".join(config_issues))
        return None

    os.makedirs(CAT12_OUTPUT_DIR, exist_ok=True)

    script_path = os.path.join(CAT12_OUTPUT_DIR, "temp_process.m")
    _write_cat12_batch(input_nii_path, script_path)

    command = [CAT12_EXE, "script", script_path]

    logger.info("--- Starting CAT12 Preprocessing on %s ---", os.path.basename(input_nii_path))

    try:
        completed = subprocess.run(
            command,
            check=True,
            env=_cat12_environment(),
            capture_output=True,
            text=True,
        )
        if completed.stdout:
            logger.info("CAT12 stdout: %s", completed.stdout[-4000:])
        if completed.stderr:
            logger.info("CAT12 stderr: %s", completed.stderr[-4000:])

        filename = os.path.basename(input_nii_path)
        found_file = None
        for loc in _expected_mwp1_locations(input_nii_path):
            if os.path.exists(loc):
                found_file = loc
                break

        if found_file:
            final_path = os.path.join(CAT12_OUTPUT_DIR, f"mwp1{filename}")
            if os.path.abspath(found_file) != os.path.abspath(final_path):
                shutil.copy2(found_file, final_path)

            logger.info("CAT12 Success: Found grey-matter output at %s", final_path)
            return final_path

        logger.error("CAT12 finished but output file mwp1%s was not found.", filename)
        return None

    except subprocess.CalledProcessError as e:
        logger.error("CAT12 failed with exit code %s", e.returncode)
        if e.stdout:
            logger.error("CAT12 stdout: %s", e.stdout[-4000:])
        if e.stderr:
            logger.error("CAT12 stderr: %s", e.stderr[-4000:])
        return None
