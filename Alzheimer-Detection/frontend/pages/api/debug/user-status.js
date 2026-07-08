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
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }

    // Get user data directly from database
    const { data: user, error: userError } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError) {
      return res.status(404).json({ error: `User not found: ${userError.message}` });
    }

    // Also get from auth table
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);

    res.status(200).json({
      success: true,
      data: {
        userProfile: user,
        authUser: authUser?.user || null,
        timestamp: new Date().toISOString()
      },
      errors: {
        user: userError,
        auth: authError
      }
    });

  } catch (error) {
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}