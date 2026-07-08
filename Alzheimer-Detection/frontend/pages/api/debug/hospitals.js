import { createClient } from '@supabase/supabase-js'

// Create Supabase client with service role for debugging
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
        // Try to fetch hospitals with service role
    const { data: hospitals, error: hospitalError } = await supabaseAdmin
      .from('hospitals')
      .select('*')
      .order('name');

        if (hospitalError) {
      console.error('Hospital fetch error:', hospitalError);
    } else {
          }

    // Also try blood groups and qualifications
    const { data: bloodGroups, error: bloodError } = await supabaseAdmin
      .from('blood_groups')
      .select('*')
      .order('blood_type');

    const { data: qualifications, error: qualError } = await supabaseAdmin
      .from('qualifications')
      .select('*')
      .order('qualification_name');

    res.status(200).json({
      success: true,
      data: {
        hospitals: hospitals || [],
        bloodGroups: bloodGroups || [],
        qualifications: qualifications || []
      },
      errors: {
        hospital: hospitalError,
        bloodGroup: bloodError,
        qualification: qualError
      },
      counts: {
        hospitals: hospitals?.length || 0,
        bloodGroups: bloodGroups?.length || 0,
        qualifications: qualifications?.length || 0
      }
    });

  } catch (error) {
    console.error('Debug hospitals API error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}