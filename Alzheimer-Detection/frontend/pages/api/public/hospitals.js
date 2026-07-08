import { createClient } from '@supabase/supabase-js'

// Create Supabase client with service role for public data
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
    // Fetch public data that users need for profile completion
    const [hospitalsRes, bloodGroupsRes, qualificationsRes] = await Promise.all([
      supabaseAdmin.from('hospitals').select('*').order('name'),
      supabaseAdmin.from('blood_groups').select('*').order('blood_type'),
      supabaseAdmin.from('qualifications').select('*').order('qualification_name')
    ]);

    res.status(200).json({
      success: true,
      data: {
        hospitals: hospitalsRes.data || [],
        bloodGroups: bloodGroupsRes.data || [],
        qualifications: qualificationsRes.data || []
      },
      errors: {
        hospitals: hospitalsRes.error,
        bloodGroups: bloodGroupsRes.error,
        qualifications: qualificationsRes.error
      }
    });

  } catch (error) {
    console.error('Public hospitals API error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}