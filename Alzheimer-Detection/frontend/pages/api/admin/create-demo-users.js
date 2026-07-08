import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🎭 Creating demo users using existing APIs...');

    // Get the current session token for API authentication
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No authorization token provided' });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Check if user is admin
    const { data: adminProfile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (adminProfile?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

        // Demo users to create
    const demoUsers = [
      {
        email: 'dr.sarah@demo.com',
        full_name: 'Dr. Sarah Smith',
        phone: '+1-555-0201',
        role: 'doctor',
        medical_license: 'MD-2020-001',
        qualification_id: 1, // Will need to be adjusted based on actual data
        specialization: 'Neurology',
        experience_years: 8,
        consultation_fee: 200
      },
      {
        email: 'dr.mike@demo.com',
        full_name: 'Dr. Michael Johnson',
        phone: '+1-555-0202', 
        role: 'doctor',
        medical_license: 'MD-2019-002',
        qualification_id: 1,
        specialization: 'Neuroscience',
        experience_years: 10,
        consultation_fee: 250
      },
      {
        email: 'patient1@demo.com',
        full_name: 'John Doe',
        phone: '+1-555-0301',
        role: 'patient',
        blood_group_id: 1, // Will need to be adjusted
        emergency_contact_name: 'Jane Doe',
        emergency_contact_phone: '+1-555-0302',
        medical_history: 'No significant medical history',
        allergies: 'None known'
      },
      {
        email: 'patient2@demo.com',
        full_name: 'Alice Wilson',
        phone: '+1-555-0303',
        role: 'patient', 
        blood_group_id: 2,
        emergency_contact_name: 'Bob Wilson',
        emergency_contact_phone: '+1-555-0304',
        medical_history: 'Hypertension',
        current_medications: 'Lisinopril 10mg daily'
      }
    ];

    const results = {
      success: [],
      failed: []
    };

    // Create users one by one using the existing create-account API
    for (const userData of demoUsers) {
      try {
        console.log(`👤 Creating ${userData.role}: ${userData.full_name}`);
        
        const response = await fetch(`${req.headers.host ? `http://${req.headers.host}` : 'http://localhost:3000'}/api/admin/create-account`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(userData)
        });

        const result = await response.json();

        if (response.ok && result.success) {
          results.success.push({
            name: userData.full_name,
            email: userData.email,
            role: userData.role,
            unique_id: result.data?.unique_id
          });
                  } else {
          results.failed.push({
            name: userData.full_name,
            email: userData.email,
            error: result.error || 'Unknown error'
          });
                  }

        // Add a small delay between requests
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        results.failed.push({
          name: userData.full_name,
          email: userData.email,
          error: error.message
        });
              }
    }

    return res.status(200).json({
      success: true,
      message: 'Demo user creation completed',
      results: {
        successful: results.success.length,
        failed: results.failed.length,
        created_users: results.success,
        errors: results.failed
      },
      note: 'Check your admin dashboard to see the new users'
    });

  } catch (error) {
        return res.status(500).json({
      success: false,
      error: 'Demo user creation failed',
      details: error.message
    });
  }
}