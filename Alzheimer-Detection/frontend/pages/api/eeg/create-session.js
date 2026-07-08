import { createClient } from '@supabase/supabase-js';

// Create admin client with service role key
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

// Generate unique session code
const generateSessionCode = (hospitalCode, patientId) => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  const patientSuffix = patientId.substring(0, 4).toUpperCase();
  return `${hospitalCode}-EEG-${timestamp}-${random}-${patientSuffix}`;
};

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb', // Allow large EEG files
    },
  },
};

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

    // Get user profile
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('role, hospital_id, account_status')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      return res.status(500).json({ error: 'Failed to fetch user profile' });
    }

    // Check role - only radiologists can create EEG sessions
    if (userProfile.role !== 'radiologist') {
      return res.status(403).json({ error: 'Radiologist access required' });
    }

    if (userProfile.account_status !== 'active') {
      return res.status(403).json({ error: 'Account not active' });
    }

    // Parse request body
    const {
      patient_id,
      doctor_id,
      filename,
      eeg_file_base64, // Base64 encoded file
      session_notes,
      session_duration,
      electrodes_used,
      sampling_rate,
      analysis_type = 'binary'
    } = req.body;

    // Validate required fields
    if (!patient_id || !doctor_id || !filename || !eeg_file_base64) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['patient_id', 'doctor_id', 'filename', 'eeg_file_base64']
      });
    }

    // Verify patient exists and is in same hospital
    const { data: patient, error: patientError } = await supabaseAdmin
      .from('user_profiles')
      .select('id, hospital_id, role, unique_identifier, patient_profiles!patient_profiles_user_fkey!inner(patient_id)')
      .eq('id', patient_id)
      .eq('hospital_id', userProfile.hospital_id)
      .eq('role', 'patient')
      .eq('account_status', 'active')
      .single();

    if (patientError || !patient) {
      console.error('Patient verification error:', patientError);
      return res.status(404).json({
        error: 'Patient not found or not in your hospital',
        details: patientError?.message
      });
    }

    // Verify doctor exists and is in same hospital
    const { data: doctor, error: doctorError } = await supabaseAdmin
      .from('user_profiles')
      .select('id, hospital_id, role, doctor_profiles(medical_license)')
      .eq('id', doctor_id)
      .eq('hospital_id', userProfile.hospital_id)
      .eq('role', 'doctor')
      .eq('account_status', 'active')
      .single();

    if (doctorError || !doctor) {
      console.error('Doctor verification error:', doctorError);
      return res.status(404).json({
        error: 'Doctor not found or not in your hospital',
        details: doctorError?.message
      });
    }

    // Get hospital info for session code
    const { data: hospital, error: hospitalError } = await supabaseAdmin
      .from('hospitals')
      .select('hospital_code')
      .eq('id', userProfile.hospital_id)
      .single();

    if (hospitalError || !hospital) {
      return res.status(500).json({ error: 'Failed to fetch hospital information' });
    }

    // Generate unique session code
    const sessionCode = generateSessionCode(hospital.hospital_code, patient.unique_identifier);

    // Upload EEG file to Supabase Storage
    let eegDataUrl = null;
    try {
      // Decode base64 file
      const fileBuffer = Buffer.from(eeg_file_base64, 'base64');
      const filePath = `${hospital.hospital_code}/${patient.unique_identifier}/${sessionCode}/${filename}`;

      const { data: uploadData, error: uploadError } = await supabaseAdmin
        .storage
        .from('eeg-data')
        .upload(filePath, fileBuffer, {
          contentType: 'application/octet-stream',
          upsert: false
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error(`Failed to upload EEG file: ${uploadError.message}`);
      }

      // Get public URL
      const { data: urlData } = supabaseAdmin
        .storage
        .from('eeg-data')
        .getPublicUrl(filePath);

      eegDataUrl = urlData.publicUrl;
    } catch (uploadErr) {
      return res.status(500).json({
        error: 'Failed to upload EEG file',
        details: uploadErr.message
      });
    }

    // Create EEG session record
    const sessionData = {
      session_code: sessionCode,
      patient_id: patient_id,
      doctor_id: doctor_id,
      hospital_id: userProfile.hospital_id,
      filename: filename,
      eeg_data_url: eegDataUrl,
      session_date: new Date().toISOString(),
      session_duration: session_duration || null,
      electrodes_used: electrodes_used || null,
      sampling_rate: sampling_rate || null,
      session_notes: session_notes || null,
      analysis_type: analysis_type,
      status: 'uploaded',
      created_at: new Date().toISOString()
    };

    const { data: session, error: sessionError } = await supabaseAdmin
      .from('eeg_sessions')
      .insert(sessionData)
      .select()
      .single();

    if (sessionError) {
      // Cleanup uploaded file on error
      try {
        const filePath = `${hospital.hospital_code}/${patient.unique_identifier}/${sessionCode}/${filename}`;
        await supabaseAdmin.storage.from('eeg-data').remove([filePath]);
      } catch (cleanupErr) {
        console.error('Cleanup error:', cleanupErr);
      }

      return res.status(500).json({
        error: 'Failed to create EEG session',
        details: sessionError.message
      });
    }

    // Create notification for doctor
    try {
      await supabaseAdmin
        .from('notifications')
        .insert({
          user_id: doctor_id,
          title: 'New EEG Session Created',
          message: `A new EEG session (${sessionCode}) has been created for your patient.`,
          type: 'system_alert',
          related_resource_type: 'eeg_session',
          related_resource_id: session.id,
          created_at: new Date().toISOString()
        });
    } catch (notifErr) {
      console.error('Notification error (non-critical):', notifErr);
    }

    return res.status(201).json({
      success: true,
      message: 'EEG session created successfully',
      data: {
        session_id: session.id,
        session_code: session.session_code,
        eeg_data_url: eegDataUrl,
        status: session.status,
        created_at: session.created_at
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
