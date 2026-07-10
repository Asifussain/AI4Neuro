# Architecture

How the unified platform is put together, and why. Companion to the top-level
`README.md` and the source of truth in `../../UNIFIED_NEURO_PLATFORM_ARCHITECTURE_PLAN.md`.

---

## 1. Layers

```
api        FastAPI routes (app/api/v1/*)          — orchestrate only, no ML
  ↓
services   app/services/*                          — database, storage, jobs,
                                                     orchestrator, reports, permissions
  ↓
pipelines  app/pipelines/{base,eeg,mri}            — framework-independent ML
  ↓
models     SIDDHI/ADformer, ConViT, CAT12          — vendored / external
```

The one hard rule: **nothing under `app/pipelines/` imports FastAPI or a service.**
Routes and the orchestrator depend on the pipeline *contract*, never on a specific
model. This is dependency inversion in practice — it is what lets the two pipelines
stay isolated and swappable, and what lets a job run in-process today and in a separate
worker tomorrow without touching a route.

---

## 2. The pipeline contract (`app/pipelines/base.py`)

```python
class AnalysisContext(BaseModel):
    session_id: str; modality: Literal["eeg", "mri"]; analysis_type: str
    local_input_path: str; original_filename: str
    patient_id: str; doctor_id / hospital_id / radiologist_id / technician_id: str | None
    uploaded_by_role: str | None; options: dict          # e.g. {"channel_index": 3}

class PipelineResult(BaseModel):
    prediction: str; confidence: float; probabilities: dict[str, float]
    metrics: dict; similarity: dict; consistency: dict; visualizations: dict
    model_version: str
    artifacts: dict[str, str]                  # local plot paths, uploaded post-run
    viewer_slices: dict[str, list[str]]        # MRI: local slice paths per orientation
```

A **registry** maps `"eeg"`/`"mri"` → a runner; `run_pipeline(context)` dispatches by
`context.modality`. Runners are registered **lazily** (`app/pipelines/__init__.py`) so
importing the app never pulls torch/timm/nibabel/matplotlib — the heavy modules import
only when a job of that modality actually runs. (Verified: the API process imports zero
ML libraries at boot.)

Modality specifics live inside the jsonb sub-objects, so the **outer shape is identical**:

- EEG → `metrics.eeg_stats`, `similarity.*` (DTW), `consistency.trial_predictions`,
  `visualizations.{timeseries,psd,similarity}_plot_url`.
- MRI → `metrics.{brain,gm,wm,csf,...}_volume` + `volume_comparison`,
  `consistency.slice_predictions`, `visualizations.{volume_chart,confidence_chart,
  similarity_plot}_url` + `viewer_slice_urls`.

---

## 3. Job orchestration (`app/services/orchestrator.py`, `jobs.py`, `workers/`)

`JobService` is a one-method interface: `enqueue_analysis(session_id)`. The MVP
implementation (`LocalJobService`) runs jobs on a `ThreadPoolExecutor`; the API only
ever calls the interface, so swapping to Celery/RQ/cloud workers later touches only this
class — **not** any route (architecture doc §4.2 / Decision 2).

`run_analysis_job(session_id)` is the durable boundary and the only place that knows
about sessions + storage + the pipeline registry + reports together:

```
processing/saved_upload(10%) → download raw → running_model(50%) → run_pipeline
  → generating_visualizations(75%): upload artifacts + viewer slices
  → insert_result → generating_reports(90%): PdfReportService → insert_reports
  → completed(100%)                       [any exception → failed + job_event + cleanup]
```

**Thread-safety notes:** the EEG runner shells out to SIDDHI with `cwd=` and a unique
`--output_path` per job (no global `os.chdir`, no shared `output.json`); both runners
serialize their matplotlib/pyplot calls with a lock (pyplot's state is process-global).
So `LOCAL_JOB_MAX_WORKERS > 1` is safe.

---

## 4. The two pipelines

### EEG (`app/pipelines/eeg/`)
Ported from `Alzheimer-Detection` verbatim: `siddhi/` (ADformer code, no checkpoints),
`similarity_analyzer.py`, `visualization.py`. `ml_runner.py` runs `siddhi/run.py` as a
subprocess and returns the parsed JSON. `runner.py` maps it to `PipelineResult`
(binary: Normal/Alzheimer's; multiclass: CN/MCI/AD), runs DTW similarity + EEG stats +
3 plots. Two additive, backward-compatible edits to vendored SIDDHI add `--output_path`
and `--checkpoint_root`. Model weights + reference `.npy` are referenced via config
(`EEG_CHECKPOINT_ROOT`, `EEG_REFERENCE_DIR`) rather than duplicated (~140 MB).

### MRI (`app/pipelines/mri/`)
Ported from `mri-platform`: `ml_runner(+mock)`, `cat12_manager`, `volumetric_analyzer`,
`similarity_analyzer`, `ml/{predictor,nifti_slicer}`. A `config.py` shim provides the
static clinical constants + env-driven CAT12/checkpoint paths. **Supabase was decoupled
from the pipeline** — the legacy slice-uploader was replaced with a local
`extract_viewer_slices_local`; the storage service does the upload. `run_mri_pipeline`
is **mock-first**: with no ConViT checkpoint / CAT12 / MATLAB (e.g. on Linux) it returns
realistic mock predictions + volumes, so it runs end to end anywhere; real mode is
env-gated (`USE_MOCK_MODEL`, `USE_CAT12_PREPROCESSING`).

---

## 5. Reports (`app/services/reports.py`, `app/reports/`)

One `PdfReportService` generates patient/clinician/technical PDFs for both modalities,
**reusing the proven fpdf2 renderers** from both legacy apps as the modality-specific
sections. It provides the common orchestration once — build the report context, read
artifact plot files back into the PDFs, upload to `reports/{session_id}/{type}.pdf`,
assemble URLs — and dispatches only the page rendering by modality. Report generation is
**non-fatal**: a failed report is logged and skipped, never failing the job (matching the
legacy "completed with errors" behaviour). The report context is mock now, with a seam
(`app/reports/context.py`) for DB-backed patient/hospital lookups.

---

## 6. Data model (`../../supabase/migrations/`)

The existing identity tables (`user_profiles`, `patient_profiles`, `doctor_profiles`,
`hospitals`, …) are **shared and untouched**. Migration `0001` adds the analysis layer:

- `analysis_sessions` — modality, analysis_type, `patient_id → patient_profiles(user_id)`,
  doctor/radiologist/technician/uploaded_by `→ user_profiles(id)`, hospital_id, filename,
  raw_file path/bucket, status, current_stage, progress_percent, error_message,
  retry_count, timestamps.
- `analysis_results` — prediction, confidence, and jsonb `probabilities`/`metrics`/
  `similarity`/`consistency`/`visualizations`, model_version (1:1 with a session).
- `analysis_reports` — patient/clinician/technical pdf urls + asset_urls (1:1).
- `job_events` — progress/debug timeline.
- Widens `user_profiles.role` to include `technician`; creates private buckets
  (`raw-files`, `report-assets`, `reports`, `viewer-slices`); enables RLS fail-closed.

Migration `0002` adds `pipeline_options jsonb` (EEG `channel_index`, MRI scan metadata).

> **Deviation from the plan doc (intentional):** the doc's §7 schema assumed
> `patient_profiles.id` as PK, but the real table's PK is `user_id` and all FKs point
> there. The migration follows reality, not the doc — see the plan's "Key conflicts".

---

## 7. Security (`app/core/security.py`, `app/services/permissions.py`)

Both legacy backends had **no** backend authorization (they trusted client-supplied ids
behind the service-role key). Now:

- The frontend attaches the Supabase access token as `Authorization: Bearer …`.
- `get_current_user` verifies the JWT (HS256, `SUPABASE_JWT_SECRET`), loads the
  `user_profiles` row, and enforces `account_status == "active"`.
- `permissions.py` centralizes the rules — `can_create_analysis`, `can_read_session`,
  `can_read_report`, `can_retry_session` — role + same-hospital scoped, fail closed.
  Every analysis route enforces them and returns a structured `403 permission_denied`.
- `AUTH_DEV_BYPASS` injects a dev admin for local dev; it **must be false in production**
  (enforced when `APP_ENV=production`).

RLS is enabled fail-closed on the new tables; per-role SELECT policies + a DB-backed
report context are the next hardening step (doc §14.4). The backend uses the service-role
key server-side only; the browser only ever holds the anon key.

---

## 8. Frontend (`frontend/src/`)

Built on the newer MRI base (Next 16 App Router, TypeScript, shadcn/Radix). Additions:

- `lib/api/client.ts` — the single backend client (Bearer token, error-shape
  normalization). Sensitive analysis data flows through the API, not direct Supabase.
- `features/analysis/` — DTO `types` mirroring the backend, `api` wrappers, a
  `useAnalysisSession` polling hook (stops on terminal status, backs off on error,
  re-arms on retry), and components (upload form, status panel, result panel with
  EEG/MRI visualization sections + the dynamic-imported MRI viewer, sessions list).
- Pages: `/analysis/new`, `/analysis/[id]`, `/dashboard`; `technician` added to the
  role model + `/technician/dashboard`.
