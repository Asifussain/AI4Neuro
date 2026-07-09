export interface User {
  id: string;
  name: string;
  email: string;
  role: 'patient' | 'doctor' | 'radiologist' | 'admin';
  avatar?: string;
}

export interface MRISession {
  id: string;
  sessionCode: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  radiologistId?: string;
  radiologistName?: string;
  scanDate: string;
  status: 'completed' | 'processing' | 'pending' | 'failed';
  prediction: 'CN' | 'MCI' | 'AD' | null;
  probabilities: {
    CN: number;
    MCI: number;
    AD: number;
  } | null;
  scannerInfo?: {
    manufacturer: string;
    model: string;
    fieldStrength: string;
    sequenceType: string;
  };
  reports?: {
    patient?: string;
    clinician?: string;
    technical?: string;
  };
}

export interface Patient {
  id: string;
  name: string;
  age: number;
  gender: string;
  patientCode: string;
  assignedDoctor: string;
  bloodGroup: string;
  lastScan?: string;
  totalScans: number;
  latestPrediction?: 'CN' | 'MCI' | 'AD';
}

export interface Doctor {
  id: string;
  name: string;
  specialization: string;
  license: string;
  patientsCount: number;
  scansThisMonth: number;
}

// Mock Users
export const mockUsers: User[] = [
  {
    id: 'patient-1',
    name: 'John Doe',
    email: 'john.doe@email.com',
    role: 'patient',
  },
  {
    id: 'doctor-1',
    name: 'Dr. Sarah Mitchell',
    email: 'sarah.mitchell@hospital.com',
    role: 'doctor',
  },
  {
    id: 'radiologist-1',
    name: 'Dr. David Chen',
    email: 'david.chen@hospital.com',
    role: 'radiologist',
  },
  {
    id: 'admin-1',
    name: 'Admin User',
    email: 'admin@hospital.com',
    role: 'admin',
  },
];

// Mock MRI Sessions
export const mockMRISessions: MRISession[] = [
  {
    id: 'session-1',
    sessionCode: 'MRI-2025-001',
    patientId: 'patient-1',
    patientName: 'John Doe',
    doctorId: 'doctor-1',
    doctorName: 'Dr. Sarah Mitchell',
    radiologistId: 'radiologist-1',
    radiologistName: 'Dr. David Chen',
    scanDate: '2025-12-14',
    status: 'completed',
    prediction: 'AD',
    probabilities: {
      CN: 0.10,
      MCI: 0.25,
      AD: 0.65,
    },
    scannerInfo: {
      manufacturer: 'Siemens',
      model: 'MAGNETOM Skyra',
      fieldStrength: '3T',
      sequenceType: 'T1-weighted MPRAGE',
    },
    reports: {
      patient: '/reports/patient-report.html',
      clinician: '/reports/clinician-report.html',
      technical: '/reports/technical-report.html',
    },
  },
  {
    id: 'session-2',
    sessionCode: 'MRI-2025-002',
    patientId: 'patient-2',
    patientName: 'Mary Johnson',
    doctorId: 'doctor-1',
    doctorName: 'Dr. Sarah Mitchell',
    radiologistId: 'radiologist-1',
    radiologistName: 'Dr. David Chen',
    scanDate: '2025-12-12',
    status: 'completed',
    prediction: 'CN',
    probabilities: {
      CN: 0.85,
      MCI: 0.10,
      AD: 0.05,
    },
    scannerInfo: {
      manufacturer: 'GE Healthcare',
      model: 'SIGNA Premier',
      fieldStrength: '3T',
      sequenceType: 'T1-weighted',
    },
    reports: {
      patient: '/reports/patient-report.html',
      clinician: '/reports/clinician-report.html',
      technical: '/reports/technical-report.html',
    },
  },
  {
    id: 'session-3',
    sessionCode: 'MRI-2025-003',
    patientId: 'patient-3',
    patientName: 'Robert Smith',
    doctorId: 'doctor-1',
    doctorName: 'Dr. Sarah Mitchell',
    radiologistId: 'radiologist-1',
    radiologistName: 'Dr. David Chen',
    scanDate: '2025-12-10',
    status: 'completed',
    prediction: 'MCI',
    probabilities: {
      CN: 0.25,
      MCI: 0.60,
      AD: 0.15,
    },
    scannerInfo: {
      manufacturer: 'Philips',
      model: 'Ingenia Elition X',
      fieldStrength: '3T',
      sequenceType: 'T2-weighted',
    },
    reports: {
      patient: '/reports/patient-report.html',
      clinician: '/reports/clinician-report.html',
      technical: '/reports/technical-report.html',
    },
  },
  {
    id: 'session-4',
    sessionCode: 'MRI-2025-004',
    patientId: 'patient-4',
    patientName: 'Emily Davis',
    doctorId: 'doctor-1',
    doctorName: 'Dr. Sarah Mitchell',
    scanDate: '2025-12-14',
    status: 'processing',
    prediction: null,
    probabilities: null,
  },
];

// Mock Patients
export const mockPatients: Patient[] = [
  {
    id: 'patient-1',
    name: 'John Doe',
    age: 68,
    gender: 'Male',
    patientCode: 'NSC-PAT-0001',
    assignedDoctor: 'Dr. Sarah Mitchell',
    bloodGroup: 'O+',
    lastScan: '2025-12-14',
    totalScans: 3,
    latestPrediction: 'AD',
  },
  {
    id: 'patient-2',
    name: 'Mary Johnson',
    age: 62,
    gender: 'Female',
    patientCode: 'NSC-PAT-0002',
    assignedDoctor: 'Dr. Sarah Mitchell',
    bloodGroup: 'A+',
    lastScan: '2025-12-12',
    totalScans: 2,
    latestPrediction: 'CN',
  },
  {
    id: 'patient-3',
    name: 'Robert Smith',
    age: 70,
    gender: 'Male',
    patientCode: 'NSC-PAT-0003',
    assignedDoctor: 'Dr. Sarah Mitchell',
    bloodGroup: 'B+',
    lastScan: '2025-12-10',
    totalScans: 4,
    latestPrediction: 'MCI',
  },
  {
    id: 'patient-4',
    name: 'Emily Davis',
    age: 65,
    gender: 'Female',
    patientCode: 'NSC-PAT-0004',
    assignedDoctor: 'Dr. Sarah Mitchell',
    bloodGroup: 'AB+',
    lastScan: '2025-12-14',
    totalScans: 1,
  },
  {
    id: 'patient-5',
    name: 'Michael Brown',
    age: 72,
    gender: 'Male',
    patientCode: 'NSC-PAT-0005',
    assignedDoctor: 'Dr. Sarah Mitchell',
    bloodGroup: 'O-',
    lastScan: '2025-12-08',
    totalScans: 5,
    latestPrediction: 'AD',
  },
];

// Mock Doctors
export const mockDoctors: Doctor[] = [
  {
    id: 'doctor-1',
    name: 'Dr. Sarah Mitchell',
    specialization: 'Neurology',
    license: 'NRG-12345',
    patientsCount: 15,
    scansThisMonth: 8,
  },
  {
    id: 'doctor-2',
    name: 'Dr. James Wilson',
    specialization: 'Geriatrics',
    license: 'GRT-67890',
    patientsCount: 12,
    scansThisMonth: 5,
  },
];

// Dashboard Statistics
export const mockPatientStats = {
  totalScans: 3,
  lastWeekScans: 2,
  resultDistribution: {
    CN: 0,
    MCI: 1,
    AD: 2,
  },
};

export const mockDoctorStats = {
  totalPatients: 15,
  pendingReviews: 3,
  completedScans: 24,
  thisMonthScans: 8,
  resultDistribution: {
    CN: 8,
    MCI: 6,
    AD: 10,
  },
};

export const mockRadiologistStats = {
  totalScans: 45,
  processingScans: 2,
  completedToday: 3,
  qualityScore: 98.5,
  avgProcessingTime: '4.2 minutes',
};

export const mockAdminStats = {
  totalUsers: 52,
  totalPatients: 35,
  totalDoctors: 8,
  totalRadiologists: 4,
  totalAdmins: 5,
  pendingVerifications: 3,
  scansThisMonth: 45,
};
