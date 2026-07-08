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
  console.log('=== API Route Called ===');
  console.log('Method:', req.method);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    console.log('Wrong method');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Starting API handler...');

    // Check environment variables
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      console.error('Missing NEXT_PUBLIC_SUPABASE_URL');
      return res.status(500).json({ error: 'Server configuration error: Missing Supabase URL' });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing SUPABASE_SERVICE_ROLE_KEY');
      return res.status(500).json({ error: 'Server configuration error: Missing Service Role Key' });
    }

    // Get auth token
    const authHeader = req.headers.authorization;
    console.log('Auth header present:', !!authHeader);

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('No valid auth header');
      return res.status(401).json({ error: 'No authorization token provided' });
    }

    const token = authHeader.split(' ')[1];
    console.log('Token extracted:', token.substring(0, 20) + '...');

    console.log('Supabase client created');

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    console.log('User verification result:', {
      userId: user?.id,
      email: user?.email,
      error: authError?.message
    });

    if (authError || !user) {
      return res.status(401).json({
        error: 'Invalid token',
        details: authError?.message
      });
    }

    // Get user profile using admin client to bypass RLS
    console.log('Fetching user profile for:', user.id);

    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('role, hospital_id, account_status')
      .eq('id', user.id)
      .single();

    console.log('User profile result:', {
      profile: userProfile,
      error: profileError?.message
    });

    if (profileError) {
      return res.status(500).json({
        error: 'Failed to fetch user profile',
        details: profileError.message
      });
    }

    // Check role
    if (userProfile?.role !== 'radiologist') {
      console.log('User is not a radiologist:', userProfile?.role);
      return res.status(403).json({
        error: 'Radiologist access required',
        yourRole: userProfile?.role
      });
    }

    if (userProfile?.account_status !== 'active') {
      console.log('Account not active:', userProfile?.account_status);
      return res.status(403).json({
        error: 'Account not active',
        status: userProfile?.account_status
      });
    }

    // Get hospital ID
    const { hospital_id } = req.body || {};
    const targetHospitalId = hospital_id || userProfile.hospital_id;

    console.log('Target hospital ID:', targetHospitalId);

    if (!targetHospitalId) {
      return res.status(400).json({ error: 'No hospital ID provided' });
    }

    // Verify same hospital
    if (targetHospitalId !== userProfile.hospital_id) {
      return res.status(403).json({ error: 'Cannot access doctors from different hospital' });
    }

    // Query doctors using admin client - simple query without joins
    console.log('Querying doctors...');

    const { data: doctors, error: doctorsError } = await supabaseAdmin
      .from('user_profiles')
      .select('id, full_name, email, unique_identifier')
      .eq('hospital_id', targetHospitalId)
      .eq('role', 'doctor')
      .eq('account_status', 'active')
      .order('full_name');

    console.log('Doctors query result:', {
      count: doctors?.length,
      error: doctorsError?.message
    });

    if (doctorsError) {
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch doctors',
        details: doctorsError.message
      });
    }

    // Get doctor profiles separately using admin client
    const doctorIds = (doctors || []).map(d => d.id);
    let doctorProfiles = [];

    if (doctorIds.length > 0) {
      console.log('Fetching doctor profiles for', doctorIds.length, 'doctors');

      const { data: profiles, error: profilesError } = await supabaseAdmin
        .from('doctor_profiles')
        .select('user_id, medical_license, specialization, experience_years')
        .in('user_id', doctorIds);

      console.log('Doctor profiles result:', {
        count: profiles?.length,
        error: profilesError?.message
      });

      if (!profilesError) {
        doctorProfiles = profiles || [];
      }
    }

    // Combine data
    const transformedDoctors = (doctors || []).map(doc => {
      const profile = doctorProfiles.find(p => p.user_id === doc.id);
      return {
        id: doc.id,
        full_name: doc.full_name,
        email: doc.email,
        unique_identifier: doc.unique_identifier,
        medical_license: profile?.medical_license || 'N/A',
        specialization: profile?.specialization || 'General Practice',
        experience_years: profile?.experience_years || 0
      };
    });

    console.log('Successfully returning', transformedDoctors.length, 'doctors');

    return res.status(200).json({
      success: true,
      data: transformedDoctors
    });

  } catch (error) {
    console.error('=== API ERROR ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Error details:', JSON.stringify(error, null, 2));

    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
