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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🌱 Starting database seeding process...');

    // Step 1: Create hospitals (simplified to match schema)
        const { data: hospitals, error: hospitalError } = await supabase
      .from('hospitals')
      .insert([
        {
          name: 'AI4NEURO Demo Hospital',
          hospital_code: 'DEMO'
        },
        {
          name: 'Central Medical Center', 
          hospital_code: 'CMC'
        }
      ])
      .select();

    if (hospitalError) {
            throw new Error(`Hospital creation failed: ${hospitalError.message}`);
    }

    const demoHospital = hospitals[0];
        // Step 2: Create blood groups
    console.log('🩸 Creating blood groups...');
    const { data: bloodGroups, error: bloodGroupError } = await supabase
      .from('blood_groups')
      .insert([
        { blood_type: 'A+', description: 'A Positive' },
        { blood_type: 'A-', description: 'A Negative' },
        { blood_type: 'B+', description: 'B Positive' },
        { blood_type: 'B-', description: 'B Negative' },
        { blood_type: 'AB+', description: 'AB Positive' },
        { blood_type: 'AB-', description: 'AB Negative' },
        { blood_type: 'O+', description: 'O Positive' },
        { blood_type: 'O-', description: 'O Negative' }
      ])
      .select();

    if (bloodGroupError) {
            throw new Error(`Blood group creation failed: ${bloodGroupError.message}`);
    }
        // Step 3: Create qualifications
    console.log('🎓 Creating qualifications...');
    const { data: qualifications, error: qualificationError } = await supabase
      .from('qualifications')
      .insert([
        { qualification_name: 'MBBS', description: 'Bachelor of Medicine and Bachelor of Surgery' },
        { qualification_name: 'MD', description: 'Doctor of Medicine' },
        { qualification_name: 'MS', description: 'Master of Surgery' },
        { qualification_name: 'DM', description: 'Doctor of Medicine (Super Specialty)' },
        { qualification_name: 'MCh', description: 'Master of Chirurgiae (Super Specialty)' },
        { qualification_name: 'PhD', description: 'Doctor of Philosophy' }
      ])
      .select();

    if (qualificationError) {
            throw new Error(`Qualification creation failed: ${qualificationError.message}`);
    }
        // Step 4: Create demo users
        if (adminError) {
          } else {
      // Create admin profile
      await supabase
        .from('user_profiles')
        .insert({
          id: adminUser.user.id,
          email: adminEmail,
          full_name: 'Demo Administrator',
          phone: '+1-555-0100',
          hospital_id: demoHospital.id,
          role: 'admin',
          unique_identifier: 'DEMO-ADM-001',
          account_status: 'active',
          phone_verified: true,
          created_by_admin: null
        });
          }

    // Create sample doctors
    const doctors = [
      {
        email: 'dr.smith@ai4neuro-demo.com',
        full_name: 'Dr. Sarah Smith',
        phone: '+1-555-0201',
        specialization: 'Neurology',
        experience_years: 10,
        medical_license: 'MD-2014-001',
        consultation_fee: 200.00
      },
      {
        email: 'dr.johnson@ai4neuro-demo.com', 
        full_name: 'Dr. Michael Johnson',
        phone: '+1-555-0202',
        specialization: 'Neuroscience',
        experience_years: 8,
        medical_license: 'MD-2016-002',
        consultation_fee: 180.00
      }
    ];

    for (let i = 0; i < doctors.length; i++) {
      const doctor = doctors[i];
      try {
        const { data: doctorUser, error: doctorError } = await supabaseAdmin.auth.admin.createUser({
          email: doctor.email,
          password: 'Doctor123!@#',
          email_confirm: true,
          user_metadata: {
            full_name: doctor.full_name,
            role: 'doctor',
            created_by_system: true
          }
        });

        if (!doctorError) {
          // Create doctor profile
          await supabase.from('user_profiles').insert({
            id: doctorUser.user.id,
            email: doctor.email,
            full_name: doctor.full_name,
            phone: doctor.phone,
            hospital_id: demoHospital.id,
            role: 'doctor',
            unique_identifier: `DEMO-DOC-${String(i + 1).padStart(3, '0')}`,
            account_status: 'active',
            phone_verified: true,
            created_by_admin: adminUser?.user.id
          });

          // Create doctor profile details
          await supabase.from('doctor_profiles').insert({
            user_id: doctorUser.user.id,
            medical_license: doctor.medical_license,
            qualification_id: qualifications[0].id, // MBBS
            specialization: doctor.specialization,
            experience_years: doctor.experience_years,
            consultation_fee: doctor.consultation_fee,
            verification_status: 'verified',
            verified_by: adminUser?.user.id,
            verified_at: new Date().toISOString()
          });

                  }
      } catch (error) {
              }
    }

    // Create sample patients
    const patients = [
      {
        email: 'patient1@example.com',
        full_name: 'John Doe',
        phone: '+1-555-0301',
        blood_group_id: bloodGroups[0].id, // A+
        emergency_contact_name: 'Jane Doe',
        emergency_contact_phone: '+1-555-0302'
      },
      {
        email: 'patient2@example.com',
        full_name: 'Alice Johnson',
        phone: '+1-555-0303',
        blood_group_id: bloodGroups[6].id, // O+
        emergency_contact_name: 'Bob Johnson',
        emergency_contact_phone: '+1-555-0304'
      },
      {
        email: 'patient3@example.com',
        full_name: 'Robert Brown',
        phone: '+1-555-0305',
        blood_group_id: bloodGroups[2].id, // B+
        emergency_contact_name: 'Mary Brown',
        emergency_contact_phone: '+1-555-0306'
      }
    ];

    for (let i = 0; i < patients.length; i++) {
      const patient = patients[i];
      try {
        const { data: patientUser, error: patientError } = await supabaseAdmin.auth.admin.createUser({
          email: patient.email,
          password: 'Patient123!@#',
          email_confirm: true,
          user_metadata: {
            full_name: patient.full_name,
            role: 'patient',
            created_by_system: true
          }
        });

        if (!patientError) {
          // Create patient profile
          await supabase.from('user_profiles').insert({
            id: patientUser.user.id,
            email: patient.email,
            full_name: patient.full_name,
            phone: patient.phone,
            hospital_id: demoHospital.id,
            role: 'patient',
            unique_identifier: `DEMO-PAT-${String(i + 1).padStart(3, '0')}`,
            account_status: 'active',
            phone_verified: true,
            created_by_admin: adminUser?.user.id
          });

          // Create patient profile details
          await supabase.from('patient_profiles').insert({
            user_id: patientUser.user.id,
            patient_id: `DEMO-PAT-${String(i + 1).padStart(3, '0')}`,
            blood_group_id: patient.blood_group_id,
            emergency_contact_name: patient.emergency_contact_name,
            emergency_contact_phone: patient.emergency_contact_phone,
            verification_status: 'verified',
            verified_by: adminUser?.user.id,
            verified_at: new Date().toISOString()
          });

                  }
      } catch (error) {
              }
    }

    // Create a pending user for approval testing
    try {
      const { data: pendingUser, error: pendingError } = await supabaseAdmin.auth.admin.createUser({
        email: 'pending@example.com',
        password: 'Pending123!@#',
        email_confirm: true,
        user_metadata: {
          full_name: 'Pending User',
          role: 'patient',
          created_by_system: true
        }
      });

      if (!pendingError) {
        await supabase.from('user_profiles').insert({
          id: pendingUser.user.id,
          email: 'pending@example.com',
          full_name: 'Pending User',
          phone: '+1-555-0400',
          hospital_id: demoHospital.id,
          role: 'patient',
          unique_identifier: 'DEMO-PAT-PND',
          account_status: 'pending', // This will show in pending approvals
          phone_verified: false,
          created_by_admin: adminUser?.user.id
        });
              }
    } catch (error) {
          }

    console.log('🎉 Database seeding completed successfully!');

    return res.status(200).json({
      success: true,
      message: 'Database seeded successfully',
      data: {
        hospitals_created: hospitals?.length || 0,
        blood_groups_created: bloodGroups?.length || 0,
        qualifications_created: qualifications?.length || 0,
        admin_credentials: {
          email: adminEmail,
          password: 'Admin123!@#',
          note: 'Use these credentials to test the admin dashboard'
        }
      }
    });

  } catch (error) {
        return res.status(500).json({
      success: false,
      error: 'Database seeding failed',
      details: error.message
    });
  }
}