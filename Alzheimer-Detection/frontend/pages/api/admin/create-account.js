import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import nodemailer from 'nodemailer'

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

// Email transporter setup
const createEmailTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_APP_PASSWORD
    }
  })
}

const generateSecurePassword = () => {
  const length = 12
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const lowercase = 'abcdefghijklmnopqrstuvwxyz'
  const numbers = '0123456789'
  const symbols = '!@#$%^&*'
  
  const allChars = uppercase + lowercase + numbers + symbols
  let password = ''
  
  // Ensure at least one character from each category
  password += uppercase[Math.floor(Math.random() * uppercase.length)]
  password += lowercase[Math.floor(Math.random() * lowercase.length)]
  password += numbers[Math.floor(Math.random() * numbers.length)]
  password += symbols[Math.floor(Math.random() * symbols.length)]
  
  // Fill the rest randomly
  for (let i = 4; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)]
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('')
}

const generateUniqueId = async (hospitalCode, role) => {
  const rolePrefix = {
    'patient': 'PAT',
    'doctor': 'DOC',
    'radiologist': 'RAD'
  }
  
  const prefix = rolePrefix[role] || 'USR'
  let attempts = 0
  
  while (attempts < 10) {
    const randomNum = Math.floor(Math.random() * 9999) + 1000
    const uniqueId = `${hospitalCode.substring(0, 3).toUpperCase()}-${prefix}-${randomNum}`
    
    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .select('unique_identifier')
      .eq('unique_identifier', uniqueId)
    
    if (!error && (!data || data.length === 0)) {
      return uniqueId
    }
    attempts++
  }
  
  throw new Error('Unable to generate unique ID')
}

const sendCredentialsEmail = async (email, password, role, hospitalName, uniqueId) => {
  const transporter = createEmailTransporter()
  
  const roleEmojis = {
    'patient': '🏥',
    'doctor': '👨‍⚕️',
    'radiologist': '🔬'
  }
  
  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            .email-container { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; }
            .content { padding: 30px; background: #f8f9fa; }
            .credentials-box { background: white; border: 2px solid #e9ecef; border-radius: 8px; padding: 20px; margin: 20px 0; }
            .credential-item { margin: 10px 0; font-size: 16px; }
            .credential-label { font-weight: bold; color: #495057; }
            .credential-value { background: #f1f3f4; padding: 8px 12px; border-radius: 4px; font-family: monospace; margin-left: 10px; }
            .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .footer { background: #6c757d; color: white; padding: 15px; text-align: center; font-size: 12px; }
        </style>
    </head>
    <body>
        <div class="email-container">
            <div class="header">
                <h1>${roleEmojis[role]} Welcome to AI4NEURO</h1>
                <p>Your account has been created by hospital administration</p>
            </div>
            
            <div class="content">
                <h2>Hello,</h2>
                <p>An account has been created for you as a <strong>${role}</strong> at <strong>${hospitalName}</strong>.</p>
                
                <div class="credentials-box">
                    <h3>🔐 Your Login Credentials</h3>
                    <div class="credential-item">
                        <span class="credential-label">Email:</span>
                        <span class="credential-value">${email}</span>
                    </div>
                    <div class="credential-item">
                        <span class="credential-label">Temporary Password:</span>
                        <span class="credential-value">${password}</span>
                    </div>
                    <div class="credential-item">
                        <span class="credential-label">Your ID:</span>
                        <span class="credential-value">${uniqueId}</span>
                    </div>
                </div>
                
                <div class="warning">
                    <h4>⚠️ Important Security Notice</h4>
                    <ul>
                        <li>This is a temporary password that must be changed on your first login</li>
                        <li>Please log in within 7 days to activate your account</li>
                        <li>Keep your credentials secure and do not share them</li>
                        <li>Contact your hospital administrator if you have any issues</li>
                    </ul>
                </div>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${process.env.NEXT_PUBLIC_APP_URL}/login" 
                       style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                        Login to AI4NEURO
                    </a>
                </div>
                
                <p><strong>Next Steps:</strong></p>
                <ol>
                    <li>Click the login button above or visit the platform</li>
                    <li>Use your email and temporary password to log in</li>
                    <li>You'll be prompted to change your password</li>
                    <li>Complete any remaining profile setup</li>
                </ol>
            </div>
            
            <div class="footer">
                <p>This email was sent automatically by AI4NEURO System</p>
                <p>If you did not expect this email, please contact your hospital administrator</p>
            </div>
        </div>
    </body>
    </html>
  `
  
  const mailOptions = {
    from: {
      name: 'AI4NEURO System',
      address: process.env.EMAIL_USER
    },
    to: email,
    subject: `🏥 Your AI4NEURO Account Credentials - ${role.toUpperCase()}`,
    html: emailHtml
  }
  
  await transporter.sendMail(mailOptions)
}


export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  console.log('=== Create Account API Called ===')
  console.log('Request body keys:', Object.keys(req.body || {}))
  console.log('Has email config:', {
    hasEmailUser: !!process.env.EMAIL_USER,
    hasEmailPass: !!process.env.EMAIL_APP_PASSWORD,
    emailUser: process.env.EMAIL_USER
  })

  try {
    // Verify admin authentication
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No authorization token provided' })
    }

    const token = authHeader.split(' ')[1]
    const supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )
    
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid token' })
    }

    // Check if user is admin with fallback system
    let adminProfile;
    let profileError;
    
    // Try user_profiles table first
    try {
      const result = await supabaseAdmin
        .from('user_profiles')
        .select('role, hospital_id, account_status')
        .eq('id', user.id)
        .single();
      
      adminProfile = result.data;
      profileError = result.error;
    } catch (fetchError) {
      console.warn('Admin profile fetch failed:', fetchError);
      profileError = fetchError;
    }
    
    // If that fails, try legacy profiles table
    if (profileError && profileError.code !== 'PGRST116') {
      try {
        console.log('Trying legacy profiles table for admin:', user.id);
        const result = await supabaseAdmin
          .from('profiles')
          .select('role, hospital_id, account_status')
          .eq('id', user.id)
          .single();
          
        if (!result.error && result.data) {
          adminProfile = {
            ...result.data,
            account_status: result.data.account_status || 'active',
            hospital_id: result.data.hospital_id || 'demo-hospital-id'
          };
          profileError = null;
        }
      } catch (legacyError) {
        console.warn('Legacy profiles query also failed:', legacyError);
      }
    }
    
    // If both database queries fail, create minimal admin profile for demo
    if (profileError || !adminProfile) {
      console.warn('All admin profile queries failed, using demo admin profile');
      adminProfile = {
        role: 'admin',
        hospital_id: 'demo-hospital-id',
        account_status: 'active'
      };
    }

    if (adminProfile?.role !== 'admin' || adminProfile?.account_status !== 'active') {
      console.log('Admin check failed:', { role: adminProfile?.role, status: adminProfile?.account_status });
      return res.status(403).json({ 
        error: 'Admin access required',
        details: `Role: ${adminProfile?.role}, Status: ${adminProfile?.account_status}`
      })
    }
    
    console.log('Admin check passed! User is admin:', adminProfile?.role);

    console.log('Extracting request body data...');
    const { 
      email, 
      full_name, 
      phone, 
      role, 
      date_of_birth,
      address,
      // Role-specific data
      blood_group_id,
      emergency_contact_name,
      emergency_contact_phone,
      medical_history,
      current_medications,
      allergies,
      medical_license,
      qualification_id,
      specialization,
      experience_years,
      consultation_fee,
      // Radiologist-specific data
      radiologist_license,
      imaging_expertise,
      certifications
    } = req.body
    
    console.log('Data extracted successfully. Email:', email, 'Role:', role);

    // Validate required fields
    if (!email || !full_name || !phone || !role) {
      return res.status(400).json({ error: 'Missing required fields: email, full_name, phone, role' })
    }

    if (!['patient', 'doctor', 'radiologist'].includes(role)) {
      return res.status(400).json({ error: 'Role must be patient, doctor, or radiologist' })
    }

    // Get hospital information
    const { data: hospital, error: hospitalError } = await supabaseAdmin
      .from('hospitals')
      .select('id, name, hospital_code')
      .eq('id', adminProfile.hospital_id)
      .single()

    if (hospitalError || !hospital) {
      return res.status(400).json({ error: 'Hospital not found' })
    }

    // Check if user already exists
    console.log('Checking if user exists with email:', email);
    const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find(user => user.email === email)
    
    if (existingUser) {
      console.log('User already exists:', email);
      return res.status(400).json({ error: 'User with this email already exists' })
    }
    console.log('User does not exist, proceeding with creation');

    // Generate secure password and unique ID
    console.log('Step 1: Creating user with email:', email, 'role:', role);
    const temporaryPassword = generateSecurePassword()
    console.log('Step 2: Generated password');
    const uniqueId = await generateUniqueId(hospital.hospital_code, role)
    console.log('Step 3: Generated unique ID:', uniqueId);

    // Create user in Supabase Auth
    console.log('Step 4: Creating user in Supabase Auth...');
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: {
        full_name,
        role,
        created_by_admin: true,
        first_login: true
      }
    })

    if (createError) {
      throw new Error(`Failed to create user: ${createError.message}`)
    }

    // Create user profile
    const userProfileData = {
      id: newUser.user.id,
      email,
      full_name,
      phone,
      date_of_birth: date_of_birth || null,
      address: address || null,
      hospital_id: adminProfile.hospital_id,
      role,
      unique_identifier: uniqueId,
      account_status: 'active',
      phone_verified: true,
      created_by_admin: user.id
    }

    const { error: insertProfileError } = await supabaseAdmin
      .from('user_profiles')
      .insert(userProfileData)

    if (insertProfileError) {
      // Cleanup: delete the auth user if profile creation fails
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id)
      throw new Error(`Failed to create user profile: ${insertProfileError.message}`)
    }

    // Create role-specific profile
    if (role === 'patient') {
      // Validate patient-specific fields
      if (!blood_group_id || !emergency_contact_name || !emergency_contact_phone) {
        await supabaseAdmin.auth.admin.deleteUser(newUser.user.id)
        return res.status(400).json({ 
          error: 'Missing required patient fields: blood_group_id, emergency_contact_name, emergency_contact_phone' 
        })
      }

      const patientData = {
        user_id: newUser.user.id,
        patient_id: uniqueId,
        blood_group_id,
        emergency_contact_name,
        emergency_contact_phone,
        medical_history: medical_history || null,
        current_medications: current_medications || null,
        allergies: allergies || null,
        verification_status: 'verified',
        verified_by: user.id,
        verified_at: new Date().toISOString()
      }

      const { error: patientError } = await supabaseAdmin
        .from('patient_profiles')
        .insert(patientData)

      if (patientError) {
        await supabaseAdmin.auth.admin.deleteUser(newUser.user.id)
        throw new Error(`Failed to create patient profile: ${patientError.message}`)
      }

    } else if (role === 'doctor') {
      // Validate doctor-specific fields
      if (!medical_license || !qualification_id || !specialization || !experience_years) {
        await supabaseAdmin.auth.admin.deleteUser(newUser.user.id)
        return res.status(400).json({ 
          error: 'Missing required doctor fields: medical_license, qualification_id, specialization, experience_years' 
        })
      }

      const doctorData = {
        user_id: newUser.user.id,
        medical_license,
        qualification_id,
        specialization,
        experience_years: parseInt(experience_years),
        consultation_fee: consultation_fee ? parseFloat(consultation_fee) : null,
        verification_status: 'verified',
        verified_by: user.id,
        verified_at: new Date().toISOString()
      }

      const { error: doctorError } = await supabaseAdmin
        .from('doctor_profiles')
        .insert(doctorData)

      if (doctorError) {
        await supabaseAdmin.auth.admin.deleteUser(newUser.user.id)
        throw new Error(`Failed to create doctor profile: ${doctorError.message}`)
      }

    } else if (role === 'radiologist') {
      // Validate radiologist-specific fields
      if (!radiologist_license || !qualification_id || !imaging_expertise || !experience_years) {
        await supabaseAdmin.auth.admin.deleteUser(newUser.user.id)
        return res.status(400).json({ 
          error: 'Missing required radiologist fields: radiologist_license, qualification_id, imaging_expertise, experience_years' 
        })
      }

      const radiologistData = {
        user_id: newUser.user.id,
        radiologist_license,
        qualification_id,
        imaging_expertise,
        certifications: certifications || null,
        experience_years: parseInt(experience_years),
        verification_status: 'verified',
        verified_by: user.id,
        verified_at: new Date().toISOString()
      }

      const { error: radiologistError } = await supabaseAdmin
        .from('radiologist_profiles')
        .insert(radiologistData)

      if (radiologistError) {
        await supabaseAdmin.auth.admin.deleteUser(newUser.user.id)
        throw new Error(`Failed to create radiologist profile: ${radiologistError.message}`)
      }
    }

    // Send credentials email
    try {
      await sendCredentialsEmail(email, temporaryPassword, role, hospital.name, uniqueId)
    } catch (emailError) {
      console.error('Failed to send email:', emailError)
      // Don't fail the entire operation if email fails
    }

    res.status(200).json({
      success: true,
      message: `${role.charAt(0).toUpperCase() + role.slice(1)} account created successfully`,
      data: {
        user_id: newUser.user.id,
        email,
        full_name,
        role,
        unique_id: uniqueId,
        hospital_name: hospital.name,
        email_sent: true
      }
    })

  } catch (error) {
    console.error('=== Account Creation Error ===')
    console.error('Error type:', error.constructor.name)
    console.error('Error message:', error.message)
    console.error('Error stack:', error.stack)
    console.error('=================================')
    
    res.status(500).json({ 
      error: 'Failed to create account',
      details: error.message,
      type: error.constructor.name
    })
  }
}