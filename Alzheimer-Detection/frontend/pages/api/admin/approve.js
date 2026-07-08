import { createClient } from '@supabase/supabase-js'

// Create Supabase client with service role
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
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

    if (profileError || userProfile?.role !== 'admin' || userProfile?.account_status !== 'active') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { userId, role, action } = req.body;

    if (!userId || !role || !action) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (action === 'approve') {
      const { data: existingUser, error: checkError } = await supabaseAdmin
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (checkError || !existingUser) {
        throw new Error(`User not found: ${checkError?.message || 'Unknown error'}`);
      }

      if (existingUser.hospital_id !== userProfile.hospital_id) {
        throw new Error('Cannot approve user from different hospital');
      }

      const updateData = { 
        account_status: 'active',
        phone_verified: true,
        updated_at: new Date().toISOString()
      };

      const { data: updateResult, error: profileError } = await supabaseAdmin
        .from('user_profiles')
        .update(updateData)
        .eq('id', userId)
        .select();

      if (profileError) {
        throw new Error(`Failed to update user profile: ${profileError.message}`);
      }

      if (!updateResult || updateResult.length === 0) {
        throw new Error('Update returned no results - possibly RLS or constraint issue');
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const { data: verifyUser, error: verifyError } = await supabaseAdmin
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (verifyError) {
        throw new Error(`Verification query failed: ${verifyError.message}`);
      }

      if (!verifyUser || verifyUser.account_status !== 'active') {
        throw new Error('Update verification failed - user status not changed to active');
      }
      if (role === 'patient') {
        const patientUpdateData = { 
          verification_status: 'verified',
          verified_by: user.id,
          verified_at: new Date().toISOString()
        };
        
        const { error: patientError } = await supabaseAdmin
          .from('patient_profiles')
          .update(patientUpdateData)
          .eq('user_id', userId);
          
        if (patientError) {
          // Main user approval succeeded, continue
        }
      } else if (role === 'doctor') {
        const doctorUpdateData = { 
          verification_status: 'verified',
          verified_by: user.id,
          verified_at: new Date().toISOString()
        };
        
        const { error: doctorError } = await supabaseAdmin
          .from('doctor_profiles')
          .update(doctorUpdateData)
          .eq('user_id', userId);
          
        if (doctorError) {
          // Main user approval succeeded, continue
        }
      }

      const { data: finalUser, error: finalError } = await supabaseAdmin
        .from('user_profiles')
        .select(`
          *,
          patient_profiles(*),
          doctor_profiles(*)
        `)
        .eq('id', userId)
        .single();
      
      if (finalError) {
        // Final verification query failed, but main approval succeeded
      } else if (finalUser.account_status !== 'active') {
        throw new Error('Final verification failed - approval did not persist');
      }

      res.status(200).json({
        success: true,
        message: `User approved successfully`
      });

    } else if (action === 'reject') {
      // Update user status to suspended
      const { error: profileError } = await supabaseAdmin
        .from('user_profiles')
        .update({ 
          account_status: 'suspended',
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (profileError) {
        throw new Error(`Failed to update user profile: ${profileError.message}`);
      }

      // Update role-specific verification status
      if (role === 'patient') {
        const { error: patientError } = await supabaseAdmin
          .from('patient_profiles')
          .update({ 
            verification_status: 'rejected',
            verified_by: user.id,
            verified_at: new Date().toISOString()
          })
          .eq('user_id', userId);
        
        if (patientError) {
          // Patient profile update failed
        }
      } else if (role === 'doctor') {
        const { error: doctorError } = await supabaseAdmin
          .from('doctor_profiles')
          .update({ 
            verification_status: 'rejected',
            verified_by: user.id,
            verified_at: new Date().toISOString()
          })
          .eq('user_id', userId);
        
        if (doctorError) {
          // Doctor profile update failed
        }
      }

      res.status(200).json({
        success: true,
        message: `User rejected successfully`
      });
    } else {
      res.status(400).json({ error: 'Invalid action' });
    }

  } catch (error) {
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}