import { createClient } from '@supabase/supabase-js';

// Create admin client with service role key to bypass RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Anon client for auth verification
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get auth token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No authorization token provided' });
    }

    const token = authHeader.split(' ')[1];

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Get user profile using admin client to bypass RLS
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('role, hospital_id, account_status')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      return res.status(500).json({ error: 'Failed to fetch user profile' });
    }

    // Check role
    if (userProfile.role !== 'radiologist') {
      return res.status(403).json({ error: 'Radiologist access required' });
    }

    if (userProfile.account_status !== 'active') {
      return res.status(403).json({ error: 'Account not active' });
    }

    // Get doctor_id from request body
    const { doctor_id } = req.body;
    if (!doctor_id) {
      return res.status(400).json({ error: 'doctor_id is required' });
    }

    // Verify doctor exists and is in same hospital
    const { data: doctor, error: doctorError } = await supabaseAdmin
      .from('user_profiles')
      .select(`
        id,
        full_name,
        email,
        hospital_id,
        role,
        account_status,
        doctor_profiles!doctor_profiles_user_fkey(
          medical_license,
          specialization,
          experience_years,
          verification_status
        )
      `)
      .eq('id', doctor_id)
      .eq('hospital_id', userProfile.hospital_id)
      .eq('role', 'doctor')
      .eq('account_status', 'active')
      .single();

    if (doctorError || !doctor) {
      return res.status(404).json({
        error: 'Doctor not found',
        details: 'The requested doctor could not be found or you don\'t have access'
      });
    }

    // Get patients assigned to this doctor
    const { data: patients, error: patientsError } = await supabaseAdmin
      .from('user_profiles')
      .select(`
        id,
        full_name,
        email,
        date_of_birth,
        unique_identifier,
        created_at,
        patient_profiles!patient_profiles_user_fkey!inner(
          patient_id,
          blood_group_id,
          verification_status,
          assigned_doctor_id,
          medical_history,
          blood_groups(blood_type)
        )
      `)
      .eq('hospital_id', userProfile.hospital_id)
      .eq('role', 'patient')
      .eq('account_status', 'active')
      .eq('patient_profiles.assigned_doctor_id', doctor_id)
      .order('full_name');

    if (patientsError) {
      return res.status(500).json({
        error: 'Failed to fetch patients',
        details: patientsError.message
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        doctor,
        patients: patients || []
      }
    });

  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
}
