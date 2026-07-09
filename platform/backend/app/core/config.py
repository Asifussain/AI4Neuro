"""Application settings.

Single source of truth for configuration, loaded from environment / .env via
pydantic-settings. Replaces the two divergent ``config.py`` modules in the old
Flask backends (``Alzheimer-Detection/backend/config.py`` and
``mri-platform/backend/config.py``) with one typed settings object.

Nothing here imports FastAPI or any pipeline code, so it is safe to import from
every layer (api / services / pipelines / workers).
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# ---- Derived default paths -------------------------------------------------- #
# config.py lives at platform/backend/app/core/config.py.
_APP_DIR = Path(__file__).resolve().parents[1]          # .../platform/backend/app
_REPO_ROOT = Path(__file__).resolve().parents[4]        # repo root (AI4Neuro)

# EEG code was copied into the pipeline package; large binaries (checkpoints,
# reference .npy) stay in the legacy tree during migration and are referenced via
# these overridable defaults (bundled into the EEG worker image at deployment).
_DEFAULT_EEG_SIDDHI_DIR = _APP_DIR / "pipelines" / "eeg" / "siddhi"
_DEFAULT_EEG_CHECKPOINT_ROOT = (
    _REPO_ROOT / "Alzheimer-Detection" / "backend" / "SIDDHI" / "checkpoints"
)
_DEFAULT_EEG_REFERENCE_DIR = _REPO_ROOT / "Alzheimer-Detection" / "backend"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ---- Application ----
    app_env: str = Field(default="development", alias="APP_ENV")
    api_host: str = Field(default="0.0.0.0", alias="API_HOST")
    api_port: int = Field(default=8000, alias="API_PORT")
    # Comma-separated list of allowed CORS origins.
    cors_origins: str = Field(default="http://localhost:3000", alias="CORS_ORIGINS")

    # ---- Supabase ----
    # Kept optional so the app can boot for local/dev + tests without secrets.
    # Services raise a clear error only when an operation actually needs them.
    supabase_url: str | None = Field(default=None, alias="SUPABASE_URL")
    supabase_service_role_key: str | None = Field(
        default=None, alias="SUPABASE_SERVICE_ROLE_KEY"
    )
    supabase_jwt_secret: str | None = Field(default=None, alias="SUPABASE_JWT_SECRET")

    # ---- Storage buckets (doc 7.2) ----
    raw_files_bucket: str = Field(default="raw-files", alias="RAW_FILES_BUCKET")
    report_assets_bucket: str = Field(
        default="report-assets", alias="REPORT_ASSETS_BUCKET"
    )
    reports_bucket: str = Field(default="reports", alias="REPORTS_BUCKET")
    viewer_slices_bucket: str = Field(
        default="viewer-slices", alias="VIEWER_SLICES_BUCKET"
    )

    # ---- Jobs / background execution (doc 4.2) ----
    job_backend: str = Field(default="local", alias="JOB_BACKEND")  # local | (celery later)
    local_job_max_workers: int = Field(default=2, alias="LOCAL_JOB_MAX_WORKERS")

    # ---- Uploads ----
    local_tmp_dir: str = Field(default="/tmp/neuro-platform", alias="LOCAL_TMP_DIR")
    max_upload_mb: int = Field(default=512, alias="MAX_UPLOAD_MB")

    # ---- Auth ----
    # When true, the JWT guard accepts requests without a valid token and injects a
    # dev principal. Lets the foundation run before Phase 5 (full auth) lands.
    # MUST be false in production.
    auth_dev_bypass: bool = Field(default=True, alias="AUTH_DEV_BYPASS")

    # ---- Pipeline toggles ----
    use_mock_model: bool = Field(default=True, alias="USE_MOCK_MODEL")
    use_cat12_preprocessing: bool = Field(
        default=False, alias="USE_CAT12_PREPROCESSING"
    )

    # ---- EEG pipeline (Phase 2) ----
    eeg_siddhi_dir: str = Field(
        default=str(_DEFAULT_EEG_SIDDHI_DIR), alias="EEG_SIDDHI_DIR"
    )
    eeg_checkpoint_root: str = Field(
        default=str(_DEFAULT_EEG_CHECKPOINT_ROOT), alias="EEG_CHECKPOINT_ROOT"
    )
    eeg_reference_dir: str = Field(
        default=str(_DEFAULT_EEG_REFERENCE_DIR), alias="EEG_REFERENCE_DIR"
    )
    eeg_use_gpu: bool = Field(default=False, alias="EEG_USE_GPU")
    eeg_default_fs: int = Field(default=128, alias="EEG_DEFAULT_FS")
    eeg_subprocess_timeout: int = Field(default=600, alias="EEG_SUBPROCESS_TIMEOUT")

    # ---- MRI pipeline (Phase 3) ----
    # Empty checkpoint / CAT12 paths => the pipeline degrades to mock mode
    # (see USE_MOCK_MODEL / USE_CAT12_PREPROCESSING). Real mode needs a
    # MATLAB-capable host with CAT12 + MATLAB Runtime and a ConViT checkpoint.
    convit_checkpoint_path: str = Field(default="", alias="CONVIT_CHECKPOINT_PATH")
    cat12_root: str = Field(default="", alias="CAT12_ROOT")
    cat12_exe: str = Field(default="", alias="CAT12_EXE")
    mcr_root: str = Field(default="", alias="MCR_ROOT")
    cat12_output_dir: str = Field(default="", alias="CAT12_OUTPUT_DIR")
    mri_use_gpu: bool = Field(default=False, alias="MRI_USE_GPU")
    mri_model_version: str = Field(default="ConViT-v1.0", alias="MRI_MODEL_VERSION")

    @field_validator("app_env")
    @classmethod
    def _normalize_env(cls, v: str) -> str:
        return v.strip().lower()

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.app_env in {"production", "prod"}

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    """Cached settings accessor (import-safe, one instance per process)."""
    return Settings()
