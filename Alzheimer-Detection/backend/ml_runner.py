import os
import sys
import subprocess
import traceback
from config import SIDDHI_FOLDER, OUTPUT_JSON_PATH

ML_RUNNER_DIR = os.path.dirname(os.path.abspath(__file__))
SIDDHI_PATH = os.path.join(ML_RUNNER_DIR, 'SIDDHI')
if SIDDHI_PATH not in sys.path:
    sys.path.insert(0, SIDDHI_PATH)

def run_model(filepath_to_process: str, classification_type: str = 'binary'):
    """
    Runs the SIDDHI ML model script as a subprocess.
    Args:
        filepath_to_process: Path to the .npy file to process
        classification_type: 'binary' or 'multiclass'
    """
    print(f"ML Runner: Executing ML model for: {filepath_to_process}")
    print(f"Classification Type: {classification_type}")

    siddhi_absolute_path = SIDDHI_PATH
    absolute_filepath_for_ml = os.path.abspath(filepath_to_process)
    expected_output_json_in_siddhi = os.path.join(siddhi_absolute_path, 'output.json')

    # Configure parameters based on classification type
    if classification_type == 'multiclass':
        model_id = 'ADFD-Indep'
        data_type = 'ADFDIndep'
        num_classes = '3'  # CN, MCI, AD
        seq_len = '256'  # ADFD model was trained with 256 timepoints (checkpoint weights confirm this)
        patch_len_list = '2,2,2,4,4,4'
        up_dim_list = '19,38,76,152'
    else:  # binary
        model_id = 'ADSZ-Indep'
        data_type = 'ADSZIndep'
        num_classes = '2'  # Normal, Alzheimer's
        seq_len = '128'  # Both models use 128 timepoints
        patch_len_list = '4'
        up_dim_list = '19'

    if not os.path.isdir(siddhi_absolute_path):
        raise FileNotFoundError(f"SIDDHI directory not found at: {siddhi_absolute_path}")
    if not os.path.isfile(absolute_filepath_for_ml):
        raise FileNotFoundError(f"Input EEG file not found at: {absolute_filepath_for_ml}")

    if os.path.exists(expected_output_json_in_siddhi):
        try:
            os.remove(expected_output_json_in_siddhi)
            print(f"Removed existing output file: {expected_output_json_in_siddhi}")
        except Exception as rem_e:
            print(f"Warning: Could not remove {expected_output_json_in_siddhi}: {rem_e}")

    original_cwd = os.getcwd()
    print(f"Changing CWD from '{original_cwd}' to '{siddhi_absolute_path}'")
    os.chdir(siddhi_absolute_path)

    try:
        # Build base command
        cmd = [
            'python', 'run.py',
            '--task_name', 'classification',
            '--is_training', '0',
            '--model_id', model_id,
            '--model', 'ADformer',
            '--data', data_type,
            '--e_layers', '6',
            '--batch_size', '1',
            '--d_model', '128',
            '--d_ff', '256',
            '--enc_in', '19',
            '--num_class', num_classes,
            '--seq_len', seq_len,
            '--input_file', absolute_filepath_for_ml,
            '--use_gpu', 'False',
            '--features', 'M',
            '--label_len', '48',
            '--pred_len', '96',
            '--n_heads', '8',
            '--d_layers', '1',
            '--factor', '1',
            '--embed', 'timeF',
            '--des', "'Exp'",
            "--patch_len_list", patch_len_list,
            "--up_dim_list", up_dim_list,
        ]

        # Add SWA flag for multiclass (ADFD was trained with SWA)
        if classification_type == 'multiclass':
            cmd.append('--swa')
        
        print(f"Running ML command: {' '.join(cmd)}")
        result = subprocess.run(cmd, capture_output=True, text=True, check=True, encoding='utf-8', timeout=360)
        
        print(f"ML Model STDOUT:\n{result.stdout}")
        if result.stderr:
            print(f"ML Model STDERR:\n{result.stderr}")
        
        if not os.path.exists('output.json'):
            raise FileNotFoundError(f"'output.json' not created in {siddhi_absolute_path} after script execution.")
        
        print("ML model script executed successfully.")
        return expected_output_json_in_siddhi

    except subprocess.CalledProcessError as proc_error:
        print(f"ML script execution failed (Return Code {proc_error.returncode})\n--- ML STDERR ---\n{proc_error.stderr}\n--- End ML STDERR ---")
        traceback.print_exc()
        raise
    except subprocess.TimeoutExpired:
        print("ML script execution timed out.")
        raise TimeoutError("ML model execution timed out.")
    except FileNotFoundError as fnf_error:
        print(f"File System Error: {fnf_error}")
        traceback.print_exc()
        raise
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        traceback.print_exc()
        raise
    finally:
        print(f"Changing CWD back to original: {original_cwd}")
        os.chdir(original_cwd)
