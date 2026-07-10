# backend/SIDDHI/exp/exp_classification.py
from copy import deepcopy
from .exp_basic import Exp_Basic
import torch
import torch.nn as nn
from torch import optim
import os
import time
import warnings
import numpy as np
from collections import Counter
import json
import scipy.stats
import traceback

from sklearn.metrics import accuracy_score, precision_recall_fscore_support, confusion_matrix

try:
    from models.ADformer import Model as ADformer_Model
except ImportError as e:
    print(f"Warning: Could not import default model classes: {e}. Ensure models are discoverable.")
    class PlaceholderModel:
        class Model:
            def __init__(self, args): pass
    ADformer_Model = PlaceholderModel.Model

warnings.filterwarnings("ignore")

# JSON encoder for numpy types
class NpEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, np.integer):
            return int(obj)
        if isinstance(obj, np.floating):
            if np.isnan(obj): return None
            if np.isinf(obj): return None
            return float(obj)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        if isinstance(obj, (np.bool_,)):
            return bool(obj)
        return super(NpEncoder, self).default(obj)

class Exp_Classification(Exp_Basic):
    def __init__(self, args):
        super().__init__(args)
        # SWA initialization
        if not hasattr(args, 'swa') or not args.swa:
            self.swa = False
            self.swa_model = None
        else:
            if self.model is not None:
                self.swa = args.swa
                self.swa_model = optim.swa_utils.AveragedModel(self.model)
                print("SWA model wrapper initialized.")
            else:
                print("Warning: SWA enabled but self.model is not yet built. SWA wrapper not initialized.")
                self.swa = False
                self.swa_model = None

    def _build_model(self):
        print("Building model...")
        model_dict = {
            'ADformer': ADformer_Model,
        }
        model_name = getattr(self.args, 'model', None)
        if model_name is None or model_name not in model_dict:
            raise ValueError(f"Model name '{model_name}' not found in model_dict or args. Available: {list(model_dict.keys())}")

        print(f"Using model class: {model_dict[model_name]}")
        model = model_dict[model_name](self.args).float()

        use_gpu = hasattr(self.args, 'use_gpu') and self.args.use_gpu
        use_multi_gpu = hasattr(self.args, 'use_multi_gpu') and self.args.use_multi_gpu
        device_ids = getattr(self.args, 'device_ids', [])

        if use_multi_gpu and use_gpu and device_ids and torch.cuda.device_count() > 1:
            try:
                valid_device_ids = [int(d) for d in device_ids]
                model = nn.DataParallel(model, device_ids=valid_device_ids)
                print(f"Using DataParallel on devices: {valid_device_ids}")
            except ValueError:
                 print(f"Warning: Invalid device_ids format: {device_ids}. Using default device instead.")
            except AssertionError as e:
                 print(f"Warning: DataParallel assertion error: {e}. Using default device instead.")

        print("Model built successfully.")
        return model

    def predict_unlabeled_sample(self, npy_file_path, setting, device,
                                 output_path='output.json', checkpoint_root=None):
        """
        Loads the trained model checkpoint and predicts the class(es) for an unlabeled NPY file.

        output_path: where to write the results JSON (default 'output.json' in CWD,
            preserving original behaviour). The unified pipeline passes a unique
            per-job path so concurrent runs never collide.
        checkpoint_root: optional root that holds the checkpoints tree. When set,
            checkpoints resolve under it; when None, the original __file__-relative
            '../checkpoints' path is used.
        """
        # Build checkpoint path
        script_dir = os.path.dirname(os.path.abspath(__file__))
        if not setting or not isinstance(setting, str):
            print("Error: 'setting' argument is missing or invalid.")
            raise ValueError("Missing 'setting' argument required to locate the correct checkpoint directory.")

        if checkpoint_root:
            checkpoint_dir_path = os.path.join(
                checkpoint_root,
                self.args.task_name,
                self.args.model_id,
                self.args.model,
                setting
            )
        else:
            checkpoint_dir_path = os.path.join(
                script_dir,
                '..',
                'checkpoints',
                self.args.task_name,
                self.args.model_id,
                self.args.model,
                setting
            )
        model_path = os.path.join(checkpoint_dir_path, 'checkpoint.pth')
        model_path = os.path.normpath(model_path)

        print(f"Looking for model checkpoint at calculated path: {model_path}")

        if not os.path.exists(model_path):
            print(f"Error: Model checkpoint not found.")
            print(f"Expected location: {model_path}")
            print(f"Current working directory: {os.getcwd()}")
            parent_dir = os.path.dirname(model_path)
            if not os.path.exists(parent_dir):
                 print(f"Parent directory '{parent_dir}' also does not exist.")
                 print("Verify arguments: task_name, model_id, model, and the passed 'setting' string.")
            else:
                 print(f"Parent directory '{parent_dir}' exists, but 'checkpoint.pth' is missing.")
            raise FileNotFoundError("Model checkpoint not found at calculated path: %s" % model_path)

        # Load model weights
        print(f"Loading model state from {model_path} onto device: {device}")
        use_swa = hasattr(self, 'swa') and self.swa and self.swa_model is not None

        try:
            if use_swa:
                if self.swa_model is None:
                     raise RuntimeError("SWA is enabled but swa_model is None. Cannot load weights.")
                self.swa_model.load_state_dict(torch.load(model_path, map_location=device))
                self.swa_model = self.swa_model.to(device)
                self.swa_model.eval()
                model_to_use = self.swa_model
                print("Using SWA model weights for prediction.")
            else:
                if self.model is None:
                    raise RuntimeError("Base model (self.model) is None. Cannot load weights.")
                self.model.load_state_dict(torch.load(model_path, map_location=device))
                self.model.eval()
                model_to_use = self.model
                print("Using standard model weights for prediction.")
        except Exception as load_err:
            print(f"Error loading model state dict from {model_path}: {load_err}")
            traceback.print_exc()
            raise

        # Load input data
        try:
            print(f"Loading input EEG data from: {npy_file_path}")
            X_orig = np.load(npy_file_path, allow_pickle=True)
            print(f"Original input data shape: {X_orig.shape}")
        except Exception as e:
            print(f"Error loading .npy file {npy_file_path}: {e}")
            traceback.print_exc()
            raise

        # Handle input shape
        if X_orig.ndim == 3:
            num_trials, seq_len_data, channels_data = X_orig.shape
            print(f"Input is 3D ({X_orig.shape}), processing {num_trials} trials/segments.")
            X_batch = X_orig
        elif X_orig.ndim == 2:
            num_trials = 1
            seq_len_data, channels_data = X_orig.shape
            print(f"Input is 2D ({X_orig.shape}), processing as 1 trial/segment.")
            X_batch = np.expand_dims(X_orig, axis=0)
        else:
            raise ValueError(f"Unsupported input data dimension: {X_orig.ndim}. Expected 2 or 3.")

        # Validate shape
        expected_seq_len = getattr(self.args, 'seq_len', None)
        expected_channels = getattr(self.args, 'enc_in', None)

        if expected_seq_len is None or expected_channels is None:
             print("Warning: Model's expected seq_len or enc_in not found in args. Skipping shape validation.")
        else:
            if seq_len_data != expected_seq_len:
                print(f"Warning: Input sequence length {seq_len_data} != expected {expected_seq_len}.")
            if channels_data != expected_channels:
                raise ValueError(f"Input data has {channels_data} channels, model expects {expected_channels}.")

        print(f"Data shape for model processing: {X_batch.shape}")

        # Convert to tensor
        X_tensor = torch.tensor(X_batch, dtype=torch.float32).to(device)

        # Inference
        all_predictions = []
        all_probabilities = []
        print(f"Running inference on {num_trials} trial(s) using device: {device}...")
        try:
            with torch.no_grad():
                batch_size, current_seq_len, _ = X_tensor.shape
                padding_mask = torch.ones((batch_size, current_seq_len), dtype=torch.bool).to(device)
                outputs = model_to_use(X_tensor, padding_mask, None, None)
                if isinstance(outputs, tuple):
                     outputs = outputs[0]
                probs = torch.nn.functional.softmax(outputs, dim=-1)
                predictions = torch.argmax(probs, dim=-1)
                all_predictions = predictions.cpu().numpy()
                all_probabilities = probs.cpu().numpy()
        except Exception as inference_err:
            print(f"Error during model inference: {inference_err}")
            print(f"Input tensor shape during error: {X_tensor.shape}")
            traceback.print_exc()
            raise

        print(f"Individual trial predictions (raw): {all_predictions}")

        # Majority vote and metrics
        majority_prediction = -1
        consistency_metrics = {"error": "Calculation failed or not applicable"}

        if num_trials > 0 and len(all_predictions) == num_trials:
            try:
                count = Counter(all_predictions)
                # Tie-break: default to 0
                if len(count) > 1 and len(count.most_common(2)) > 1 and count.most_common(2)[0][1] == count.most_common(2)[1][1]:
                    print("Warning: Tie in majority vote. Defaulting to 0 (Normal).")
                    majority_prediction = 0
                else:
                    majority_prediction = count.most_common(1)[0][0]

                print(f"Majority Prediction (0=Normal, 1=Alz): {majority_prediction}")

                if num_trials > 1:
                    print("Calculating internal consistency metrics...")
                    y_true = np.full(num_trials, majority_prediction)
                    y_pred = all_predictions

                    accuracy = accuracy_score(y_true, y_pred)
                    precision, recall, f1, _ = precision_recall_fscore_support(
                        y_true, y_pred, average='binary', pos_label=1, zero_division=0
                    )
                    _, specificity, _, _ = precision_recall_fscore_support(
                         y_true, y_pred, average='binary', pos_label=0, zero_division=0
                    )

                    unique_labels_in_preds = np.unique(y_pred)
                    if len(unique_labels_in_preds) == 1:
                         print(f"Warning: Only one class ({unique_labels_in_preds[0]}) predicted across trials.")
                         if unique_labels_in_preds[0] == 0:
                             tn = len(y_true) if majority_prediction == 0 else 0
                             fp = 0 if majority_prediction == 0 else len(y_true)
                             fn, tp = 0, 0
                         else:
                             tn, fp = 0, 0
                             fn = len(y_true) if majority_prediction == 0 else 0
                             tp = 0 if majority_prediction == 0 else len(y_true)
                         precision = 0 if tp + fp == 0 else tp / (tp + fp)
                         recall = 0 if tp + fn == 0 else tp / (tp + fn)
                         specificity = 0 if tn + fp == 0 else tn / (tn + fp)
                         f1 = 0 if precision + recall == 0 else 2 * (precision * recall) / (precision + recall)
                    else:
                         cm = confusion_matrix(y_true, y_pred, labels=[0, 1])
                         if cm.shape == (2, 2):
                             tn, fp, fn, tp = cm.ravel()
                         else:
                             print(f"Warning: Unexpected confusion matrix shape: {cm.shape}. Setting counts/metrics to 0.")
                             tn, fp, fn, tp = 0, 0, 0, 0
                             precision, recall, specificity, f1 = 0, 0, 0, 0

                    consistency_metrics = {
                        "num_trials": int(num_trials),
                        "num_normal_pred": int(np.sum(y_pred == 0)),
                        "num_alz_pred": int(np.sum(y_pred == 1)),
                        "accuracy": float(accuracy),
                        "precision": float(precision),
                        "recall_sensitivity": float(recall),
                        "specificity": float(specificity),
                        "f1_score": float(f1),
                        "true_positives": int(tp),
                        "true_negatives": int(tn),
                        "false_positives": int(fp),
                        "false_negatives": int(fn),
                        "majority_label_used_as_reference": int(majority_prediction)
                    }
                    print(f"Consistency Metrics: {json.dumps(consistency_metrics, cls=NpEncoder, indent=4)}")
                else:
                    print("Only one trial/segment found, consistency metrics are not applicable.")
                    consistency_metrics = {"num_trials": 1, "message": "Metrics not applicable for single segment input"}

            except Exception as metrics_err:
                print(f"Error calculating metrics: {metrics_err}")
                traceback.print_exc()
                consistency_metrics = {"error": f"Metrics calculation failed: {metrics_err}"}

        else:
            print("Warning: No predictions available to calculate majority or metrics.")
            majority_prediction = -1
            consistency_metrics = {"error": "No predictions generated"}
            all_predictions = []

        # Prepare output
        first_trial_probabilities = all_probabilities[0].tolist() if len(all_probabilities) > 0 else None

        results = {
            "majority_prediction": int(majority_prediction),
            "probabilities": first_trial_probabilities,
            "trial_predictions": all_predictions.tolist() if isinstance(all_predictions, np.ndarray) else all_predictions,
            "consistency_metrics": consistency_metrics
        }

        # Save results to the requested output path (default 'output.json')
        output_file = output_path
        try:
            with open(output_file, "w") as f:
                json.dump(results, f, cls=NpEncoder, indent=4)
            print(f"Prediction results and metrics saved to {os.path.abspath(output_file)}")
        except Exception as e:
            print(f"An error occurred saving results to {output_file}: {e}")
            traceback.print_exc()

        return results
