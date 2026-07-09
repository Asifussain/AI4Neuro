import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { createClient } from '@/lib/supabase/server';
import nodemailer from 'nodemailer';

// Generate random password
function generatePassword(length = 12): string {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

// Generate unique codes
function generateCode(prefix: string): string {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0');
  return `${prefix}${timestamp}${random}`;
}

export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user is admin
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { email, full_name, phone, role, roleData } = body;

    // Validate required fields
    if (!email || !full_name || !role) {
      return NextResponse.json(
        { error: 'Missing required fields: email, full_name, role' },
        { status: 400 }
      );
    }

    // Validate role
    if (!['patient', 'doctor', 'radiologist', 'admin'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    // Generate temporary password
    const temporaryPassword = generatePassword(12);

    // Use service role client to create user (bypasses RLS)
    const supabaseAdmin = createServiceRoleClient();

    // Create auth user
    const { data: newUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: {
        full_name,
        role,
        first_login: true,
      },
    });

    if (authError || !newUser.user) {
      console.error('Auth creation error:', authError);
      return NextResponse.json(
        { error: authError?.message || 'Failed to create user' },
        { status: 500 }
      );
    }

    // Create user profile
    const { error: profileError } = await supabaseAdmin.from('user_profiles').insert({
      id: newUser.user.id,
      full_name,
      email,
      role,
      phone: phone || null,
      account_status: 'active',
    });

    if (profileError) {
      console.error('Profile creation error:', profileError);
      // Rollback: delete auth user
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      return NextResponse.json(
        { error: 'Failed to create user profile' },
        { status: 500 }
      );
    }

    // Create role-specific profile
    let roleProfileError = null;

    if (role === 'patient') {
      const patientCode = generateCode('PT');
      const { error } = await supabaseAdmin.from('patient_profiles').insert({
        user_id: newUser.user.id,
        patient_code: patientCode,
        date_of_birth: roleData?.date_of_birth,
        age: roleData?.age,
        gender: roleData?.gender,
        blood_group_id: roleData?.blood_group_id,
        address: roleData?.address,
        city: roleData?.city,
        state: roleData?.state,
        pincode: roleData?.pincode,
        emergency_contact_name: roleData?.emergency_contact_name,
        emergency_contact_phone: roleData?.emergency_contact_phone,
        medical_history: roleData?.medical_history,
      });
      roleProfileError = error;
    } else if (role === 'doctor') {
      const doctorCode = generateCode('DR');
      const { error } = await supabaseAdmin.from('doctor_profiles').insert({
        user_id: newUser.user.id,
        doctor_code: doctorCode,
        specialization: roleData?.specialization,
        qualification_id: roleData?.qualification_id,
        license_number: roleData?.license_number,
        hospital_id: roleData?.hospital_id,
        experience_years: roleData?.experience_years,
      });
      roleProfileError = error;
    } else if (role === 'radiologist') {
      const radiologistCode = generateCode('RD');
      const { error } = await supabaseAdmin.from('radiologist_profiles').insert({
        user_id: newUser.user.id,
        radiologist_code: radiologistCode,
        specialization: roleData?.specialization,
        qualification_id: roleData?.qualification_id,
        license_number: roleData?.license_number,
        hospital_id: roleData?.hospital_id,
        certification: roleData?.certification,
      });
      roleProfileError = error;
    } else if (role === 'admin') {
      const adminCode = generateCode('AD');
      const { error } = await supabaseAdmin.from('admin_profiles').insert({
        user_id: newUser.user.id,
        admin_code: adminCode,
        hospital_id: roleData?.hospital_id,
        permissions: roleData?.permissions || {},
      });
      roleProfileError = error;
    }

    if (roleProfileError) {
      console.error('Role profile creation error:', roleProfileError);
      // Rollback: delete user profile and auth user
      await supabaseAdmin.from('user_profiles').delete().eq('id', newUser.user.id);
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      return NextResponse.json(
        { error: `Failed to create ${role} profile` },
        { status: 500 }
      );
    }

    // Send email with credentials
    let emailSent = false;
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.EMAIL_PORT || '587'),
        secure: false,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD,
        },
      });

      const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);

      await transporter.sendMail({
        from: `"NeuroXiva Platform" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Welcome to NeuroXiva — Your Login Credentials',
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0a0f1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0f1a;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background-color:#111827;border-radius:16px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#7c3aed,#14b8a6);padding:32px 40px;">
          <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">NeuroXiva</h1>
          <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">AI-Powered MRI Analysis Platform</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px 40px;">
          <h2 style="margin:0 0 8px;color:#f1f5f9;font-size:20px;">Welcome, ${full_name}!</h2>
          <p style="margin:0 0 24px;color:#94a3b8;font-size:14px;line-height:1.6;">
            Your <strong style="color:#e2e8f0;">${roleLabel}</strong> account has been created on NeuroXiva. Below are your login credentials.
          </p>
          <!-- Credentials Box -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#1e293b;border-radius:12px;border:1px solid rgba(255,255,255,0.06);">
            <tr><td style="padding:24px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:8px 0;color:#94a3b8;font-size:13px;width:100px;">Email</td>
                  <td style="padding:8px 0;color:#f1f5f9;font-size:14px;font-family:monospace;font-weight:600;">${email}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;border-top:1px solid rgba(255,255,255,0.05);color:#94a3b8;font-size:13px;">Password</td>
                  <td style="padding:8px 0;border-top:1px solid rgba(255,255,255,0.05);color:#14b8a6;font-size:15px;font-family:monospace;font-weight:700;letter-spacing:0.5px;">${temporaryPassword}</td>
                </tr>
              </table>
            </td></tr>
          </table>
          <!-- Warning -->
          <div style="margin:24px 0;padding:16px;background-color:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.2);border-radius:10px;">
            <p style="margin:0;color:#fbbf24;font-size:13px;font-weight:600;">&#9888; Important Security Notice</p>
            <p style="margin:6px 0 0;color:#d97706;font-size:13px;line-height:1.5;">
              Please change your password immediately after your first login. You will be automatically prompted to set a new password.
            </p>
          </div>
          <!-- CTA -->
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td align="center" style="padding:8px 0 0;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#7c3aed,#14b8a6);color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:10px;">
                Login to NeuroXiva
              </a>
            </td></tr>
          </table>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:24px 40px;border-top:1px solid rgba(255,255,255,0.05);">
          <p style="margin:0;color:#475569;font-size:11px;text-align:center;line-height:1.5;">
            This is an automated message from NeuroXiva. Do not reply to this email.<br/>
            &copy; 2026 NeuroXiva. All rights reserved.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
      });
      emailSent = true;
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      // Don't fail the request — user was created successfully
    }

    return NextResponse.json({
      success: true,
      message: emailSent
        ? 'User created successfully. Credentials sent via email.'
        : 'User created successfully. Email delivery failed — please share credentials manually.',
      emailSent,
      user: {
        id: newUser.user.id,
        email,
        full_name,
        role,
        temporaryPassword,
      },
    });
  } catch (error: any) {
    console.error('Create user error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
