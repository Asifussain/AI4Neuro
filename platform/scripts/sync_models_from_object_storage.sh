#!/usr/bin/env bash
set -euo pipefail

# Sync AI4NEURO model artifacts from an S3-compatible object store.
#
# Works with Cloudflare R2 and Oracle Object Storage S3 compatibility.
# Requires AWS CLI v2 configured through environment variables:
#
#   AWS_ACCESS_KEY_ID=...
#   AWS_SECRET_ACCESS_KEY=...
#   MODEL_BUCKET=ai4neuro-models
#   MODEL_ENDPOINT_URL=https://<account-id>.r2.cloudflarestorage.com
#
# Optional:
#   MODEL_PREFIX=ai4neuro
#   MODEL_DIR=platform/backend/models

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLATFORM_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_DIR="$(cd "${PLATFORM_DIR}/.." && pwd)"

MODEL_BUCKET="${MODEL_BUCKET:?Set MODEL_BUCKET, for example ai4neuro-models}"
MODEL_ENDPOINT_URL="${MODEL_ENDPOINT_URL:?Set MODEL_ENDPOINT_URL for R2/Oracle S3 compatibility}"
MODEL_PREFIX="${MODEL_PREFIX:-}"
MODEL_DIR="${MODEL_DIR:-${PLATFORM_DIR}/backend/models}"

if ! command -v aws >/dev/null 2>&1; then
  echo "aws CLI is required. Install AWS CLI v2 first." >&2
  exit 1
fi

mkdir -p "${MODEL_DIR}/eeg" "${MODEL_DIR}/mri"

prefix_path() {
  local suffix="$1"
  if [[ -n "${MODEL_PREFIX}" ]]; then
    printf '%s/%s' "${MODEL_PREFIX%/}" "${suffix#/}"
  else
    printf '%s' "${suffix#/}"
  fi
}

echo "Syncing EEG checkpoints into ${MODEL_DIR}/eeg/checkpoints"
aws s3 sync \
  "s3://${MODEL_BUCKET}/$(prefix_path eeg/checkpoints)" \
  "${MODEL_DIR}/eeg/checkpoints" \
  --endpoint-url "${MODEL_ENDPOINT_URL}"

echo "Syncing EEG reference files into ${MODEL_DIR}/eeg/reference"
aws s3 sync \
  "s3://${MODEL_BUCKET}/$(prefix_path eeg/reference)" \
  "${MODEL_DIR}/eeg/reference" \
  --endpoint-url "${MODEL_ENDPOINT_URL}"

echo "Syncing MRI model files into ${MODEL_DIR}/mri"
aws s3 sync \
  "s3://${MODEL_BUCKET}/$(prefix_path mri)" \
  "${MODEL_DIR}/mri" \
  --endpoint-url "${MODEL_ENDPOINT_URL}"

cat <<EOF

Model sync complete.

Suggested backend env:

EEG_CHECKPOINT_ROOT=${MODEL_DIR}/eeg/checkpoints
EEG_REFERENCE_DIR=${MODEL_DIR}/eeg/reference
CONVIT_CHECKPOINT_PATH=${MODEL_DIR}/mri/ConVit_checkpoint.pth

Repo root:
${REPO_DIR}
EOF
