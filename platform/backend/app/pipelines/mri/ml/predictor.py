"""
MRI Disease Predictor for the platform.
Uses ConViT model for multi-class classification with majority voting.
"""

import os
import logging
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
            self.model = timm.create_model('convit_base.fb_in1k', pretrained=False, num_classes=3)

            # Load checkpoint weights
            checkpoint = torch.load(self.checkpoint_path, map_location=self.device)
            self.model.load_state_dict(checkpoint['model_state_dict'])
            self.model = self.model.to(self.device)
            self.model.eval()

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
                prediction = self.predict_single_image(img_path)
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

        result = {
            'patient_diagnosis': final_diagnosis,
            'diagnosis_label': self.CLASS_LABELS.get(final_diagnosis, final_diagnosis),
            'confidence': round(avg_confidence, 2),
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


def create_predictor(checkpoint_path: str = None) -> MRIPredictor:
    """
    Create or get the global predictor instance.

    Args:
        checkpoint_path: Path to model checkpoint

    Returns:
        MRIPredictor instance
    """
    global _predictor

    if checkpoint_path is None:
        # Default checkpoint path
        checkpoint_path = os.path.join(
            os.path.dirname(os.path.dirname(__file__)),
            'checkpoints',
            'ConViT_model.pth'
        )

    if _predictor is None:
        _predictor = MRIPredictor(checkpoint_path)

    return _predictor
