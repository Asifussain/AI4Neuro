import { createClient } from '@supabase/supabase-js'

// Create Supabase client - try service role first, fallback to anon key
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

// Flag to determine if we have service role access
const hasServiceRole = !!process.env.SUPABASE_SERVICE_ROLE_KEY

export default async function handler(req, res) {
  // Only allow admin users to access this endpoint
  const { method } = req;
  
  if (method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check if service role key is available
    if (!hasServiceRole) {
      return res.status(500).json({ 
        error: 'Service role key not configured',
        message: 'To fix the RLS issue, add SUPABASE_SERVICE_ROLE_KEY to your .env.local file',
        instructions: {
          step1: 'Go to your Supabase project dashboard',
          step2: 'Go to Settings > API',
          step3: 'Copy the service_role key (not the anon key)',
          step4: 'Add SUPABASE_SERVICE_ROLE_KEY=your_service_role_key to .env.local',
          step5: 'Restart your Next.js development server'
        }
      });
    }

    // Get the current user from the request headers
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No authorization token provided' });
    }

    // Verify the user is an admin
    const token = authHeader.split(' ')[1];
    const supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Check if user is admin
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('role, hospital_id, account_status')
      .eq('id', user.id)
      .single();

    if (profileError || userProfile?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    if (userProfile.account_status !== 'active') {
      return res.status(403).json({ error: 'Admin account not active' });
    }

    // Now fetch data using service role (bypasses RLS)
    const hospitalId = userProfile.hospital_id;


    const [
      allUsersResult,
      pendingUsersResult,
      activePatientsResult,
      activeDoctorsResult,
      patientProfilesResult
    ] = await Promise.all([
      // All users in hospital
      supabaseAdmin
        .from('user_profiles')
        .select('id, full_name, email, role, account_status, hospital_id, created_at, phone, unique_identifier')
        .eq('hospital_id', hospitalId)
        .order('created_at', { ascending: false }),
      
      // Pending users with role-specific data
      supabaseAdmin
        .from('user_profiles')
        .select(`
          *,
          patient_profiles!patient_profiles_user_fkey(*,
            blood_groups(*)
          ),
          doctor_profiles!doctor_profiles_user_fkey(*,
            qualifications(*)
          ),
          admin_profiles!admin_profiles_user_fkey(*)
        `)
        .eq('hospital_id', hospitalId)
        .eq('account_status', 'pending')
        .order('created_at', { ascending: false }),
      
      // Active patients
      supabaseAdmin
        .from('user_profiles')
        .select(`
          *,
          patient_profiles!patient_profiles_user_fkey(*,
            blood_groups(*),
            assigned_doctor:doctor_profiles!patient_profiles_doctor_fkey(user_profiles!doctor_profiles_user_fkey(full_name))
          )
        `)
        .eq('hospital_id', hospitalId)
        .eq('role', 'patient')
        .eq('account_status', 'active')
        .order('created_at', { ascending: false }),
      
      // Active doctors
      supabaseAdmin
        .from('user_profiles')
        .select(`
          *,
          doctor_profiles!doctor_profiles_user_fkey(*,
            qualifications(*)
          )
        `)
        .eq('hospital_id', hospitalId)
        .eq('role', 'doctor')
        .eq('account_status', 'active')
        .order('created_at', { ascending: false }),
      
      // Patient profiles for unassigned count
      supabaseAdmin
        .from('patient_profiles')
        .select('user_id, assigned_doctor_id, user_profiles!patient_profiles_user_fkey!inner(hospital_id, account_status)')
        .eq('user_profiles.hospital_id', hospitalId)
        .eq('user_profiles.account_status', 'active')
    ]);

    const { data: allUsers, error: usersError } = allUsersResult;
    const { data: pendingUsers, error: pendingError } = pendingUsersResult;
    const { data: patients, error: patientsError } = activePatientsResult;
    const { data: doctors, error: doctorsError } = activeDoctorsResult;
    const { data: patientProfiles, error: profilesError } = patientProfilesResult;


    const stats = {
      totalUsers: allUsers?.length || 0,
      pendingPatients: pendingUsers?.filter(u => u.role === 'patient').length || 0,
      pendingDoctors: pendingUsers?.filter(u => u.role === 'doctor').length || 0,
      activePatients: patients?.length || 0,
      activeDoctors: doctors?.length || 0,
      unassignedPatients: patientProfiles?.filter(p => !p.assigned_doctor_id).length || 0
    };

    res.status(200).json({
      success: true,
      data: {
        allUsers: allUsers || [],
        pendingUsers: pendingUsers || [],
        patients: patients || [],
        doctors: doctors || [],
        stats,
        hospitalId,
        adminInfo: {
          id: user.id,
          email: user.email,
          role: userProfile.role,
          hospitalId: userProfile.hospital_id
        }
      },
      errors: {
        users: usersError,
        pending: pendingError,
        patients: patientsError,
        doctors: doctorsError,
        profiles: profilesError
      }
    });

  } catch (error) {
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}