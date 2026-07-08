import os
import subprocess
import logging
import shutil
from config import CAT12_EXE, MCR_ROOT, CAT12_OUTPUT_DIR, CAT12_ROOT

logger = logging.getLogger(__name__)

def run_cat12_preprocessing(input_nii_path):
    """
    Step 1: Runs CAT12 on the input NIfTI file.
    Returns the path to the processed Grey Matter file (mwp1...).
    """
    input_nii_path = os.path.abspath(input_nii_path)
    input_dir = os.path.dirname(input_nii_path)
    
    # Ensure output directory exists
    os.makedirs(CAT12_OUTPUT_DIR, exist_ok=True)
    
    # 1. Setup Environment
    mcr_paths = [
        os.path.join(MCR_ROOT, "runtime", "win64"),
        os.path.join(MCR_ROOT, "bin", "win64"),
        os.path.join(MCR_ROOT, "sys", "os", "win64"),
        os.path.join(MCR_ROOT, "sys", "opengl", "lib", "win64")
    ]
    env = os.environ.copy()
    env["PATH"] = ";".join(mcr_paths) + ";" + env["PATH"]

    # 2. Generate MATLAB Script
    script_path = os.path.join(CAT12_OUTPUT_DIR, "temp_process.m")
    
    # Handle paths safely
    clean_nii_path = input_nii_path.replace("\\", "/")
    
    # We do NOT specify a move command in MATLAB anymore. 
    # We let CAT12 save where it wants (usually relative to input), then WE find it.
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
    matlabbatch{{1}}.spm.tools.cat.estwrite.output.WM.mod = 1; % mwp2 (white matter)

    % Run
    spm_jobman('run', matlabbatch);
    exit;
    """

    with open(script_path, "w") as f:
        f.write(matlab_code)

    # 3. Execute
    command = [CAT12_EXE, "script", script_path]
    
    logger.info(f"--- Starting CAT12 Preprocessing on {os.path.basename(input_nii_path)} ---")
    
    try:
        subprocess.run(command, check=True, env=env)
        
        # 4. Verify & Retrieve Output
        # CAT12 usually creates an 'mri' folder inside the input directory
        filename = os.path.basename(input_nii_path)
        
        # Possible locations for the output file
        possible_locs = [
            # 1. Inside 'mri' folder next to input (Standard CAT12 behavior)
            os.path.join(input_dir, "mri", f"mwp1{filename}"),
            # 2. Directly next to input
            os.path.join(input_dir, f"mwp1{filename}"),
            # 3. Inside processing folder (if configured differently)
            os.path.join(CAT12_OUTPUT_DIR, f"mwp1{filename}")
        ]

        found_file = None
        for loc in possible_locs:
            if os.path.exists(loc):
                found_file = loc
                break
        
        if found_file:
            # OPTIONAL: Move it to our clean processing folder so everything is organized
            final_path = os.path.join(CAT12_OUTPUT_DIR, f"mwp1{filename}")
            # If it's not already there, copy it
            if os.path.abspath(found_file) != os.path.abspath(final_path):
                shutil.copy2(found_file, final_path)
                
            logger.info(f"CAT12 Success: Found and moved file to {final_path}")
            return final_path
        else:
            logger.error(f"CAT12 finished but output file mwp1{filename} not found in expected locations.")
            return None

    except subprocess.CalledProcessError as e:
        logger.error(f"CAT12 Failed with exit code {e.returncode}")
        return None