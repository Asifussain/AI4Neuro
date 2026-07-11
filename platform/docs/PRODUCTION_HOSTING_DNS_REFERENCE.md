# Production Hosting And DNS Reference

This document explains how AI4NEURO production URLs, hosts, DNS records, and
environment variables should fit together.

Use the term:

```text
Production Hosting and DNS
```

instead of only "domain hosting". Domain hosting is one part of the setup, but
the full deployment also includes frontend hosting, backend hosting, SSL, DNS,
Supabase, and model artifact storage.

## Target Public URLs

Use one root domain and two subdomains.

Example:

```text
Root domain: ai4neuro.in
Frontend:    https://app.ai4neuro.in
Backend API: https://api.ai4neuro.in
```

If the final root domain is not ready yet, use temporary provider URLs:

```text
Frontend: https://ai4neuro.vercel.app
Backend:  http://<oracle-vm-public-ip>:8000
```

Then switch to the final domain after DNS is ready.

## Service Map

```text
app.ai4neuro.in
  -> Vercel
  -> Next.js frontend

api.ai4neuro.in
  -> Oracle VM public IP
  -> Caddy or Nginx
  -> FastAPI on localhost:8000

xxxxx.supabase.co
  -> Supabase Auth
  -> Supabase Postgres
  -> Supabase Storage for product data

R2 or Oracle Object Storage
  -> private model artifact bucket
  -> EEG checkpoints
  -> MRI ConViT checkpoint
```

## Request Flow

Login:

```text
Browser
-> app.ai4neuro.in
-> Supabase Auth
-> browser receives Supabase access token
```

Analysis upload:

```text
Browser
-> app.ai4neuro.in
-> api.ai4neuro.in/api/v1/analysis
-> FastAPI verifies Supabase JWT through JWKS
-> FastAPI writes analysis row to Supabase
-> FastAPI uploads raw file to Supabase Storage
-> FastAPI runs EEG/MRI pipeline
-> FastAPI uploads artifacts/reports
-> FastAPI marks job completed
```

Result view:

```text
Browser
-> app.ai4neuro.in
-> api.ai4neuro.in/api/v1/analysis/{session_id}/result
-> FastAPI reads Supabase result/report rows
-> FastAPI returns normalized result payload
```

## DNS Records

At the domain provider, create:

```text
app.ai4neuro.in  CNAME  cname.vercel-dns.com
api.ai4neuro.in  A      <Oracle VM public IP>
```

If using Cloudflare DNS, keep proxying off at first for the API record while
debugging:

```text
api.ai4neuro.in  DNS only
```

After everything is stable, Cloudflare proxy can be evaluated.

## SSL / HTTPS

Frontend:

```text
Vercel automatically provisions HTTPS for app.ai4neuro.in.
```

Backend:

```text
Caddy can automatically provision HTTPS for api.ai4neuro.in.
```

Recommended backend reverse proxy:

```text
Caddy
```

because it handles Let's Encrypt certificates with less manual work than Nginx.

## Backend Runtime

FastAPI should not be exposed directly on port `8000` in final production.

Recommended:

```text
Public internet
-> api.ai4neuro.in:443
-> Caddy
-> 127.0.0.1:8000
-> FastAPI / Uvicorn
```

Uvicorn command behind Caddy:

```bash
cd /opt/ai4neuro/app/platform/backend
source .venv/bin/activate
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

For early testing before DNS:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Open Oracle firewall/security-list ingress for:

```text
22/tcp   SSH
80/tcp   HTTP for certificate setup
443/tcp  HTTPS API
```

Avoid exposing `8000/tcp` publicly after Caddy is configured.

## Frontend Environment

Vercel production env:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xxx
NEXT_PUBLIC_API_BASE_URL=https://api.ai4neuro.in
```

Do not put backend secrets in Vercel public env.

## Backend Environment

Oracle VM backend env:

```env
APP_ENV=production
API_HOST=127.0.0.1
API_PORT=8000
CORS_ORIGINS=https://app.ai4neuro.in

SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxx
SUPABASE_JWT_SECRET=
AUTH_DEV_BYPASS=false

RAW_FILES_BUCKET=raw-files
REPORT_ASSETS_BUCKET=report-assets
REPORTS_BUCKET=reports
VIEWER_SLICES_BUCKET=viewer-slices

JOB_BACKEND=local
LOCAL_JOB_MAX_WORKERS=1
LOCAL_TMP_DIR=/tmp/neuro-platform
MAX_UPLOAD_MB=512

USE_MOCK_MODEL=false
USE_CAT12_PREPROCESSING=false

EEG_CHECKPOINT_ROOT=/opt/ai4neuro/models/eeg/checkpoints
EEG_REFERENCE_DIR=/opt/ai4neuro/models/eeg/reference
EEG_SIDDHI_DIR=/opt/ai4neuro/app/platform/backend/app/pipelines/eeg/siddhi
EEG_USE_GPU=false
EEG_DEFAULT_FS=128
EEG_SUBPROCESS_TIMEOUT=600

CONVIT_CHECKPOINT_PATH=/opt/ai4neuro/models/mri/ConVit_checkpoint.pth
MRI_USE_GPU=false
MRI_MODEL_VERSION=ConViT-v1.0
```

## Supabase Auth Redirect URLs

In Supabase Auth settings, allow:

```text
https://app.ai4neuro.in
https://app.ai4neuro.in/**
```

For local development, also allow:

```text
http://localhost:3000
http://localhost:3000/**
```

## CORS Matching

Backend `CORS_ORIGINS` must match the frontend origin exactly.

Correct:

```env
CORS_ORIGINS=https://app.ai4neuro.in
```

Incorrect:

```env
CORS_ORIGINS=https://api.ai4neuro.in
CORS_ORIGINS=*
```

The browser origin is the frontend URL, not the backend URL.

## Model Artifact Hosting

Do not host model checkpoints on Vercel or GitHub.

Use:

```text
Cloudflare R2
or
Oracle Object Storage
```

Runtime layout on Oracle VM:

```text
/opt/ai4neuro/models/
  eeg/checkpoints/
  eeg/reference/
  mri/ConVit_checkpoint.pth
```

Use `CHECKPOINT_DEPLOYMENT.md` for upload/sync instructions.

## MVP Production Checklist

```text
[ ] Domain purchased or available
[ ] Vercel project created
[ ] Oracle VM created
[ ] DNS app subdomain points to Vercel
[ ] DNS api subdomain points to Oracle VM
[ ] HTTPS works for frontend
[ ] HTTPS works for backend
[ ] CORS_ORIGINS points to frontend URL
[ ] NEXT_PUBLIC_API_BASE_URL points to backend API URL
[ ] Supabase Auth redirect URLs include frontend URL
[ ] Supabase buckets exist and are private
[ ] Checkpoints synced to Oracle VM
[ ] AUTH_DEV_BYPASS=false
[ ] USE_CAT12_PREPROCESSING=false for first production deployment
[ ] Smoke test login/logout
[ ] Smoke test EEG Binary
[ ] Smoke test EEG Multiclass
[ ] Smoke test MRI Binary
[ ] Smoke test MRI Multiclass
[ ] Smoke test PDF reports
```

## Naming Recommendation

Recommended document / task name:

```text
Production Hosting and DNS Setup
```

Good alternatives:

```text
Production Deployment Topology
Domain and Hosting Setup
Hosting, DNS, and SSL Setup
```

Avoid only:

```text
Domain Hosting
```

because it underspecifies backend hosting, reverse proxy, SSL, CORS, and runtime
environment variables.
