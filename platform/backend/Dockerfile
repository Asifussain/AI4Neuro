# All-in-one backend image (MVP).
#
# Bundles the API + both ML pipelines and runs jobs in-process via the
# ThreadPoolExecutor JobService. This is the simplest deployable unit; for
# production, split into Dockerfile.api + worker images (see docs/deployment.md).
#
# NOTE: this image is large (PyTorch + timm + nibabel). torch/torchvision are
# installed from a CPU wheel index by default; override TORCH_INDEX_URL for GPU.
FROM python:3.11-slim AS base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

# libgomp1 is needed by some scientific wheels (torch/scipy) at runtime.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# CPU torch by default; override for a GPU base + CUDA wheels.
ARG TORCH_INDEX_URL=https://download.pytorch.org/whl/cpu

COPY requirements ./requirements
# Install torch/torchvision first from the chosen index, then the pipeline deps.
RUN pip install --no-cache-dir --index-url "${TORCH_INDEX_URL}" torch torchvision \
    && pip install --no-cache-dir -r requirements/eeg.txt -r requirements/mri.txt

COPY app ./app

# Model weights + reference data are provided at runtime via a mounted /models
# volume (they are intentionally NOT baked in — see docs/deployment.md).
ENV EEG_CHECKPOINT_ROOT=/models/eeg/checkpoints \
    EEG_REFERENCE_DIR=/models/eeg/reference \
    CONVIT_CHECKPOINT_PATH=/models/mri/ConViT_model.pth \
    LOCAL_TMP_DIR=/tmp/neuro-platform \
    USE_MOCK_MODEL=true \
    USE_CAT12_PREPROCESSING=false

RUN useradd --create-home --uid 10001 appuser && chown -R appuser /app
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/v1/health').status==200 else 1)"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
