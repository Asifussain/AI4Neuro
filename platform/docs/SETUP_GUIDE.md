# Complete Setup Guide — from an empty Supabase project to a tested app

This guide takes you, step by step, from **nothing** to a fully working, seeded,
and tested Unified Neuro Platform. It assumes **zero prior knowledge** of
Supabase, PostgreSQL, storage buckets, or OAuth. Every place you must click is
spelled out.

Whenever you must do something outside the code, you'll see a **🟦 USER ACTION
REQUIRED** box telling you exactly where to go, what to copy, and how to confirm
it worked. Do the steps in order.

> **Two honest facts up front (discovered by inspecting the code):**
> 1. **Login is email + password**, with accounts created by an admin. The app
>    does **not** use Google sign-in anywhere. So the big "Google OAuth" setup is
>    **optional** — it's in Appendix A only if you specifically want it. You do
>    **not** need it to run or test the app.
> 2. This guide sets up the **unified `platform/` app** (the merged product). The
>    old standalone apps (`Alzheimer-Detection/`, `mri-platform/`) are not covered
>    and are not needed.

---

## 1. What we are setting up and how it works

Four moving parts:

| Part | What it does |
|---|---|
| **Supabase** | Your cloud backend. It gives you three things at once: a **PostgreSQL database** (tables/records), **Auth** (login/users), and **Storage** (files). You never install these — Supabase hosts them. |
| **Backend** (`platform/backend`) | A Python **FastAPI** server. It receives uploads, checks permissions, runs the ML, and reads/writes Supabase using a secret **service-role key**. |
| **Frontend** (`platform/frontend`) | A **Next.js** website. Users log in and upload scans. It talks to Supabase **only for login**, and to the Backend for everything else. |
| **Seed script** (`supabase/seed`) | A one-time Node script that fills the database with demo hospitals, users, and patients so you can log in and see data. |

**How data flows (one sentence):** the browser logs in with Supabase, gets a
token, and sends it to the Backend on every request; the Backend verifies the
token and reads/writes the Supabase database and storage on your behalf.

---

## 2. Prerequisites and accounts

Install these on your computer first:

- **Node.js 20+** — check with `node --version`. Get it from nodejs.org if missing.
- **Python 3.11+** — check with `python3 --version`.
- **Git** — to have this repository on your machine.

Accounts:

- **A Supabase account** — free. We create it in Step 3.
- (Optional) A Google account — only if you do Appendix A (Google login).

---

## 3. Create and open your Supabase project

**🟦 USER ACTION REQUIRED — create the project**
1. Go to **https://supabase.com** and click **Start your project** → sign in
   (GitHub or email).
2. You land on the **Dashboard**. Click **New project** (green button, top right).
3. Fill in:
   - **Name:** `neuro-platform` (anything).
   - **Database Password:** click **Generate a password**, then **copy it and save
     it somewhere safe** — you may need it later. This is the Postgres password.
   - **Region:** pick the one closest to you.
4. Click **Create new project**. Wait ~2 minutes while it provisions (you'll see a
   spinner). When it's ready you'll see the project home.

**Where your credentials live (you'll need these repeatedly):**
- In the left sidebar click the **gear icon (Project Settings)** at the bottom →
  **API**. This page shows:
  - **Project URL** (looks like `https://abcd1234.supabase.co`) — this is
    `SUPABASE_URL`.
  - **Project API keys** →
    - **`anon` `public`** key — safe for the browser (`..._ANON_KEY`).
    - **`service_role` `secret`** key — **NEVER put this in the browser**
      (backend/seed only).
  - Scroll down to **JWT Settings** → **JWT Secret** — this is
    `SUPABASE_JWT_SECRET` (the Backend uses it to verify login tokens).

Keep this tab open — you'll copy from it in Steps 4 and 10.

---

## 4. Build the complete database schema (one paste)

We use the **Supabase SQL Editor** — the safest, simplest path for a beginner. One
file creates everything in the right order. It is **idempotent** (safe to run
again; it never drops tables or deletes data).

**🟦 USER ACTION REQUIRED — run the schema**
1. In the Supabase left sidebar, click **SQL Editor** (icon looks like `</>`).
2. Click **+ New query**.
3. Open the file `supabase/setup/full_setup.sql` from this repository, select
   **all** of it, copy, and **paste** it into the query box.
4. Click **Run** (bottom right, or Ctrl/Cmd+Enter).
5. **Read the result:** you want **"Success. No rows returned"** at the bottom. If
   you see a red error, jump to Troubleshooting (Section 18) — but on a fresh
   project it should succeed.

> ⚠️ **Reset note (dev only):** this script never deletes data. If you ever want a
> totally clean slate on a **development** project, the easy way is to delete the
> whole Supabase project and make a new one. Do **not** run destructive `DROP`
> commands on anything with real data.

---

## 5. Verify tables, relationships, and RLS

**🟦 USER ACTION REQUIRED — confirm the schema**
1. Left sidebar → **Table Editor**. In the `public` schema you should see these
   **13 tables**:
   `hospitals`, `user_profiles`, `patient_profiles`, `doctor_profiles`,
   `radiologist_profiles`, `admin_profiles`, `doctor_patient_relationships`,
   `blood_groups`, `qualifications`, `analysis_sessions`, `analysis_results`,
   `analysis_reports`, `job_events`.
2. Click `blood_groups` — it should already contain 8 rows (A+, A-, …). Click
   `qualifications` — 4 rows. (These are the starter lookup values.)
3. Confirm RLS is on: click `user_profiles` → the top of the table view shows
   **"RLS enabled"**. (Sidebar → **Authentication → Policies** lists the policies;
   you should see `authenticated_can_read` on the identity tables.)

If all 13 tables exist and the lookup tables have data, the database is ready.

---

## 6. Storage buckets

The schema step (Section 4) already created the four buckets for you. Just verify.

**🟦 USER ACTION REQUIRED — verify the buckets**
1. Left sidebar → **Storage**.
2. You should see four buckets: **`raw-files`**, **`report-assets`**,
   **`reports`**, **`viewer-slices`**.
3. Click any one → the header should show it is **Private** (not public). That is
   correct — the app serves files through short-lived **signed URLs** created by
   the Backend, so the buckets stay private and need **no extra policies**.

What each bucket holds:

| Bucket | Contents |
|---|---|
| `raw-files` | the uploaded scan (`.npy` for EEG, `.nii.gz` for MRI) |
| `report-assets` | generated chart/plot PNGs |
| `viewer-slices` | MRI brain-slice images for the viewer |
| `reports` | the 3 generated PDF reports per analysis |

(There is nothing to click to "create" them — the SQL did it. If a bucket is
missing, re-run `full_setup.sql`.)

---

## 7. Google OAuth — NOT required (see Appendix A)

The application authenticates with **email + password**. There is no Google login
in the code. **Skip this** for normal setup. If you specifically want to add
"Sign in with Google" as an extra option later, follow **Appendix A** at the end.

---

## 8–9. Configure Auth Site URL & Redirect URLs

Even with email/password, Supabase needs to know your app's URL for confirmation
links and redirects.

**🟦 USER ACTION REQUIRED**
1. Left sidebar → **Authentication** → **URL Configuration**.
2. Set **Site URL** to `http://localhost:3000` (your local frontend).
3. Under **Redirect URLs**, click **Add URL** and add `http://localhost:3000/**`.
4. Click **Save**.
5. (Recommended for local dev) Left sidebar → **Authentication** → **Providers** →
   **Email** → make sure **Email** is **enabled**. If you want to skip email
   confirmation for local testing, you can disable "Confirm email" here — but our
   seed script already creates users **pre-confirmed**, so you don't have to.

When you deploy, add your production URL (e.g. `https://app.yourdomain.com`) here
too.

---

## 10. Configure every environment variable

There are **three** env files. Fill them from the Supabase **Project Settings →
API** page (Step 3).

### 10a. Backend — `platform/backend/.env`

```bash
cd platform/backend
cp .env.example .env
```
Then edit `.env` and set:

| Variable | What it is | Where to get it | Secret? |
|---|---|---|---|
| `SUPABASE_URL` | your project URL | Settings → API → Project URL | no |
| `SUPABASE_SERVICE_ROLE_KEY` | admin DB/storage key | Settings → API → `service_role` `secret` | **YES — server only** |
| `SUPABASE_JWT_SECRET` | verifies login tokens | Settings → API → JWT Settings → JWT Secret | **YES** |
| `CORS_ORIGINS` | who may call the API | keep `http://localhost:3000` | no |
| `AUTH_DEV_BYPASS` | dev shortcut (see below) | `true` for local dev | — |
| `USE_MOCK_MODEL` | MRI mock vs real | keep `true` (Linux/dev) | — |

> **`AUTH_DEV_BYPASS=true`** lets you call the Backend directly (curl/Postman)
> without a login token — it treats you as a dev admin. The **browser flow still
> uses real logins** regardless. Set it to `false` in production.

### 10b. Frontend — `platform/frontend/.env.local`

```bash
cd platform/frontend
cp .env.example .env.local
```
Set:

| Variable | What it is | Where to get it | Secret? |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | project URL | Settings → API → Project URL | no (public) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser login key | Settings → API → `anon` `public` | no (public) |
| `NEXT_PUBLIC_API_BASE_URL` | backend address | `http://localhost:8000` | no |
| `SUPABASE_SERVICE_ROLE_KEY` | used by a couple of admin server routes | Settings → API → `service_role` | **YES — server only** |

> Anything starting with `NEXT_PUBLIC_` is baked into the browser bundle — only
> put **public** values there. The service-role key here is only read by Next.js
> **server** route handlers, never shipped to the browser.

### 10c. Seed — `supabase/seed/.env`

```bash
cd supabase/seed
cp .env.example .env
```
Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (same values as the backend).

---

## 11. Start all services

Open **three terminals**.

**Terminal 1 — Backend**
```bash
cd platform/backend
python3 -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements/dev.txt      # API + tests
pip install -r requirements/eeg.txt      # EEG model (real) — pulls torch, ~large
pip install -r requirements/mri.txt      # MRI (mock needs numpy/matplotlib/nibabel; not torch)
uvicorn app.main:app --reload --port 8000
```
Verify: open `http://localhost:8000/api/v1/health` → you should see
`{"status":"ok",...}`. And `http://localhost:8000/api/v1/health/database` →
`{"status":"ok","configured":true}` (if it says `not_configured`, your backend
`.env` Supabase values are missing).

**Terminal 2 — Frontend**
```bash
cd platform/frontend
npm install
npm run dev
```
Verify: open `http://localhost:3000` — you should be redirected to the login page.

**Terminal 3** — we'll use for the seed in Step 12.

---

## 12. Run the seed script

This creates the demo hospitals, login users, patients, and one sample analysis.

```bash
cd supabase/seed
npm install
npm run seed
```

**What success looks like:** it prints
```
🌱 Seeding Unified Neuro Platform (dev)...
  hospitals: General Neural Hospital, City Medical Center
  user: admin@demo.dev (admin)
  ... (one line per user)
  relationships: doctor -> 2 patients
  sample analysis session (completed) created for patient1
✅ Seed complete.
```
followed by a table of login accounts. It is **safe to re-run** (it upserts and
finds-or-creates users, so no duplicates).

**Test account matrix** (password for **all**: `Password123!` — dev only):

| Role | Email | Hospital | Purpose |
|---|---|---|---|
| admin | `admin@demo.dev` | GNH | manage users/relationships; see everything |
| doctor | `doctor@demo.dev` | GNH | assigned to both patients |
| radiologist | `radiologist@demo.dev` | GNH | can upload MRI |
| technician | `technician@demo.dev` | GNH | can upload EEG |
| patient | `patient1@demo.dev` | GNH | has a sample completed analysis |
| patient | `patient2@demo.dev` | GNH | second patient |

> ⚠️ These are **development-only** credentials. Never use them in production.

---

## 13. Verify seeded users, hospitals, and records

**🟦 USER ACTION REQUIRED**
1. Supabase → **Authentication** → **Users**: you should see 6 users (the
   `@demo.dev` emails), each **Confirmed**.
2. Supabase → **Table Editor** → `hospitals`: 2 rows. `user_profiles`: 6 rows, all
   `account_status = active`. `patient_profiles`: 2 rows.
   `doctor_patient_relationships`: 2 rows. `analysis_sessions`: 1 row
   (`status = completed`).

---

## 14. Test login using every important role

For each account in the matrix:

**🟦 USER ACTION REQUIRED**
1. Go to `http://localhost:3000/login`.
2. Enter the email and `Password123!`, submit.
3. **Expected:** you're logged in and redirected to that role's dashboard
   (e.g. `/technician/dashboard`, `/admin/dashboard`). No error toast.
4. **Refresh the page** — you should stay logged in (session persists).
5. Click **Sign out** (in the navbar) — you should return to `/login`.

> Note: the **unified** analysis screens are `/dashboard`, `/analysis/new`, and
> `/analysis/{id}` — these are fully wired to the new Backend. Some inherited
> role-dashboard widgets from the old MRI app still read old tables and may show
> empty/error panels; that's expected and out of scope. Use `/dashboard` and
> `/analysis/new` for the end-to-end test below.

---

## 15. Test the storage + full analysis flow (the real end-to-end)

This exercises upload → job → ML → storage → results → reports.

**🟦 USER ACTION REQUIRED**
1. Log in as `technician@demo.dev` (can create EEG) or `radiologist@demo.dev`
   (MRI). Go to `http://localhost:3000/analysis/new`.
2. **EEG test:** Modality = **EEG**, Analysis type = **binary**, **Patient ID** =
   the `user_id` of a patient. Get it from Supabase → Table Editor →
   `patient_profiles` → copy a `user_id`. Choose the file
   `Alzheimer-Detection/backend/SIDDHI/Sample/feature_02.npy`. Click **Start
   analysis**.
3. **Expected:** you're redirected to `/analysis/{id}` and see a progress bar
   moving through stages. Within a minute (real ADformer model runs) it reaches
   **completed** and shows a prediction (Normal/Alzheimer's), a probability chart,
   and 3 plot images.
4. **MRI test (mock):** same page, Modality = **MRI**, Analysis type =
   **multi-disease**. Any `.nii.gz`-named file works in mock mode (mock ignores
   content). Expect a completed result with a prediction (CN/MCI/AD), charts, and
   the MRI viewer.
5. **Verify storage got the files:** Supabase → **Storage** → `raw-files` → you
   should see a new `eeg/{id}/…` or `mri/{id}/…` object. → `reports` → three PDFs
   under `{id}/`. Click a PDF's **⋯ → Get URL** to confirm it downloads.
6. **Verify DB rows:** Table Editor → `analysis_sessions` (new row, `completed`),
   `analysis_results` (prediction), `analysis_reports` (3 pdf urls), `job_events`
   (the timeline).
7. Go to `/dashboard` → your new analysis appears in the list. Click it → the
   result renders. **This is the full end-to-end success.**

---

## 16. Test authorization and RLS boundaries

**Backend permission checks (the real security):**
- Log in as `patient1@demo.dev`. Try to open `/analysis/new`. **Expected:** the
  page redirects you away (patients may not create analyses). If you call the API
  directly as a patient token, `POST /api/v1/analysis` returns **403
  permission_denied**.
- As `doctor@demo.dev`, open the sample analysis for `patient1` (allowed — the
  doctor is assigned). A doctor from another hospital would get **403** on it.

**RLS spot check (database level):**
- Supabase → **SQL Editor** → run:
  ```sql
  select count(*) from analysis_sessions;
  ```
  This uses the service role (SQL editor) and works. The point of RLS here is that
  the **browser's anon key cannot** read `analysis_sessions` directly — all
  sensitive analysis data is fetched through the Backend, which is exactly the
  design.

---

## 17. Run the complete end-to-end application test (checklist)

Tick these in order:

- [ ] `GET http://localhost:8000/api/v1/health` → `ok`
- [ ] `GET .../health/database` → `configured: true`
- [ ] Frontend loads and redirects to `/login`
- [ ] Each of the 6 seeded accounts can log in
- [ ] Session persists after refresh; logout returns to `/login`
- [ ] Technician/radiologist can open `/analysis/new`; patient cannot
- [ ] EEG upload → completes → real prediction + plots
- [ ] MRI (mock) upload → completes → prediction + charts + viewer
- [ ] `raw-files`, `report-assets`, `reports`, `viewer-slices` receive objects
- [ ] `analysis_sessions/results/reports/job_events` rows created
- [ ] `/dashboard` lists analyses and opens them
- [ ] PDF report links open/download

If every box is ticked, the application is fully set up and working end to end.

---

## 18. Troubleshooting

| Symptom | Likely cause & fix |
|---|---|
| SQL editor error `relation "auth.users" does not exist` | You're not on a real Supabase project (auth schema missing). Use a hosted Supabase project, not a bare Postgres. |
| `full_setup.sql` error about a policy already existing | Harmless on re-run; the script drops-then-creates. If it still fails, tell me the exact line. |
| Creating a hospital fails with `Could not find the 'created_by' column of 'hospitals' in the schema cache` | The `hospitals.created_by` column (or the PostgREST schema cache) is out of date on an **already-deployed** project. Fix: run `supabase/migrations/0009_align_hospital_admin_role_value.sql` in the SQL Editor (it adds the column if missing and reloads the cache with `notify pgrst, 'reload schema'`). Fresh installs from `full_setup.sql` already include both. |
| Super Admin can't create a Hospital Admin, or a Hospital Admin can't create Doctors/Radiologists/Patients (403 / insert fails) | The database still stores the hospital-admin role as `hospital_admin`, but the whole app uses the value `admin`. Fix: run `supabase/migrations/0009_align_hospital_admin_role_value.sql` (renames existing rows back to `admin` and fixes the role CHECK constraint). |
| Backend `/health/database` says `not_configured` | `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` missing or wrong in `platform/backend/.env`. |
| Backend request → `503 service_unavailable` | Same as above — Supabase not configured. |
| Login says "Invalid login credentials" | Run the seed (Step 12), or the user isn't confirmed. Check Authentication → Users. |
| Login works but every page bounces you to `/login` | The user has no `user_profiles` row, or `account_status` ≠ `active`. The seed sets `active`; if you made a user by hand, add the profile row. |
| Upload → `403 permission_denied` | That role can't create that modality (patients can't; technicians can't create MRI). Use the right role. |
| Upload → `400 invalid_file_type` | EEG needs `.npy`; MRI needs `.nii`/`.nii.gz`/`.gz`. |
| Analysis stuck at `queued`/`processing` forever | Look at the Backend terminal for errors. EEG needs `pip install -r requirements/eeg.txt` (torch). MRI mock needs `requirements/mri.txt`. |
| Frontend build/login CORS error | `CORS_ORIGINS` in backend `.env` must include `http://localhost:3000`. |
| Images/PDFs don't load in the result page | The buckets must exist and be **private**; the Backend generates signed URLs. Re-check Step 6. |

---

## 19. Final completion checklist

You are done when you have:

- [ ] a Supabase project with the **13 tables** and **4 private buckets**
- [ ] correct `platform/backend/.env`, `platform/frontend/.env.local`,
      `supabase/seed/.env`
- [ ] seeded **2 hospitals, 6 users (5 roles), 2 patients, relationships**
- [ ] working **email/password** login for every role
- [ ] a completed **EEG (real)** and **MRI (mock)** analysis end to end
- [ ] files in all four **storage buckets** and rows in all four **analysis tables**
- [ ] verified that patients are blocked from creating analyses (authorization)

---

## Appendix A — (Optional) Add "Sign in with Google"

Only do this if you *want* Google login as an extra option. The app works fully
without it.

**A1. Get the Supabase callback URL first (so you don't guess it).**
Supabase → **Authentication → Providers → Google** → expand it. Supabase shows a
**Callback URL (for OAuth)** like
`https://<your-project-ref>.supabase.co/auth/v1/callback`. **Copy it.**

**A2. Create a Google Cloud OAuth client.**
1. Go to **https://console.cloud.google.com** and sign in. (Any Google account
   works; for a company, use a company-owned account, not a personal one.)
2. Top bar → project dropdown → **New Project** → name it → **Create** → select it.
3. Left menu → **APIs & Services → OAuth consent screen**. Choose **External** →
   **Create**. Fill **App name**, **User support email**, and **Developer contact
   email** (required). Save and continue through the steps. While in **Testing**
   mode, add your own Google email under **Test users** (only test users can log
   in until you "Publish").
4. Left menu → **APIs & Services → Credentials → + Create Credentials → OAuth
   client ID**. **Application type = Web application.**
   - **Authorized JavaScript origins:** `http://localhost:3000`
   - **Authorized redirect URIs:** paste the **Supabase Callback URL** from A1.
   - Click **Create**. A dialog shows your **Client ID** and **Client Secret** —
     copy both.

**A3. Put them in Supabase.**
Supabase → **Authentication → Providers → Google** → toggle **Enable** → paste the
**Client ID** and **Client Secret** → **Save**.

**A4. Add a button in the app.** The current code has no Google button; you'd add
`await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo:
'http://localhost:3000' } })` to the login page. (Tell me if you want this and
I'll wire it in — including creating the matching `user_profiles` row on first
login, which the app currently does not do automatically.)

**A5. Verify.** Click the Google button → complete Google login → Supabase →
**Authentication → Users** shows the Google user. Note: a brand-new Google user
won't have a `user_profiles` row yet, so the app would bounce them to `/login`
until an admin creates their profile — which is why email/password + admin-created
accounts is the app's real model.
