import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const diagnosis = {
    database_connectivity: 'unknown',
    authentication: 'unknown',
    reference_data: {},
    user_data: {},
    recommendations: []
  };

  try {
    console.log('🔍 Starting comprehensive database diagnosis...');

    // Test 1: Database connectivity
    try {
      const { error: connectionTest } = await supabase
        .from('user_profiles')
        .select('id')
        .limit(1);
      
      if (connectionTest) {
        diagnosis.database_connectivity = 'failed';
        diagnosis.recommendations.push('❌ Database connection failed - check Supabase configuration');
      } else {
        diagnosis.database_connectivity = 'success';
              }
    } catch (error) {
      diagnosis.database_connectivity = 'error';
      diagnosis.recommendations.push(`❌ Database connection error: ${error.message}`);
    }

    // Test 2: Check reference data
    const tables = ['hospitals', 'blood_groups', 'qualifications'];
    for (const table of tables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(5);
        
        if (error) {
          diagnosis.reference_data[table] = { status: 'error', error: error.message, count: 0 };
        } else {
          diagnosis.reference_data[table] = { 
            status: 'success', 
            count: data?.length || 0,
            sample: data?.[0] || null
          };
        }
      } catch (error) {
        diagnosis.reference_data[table] = { status: 'exception', error: error.message, count: 0 };
      }
    }

    // Test 3: Check user data
    const userTables = ['user_profiles', 'patient_profiles', 'doctor_profiles'];
    for (const table of userTables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(3);
        
        if (error) {
          diagnosis.user_data[table] = { status: 'error', error: error.message, count: 0 };
        } else {
          diagnosis.user_data[table] = { 
            status: 'success', 
            count: data?.length || 0,
            sample: data?.[0] || null
          };
        }
      } catch (error) {
        diagnosis.user_data[table] = { status: 'exception', error: error.message, count: 0 };
      }
    }

    // Test 4: Authentication test
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      diagnosis.authentication = user ? 'authenticated' : 'anonymous';
    } catch (error) {
      diagnosis.authentication = 'error';
    }

    // Generate recommendations
    const hospitalCount = diagnosis.reference_data.hospitals?.count || 0;
    const bloodGroupCount = diagnosis.reference_data.blood_groups?.count || 0;
    const qualificationCount = diagnosis.reference_data.qualifications?.count || 0;
    const userCount = diagnosis.user_data.user_profiles?.count || 0;

    if (hospitalCount === 0) {
      diagnosis.recommendations.push('🏥 No hospitals found - you need to create at least one hospital in the database');
    }

    if (bloodGroupCount === 0) {
      diagnosis.recommendations.push('🩸 No blood groups found - you need to add blood group reference data');
    }

    if (qualificationCount === 0) {
      diagnosis.recommendations.push('🎓 No qualifications found - you need to add qualification reference data');
    }

    if (userCount === 0) {
      diagnosis.recommendations.push('👥 No users found - this explains why the admin dashboard shows zero values');
    }

    // Provide solutions
    if (hospitalCount === 0 || bloodGroupCount === 0 || qualificationCount === 0) {
      diagnosis.recommendations.push('💡 SOLUTION 1: Manually add reference data through Supabase dashboard');
      diagnosis.recommendations.push('💡 SOLUTION 2: Disable RLS temporarily and run seeding script');
      diagnosis.recommendations.push('💡 SOLUTION 3: Create the data through SQL queries in Supabase SQL editor');
    }

    if (userCount === 0 && hospitalCount > 0) {
      diagnosis.recommendations.push('✨ Once reference data exists, you can create users via the "Add User" tab');
    }

    // SQL commands for manual setup
    const sqlCommands = [];
    
    if (hospitalCount === 0) {
      sqlCommands.push(`-- Create hospitals
INSERT INTO hospitals (name, hospital_code) VALUES 
('AI4NEURO Demo Hospital', 'DEMO'),
('Central Medical Center', 'CMC');`);
    }

    if (bloodGroupCount === 0) {
      sqlCommands.push(`-- Create blood groups
INSERT INTO blood_groups (blood_type, description) VALUES 
('A+', 'A Positive'), ('A-', 'A Negative'),
('B+', 'B Positive'), ('B-', 'B Negative'),
('AB+', 'AB Positive'), ('AB-', 'AB Negative'),
('O+', 'O Positive'), ('O-', 'O Negative');`);
    }

    if (qualificationCount === 0) {
      sqlCommands.push(`-- Create qualifications
INSERT INTO qualifications (qualification_name, description) VALUES 
('MBBS', 'Bachelor of Medicine and Bachelor of Surgery'),
('MD', 'Doctor of Medicine'),
('MS', 'Master of Surgery');`);
    }

    return res.status(200).json({
      success: true,
      message: 'Database diagnosis completed',
      diagnosis,
      summary: {
        overall_status: userCount > 0 ? 'healthy' : 'needs_setup',
        missing_reference_data: hospitalCount === 0 || bloodGroupCount === 0 || qualificationCount === 0,
        missing_user_data: userCount === 0,
        admin_dashboard_will_show_zeros: userCount === 0
      },
      sql_commands: sqlCommands.length > 0 ? sqlCommands.join('\n\n') : 'No SQL commands needed - database has reference data',
      next_steps: [
        '1. If missing reference data: Run the SQL commands in Supabase SQL editor',
        '2. Once reference data exists: Use "Add User" tab to create users',
        '3. Refresh admin dashboard to see the new data',
        '4. The zeros in dashboard will disappear once users are created'
      ]
    });

  } catch (error) {
        return res.status(500).json({
      success: false,
      error: 'Diagnosis failed',
      details: error.message,
      diagnosis
    });
  }
}