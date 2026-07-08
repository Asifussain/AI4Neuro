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

    // Check role - only admins can unassign doctors
    if (userProfile.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    if (userProfile.account_status !== 'active') {
      return res.status(403).json({ error: 'Account not active' });
    }

    // Get patient_id and doctor_id from request
    const { patient_id, doctor_id } = req.body;

    if (!patient_id || !doctor_id) {
      return res.status(400).json({ error: 'patient_id and doctor_id are required' });
    }

    // Verify patient exists and is in same hospital
    const { data: patient, error: patientError } = await supabaseAdmin
      .from('user_profiles')
      .select('id, hospital_id, role')
      .eq('id', patient_id)
      .eq('hospital_id', userProfile.hospital_id)
      .eq('role', 'patient')
      .single();

    if (patientError || !patient) {
      return res.status(404).json({ error: 'Patient not found or not in your hospital' });
    }

    // Mark the relationship as inactive
    const { error: relationshipError } = await supabaseAdmin
      .from('doctor_patient_relationships')
      .update({
        relationship_status: 'inactive'
      })
      .eq('doctor_id', doctor_id)
      .eq('patient_id', patient_id)
      .eq('hospital_id', userProfile.hospital_id);

    if (relationshipError) {
      console.error('Relationship update error:', relationshipError);
      return res.status(500).json({
        error: 'Failed to unassign doctor',
        details: relationshipError.message
      });
    }

    // Check if this was the primary doctor
    const { data: patientProfile } = await supabaseAdmin
      .from('patient_profiles')
      .select('assigned_doctor_id')
      .eq('user_id', patient_id)
      .single();

    if (patientProfile && patientProfile.assigned_doctor_id === doctor_id) {
      // This was the primary doctor, find another active doctor or set to null
      const { data: otherRelationships } = await supabaseAdmin
        .from('doctor_patient_relationships')
        .select('doctor_id')
        .eq('patient_id', patient_id)
        .eq('relationship_status', 'active')
        .limit(1);

      const newPrimaryDoctorId = otherRelationships && otherRelationships.length > 0
        ? otherRelationships[0].doctor_id
        : null;

      await supabaseAdmin
        .from('patient_profiles')
        .update({
          assigned_doctor_id: newPrimaryDoctorId,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', patient_id);
    }

    return res.status(200).json({
      success: true,
      message: 'Doctor successfully unassigned from patient'
    });

  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
}
