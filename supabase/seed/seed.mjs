/**
 * Unified Neuro Platform — development seed script.
 *
 * Creates realistic dev data using the Supabase SERVICE ROLE key:
 *   - 2 hospitals
 *   - 1 user per role (admin, doctor, radiologist, technician) + 2 patients
 *   - their role-specific profiles
 *   - doctor<->patient relationships
 *   - one sample COMPLETED analysis session so the dashboard isn't empty
 *
 * Auth users are created CONFIRMED (email_confirm: true) so they can log in
 * immediately with email + password.
 *
 * SAFE TO RE-RUN: it finds-or-creates auth users by email and upserts rows,
 * so running it again does not create duplicates.
 *
 * Usage:
 *   cd supabase/seed
 *   cp .env.example .env    # fill SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *   npm install
 *   npm run seed
 *
 * NEVER use these dev credentials in production.
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('❌ Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in supabase/seed/.env');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEV_PASSWORD = 'Password123!'; // dev-only

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------
async function findAuthUserByEmail(email) {
  let page = 1;
  // paginate the auth users list until we find the email or run out of pages
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((u) => (u.email || '').toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (data.users.length < 200) return null;
    page += 1;
  }
}

async function ensureAuthUser(email, fullName, role) {
  const existing = await findAuthUserByEmail(email);
  if (existing) {
    await db.auth.admin.updateUserById(existing.id, {
      password: DEV_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: fullName, role },
    });
    return existing.id;
  }
  const { data, error } = await db.auth.admin.createUser({
    email,
    password: DEV_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName, role },
  });
  if (error) throw error;
  return data.user.id;
}

async function upsertHospital(h) {
  const { data, error } = await db
    .from('hospitals')
    .upsert(h, { onConflict: 'hospital_code' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function upsertUserProfile(row) {
  const { error } = await db.from('user_profiles').upsert(row, { onConflict: 'id' });
  if (error) throw error;
}

async function upsertByUserId(table, row) {
  const { error } = await db.from(table).upsert(row, { onConflict: 'user_id' });
  if (error) throw error;
}

async function ensureRadiologistProfile(row) {
  const { data } = await db
    .from('radiologist_profiles')
    .select('id')
    .eq('user_id', row.user_id)
    .maybeSingle();
  if (data) return;
  const { error } = await db.from('radiologist_profiles').insert(row);
  if (error) throw error;
}

async function ensureRelationship(rel) {
  const { error } = await db
    .from('doctor_patient_relationships')
    .upsert(rel, { onConflict: 'doctor_id,patient_id,hospital_id,relationship_status' });
  if (error) throw error;
}

// --------------------------------------------------------------------------
// Seed
// --------------------------------------------------------------------------
async function main() {
  console.log('🌱 Seeding Unified Neuro Platform (dev)...');

  // 1) Hospitals
  const gnh = await upsertHospital({
    hospital_code: 'GNH',
    name: 'General Neural Hospital',
    address: '123 Medical Center Dr, Neuropolis, NY 10001',
    phone: '+1 (555) 012-3456',
    email: 'contact@gnh.example',
    status: 'active',
  });
  const cmc = await upsertHospital({
    hospital_code: 'CMC',
    name: 'City Medical Center',
    address: '456 Health Ave, Metroville, CA 90002',
    phone: '+1 (555) 987-6543',
    email: 'contact@cmc.example',
    status: 'active',
  });
  console.log(`  hospitals: ${gnh.name}, ${cmc.name}`);

  // 2) Users (email -> role). All in GNH for a coherent single-hospital demo.
  const people = [
    { email: 'admin@demo.dev',      role: 'admin',       full_name: 'Alice Admin' },
    { email: 'doctor@demo.dev',     role: 'doctor',      full_name: 'Dr. David Doctor' },
    { email: 'radiologist@demo.dev',role: 'radiologist', full_name: 'Dr. Rita Radiologist' },
    { email: 'technician@demo.dev', role: 'technician',  full_name: 'Tom Technician' },
    { email: 'patient1@demo.dev',   role: 'patient',     full_name: 'Pat Patient One' },
    { email: 'patient2@demo.dev',   role: 'patient',     full_name: 'Paula Patient Two' },
  ];

  const ids = {};
  let seq = 1;
  for (const p of people) {
    const id = await ensureAuthUser(p.email, p.full_name, p.role);
    ids[p.email] = id;
    await upsertUserProfile({
      id,
      hospital_id: gnh.id,
      unique_identifier: `GNH-${p.role.toUpperCase()}-${String(seq++).padStart(4, '0')}`,
      full_name: p.full_name,
      email: p.email,
      phone: `+1 (555) 000-${String(1000 + seq)}`,
      role: p.role,
      account_status: 'active', // active so they can log in and use the app
      auth_provider: 'email',
    });
    console.log(`  user: ${p.email} (${p.role})`);
  }

  // 3) Role-specific profiles
  await upsertByUserId('doctor_profiles', {
    user_id: ids['doctor@demo.dev'],
    medical_license: 'MED-GNH-0001',
    specialization: 'Neurology',
    experience_years: 12,
    verification_status: 'verified',
  });
  await ensureRadiologistProfile({
    user_id: ids['radiologist@demo.dev'],
    radiologist_license: 'RAD-GNH-0001',
    imaging_expertise: 'Neuroimaging (MRI, CT)',
    experience_years: 9,
    verification_status: 'verified',
  });
  await upsertByUserId('admin_profiles', {
    user_id: ids['admin@demo.dev'],
    employee_id: 'EMP-0001',
    department: 'Administration',
  });
  for (const email of ['patient1@demo.dev', 'patient2@demo.dev']) {
    await upsertByUserId('patient_profiles', {
      user_id: ids[email],
      patient_id: email === 'patient1@demo.dev' ? 'GNH-PAT-0001' : 'GNH-PAT-0002',
      medical_history: 'Reported mild memory concerns.',
      verification_status: 'verified',
    });
  }

  // 4) Doctor <-> patient relationships (both patients assigned to the doctor)
  for (const email of ['patient1@demo.dev', 'patient2@demo.dev']) {
    await ensureRelationship({
      doctor_id: ids['doctor@demo.dev'],
      patient_id: ids[email],
      hospital_id: gnh.id,
      relationship_status: 'active',
      assigned_by: ids['admin@demo.dev'],
    });
  }
  console.log('  relationships: doctor -> 2 patients');

  // 5) One sample COMPLETED analysis session for patient1 (only if none exist)
  const { data: existing } = await db
    .from('analysis_sessions')
    .select('id')
    .eq('patient_id', ids['patient1@demo.dev'])
    .limit(1);
  if (!existing || existing.length === 0) {
    const { data: session, error: sErr } = await db
      .from('analysis_sessions')
      .insert({
        modality: 'mri',
        analysis_type: 'multi-disease',
        patient_id: ids['patient1@demo.dev'],
        doctor_id: ids['doctor@demo.dev'],
        radiologist_id: ids['radiologist@demo.dev'],
        hospital_id: gnh.id,
        uploaded_by: ids['radiologist@demo.dev'],
        uploaded_by_role: 'radiologist',
        original_filename: 'sample_scan.nii.gz',
        status: 'completed',
        progress_percent: 100,
      })
      .select()
      .single();
    if (sErr) throw sErr;
    await db.from('analysis_results').insert({
      session_id: session.id,
      prediction: 'MCI',
      confidence: 0.71,
      probabilities: { CN: 0.18, MCI: 0.71, AD: 0.11 },
      metrics: { brain_volume: 1196, gm_volume: 540, wm_volume: 470 },
      model_version: 'mock-v1.0',
    });
    console.log('  sample analysis session (completed) created for patient1');
  } else {
    console.log('  sample analysis session already present — skipped');
  }

  console.log('\n✅ Seed complete.\n');
  console.log('Dev login accounts (password for ALL: ' + DEV_PASSWORD + '):');
  console.table(people.map((p) => ({ role: p.role, email: p.email, hospital: 'GNH' })));
  console.log('\n⚠️  Development only — never use these in production.');
}

main().catch((e) => {
  console.error('❌ Seed failed:', e.message || e);
  process.exit(1);
});
