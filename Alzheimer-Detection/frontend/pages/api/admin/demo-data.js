// Demo data API for testing admin dashboard
export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Return mock data for testing
  const mockData = {
    success: true,
    data: {
      allUsers: [
        {
          id: '1',
          full_name: 'John Doe',
          email: 'john.doe@hospital.com',
          role: 'patient',
          account_status: 'active',
          phone: '+1-555-0123',
          unique_identifier: 'HSP-PAT-1001',
          created_at: new Date().toISOString()
        },
        {
          id: '2',
          full_name: 'Dr. Sarah Smith',
          email: 'dr.smith@hospital.com',
          role: 'doctor',
          account_status: 'active',
          phone: '+1-555-0124',
          unique_identifier: 'HSP-DOC-2001',
          created_at: new Date().toISOString()
        },
        {
          id: '3',
          full_name: 'Jane Wilson',
          email: 'jane.wilson@hospital.com',
          role: 'patient',
          account_status: 'pending',
          phone: '+1-555-0125',
          unique_identifier: 'HSP-PAT-1002',
          created_at: new Date().toISOString()
        }
      ],
      pendingUsers: [
        {
          id: '3',
          full_name: 'Jane Wilson',
          email: 'jane.wilson@hospital.com',
          role: 'patient',
          account_status: 'pending',
          phone: '+1-555-0125',
          unique_identifier: 'HSP-PAT-1002',
          created_at: new Date().toISOString()
        }
      ],
      patients: [
        {
          id: '1',
          full_name: 'John Doe',
          email: 'john.doe@hospital.com',
          role: 'patient',
          account_status: 'active',
          phone: '+1-555-0123',
          unique_identifier: 'HSP-PAT-1001',
          created_at: new Date().toISOString()
        }
      ],
      doctors: [
        {
          id: '2',
          full_name: 'Dr. Sarah Smith',
          email: 'dr.smith@hospital.com',
          role: 'doctor',
          account_status: 'active',
          phone: '+1-555-0124',
          unique_identifier: 'HSP-DOC-2001',
          created_at: new Date().toISOString(),
          doctor_profiles: [{
            medical_license: 'MD-12345',
            specialization: 'Neurology',
            experience_years: 10,
            patient_count: 25
          }]
        }
      ],
      stats: {
        totalUsers: 3,
        pendingPatients: 1,
        pendingDoctors: 0,
        activePatients: 1,
        activeDoctors: 1,
        unassignedPatients: 0
      },
      hospitalId: 'demo-hospital-id',
      adminInfo: {
        id: 'demo-admin-id',
        email: 'admin@hospital.com',
        name: 'Demo Admin',
        role: 'admin',
        hospitalId: 'demo-hospital-id'
      }
    },
    message: 'Demo data loaded successfully',
    mode: 'demo'
  };

  res.status(200).json(mockData);
}