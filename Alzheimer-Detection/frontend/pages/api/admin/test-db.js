import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🔍 Testing database connectivity...');

    // Test 1: Check if we can connect to database
    const { data: testConnection, error: connectionError } = await supabase
      .from('user_profiles')
      .select('count', { count: 'exact', head: true });

    if (connectionError) {
            return res.status(500).json({
        success: false,
        error: 'Database connection failed',
        details: connectionError.message
      });
    }

            // Test 2: Get sample user data
    const { data: sampleUsers, error: usersError } = await supabase
      .from('user_profiles')
      .select('id, role, account_status, full_name, email, hospital_id, created_at')
      .limit(10);

    if (usersError) {
          } else {
            if (sampleUsers && sampleUsers.length > 0) {
              }
    }

    // Test 3: Check hospitals table
    const { data: hospitals, error: hospitalError } = await supabase
      .from('hospitals')
      .select('id, name, hospital_code')
      .limit(5);

    if (hospitalError) {
          } else {
          }

    // Test 4: Check blood groups and qualifications
    const [bloodGroupsRes, qualificationsRes] = await Promise.all([
      supabase.from('blood_groups').select('count', { count: 'exact', head: true }),
      supabase.from('qualifications').select('count', { count: 'exact', head: true })
    ]);

    console.log('🩸 Blood groups count:', bloodGroupsRes.data?.count || 0);
        return res.status(200).json({
      success: true,
      message: 'Database connectivity test completed',
      results: {
        userProfilesCount: testConnection?.count || 0,
        sampleUsersFound: sampleUsers?.length || 0,
        hospitalsCount: hospitals?.length || 0,
        bloodGroupsCount: bloodGroupsRes.data?.count || 0,
        qualificationsCount: qualificationsRes.data?.count || 0,
        sampleUser: sampleUsers?.[0] || null,
        hospitals: hospitals || []
      }
    });

  } catch (error) {
        return res.status(500).json({
      success: false,
      error: 'Test failed',
      details: error.message
    });
  }
}