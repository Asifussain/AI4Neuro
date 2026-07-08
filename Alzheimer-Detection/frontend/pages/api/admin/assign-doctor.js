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

    // Check role - only admins can assign doctors
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

    // Verify doctor exists and is in same hospital
    const { data: doctor, error: doctorError } = await supabaseAdmin
      .from('user_profiles')
      .select('id, hospital_id, role, full_name')
      .eq('id', doctor_id)
      .eq('hospital_id', userProfile.hospital_id)
      .eq('role', 'doctor')
      .eq('account_status', 'active')
      .single();

    if (doctorError || !doctor) {
      return res.status(404).json({ error: 'Doctor not found or not in your hospital' });
    }

    // Check if this doctor-patient relationship already exists
    const { data: existingRelationship } = await supabaseAdmin
      .from('doctor_patient_relationships')
      .select('id, relationship_status')
      .eq('doctor_id', doctor_id)
      .eq('patient_id', patient_id)
      .eq('hospital_id', userProfile.hospital_id)
      .single();

    if (existingRelationship) {
      // If relationship exists but is inactive, reactivate it
      if (existingRelationship.relationship_status !== 'active') {
        const { error: updateError } = await supabaseAdmin
          .from('doctor_patient_relationships')
          .update({
            relationship_status: 'active',
            assigned_at: new Date().toISOString()
          })
          .eq('id', existingRelationship.id);

        if (updateError) {
          return res.status(500).json({
            error: 'Failed to reactivate doctor assignment',
            details: updateError.message
          });
        }
      } else {
        // Relationship is already active
        return res.status(200).json({
          success: true,
          message: `Doctor ${doctor.full_name} is already assigned to this patient`,
          data: {
            patient_id,
            doctor_id,
            doctor_name: doctor.full_name,
            already_assigned: true
          }
        });
      }
    } else {
      // Create new doctor-patient relationship record
      const { error: relationshipError } = await supabaseAdmin
        .from('doctor_patient_relationships')
        .insert({
          doctor_id: doctor_id,
          patient_id: patient_id,
          hospital_id: userProfile.hospital_id,
          relationship_status: 'active',
          assigned_by: user.id,
          assigned_at: new Date().toISOString()
        });

      if (relationshipError) {
        console.error('Relationship creation error:', relationshipError);
        return res.status(500).json({
          error: 'Failed to create doctor assignment',
          details: relationshipError.message
        });
      }
    }

    // Update patient_profiles with the primary doctor (first active assignment)
    // This maintains backward compatibility with the assigned_doctor_id field
    const { data: currentAssignment } = await supabaseAdmin
      .from('patient_profiles')
      .select('assigned_doctor_id')
      .eq('user_id', patient_id)
      .single();

    // Only update assigned_doctor_id if patient doesn't have a primary doctor yet
    if (!currentAssignment || !currentAssignment.assigned_doctor_id) {
      await supabaseAdmin
        .from('patient_profiles')
        .update({
          assigned_doctor_id: doctor_id,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', patient_id);
    }

    return res.status(200).json({
      success: true,
      message: `Doctor ${doctor.full_name} successfully assigned to patient`,
      data: {
        patient_id,
        doctor_id,
        doctor_name: doctor.full_name
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