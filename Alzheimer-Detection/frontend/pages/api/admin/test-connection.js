import { createClient } from '@supabase/supabase-js'

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
  console.log('=== Testing Database Connection ===')
  
  const results = {
    timestamp: new Date().toISOString(),
    environment: {
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      hasEmailUser: !!process.env.EMAIL_USER,
      hasEmailPass: !!process.env.EMAIL_APP_PASSWORD,
      emailUser: process.env.EMAIL_USER
    },
    tests: {}
  }

  // Test basic connection
  try {
    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .select('id, email, role')
      .limit(5)
    
    if (error) {
      results.tests.basicConnection = {
        success: false,
        error: error.message,
        code: error.code
      }
    } else {
      results.tests.basicConnection = {
        success: true,
        userCount: data?.length || 0,
        sampleUsers: data?.map(u => ({ id: u.id.substring(0, 8) + '...', email: u.email, role: u.role }))
      }
    }
  } catch (err) {
    results.tests.basicConnection = {
      success: false,
      error: err.message,
      stack: err.stack
    }
  }

  // Test user creation permissions
  try {
    // Just test if we can read from auth.users (not create)
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1 })
    
    if (error) {
      results.tests.authPermissions = {
        success: false,
        error: error.message
      }
    } else {
      results.tests.authPermissions = {
        success: true,
        message: 'Can access auth admin functions'
      }
    }
  } catch (err) {
    results.tests.authPermissions = {
      success: false,
      error: err.message
    }
  }

  console.log('Test results:', JSON.stringify(results, null, 2))
  res.status(200).json(results)
}