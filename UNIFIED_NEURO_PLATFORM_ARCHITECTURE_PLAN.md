# Unified Neuro Platform Architecture and Deployment Plan

This document is the implementation plan for merging the current AI4NEURO EEG Alzheimer Detection project and the MRI Platform into one deployable product with one frontend, one backend API contract, and Supabase as the shared database and storage layer.

The recommended direction is:

```text
One Next.js frontend
One FastAPI backend API
Two isolated Python analysis pipelines
One Supabase project for auth, database, and storage
ThreadPoolExecutor for MVP background jobs
Queue/worker upgrade path for production scale
```

The key rule is that the API layer and ML pipeline layer must be separated. The frontend should never care whether a session is EEG or MRI beyond passing `modality`. The backend should route the analysis internally.

---

## 1. Product Goal

Build one platform that supports:

- EEG upload and analysis using ADFormer/SIDDHI.
- MRI upload and analysis using CAT12, NIfTI slicing, and ConViT.
- Role-based users: admin, doctor, radiologist, technician, patient.
- Unified dashboards and report viewing.
- Supabase-backed authentication, database records, file storage, and polling.
- Deployable frontend and backend.

Target user-facing flow:

```text
User logs in
  -> creates or selects patient/session
  -> uploads EEG or MRI
  -> backend creates analysis session
  -> backend processes in background
  -> frontend polls session status
  -> reports and viewer assets become available
```

---

## 2. Current Systems Summary

### 2.1 AI4NEURO EEG System

Current shape:

```text
Next.js frontend
  -> Flask API /api/predict
  -> Supabase predictions table and storage
  -> Celery task
  -> SIDDHI ADFormer model
  -> EEG visualizations, similarity, reports
```

Important files:

```text
Alzheimer-Detection/backend/routes/predict_api.py
Alzheimer-Detection/backend/ml_runner.py
Alzheimer-Detection/backend/SIDDHI/
Alzheimer-Detection/backend/similarity_analyzer.py
Alzheimer-Detection/backend/visualization.py
Alzheimer-Detection/backend/pdf_generation/
```

Key behavior:

- Input is `.npy` EEG data.
- Binary mode: Normal vs Alzheimer's.
- Multiclass mode: CN vs MCI vs AD.
- Uses ADFormer model checkpoints.
- Generates patient, clinician, and technical PDFs.
- Existing backend uses Celery.

### 2.2 MRI Platform

Current shape:

```text
Next.js frontend
  -> Flask API /api/analyze
  -> Supabase mri_sessions and mri_predictions
  -> background thread
  -> CAT12 preprocessing
  -> NIfTI slice extraction
  -> ConViT inference
  -> visualizations and reports
```

Important files:

```text
mri-platform/backend/app.py
mri-platform/backend/ml_runner.py
mri-platform/backend/cat12_manager.py
mri-platform/backend/ml/nifti_slicer.py
mri-platform/backend/ml/predictor.py
mri-platform/backend/volumetric_analyzer.py
mri-platform/backend/pdf_generation/
mri-platform/frontend/src/app/radiologist/upload/page.tsx
```

Key behavior:

- Input is MRI/NIfTI scan, usually `.nii`, `.nii.gz`, or `.gz`.
- Optional CAT12 preprocessing through MATLAB Runtime.
- Extracts axial, sagittal, and coronal slices for viewer/reporting.
- Runs ConViT model across slices and uses majority voting.
- Existing backend uses `threading.Thread`.

---

## 3. Target Architecture

### 3.1 High-Level Architecture

```text
                            Next.js Frontend
                                  |
                                  | HTTPS
                                  v
                            FastAPI Backend
                                  |
             +--------------------+--------------------+
             |                                         |
       Supabase DB                              Supabase Storage
             |                                         |
             +--------------------+--------------------+
                                  |
                                  v
                         Background Job Service
                                  |
               +------------------+------------------+
               |                                     |
        EEG Pipeline                          MRI Pipeline
        ADFormer/SIDDHI                       CAT12/NIfTI/ConViT
```

### 3.2 Backend Responsibility Split

```text
FastAPI API layer
  - Auth-aware endpoints
  - Upload validation
  - Analysis session creation
  - Status/result APIs
  - Report APIs
  - Admin/user APIs

Services layer
  - Supabase database service
  - Supabase storage service
  - Job service
  - Report service
  - Notification hooks, later if needed

Pipeline layer
  - EEG runner
  - MRI runner
  - Similarity analyzers
  - Visualization generators
  - Model inference wrappers

Model/vendor layer
  - SIDDHI
  - ADFormer checkpoints
  - CAT12/MATLAB Runtime
  - ConViT checkpoint
```

### 3.3 Recommended Repository Layout

Create a new merged product directory rather than mutating both old repos directly:

```text
unified-neuro-platform/
  backend/
    app/
      main.py
      api/
        __init__.py
        analysis.py
        auth.py
        users.py
        reports.py
        health.py
      core/
        config.py
        logging.py
        security.py
      schemas/
        analysis.py
        users.py
        reports.py
      services/
        database.py
        storage.py
        jobs.py
        reports.py
        permissions.py
      pipelines/
        eeg/
          runner.py
          ml_runner.py
          similarity_analyzer.py
          visualization.py
          siddhi/
          representative/
        mri/
          runner.py
          ml_runner.py
          cat12_manager.py
          volumetric_analyzer.py
          ml/
            nifti_slicer.py
            predictor.py
      reports/
        base_report.py
        patient_report.py
        clinician_report.py
        technical_report.py
        sections/
          eeg_sections.py
          mri_sections.py
      workers/
        local_executor.py
      tmp/
    requirements/
      api.txt
      eeg.txt
      mri.txt
      dev.txt
    Dockerfile.api
    Dockerfile.worker-eeg
    Dockerfile.worker-mri
    docker-compose.yml
    .env.example

  frontend/
    src/
      app/
      components/
      lib/
      features/
        analysis/
        patients/
        reports/
        viewer/
    package.json
    .env.example

  supabase/
    migrations/
    seed.sql

  docs/
    architecture.md
    deployment.md
```

For a faster first merge, you can keep the existing root and create:

```text
merged-platform/backend
merged-platform/frontend
```

Then gradually copy code from `Alzheimer-Detection` and `mri-platform`.

---

## 4. Backend Architecture Plan

### 4.1 Framework Choice

Use FastAPI for the new unified backend.

Reasons:

- Strong request and response validation with Pydantic.
- Automatic OpenAPI docs for frontend integration.
- Cleaner API contracts for a new unified frontend.
- Good upload handling.
- Easy to keep ML code as plain Python modules.

Important: the pipeline code must not depend on FastAPI. It should expose plain functions/classes.

Good:

```python
result = run_eeg_pipeline(input_path, analysis_type, context)
```

Avoid:

```python
from fastapi import Request
```

inside pipeline modules.

### 4.2 MVP Background Execution

For the first deployable product, Celery is not mandatory.

Use `ThreadPoolExecutor` behind a job service:

```text
API endpoint
  -> create analysis_sessions row
  -> upload raw file to Supabase Storage
  -> enqueue job through JobService
  -> return session_id
```

The first `JobService` implementation can be local:

```python
from concurrent.futures import ThreadPoolExecutor

executor = ThreadPoolExecutor(max_workers=2)

def enqueue_analysis(session_id: str):
    executor.submit(run_analysis_job, session_id)
```

Set conservative limits:

```text
max_workers=2 for development
max_workers=1 for MRI-heavy production MVP
```

The code must be written so it can later swap to Celery, RQ, Dramatiq, or a cloud queue without changing API routes.

### 4.3 Production Background Upgrade Path

When real usage starts, move to:

```text
FastAPI API container
Redis or cloud queue
EEG worker container
MRI worker container
Supabase
```

This is the durable architecture:

```text
Frontend
  -> FastAPI API
  -> Queue
  -> EEG worker or MRI worker
  -> Supabase status/results
```

The MVP should keep this boundary:

```python
job_service.enqueue_analysis(session_id)
```

So only `job_service` changes later.

---

## 5. Unified API Contract

### 5.1 Main Endpoints

Use one analysis endpoint for both modalities.

```text
POST /api/v1/analysis
GET  /api/v1/analysis/{session_id}
GET  /api/v1/analysis/{session_id}/result
GET  /api/v1/analysis/{session_id}/reports
POST /api/v1/analysis/{session_id}/retry
```

Other endpoints:

```text
GET  /api/v1/health
GET  /api/v1/health/storage
GET  /api/v1/health/database

GET  /api/v1/users/me
GET  /api/v1/patients
POST /api/v1/patients
GET  /api/v1/patients/{patient_id}/sessions
```

### 5.2 Upload Request

Use `multipart/form-data`.

Fields:

```text
file
modality              eeg | mri
analysis_type         binary | multiclass | multi-disease
patient_id
doctor_id
hospital_id
radiologist_id        optional
technician_id         optional
uploaded_by_role
channel_index         optional, EEG only
scan_metadata_json    optional, MRI only
```

Response:

```json
{
  "session_id": "uuid",
  "status": "queued",
  "modality": "eeg",
  "analysis_type": "multiclass"
}
```

### 5.3 Session Status Response

```json
{
  "id": "uuid",
  "modality": "mri",
  "analysis_type": "multi-disease",
  "status": "processing",
  "current_stage": "extracting_slices",
  "progress_percent": 45,
  "error_message": null,
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

Recommended statuses:

```text
queued
uploading
processing
preprocessing
running_model
generating_visualizations
generating_reports
completed
failed
cancelled
```

Recommended stages:

```text
saved_upload
cat12_preprocessing
slice_extraction
model_inference
similarity_analysis
visualization_generation
report_generation
database_update
cleanup
```

### 5.4 Unified Result Response

Both EEG and MRI must return the same outer shape:

```json
{
  "session_id": "uuid",
  "modality": "eeg",
  "prediction": "AD",
  "confidence": 0.87,
  "probabilities": {
    "CN": 0.05,
    "MCI": 0.08,
    "AD": 0.87
  },
  "metrics": {},
  "similarity": {},
  "consistency": {},
  "visualizations": {},
  "model_version": "ADFormer-ADFD-Indep",
  "report_urls": {
    "patient": "https://...",
    "clinician": "https://...",
    "technical": "https://..."
  }
}
```

EEG-specific data goes into:

```text
metrics.eeg_stats
similarity.dtw_scores
consistency.trial_predictions
visualizations.timeseries_plot_url
visualizations.psd_plot_url
```

MRI-specific data goes into:

```text
metrics.brain_volume
metrics.gm_volume
metrics.wm_volume
metrics.csf_volume
consistency.slice_predictions
visualizations.volume_chart_url
visualizations.confidence_chart_url
visualizations.viewer_slice_urls
```

---

## 6. Pipeline Interface

### 6.1 Shared Pipeline Input

Create a shared context object:

```python
class AnalysisContext(BaseModel):
    session_id: str
    modality: Literal["eeg", "mri"]
    analysis_type: str
    local_input_path: str
    original_filename: str
    patient_id: str
    doctor_id: str
    hospital_id: str
    radiologist_id: str | None = None
    technician_id: str | None = None
    uploaded_by_role: str | None = None
    options: dict = {}
```

### 6.2 Shared Pipeline Output

```python
class PipelineResult(BaseModel):
    prediction: str
    confidence: float
    probabilities: dict[str, float]
    metrics: dict = {}
    similarity: dict = {}
    consistency: dict = {}
    visualizations: dict = {}
    model_version: str
    artifacts: dict = {}
```

Every pipeline must return this.

### 6.3 EEG Runner

Target runner:

```python
def run_eeg_pipeline(context: AnalysisContext) -> PipelineResult:
    # save/read local .npy
    # run SIDDHI ADFormer
    # parse output.json
    # run similarity
    # generate EEG plots
    # return normalized result
```

Move/adapt from:

```text
Alzheimer-Detection/backend/ml_runner.py
Alzheimer-Detection/backend/routes/predict_api.py
Alzheimer-Detection/backend/similarity_analyzer.py
Alzheimer-Detection/backend/visualization.py
```

### 6.4 MRI Runner

Target runner:

```python
def run_mri_pipeline(context: AnalysisContext) -> PipelineResult:
    # optionally run CAT12
    # extract report slices
    # extract viewer slices
    # run ConViT predictor
    # compute volume metrics
    # run similarity/mock similarity
    # generate charts
    # return normalized result
```

Move/adapt from:

```text
mri-platform/backend/ml_runner.py
mri-platform/backend/cat12_manager.py
mri-platform/backend/ml/nifti_slicer.py
mri-platform/backend/ml/predictor.py
mri-platform/backend/volumetric_analyzer.py
mri-platform/backend/similarity_analyzer.py
```

---

## 7. Supabase Architecture

Supabase should be the system of record.

Use it for:

- Auth users.
- User profiles and role profiles.
- Patient, doctor, radiologist relationships.
- Analysis sessions.
- Analysis results.
- Report URLs.
- Storage for raw files, plots, slices, and PDFs.

### 7.1 Tables

#### user_profiles

```sql
create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null check (role in ('admin', 'doctor', 'radiologist', 'technician', 'patient')),
  hospital_id uuid,
  status text not null default 'active' check (status in ('pending', 'active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

#### patient_profiles

```sql
create table if not exists public.patient_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.user_profiles(id),
  hospital_id uuid,
  patient_code text unique,
  date_of_birth date,
  gender text,
  phone text,
  medical_history text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

#### clinical_relationships

```sql
create table if not exists public.clinical_relationships (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patient_profiles(id) on delete cascade,
  doctor_id uuid references public.user_profiles(id),
  radiologist_id uuid references public.user_profiles(id),
  hospital_id uuid,
  status text not null default 'active',
  created_at timestamptz not null default now()
);
```

#### analysis_sessions

```sql
create table if not exists public.analysis_sessions (
  id uuid primary key default gen_random_uuid(),
  modality text not null check (modality in ('eeg', 'mri')),
  analysis_type text not null,
  patient_id uuid not null references public.patient_profiles(id),
  doctor_id uuid references public.user_profiles(id),
  radiologist_id uuid references public.user_profiles(id),
  technician_id uuid references public.user_profiles(id),
  hospital_id uuid,
  uploaded_by uuid references public.user_profiles(id),
  uploaded_by_role text,
  original_filename text not null,
  raw_file_path text,
  raw_file_bucket text,
  status text not null default 'queued',
  current_stage text,
  progress_percent integer not null default 0 check (progress_percent >= 0 and progress_percent <= 100),
  error_message text,
  retry_count integer not null default 0,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

#### analysis_results

```sql
create table if not exists public.analysis_results (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.analysis_sessions(id) on delete cascade,
  prediction text not null,
  confidence numeric,
  probabilities jsonb not null default '{}'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  similarity jsonb not null default '{}'::jsonb,
  consistency jsonb not null default '{}'::jsonb,
  visualizations jsonb not null default '{}'::jsonb,
  model_version text,
  created_at timestamptz not null default now()
);
```

#### analysis_reports

```sql
create table if not exists public.analysis_reports (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.analysis_sessions(id) on delete cascade,
  patient_pdf_url text,
  clinician_pdf_url text,
  technical_pdf_url text,
  asset_urls jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now()
);
```

#### job_events

Useful for debugging and frontend timelines:

```sql
create table if not exists public.job_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.analysis_sessions(id) on delete cascade,
  level text not null default 'info',
  stage text,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
```

### 7.2 Storage Buckets

Recommended buckets:

```text
raw-files
report-assets
reports
viewer-slices
```

Recommended paths:

```text
raw-files/
  eeg/{session_id}/input.npy
  mri/{session_id}/input.nii.gz

report-assets/
  {session_id}/timeseries.png
  {session_id}/psd.png
  {session_id}/similarity.png
  {session_id}/volume_chart.png
  {session_id}/confidence_chart.png

viewer-slices/
  {session_id}/axial/slice_001.png
  {session_id}/sagittal/slice_001.png
  {session_id}/coronal/slice_001.png

reports/
  {session_id}/patient.pdf
  {session_id}/clinician.pdf
  {session_id}/technical.pdf
```

### 7.3 Row-Level Security Guidance

Use Supabase RLS for frontend reads.

The backend should use the service role key and enforce its own permission checks too.

Suggested access:

```text
admin:
  can read/manage all users and sessions in hospital/system

doctor:
  can read assigned patients and their analysis sessions

radiologist:
  can create MRI sessions and read assigned sessions

technician:
  can create EEG sessions and read sessions they uploaded

patient:
  can read their own completed reports/results
```

MVP shortcut:

- Backend service role performs writes.
- Frontend reads via API instead of reading sensitive tables directly.
- Add RLS policies before production release.

---

## 8. Frontend Integration Plan

Use the MRI Next.js app-router frontend as the base because it is newer and already includes:

- Next.js app router.
- TypeScript.
- Supabase client/server helpers.
- MRI viewer components.
- Shared UI components.

Move needed EEG screens/features from `Alzheimer-Detection/frontend` into the new frontend as feature modules.

### 8.1 Frontend Target Structure

```text
frontend/src/
  app/
    page.tsx
    login/page.tsx
    dashboard/page.tsx
    analysis/new/page.tsx
    analysis/[id]/page.tsx
    patients/[id]/page.tsx
    reports/[id]/page.tsx
    admin/dashboard/page.tsx
    doctor/dashboard/page.tsx
    radiologist/dashboard/page.tsx
    technician/dashboard/page.tsx
    patient/dashboard/page.tsx

  features/
    analysis/
      components/AnalysisUploadForm.tsx
      components/AnalysisStatusPanel.tsx
      components/AnalysisResultPanel.tsx
      api.ts
      types.ts
    eeg/
      components/EEGUploadOptions.tsx
      components/EEGPlots.tsx
    mri/
      components/MRIUploadOptions.tsx
      components/MRIViewer.tsx
    reports/
      components/ReportViewer.tsx
    patients/
      components/PatientSelector.tsx

  lib/
    api/client.ts
    supabase/client.ts
    supabase/server.ts
    auth.ts
    routes.ts
```

### 8.2 Unified Upload UX

Create one upload page:

```text
/analysis/new
```

Fields:

```text
Modality selector:
  EEG
  MRI

Patient selector
Doctor selector
Hospital context
File input

EEG options:
  binary / multiclass
  channel index for similarity plot

MRI options:
  multi-disease
  scan metadata
```

Submit to:

```text
POST {NEXT_PUBLIC_API_BASE_URL}/api/v1/analysis
```

Then redirect:

```text
/analysis/{session_id}
```

### 8.3 Polling

On the detail page:

```text
GET /api/v1/analysis/{session_id}
```

Poll every 3-5 seconds while status is:

```text
queued
processing
preprocessing
running_model
generating_visualizations
generating_reports
```

Stop polling when:

```text
completed
failed
cancelled
```

### 8.4 Result Rendering

Use the same result screen with modality-specific sections.

Shared:

```text
Prediction
Confidence
Probability chart
Report downloads
Session metadata
```

EEG-specific:

```text
Timeseries plot
PSD plot
Similarity plot
Trial predictions
Consistency metrics
```

MRI-specific:

```text
MRI viewer slices
Volume chart
Confidence chart
Slice predictions
Brain volume metrics
```

### 8.5 Frontend Environment

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

For production:

```env
NEXT_PUBLIC_API_BASE_URL=https://api.yourdomain.com
```

---

## 9. Backend Implementation Steps

### Phase 1: Create the New Backend Skeleton

1. Create `merged-platform/backend`.
2. Add FastAPI app with `/api/v1/health`.
3. Add Pydantic settings from `.env`.
4. Add Supabase client service.
5. Add storage service.
6. Add database service.
7. Add local job service using `ThreadPoolExecutor`.

Minimum files:

```text
backend/app/main.py
backend/app/core/config.py
backend/app/services/database.py
backend/app/services/storage.py
backend/app/services/jobs.py
backend/app/api/health.py
backend/app/api/analysis.py
```

Validation:

```bash
uvicorn app.main:app --reload --port 8000
```

Expected:

```text
GET /api/v1/health returns ok
```

### Phase 2: Add Unified Supabase Tables and Storage

1. Create Supabase migrations.
2. Add tables listed in Section 7.
3. Create buckets.
4. Add indexes:

```sql
create index if not exists idx_analysis_sessions_patient_id on public.analysis_sessions(patient_id);
create index if not exists idx_analysis_sessions_status on public.analysis_sessions(status);
create index if not exists idx_analysis_sessions_modality on public.analysis_sessions(modality);
create index if not exists idx_analysis_results_session_id on public.analysis_results(session_id);
create index if not exists idx_analysis_reports_session_id on public.analysis_reports(session_id);
```

5. Test backend can insert a fake session.

### Phase 3: Implement Upload and Session Creation

Implement:

```text
POST /api/v1/analysis
```

Steps:

```text
validate modality and file type
create analysis_sessions row with queued status
save file temporarily
upload raw file to Supabase Storage
update raw_file_path
enqueue job
return session_id
```

File validation:

```text
EEG:
  .npy

MRI:
  .nii
  .nii.gz
  .gz
  optional .dcm later if DICOM support is finalized
```

### Phase 4: Move EEG Pipeline

Copy and adapt:

```text
Alzheimer-Detection/backend/ml_runner.py
Alzheimer-Detection/backend/SIDDHI/
Alzheimer-Detection/backend/similarity_analyzer.py
Alzheimer-Detection/backend/visualization.py
Alzheimer-Detection/backend/representative/
```

Target:

```text
backend/app/pipelines/eeg/
```

Create:

```text
backend/app/pipelines/eeg/runner.py
```

Make it return `PipelineResult`.

Do not generate reports inside this runner yet. Return raw plot bytes/base64/artifact paths to the job service.

### Phase 5: Move MRI Pipeline

Copy and adapt:

```text
mri-platform/backend/ml_runner.py
mri-platform/backend/cat12_manager.py
mri-platform/backend/ml/
mri-platform/backend/volumetric_analyzer.py
mri-platform/backend/similarity_analyzer.py
```

Target:

```text
backend/app/pipelines/mri/
```

Create:

```text
backend/app/pipelines/mri/runner.py
```

Make it return `PipelineResult`.

For MVP, support mock mode:

```env
USE_MOCK_MODEL=true
USE_CAT12_PREPROCESSING=false
```

Production MRI should later use:

```env
USE_MOCK_MODEL=false
USE_CAT12_PREPROCESSING=true
```

### Phase 6: Build the Job Orchestrator

Create one internal function:

```python
def run_analysis_job(session_id: str) -> None:
    session = database.get_session(session_id)
    database.update_session_stage(session_id, "processing", "saved_upload", 10)
    local_file = storage.download_raw_file(session)

    if session.modality == "eeg":
        result = run_eeg_pipeline(context)
    elif session.modality == "mri":
        result = run_mri_pipeline(context)

    uploaded_assets = storage.upload_result_artifacts(session_id, result)
    reports = report_service.generate_reports(session, result, uploaded_assets)
    database.insert_result(session_id, result, uploaded_assets)
    database.insert_reports(session_id, reports)
    database.mark_completed(session_id)
```

Every exception must:

```text
log job_event
set analysis_sessions.status = failed
set error_message
cleanup temp files
```

### Phase 7: Merge Report Generation

Create shared report entry points:

```python
generate_patient_report(session, result)
generate_clinician_report(session, result)
generate_technical_report(session, result)
```

Internally:

```python
if session.modality == "eeg":
    add_eeg_sections(...)
else:
    add_mri_sections(...)
```

Reuse existing PDF builders where possible.

### Phase 8: Add Result and Report APIs

Implement:

```text
GET /api/v1/analysis/{session_id}
GET /api/v1/analysis/{session_id}/result
GET /api/v1/analysis/{session_id}/reports
```

These should read from Supabase, not local files.

### Phase 9: Add Auth and Permission Checks

MVP:

- Verify Supabase JWT from frontend.
- Read user role from `user_profiles`.
- Enforce basic permission checks in backend service layer.

Production:

- Add RLS policies.
- Keep service role key only in backend.
- Never expose service role key to frontend.

---

## 10. Frontend Implementation Steps

### Phase 1: Select Base Frontend

Use:

```text
mri-platform/frontend
```

as the base because it already has:

- Next.js app router.
- TypeScript.
- Supabase SSR helpers.
- MRI viewer components.
- Shadcn/Radix-style UI components.

### Phase 2: Add API Client

Create:

```text
frontend/src/lib/api/client.ts
```

Responsibilities:

```text
attach Supabase access token
send multipart analysis uploads
fetch session status
fetch results/reports
normalize errors
```

### Phase 3: Create Unified Upload Page

Create:

```text
frontend/src/app/analysis/new/page.tsx
```

Use:

```text
modality selector
patient selector
role-aware metadata
file input
modality-specific options
submit button
```

### Phase 4: Create Session Detail Page

Create:

```text
frontend/src/app/analysis/[id]/page.tsx
```

Responsibilities:

```text
poll status
show progress
render result when completed
show failed state with retry action
```

### Phase 5: Merge Dashboards

Keep role dashboards, but make their data source unified:

```text
admin dashboard:
  all sessions/users

doctor dashboard:
  assigned patients and sessions

radiologist dashboard:
  MRI upload and review sessions

technician dashboard:
  EEG upload and review sessions

patient dashboard:
  own reports/results
```

All dashboards should query:

```text
/api/v1/analysis
```

with filters instead of using separate EEG/MRI APIs.

### Phase 6: Add Report Viewer

Use one report viewer component:

```text
frontend/src/features/reports/components/ReportViewer.tsx
```

It should accept:

```ts
type ReportUrls = {
  patient?: string
  clinician?: string
  technical?: string
}
```

### Phase 7: Add MRI Viewer

Keep the existing MRI viewer from:

```text
mri-platform/frontend/src/components/viewers/
```

Wire it to:

```text
result.visualizations.viewer_slice_urls
```

### Phase 8: Add EEG Plot Display

Move/adapt EEG plot components from the old frontend.

Show:

```text
timeseries plot
PSD plot
similarity plot
trial prediction table
```

---

## 11. Deployment Plan

### 11.1 MVP Deployment Without Celery

Deployable MVP:

```text
Vercel or Node host:
  Next.js frontend

Container host:
  FastAPI backend with ThreadPoolExecutor

Supabase:
  Auth, Postgres, Storage
```

Architecture:

```text
Frontend
  -> FastAPI backend
  -> local background executor
  -> EEG/MRI pipelines
  -> Supabase
```

Good for:

- Demo.
- Internal testing.
- Low concurrent usage.
- Fast first deployment.

Important limitations:

- Jobs can be lost if backend restarts.
- Long MRI jobs occupy backend process resources.
- Scaling API horizontally can complicate job ownership.

Use this only if those risks are acceptable.

### 11.2 Production Deployment With Separate Workers

Recommended production architecture:

```text
Frontend
  -> FastAPI API container
  -> Queue
  -> EEG worker container
  -> MRI worker container
  -> Supabase
```

This can be implemented later without changing frontend APIs.

Services:

```text
frontend
backend-api
worker-eeg
worker-mri
redis or cloud queue
supabase
```

The API image should stay small.

The EEG worker image should include:

```text
SIDDHI
ADFormer checkpoints
PyTorch
scipy/dtaidistance/einops/reformer-pytorch
```

The MRI worker image should include:

```text
CAT12
MATLAB Runtime
PyTorch
timm
nibabel
ConViT checkpoint
```

### 11.3 Recommended Hosting Options

#### MVP

```text
Frontend:
  Vercel

Backend:
  Render, Railway, Fly.io, or a Docker VM

Supabase:
  Managed Supabase project
```

#### MRI Production

For real CAT12/MATLAB Runtime, prefer a VM or container host where you control OS packages:

```text
AWS EC2
GCP Compute Engine
Azure VM
DigitalOcean Droplet
```

Reason:

- CAT12 and MATLAB Runtime paths are sensitive.
- MRI jobs are long-running.
- Memory/CPU requirements can be high.

### 11.4 Docker Strategy

Use separate Dockerfiles:

```text
backend/Dockerfile.api
backend/Dockerfile.worker-eeg
backend/Dockerfile.worker-mri
```

MVP can start with one:

```text
backend/Dockerfile
```

But do not install MATLAB Runtime in the API image unless absolutely necessary.

### 11.5 Environment Variables

Backend shared:

```env
APP_ENV=production
API_HOST=0.0.0.0
API_PORT=8000
CORS_ORIGINS=https://your-frontend-domain.com

SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=

RAW_FILES_BUCKET=raw-files
REPORT_ASSETS_BUCKET=report-assets
REPORTS_BUCKET=reports
VIEWER_SLICES_BUCKET=viewer-slices

LOCAL_TMP_DIR=/tmp/neuro-platform
MAX_UPLOAD_MB=512
JOB_BACKEND=local
LOCAL_JOB_MAX_WORKERS=1
```

EEG:

```env
SIDDHI_FOLDER=/app/app/pipelines/eeg/siddhi
EEG_MODEL_ROOT=/app/models/eeg
EEG_USE_GPU=false
```

MRI:

```env
USE_MOCK_MODEL=false
USE_CAT12_PREPROCESSING=true
CONVIT_CHECKPOINT_PATH=/app/models/mri/ConViT_model.pth
CAT12_ROOT=
MCR_ROOT=
CAT12_EXE=
MRI_USE_GPU=false
```

Frontend:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_BASE_URL=https://api.yourdomain.com
```

### 11.6 Deployment Checklist

Backend:

```text
FastAPI starts successfully
/api/v1/health returns ok
Supabase connection works
Storage buckets exist
Upload endpoint accepts EEG file
Upload endpoint accepts MRI file
Background job updates status
Reports upload to storage
Errors mark sessions as failed
Temp files are cleaned
```

Frontend:

```text
Build passes
Login works
Role redirect works
Upload page submits to backend
Status polling works
Completed result renders
Report links open
MRI viewer renders uploaded slices
EEG plots render from result URLs
```

Supabase:

```text
Tables migrated
Buckets created
Indexes created
RLS reviewed
Service role key only used in backend
Anon key only used in frontend
```

---

## 12. Suggested Implementation Timeline

### Week 1: Backend Foundation

```text
Create FastAPI skeleton
Add Supabase services
Add unified schema/migrations
Implement upload/session/status APIs
Add local job executor
```

Deliverable:

```text
Can create fake analysis session and watch status change.
```

### Week 2: EEG Pipeline Migration

```text
Move SIDDHI and EEG runner
Normalize EEG output
Upload EEG plots/assets
Generate EEG reports
```

Deliverable:

```text
EEG upload works end to end.
```

### Week 3: MRI Pipeline Migration

```text
Move MRI runner
Support mock MRI first
Add real NIfTI slicing
Add ConViT integration
Add CAT12 config path
Generate MRI reports
```

Deliverable:

```text
MRI upload works end to end in mock mode, then real mode.
```

### Week 4: Frontend Merge

```text
Use MRI frontend as base
Add unified upload page
Add analysis detail page
Add role dashboards
Add EEG plots and MRI viewer sections
```

Deliverable:

```text
One frontend can run both EEG and MRI analyses.
```

### Week 5: Deployment Hardening

```text
Dockerize backend
Configure production env vars
Deploy frontend
Deploy backend
Connect Supabase production
Add logs and health checks
Run full end-to-end tests
```

Deliverable:

```text
Deployable full product.
```

### Week 6: Production Upgrade

Optional but recommended before serious usage:

```text
Move from local executor to queue/workers
Split EEG and MRI worker images
Add monitoring
Add retry logic
Add RLS policies
Add audit events
```

---

## 13. Testing Plan

### Backend Tests

Minimum:

```text
health endpoint
upload validation
session creation
status update helper
storage upload helper
pipeline result normalization
failed job status handling
```

### Pipeline Tests

EEG:

```text
sample .npy file loads
binary analysis returns normalized result
multiclass analysis returns normalized result
plots are generated
reports are generated
```

MRI:

```text
sample NIfTI loads
slice extraction returns images
mock model returns normalized result
real model fallback works if checkpoint missing
reports are generated
```

### Frontend Tests

Manual MVP checklist:

```text
login
role dashboard
new analysis page
EEG upload
MRI upload
status polling
completed report viewing
failed job display
```

---

## 14. Security, Auth, State Management, and Supabase Execution Plan

The merged platform handles medical data, user identity, reports, and AI-derived clinical outputs. Treat security as a product feature, not a final checklist. The target standard should be comparable to a serious health-tech startup: least privilege, auditable access, clear session boundaries, safe uploads, and predictable UI state.

### 14.1 Security Principles

Use these principles across backend, frontend, and Supabase:

```text
Authenticate every user.
Authorize every data access.
Never trust frontend role claims.
Never expose Supabase service role key to the browser.
Store sensitive files in private buckets by default.
Use short-lived signed URLs for private files.
Record audit events for sensitive actions.
Fail closed when permissions are unclear.
Keep raw medical uploads and generated reports scoped by session/user/hospital.
```

### 14.2 Supabase Auth Strategy

Use Supabase Auth as the identity provider.

Frontend:

```text
Uses anon key only.
Uses Supabase client for login/logout/session refresh.
Passes access token to backend API in Authorization header.
```

Backend:

```text
Validates Supabase JWT on every protected request.
Loads user profile from user_profiles.
Checks role and relationship permissions before returning data.
Uses service role key only on the server for trusted DB/storage writes.
```

Required request header:

```http
Authorization: Bearer <supabase_access_token>
```

Backend validation flow:

```text
decode/verify JWT
extract auth user id
load user_profiles row
ensure status = active
evaluate route permission
execute action
write audit event if sensitive
```

Important rule:

```text
Frontend role information is only for UI rendering.
Backend role checks are the source of truth.
```

### 14.3 Role and Permission Model

Recommended roles:

```text
admin
doctor
radiologist
technician
patient
```

Baseline permissions:

```text
admin:
  manage users, hospitals, relationships, and all sessions in permitted scope

doctor:
  view assigned patients, create/review clinical notes, view reports for assigned patients

radiologist:
  upload MRI scans, view MRI sessions they created or are assigned to

technician:
  upload EEG files, view EEG sessions they created or are assigned to

patient:
  view own completed reports and approved clinical summaries
```

Permission checks should be implemented in backend service functions:

```text
can_create_analysis(user, modality, patient_id)
can_read_session(user, session_id)
can_read_report(user, session_id, report_type)
can_manage_user(user, target_user_id)
can_assign_relationship(user, patient_id, doctor_id)
```

Avoid scattering permission logic directly inside route handlers.

### 14.4 Row-Level Security Plan

Enable RLS on all user-facing tables before production:

```sql
alter table public.user_profiles enable row level security;
alter table public.patient_profiles enable row level security;
alter table public.clinical_relationships enable row level security;
alter table public.analysis_sessions enable row level security;
alter table public.analysis_results enable row level security;
alter table public.analysis_reports enable row level security;
alter table public.job_events enable row level security;
alter table public.audit_events enable row level security;
```

MVP path:

```text
Frontend talks to backend API for sensitive data.
Backend uses service role key.
RLS policies are still created and tested before production.
```

Production path:

```text
Frontend may read limited low-risk views directly.
Sensitive tables/files remain API-mediated.
RLS policies protect every table even if API has a bug.
```

Recommended helper function:

```sql
create or replace function public.current_user_role()
returns text
language sql
security definer
stable
as $$
  select role
  from public.user_profiles
  where id = auth.uid()
$$;
```

Recommended hospital scope helper:

```sql
create or replace function public.current_user_hospital_id()
returns uuid
language sql
security definer
stable
as $$
  select hospital_id
  from public.user_profiles
  where id = auth.uid()
$$;
```

Example session read policy shape:

```sql
create policy "Users can read permitted analysis sessions"
on public.analysis_sessions
for select
using (
  uploaded_by = auth.uid()
  or patient_id in (
    select id from public.patient_profiles where user_id = auth.uid()
  )
  or doctor_id = auth.uid()
  or radiologist_id = auth.uid()
  or technician_id = auth.uid()
  or public.current_user_role() = 'admin'
);
```

This policy should be tightened around hospital boundaries if multiple hospitals share one Supabase project.

### 14.5 Private Storage and Signed URL Policy

Use private buckets for medical data:

```text
raw-files        private
reports          private
viewer-slices    private or restricted
report-assets    private unless assets are non-sensitive
```

The backend should generate signed URLs:

```text
GET /api/v1/analysis/{session_id}/reports
  -> backend checks permission
  -> creates short-lived signed URLs
  -> returns URLs to frontend
```

Suggested expiry:

```text
reports: 5-15 minutes
viewer slices: 15-60 minutes
temporary chart assets: 15-60 minutes
```

Never store permanent public URLs for sensitive reports unless the bucket is intentionally public and the data is not sensitive.

### 14.6 Audit Logging

Add an `audit_events` table.

```sql
create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.user_profiles(id),
  actor_role text,
  action text not null,
  resource_type text not null,
  resource_id uuid,
  patient_id uuid,
  hospital_id uuid,
  ip_address text,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
```

Log at minimum:

```text
login success/failure if available from auth hooks
analysis created
analysis viewed
report viewed/downloaded
user created/updated/suspended
doctor-patient relationship changed
failed permission check
storage signed URL generated
```

Audit logs should be append-only for normal application code.

### 14.7 Backend API Security

Add these protections:

```text
CORS allowlist, no wildcard in production
request size limits
file type allowlist
file extension and MIME checks
safe temporary file names
per-user upload rate limits
per-hospital job concurrency limits
structured error responses without stack traces
server-side logging with request ids
```

Upload security:

```text
accept only expected extensions
store uploads outside source directories
generate server-side filenames
scan or validate file structure before processing
delete temp files after job completion/failure
do not execute user-provided paths
```

Recommended API error shape:

```json
{
  "error": {
    "code": "permission_denied",
    "message": "You do not have access to this analysis session.",
    "request_id": "..."
  }
}
```

Do not send Python tracebacks to the frontend.

### 14.8 Frontend Auth and Session State

Use a single auth provider around the app.

Responsibilities:

```text
load Supabase session
refresh session automatically
fetch /api/v1/users/me
store canonical backend profile
redirect unauthenticated users
handle suspended/pending accounts
clear state on logout
```

Recommended client state split:

```text
Supabase session:
  Supabase client/auth helpers

Server state:
  TanStack Query or SWR
  analysis sessions, patients, reports, dashboards

Local UI state:
  Zustand or React state
  sidebar state, upload wizard state, selected filters

Form state:
  React Hook Form + schema validation
```

If the project avoids additional libraries initially, use:

```text
React Context for auth/profile
small custom hooks for polling
local component state for forms
```

But for production-grade UI reliability, prefer a proper server-state library such as TanStack Query.

### 14.9 Frontend Data Fetching Rules

Use backend API for sensitive application data:

```text
analysis sessions
analysis results
reports
patient lists
doctor assignments
admin user management
```

Frontend Supabase direct access is acceptable for:

```text
auth session management
low-risk profile reads if RLS is complete
non-sensitive lookup tables
```

Every frontend API request should:

```text
include Supabase access token
handle 401 by refreshing session or redirecting to login
handle 403 with a proper no-access state
handle 404 without leaking resource existence across roles
handle failed polling gracefully
```

### 14.10 UI State Management for Analysis Jobs

Represent analysis jobs as a small state machine in the frontend.

```text
idle
uploading
queued
processing
completed
failed
cancelled
```

Polling behavior:

```text
poll every 3-5 seconds during queued/processing states
pause polling when tab is hidden if desired
resume when tab becomes visible
stop polling on completed/failed/cancelled
show last updated time
show retry action only when backend allows it
```

Use optimistic UI only for safe states:

```text
OK:
  showing upload progress
  showing queued after API accepts upload

Avoid:
  pretending analysis completed before backend confirms
  showing report links before signed URLs are issued
```

### 14.11 Supabase Unified Schema Execution Plan

Execute schema migration in phases.

Phase A: Foundation tables

```text
hospitals
user_profiles
patient_profiles
clinical_relationships
lookup tables
```

Phase B: Analysis core

```text
analysis_sessions
analysis_results
analysis_reports
job_events
audit_events
```

Phase C: Storage

```text
create raw-files bucket
create reports bucket
create report-assets bucket
create viewer-slices bucket
make sensitive buckets private
```

Phase D: RLS

```text
enable RLS
add helper functions
add table policies
test every role
```

Phase E: Backfill/adapters

```text
map old EEG predictions into analysis_sessions/results
map old MRI mri_sessions/mri_predictions into analysis_sessions/results
preserve old ids in legacy_metadata jsonb if needed
```

Recommended migration safety:

```text
write migrations as idempotent SQL where possible
test on staging Supabase first
use separate staging and production Supabase projects
never test destructive migrations directly on production
export production schema before major migrations
```

### 14.12 Security Release Checklist

Before production:

```text
No service role key in frontend env
No public sensitive buckets
RLS enabled on sensitive tables
Backend validates Supabase JWT
Backend enforces role permissions
CORS restricted to production domains
Upload limits configured
Signed URLs used for reports
Audit events written for sensitive actions
Errors do not leak stack traces
Logs do not include raw tokens or medical files
Dependency vulnerabilities reviewed
Production env vars separated from staging
Admin routes protected and tested
Suspended users blocked everywhere
```

---

## 15. Key Technical Decisions

### Decision 1: FastAPI for Unified Backend

Use FastAPI for the new API layer. Keep ML logic as plain Python modules.

### Decision 2: No Celery for MVP

Use `ThreadPoolExecutor` first. Keep a `JobService` boundary so queue migration is easy.

### Decision 3: Supabase as System of Record

All user-visible status, results, reports, and file URLs should live in Supabase.

### Decision 4: MRI Frontend as Base

Use the newer MRI Next.js frontend as the base and move EEG functionality into it.

### Decision 5: Unified Data Shape

Both EEG and MRI pipelines must return the same outer result structure.

### Decision 6: Separate Worker Images Later

Production should eventually split API, EEG worker, and MRI worker due to dependency differences.

---

## 16. Final Target State

The final deployable product should look like this:

```text
User-facing:
  One web app
  One login
  One dashboard system
  One upload flow
  One report/result experience

Backend:
  One FastAPI API
  One unified analysis API
  EEG and MRI pipelines isolated internally
  Supabase-backed status/results/reports

Deployment:
  Frontend deployed independently
  Backend deployed as container
  Supabase managed
  Optional future queue/workers for production scale
```

The end result should not feel like two products joined together. It should feel like one clinical neuro-analysis platform with multiple supported scan modalities.
