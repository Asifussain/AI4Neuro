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
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const debugInfo = {
    timestamp: new Date().toISOString(),
    environment: {
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      hasEmailUser: !!process.env.EMAIL_USER,
      hasEmailPassword: !!process.env.EMAIL_APP_PASSWORD,
      emailUser: process.env.EMAIL_USER || 'NOT_SET'
    },
    tests: {}
  }

  // Test 1: Supabase connection
  try {
    const { data, error } = await supabaseAdmin.from('user_profiles').select('count').limit(1)
    debugInfo.tests.supabaseConnection = { success: true, error: null }
  } catch (error) {
    debugInfo.tests.supabaseConnection = { success: false, error: error.message }
  }

  // Test 2: Table existence
  try {
    const tables = ['user_profiles', 'hospitals', 'patient_profiles', 'doctor_profiles']
    for (const table of tables) {
      try {
        const { data, error } = await supabaseAdmin.from(table).select('*').limit(1)
        debugInfo.tests[`table_${table}`] = { exists: true, error: null }
      } catch (err) {
        debugInfo.tests[`table_${table}`] = { exists: false, error: err.message }
      }
    }
  } catch (error) {
    debugInfo.tests.tableCheck = { success: false, error: error.message }
  }

  // Test 3: Email configuration
  if (process.env.EMAIL_USER && process.env.EMAIL_APP_PASSWORD) {
    try {
      const nodemailer = require('nodemailer')
      const transporter = nodemailer.createTransporter({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_APP_PASSWORD
        }
      })
      
      await transporter.verify()
      debugInfo.tests.emailConnection = { success: true, error: null }
    } catch (error) {
      debugInfo.tests.emailConnection = { success: false, error: error.message }
    }
  } else {
    debugInfo.tests.emailConnection = { success: false, error: 'Email credentials not configured' }
  }

  res.status(200).json(debugInfo)
}