import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('=== DEBUGGING DATABASE CONTENTS ===');

    // Check all users in auth.users table
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    console.log('Auth users found:', authUsers?.users?.length || 0);
    
    // Check user_profiles table
    const { data: userProfiles, error: profilesError } = await supabase
      .from('user_profiles')
      .select('*');
    console.log('User profiles found:', userProfiles?.length || 0);
    console.log('User profiles data:', userProfiles);

    // Check legacy profiles table
    const { data: legacyProfiles, error: legacyError } = await supabase
      .from('profiles')
      .select('*');
    console.log('Legacy profiles found:', legacyProfiles?.length || 0);

    return res.status(200).json({
      success: true,
      debug: {
        authUsers: authUsers?.users?.map(u => ({ 
          id: u.id, 
          email: u.email, 
          metadata: u.user_metadata 
        })) || [],
        userProfiles: userProfiles || [],
        legacyProfiles: legacyProfiles || [],
        errors: {
          authError,
          profilesError,
          legacyError
        }
      }
    });

  } catch (error) {
    console.error('Debug API error:', error);
    return res.status(500).json({ 
      error: 'Debug failed',
      details: error.message
    });
  }
}