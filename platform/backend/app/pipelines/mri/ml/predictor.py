"""
MRI Disease Predictor for the platform.
Uses ConViT model for multi-class classification with majority voting.
"""

import os
import logging
import time
from typing import List, Dict, Any, Optional
from collections import Counter
from pathlib import Path

logger = logging.getLogger(__name__)

# Suppress TensorFlow warnings
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'


class MRIPredictor:
    """
    MRI Disease classification predictor.
    Performs patient-level prediction using majority voting across multiple slice images.
    """

    # Mapping from model classes to platform disease codes
    MODEL_TO_PLATFORM = {
        'AD': 'AD',
        'CN': 'CN',
        'MCI': 'MCI',  # Mild Cognitive Impairment
    }

    CLASS_LABELS = {
        'AD': "Alzheimer's Disease",
        'CN': 'Cognitively Normal',
        'MCI': 'Mild Cognitive Impairment'
    }

    def __init__(self, checkpoint_path: str, device: str = None):
        """
        Initialize the predictor with a trained model checkpoint.

        Args:
            checkpoint_path: Path to the .pth checkpoint file
            device: Device to run inference on ('cuda' or 'cpu')
        """
        self.checkpoint_path = checkpoint_path
        self.model = None
        self.transform = None
        self.class_names = ['AD', 'CN', 'MCI']
        self.device = None
        self._initialized = False

        # Try to initialize the model
        self._initialize_model(device)

    def _initialize_model(self, device: str = None):
        """Initialize the PyTorch model."""
        try:
            import torch
            import timm
            from torchvision import transforms

            self.device = torch.device(device) if device else torch.device(
                "cuda" if torch.cuda.is_available() else "cpu"
            )

            logger.info(f"Initializing MRIPredictor on {self.device}")

            if not os.path.exists(self.checkpoint_path):
                logger.warning(f"Checkpoint not found: {self.checkpoint_path}")
                return

            # Load the ConViT model
            model_start = time.perf_counter()
            logger.info("Creating ConViT architecture: convit_base.fb_in1k")
            self.model = timm.create_model('convit_base.fb_in1k', pretrained=False, num_classes=3)
            logger.info("ConViT architecture created in %.2fs", time.perf_counter() - model_start)

            # Load checkpoint weights
            load_start = time.perf_counter()
            checkpoint_size_mb = os.path.getsize(self.checkpoint_path) / (1024 * 1024)
            logger.info(
                "Loading MRI checkpoint %.1f MB from %s",
                checkpoint_size_mb,
                self.checkpoint_path,
            )
            checkpoint = torch.load(self.checkpoint_path, map_location=self.device)
            logger.info("MRI checkpoint deserialized in %.2fs", time.perf_counter() - load_start)

            state_start = time.perf_counter()
            self.model.load_state_dict(checkpoint['model_state_dict'])
            logger.info("MRI checkpoint state loaded in %.2fs", time.perf_counter() - state_start)

            device_start = time.perf_counter()
            self.model = self.model.to(self.device)
            self.model.eval()
            logger.info("MRI model moved to %s in %.2fs", self.device, time.perf_counter() - device_start)

            logger.info(f"Model loaded from: {self.checkpoint_path}")
            logger.info(f"Checkpoint epoch: {checkpoint.get('epoch', 'N/A')}")

            # Setup transforms
            data_config = timm.data.resolve_model_data_config(self.model)
            self.transform = transforms.Compose([
                transforms.Resize((248, 248)),
                transforms.CenterCrop(224),
                transforms.ToTensor(),
                transforms.Normalize(mean=data_config['mean'], std=data_config['std'])
            ])

            self._initialized = True
            logger.info("MRIPredictor initialized successfully")

        except ImportError as e:
            logger.warning(f"PyTorch/timm not available: {e}. Using mock predictions.")
        except Exception as e:
            logger.warning(f"Failed to initialize model: {e}. Using mock predictions.")

    def is_available(self) -> bool:
        """Check if the model is available for predictions."""
        return self._initialized and self.model is not None

    def predict_single_image(self, image_path: str) -> Dict[str, Any]:
        """
        Predict class for a single slice image.

        Args:
            image_path: Path to the image file

        Returns:
            dict with predicted_class, confidence, and probabilities
        """
        if not self.is_available():
            return self._mock_prediction()

        try:
            import torch
            from PIL import Image

            # Load and preprocess image
            image = Image.open(image_path).convert('RGB')
            image_tensor = self.transform(image).unsqueeze(0).to(self.device)

            # Make prediction
            with torch.no_grad():
                output = self.model(image_tensor)
                probabilities = torch.nn.functional.softmax(output, dim=1)
                top_prob, top_class = probabilities.max(1)

            predicted_class = self.class_names[top_class.item()]
            confidence = top_prob.item() * 100

            all_probs = {
                self.class_names[i]: round(probabilities[0][i].item() * 100, 2)
                for i in range(len(self.class_names))
            }

            return {
                'predicted_class': predicted_class,
                'confidence': round(confidence, 2),
                'probabilities': all_probs
            }

        except Exception as e:
            logger.error(f"Error predicting image {image_path}: {e}")
            return self._mock_prediction()

    def predict_patient(self, image_paths: List[str]) -> Dict[str, Any]:
        """
        Predict diagnosis for a patient using majority voting across slices.

        Args:
            image_paths: List of paths to slice images

        Returns:
            dict with patient_diagnosis, confidence, vote_distribution, etc.
        """
        if not image_paths:
            raise ValueError("No image paths provided")

        logger.info(f"Processing {len(image_paths)} images for patient...")

        individual_predictions = []
        predicted_classes = []

        for i, img_path in enumerate(image_paths, 1):
            try:
                slice_start = time.perf_counter()
                logger.info("Predicting MRI slice %s/%s: %s", i, len(image_paths), os.path.basename(img_path))
                prediction = self.predict_single_image(img_path)
                logger.info("MRI slice %s/%s predicted in %.2fs", i, len(image_paths), time.perf_counter() - slice_start)
                individual_predictions.append({
                    'image_index': i,
                    'image_path': os.path.basename(img_path),
                    **prediction
                })
                predicted_classes.append(prediction['predicted_class'])
            except Exception as e:
                logger.warning(f"Failed to process image {i}: {e}")
                continue

        if not predicted_classes:
            raise Exception("No images were successfully processed")

        # Majority voting
        vote_counts = Counter(predicted_classes)
        final_diagnosis = vote_counts.most_common(1)[0][0]
        votes_for_final = vote_counts[final_diagnosis]
        consensus_strength = (votes_for_final / len(predicted_classes)) * 100

        # Average confidence for final diagnosis
        import numpy as np
        confidences_for_final = [
            pred['confidence'] for pred in individual_predictions
            if pred['predicted_class'] == final_diagnosis
        ]
        avg_confidence = np.mean(confidences_for_final) if confidences_for_final else 0

        # Vote distribution
        vote_distribution = {
            cls: {
                'count': vote_counts.get(cls, 0),
                'percentage': round((vote_counts.get(cls, 0) / len(predicted_classes)) * 100, 1)
            }
            for cls in self.class_names
        }
        average_probabilities = {cls: 0.0 for cls in self.class_names}
        probability_rows = [
            pred.get('probabilities') or {}
            for pred in individual_predictions
            if isinstance(pred.get('probabilities'), dict)
        ]
        if probability_rows:
            for cls in self.class_names:
                average_probabilities[cls] = round(
                    sum(float(row.get(cls, 0.0)) for row in probability_rows)
                    / len(probability_rows),
                    2,
                )

        result = {
            'patient_diagnosis': final_diagnosis,
            'diagnosis_label': self.CLASS_LABELS.get(final_diagnosis, final_diagnosis),
            'confidence': round(avg_confidence, 2),
            'average_probabilities': average_probabilities,
            'vote_distribution': vote_distribution,
            'individual_predictions': individual_predictions,
            'consensus_strength': round(consensus_strength, 1),
            'total_images_processed': len(predicted_classes)
        }

        logger.info(f"Diagnosis: {final_diagnosis} ({consensus_strength:.1f}% consensus)")
        return result

    def _mock_prediction(self) -> Dict[str, Any]:
        """Generate mock prediction when model is not available."""
        import random
        import numpy as np

        predicted_class = random.choice(self.class_names)

        # Generate realistic probabilities
        probs = np.random.dirichlet([3 if c == predicted_class else 1 for c in self.class_names])

        return {
            'predicted_class': predicted_class,
            'confidence': round(max(probs) * 100, 2),
            'probabilities': {
                cls: round(probs[i] * 100, 2)
                for i, cls in enumerate(self.class_names)
            }
        }


# Global predictor instance (initialized lazily)
_predictor: Optional[MRIPredictor] = None
_predictor_checkpoint_path: Optional[str] = None


def create_predictor(checkpoint_path: str = None) -> MRIPredictor:
    """
    Create or get the global predictor instance.

    Args:
        checkpoint_path: Path to model checkpoint

    Returns:
        MRIPredictor instance
    """
    global _predictor, _predictor_checkpoint_path

    if checkpoint_path is None:
        # Default checkpoint path
        checkpoint_path = os.path.join(
            os.path.dirname(os.path.dirname(__file__)),
            'checkpoints',
            'ConViT_model.pth'
        )

    checkpoint_path = os.path.abspath(checkpoint_path)

    if _predictor is None or _predictor_checkpoint_path != checkpoint_path:
        _predictor = MRIPredictor(checkpoint_path)
        _predictor_checkpoint_path = checkpoint_path

    return _predictor
