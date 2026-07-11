# End-to-End Testing Readiness

Last checked locally: 2026-07-11.

This runbook records what is currently verified for the unified `platform/` app and what is still required for a real Supabase-backed browser E2E test.

---

## 1. Current Verification Status

### Backend

Verified locally with Python 3.12:

```bash
cd platform/backend
.venv/bin/pytest -rs
```

Result:

```text
33 passed
```

Coverage included:

```text
health endpoints
analysis upload/session flow with fake Supabase
orchestrator success/failure paths
permissions
role-scoped list/users endpoints
real EEG pipeline test path
MRI mock pipeline test path
PDF report generation
```

Backend runtime smoke:

```bash
cd platform/backend
.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
curl http://127.0.0.1:8000/api/v1/health
```

Expected:

```json
{"status":"ok","timestamp":"..."}
```

### Frontend

Verified locally:

```bash
cd platform/frontend
npx tsc --noEmit
npx eslint src/lib/api/client.ts src/features/analysis src/app/analysis src/app/dashboard src/app/technician
npm run build
```

Result:

```text
typecheck passed
CI-scoped lint passed
production build passed
```

Frontend runtime smoke:

```bash
cd platform/frontend
npm run start -- --hostname 127.0.0.1 -p 3000
curl -I http://127.0.0.1:3000
```

Expected:

```text
HTTP/1.1 200 OK
```

Note: `next start` prints a warning because the project uses `output: standalone`. For deployment, prefer:

```bash
node .next/standalone/server.js
```

or the existing frontend Dockerfile.

---

## 2. Local Setup Commands

### Backend Environment

Use Python 3.11 or 3.12. Do not use Python 3.14 with the current pinned Pydantic stack.

```bash
cd platform/backend
python3.12 -m venv .venv
. .venv/bin/activate
pip install -r requirements/dev.txt
pip install -r requirements/eeg.txt -r requirements/mri.txt
```

If only API tests are needed:

```bash
pip install -r requirements/dev.txt
```

If full pipeline tests are needed:

```bash
pip install -r requirements/eeg.txt -r requirements/mri.txt
```

### Frontend Environment

```bash
cd platform/frontend
npm ci
cp .env.example .env.local
```

For build-only verification, placeholder values are enough:

```env
NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
SUPABASE_SERVICE_ROLE_KEY=placeholder
```

For real E2E, use real Supabase values.

---

## 3. Real Supabase E2E Checklist

A true end-to-end browser test requires a real Supabase project.

### Step 1: Create Schema

Run this in Supabase SQL Editor:

```text
supabase/setup/full_setup.sql
```

Confirm tables:

```text
hospitals
user_profiles
patient_profiles
doctor_profiles
radiologist_profiles
admin_profiles
doctor_patient_relationships
blood_groups
qualifications
analysis_sessions
analysis_results
analysis_reports
job_events
```

Confirm buckets are private:

```text
raw-files
report-assets
reports
viewer-slices
```

### Step 2: Seed Demo Users

```bash
cd supabase/seed
npm install
cp .env.example .env
```

Set:

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

Then run:

```bash
npm run seed
```

### Step 3: Backend Real Env

Create `platform/backend/.env`:

```env
APP_ENV=development
AUTH_DEV_BYPASS=false
CORS_ORIGINS=http://localhost:3000

SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
# Optional for legacy HS256 projects. Newer Supabase signing keys are verified
# through JWKS when SUPABASE_URL is set.
SUPABASE_JWT_SECRET=

RAW_FILES_BUCKET=raw-files
REPORT_ASSETS_BUCKET=report-assets
REPORTS_BUCKET=reports
VIEWER_SLICES_BUCKET=viewer-slices

JOB_BACKEND=local
LOCAL_JOB_MAX_WORKERS=2
USE_MOCK_MODEL=true
USE_CAT12_PREPROCESSING=false
```

`SUPABASE_SERVICE_ROLE_KEY` should be the newer Supabase `sb_secret_...` key
after installing backend deps from `requirements/api.txt`
(`supabase==2.31.0`). Legacy `service_role` still works as a fallback. Do not
use either backend key in the browser.
After pulling JWT/JWKS support, reinstall backend API deps so PyJWT has crypto
support for ES256/RS256:

```bash
cd platform/backend
. .venv/bin/activate
pip install -r requirements/api.txt
```

Start backend:

```bash
cd platform/backend
. .venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

### Step 4: Frontend Real Env

Create `platform/frontend/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
SUPABASE_SERVICE_ROLE_KEY=
```

Start frontend:

```bash
cd platform/frontend
npm run dev
```

### Step 5: Browser E2E Path

Open:

```text
http://localhost:3000/login
```

Test:

```text
login with seeded user
go to /analysis/new
upload EEG .npy file
verify redirect to /analysis/{id}
verify status polling reaches completed
verify result panel renders
verify patient/clinician/technical report links work
repeat with MRI in mock mode
verify dashboard lists sessions
```

---

## 4. Known Non-Blocking Issues

### Full Frontend Lint

The full command fails:

```bash
npm run lint
```

Reason:

```text
Inherited MRI-base lint debt in unmodified legacy files.
```

The CI gate intentionally uses scoped lint:

```bash
npx eslint src/lib/api/client.ts src/features/analysis src/app/analysis src/app/dashboard src/app/technician
```

This currently passes.

### Remaining npm Audit Findings

After safe fixes and targeted upgrades:

```text
0 high vulnerabilities
11 moderate vulnerabilities
```

Remaining issues are mainly under:

```text
@cornerstonejs / @kitware/vtk.js / xmlbuilder2
uuid transitive dependency
Next.js advisory range with no newer published Next version at time of check
```

Do not run broad `npm audit fix --force` without testing MRI viewer regressions, because npm proposes breaking dependency changes.

### Real MRI Inference

Current tested MRI path is mock mode.

Real MRI inference still requires:

```text
ConViT checkpoint
CAT12
MATLAB Runtime
host-specific CAT12 paths
```

### Production Queue

Current background jobs use local `ThreadPoolExecutor`.

For production scale, replace `LocalJobService` behind the existing `JobService` interface with a durable queue.

---

## 5. What Counts as E2E Success

For MVP/internal testing:

```text
backend tests pass
frontend typecheck passes
frontend scoped lint passes
frontend production build passes
backend health endpoint returns ok
frontend serves HTTP 200
Supabase schema is applied
seeded login works
EEG upload completes
MRI mock upload completes
reports open through signed URLs
dashboard shows completed sessions
```

For production readiness:

```text
real Supabase RLS policies completed
real report context replaces mock context
real MRI inference validated
full security review of remaining npm moderate advisories
durable job queue added
deployment Docker images built and smoke-tested
```
