import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../components/AuthProvider';
import Navbar from '../components/Navbar';
import LoadingSpinner from '../components/LoadingSpinner';
import supabase from '../lib/supabaseClient';
import styles from '../styles/CompleteProfile.module.css';

const BLOOD_GROUPS = [
  'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'
];

// Shiny Button Component
const ShinyButton = ({ children, onClick, disabled, variant = 'primary', type = 'button' }) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled}
    className={`${styles.shinyButton} ${styles[variant]} ${disabled ? styles.disabled : ''}`}
  >
    <span className={styles.buttonText}>{children}</span>
    <div className={styles.buttonShine}></div>
  </button>
);

// Shiny Text Component
const ShinyText = ({ children, className = '' }) => (
  <div className={`${styles.shinyText} ${className}`}>
    {children}
    <div className={styles.textShine}></div>
  </div>
);

export default function CompleteProfilePage() {
  const { user, refreshProfile } = useAuth();
  const router = useRouter();
  
  // State Management
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  // Form Data
  const [formData, setFormData] = useState({
    // Step 1: Role Selection
    role: '',
    
    // Step 2: Basic Information
    full_name: '',
    phone: '',
    date_of_birth: '',
    address: '',
    hospital_id: '',
    
    // Step 3: Role-specific Information
    // Patient
    blood_group_id: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    medical_history: '',
    current_medications: '',
    allergies: '',
    preferred_doctor_id: '',
    prescriptionFile: null,
    
    // Doctor
    medical_license: '',
    qualification_id: '',
    specialization: '',
    experience_years: '',
    consultation_fee: '',
    
    // Admin
    employee_id: '',
    department: ''
  });

  // Supporting Data
  const [hospitals, setHospitals] = useState([]);
  const [bloodGroups, setBloodGroups] = useState([]);
  const [qualifications, setQualifications] = useState([]);
  const [availableDoctors, setAvailableDoctors] = useState([]);

  // Auto-save effect
  useEffect(() => {
    const savedData = localStorage.getItem('profileFormData');
    if (savedData && !isLoading) {
      try {
        const parsed = JSON.parse(savedData);
        setFormData(prev => ({ ...prev, ...parsed }));
      } catch (error) {
        console.error('Error parsing saved form data:', error);
      }
    }
  }, [isLoading]);

  // Auto-save form data
  const saveFormData = useCallback(() => {
    if (Object.keys(formData).some(key => formData[key] && key !== 'prescriptionFile')) {
      localStorage.setItem('profileFormData', JSON.stringify({ 
        ...formData, 
        prescriptionFile: null // Don't save file objects
      }));
    }
  }, [formData]);

  useEffect(() => {
    const timeoutId = setTimeout(saveFormData, 1000);
    return () => clearTimeout(timeoutId);
  }, [formData, saveFormData]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setIsLoading(true);
      
      // Check if user is coming to edit their profile
      const isEditing = router.query.edit === 'true';
      
      // Check for existing profile
      const { data: existingProfile, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (!profileError && existingProfile && existingProfile.role && !isEditing) {
        // User already has a profile and is not editing, redirect appropriately
        if (existingProfile.account_status === 'pending') {
          router.replace('/account-pending');
          return;
        } else {
          router.replace(`/${existingProfile.role}/dashboard`);
          return;
        }
      }

      // Fetch supporting data using public API (bypasses RLS issues)
            try {
        const response = await fetch('/api/public/hospitals');
        const result = await response.json();
        
                if (result.success) {
          setHospitals(result.data.hospitals);
          setBloodGroups(result.data.bloodGroups);
          setQualifications(result.data.qualifications);
          
                  } else {
                    // Fallback to direct Supabase queries
                    const [hospitalsRes, bloodGroupsRes, qualificationsRes] = await Promise.all([
            supabase.from('hospitals').select('*').order('name'),
            supabase.from('blood_groups').select('*').order('blood_type'),
            supabase.from('qualifications').select('*').order('qualification_name')
          ]);
          
          setHospitals(hospitalsRes.data || []);
          setBloodGroups(bloodGroupsRes.data || []);
          setQualifications(qualificationsRes.data || []);
        }
      } catch (apiError) {
                // Fallback to direct Supabase queries
        const [hospitalsRes, bloodGroupsRes, qualificationsRes] = await Promise.all([
          supabase.from('hospitals').select('*').order('name'),
          supabase.from('blood_groups').select('*').order('blood_type'),
          supabase.from('qualifications').select('*').order('qualification_name')
        ]);
        
        setHospitals(hospitalsRes.data || []);
        setBloodGroups(bloodGroupsRes.data || []);
        setQualifications(qualificationsRes.data || []);
      }

      // Pre-populate with existing profile data if editing
      if (isEditing && existingProfile) {
        // Fetch role-specific data
        let roleSpecificData = {};
        
        if (existingProfile.role === 'patient') {
          const { data: patientData } = await supabase
            .from('patient_profiles')
            .select('*, blood_groups(*)')
            .eq('user_id', user.id)
            .single();
          
          if (patientData) {
            roleSpecificData = {
              blood_group_id: patientData.blood_group_id,
              emergency_contact_name: patientData.emergency_contact_name || '',
              emergency_contact_phone: patientData.emergency_contact_phone || '',
              assigned_doctor_id: patientData.assigned_doctor_id || ''
            };
          }
        } else if (existingProfile.role === 'doctor') {
          const { data: doctorData } = await supabase
            .from('doctor_profiles')
            .select('*')
            .eq('user_id', user.id)
            .single();
          
          if (doctorData) {
            roleSpecificData = {
              medical_license: doctorData.medical_license || '',
              specialization: doctorData.specialization || '',
              experience_years: doctorData.experience_years || '',
              qualification_ids: doctorData.qualification_ids || []
            };
          }
        } else if (existingProfile.role === 'admin') {
          const { data: adminData } = await supabase
            .from('admin_profiles')
            .select('*')
            .eq('user_id', user.id)
            .single();
          
          if (adminData) {
            roleSpecificData = {
              employee_id: adminData.employee_id || '',
              department: adminData.department || ''
            };
          }
        }

        setFormData({
          role: existingProfile.role,
          full_name: existingProfile.full_name || '',
          phone: existingProfile.phone || '',
          date_of_birth: existingProfile.date_of_birth || '',
          address: existingProfile.address || '',
          hospital_id: existingProfile.hospital_id || '',
          ...roleSpecificData
        });

        // Set appropriate step based on what data exists
        if (existingProfile.role) {
          if (existingProfile.full_name && existingProfile.phone) {
            setCurrentStep(3); // Go to role-specific details
          } else {
            setCurrentStep(2); // Go to basic info
          }
        }
        
        // Fetch doctors if patient with hospital selected
        if (existingProfile.role === 'patient' && existingProfile.hospital_id) {
          fetchDoctorsForHospital(existingProfile.hospital_id);
        }
      } else if (user) {
        // Pre-populate with user's email data for new profiles
        setFormData(prev => ({
          ...prev,
          full_name: user.user_metadata?.full_name || '',
        }));
      }

    } catch (error) {
      console.error('Error fetching initial data:', error);
      
      // Provide user-friendly error messages
      let errorMessage = 'Failed to load form data. Please refresh the page and try again.';
      
      if (error.message?.includes('network')) {
        errorMessage = 'Network error. Please check your internet connection and refresh the page.';
      } else if (error.message?.includes('permission')) {
        errorMessage = 'You do not have permission to access this page. Please sign in again.';
      } else if (error.message?.includes('not found')) {
        errorMessage = 'Required data not found. Please contact support if this issue persists.';
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDoctorsForHospital = async (hospitalId) => {
    try {
      const { data, error } = await supabase
        .from('doctor_profiles')
        .select(`
          user_id,
          medical_license,
          specialization,
          verification_status,
          user_profiles!inner(full_name, hospital_id)
        `)
        .eq('user_profiles.hospital_id', hospitalId)
        .eq('verification_status', 'verified');

      if (error) throw error;
      setAvailableDoctors(data || []);
    } catch (error) {
      console.error('Error fetching doctors:', error);
      setAvailableDoctors([]);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, files } = e.target;
    
    if (type === 'file') {
      setFormData(prev => ({ ...prev, [name]: files[0] }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
      
      // Fetch doctors when hospital is selected for patients
      if (name === 'hospital_id' && value && formData.role === 'patient') {
        fetchDoctorsForHospital(value);
      }
    }
    
    setError('');
  };

  const validateStep = () => {
    switch (currentStep) {
      case 1:
        if (!formData.role) {
          setError('Please select your role to continue');
          return false;
        }
        break;
      case 2:
        // More user-friendly field name mapping
        const fieldNames = {
          full_name: 'full name',
          phone: 'phone number',
          date_of_birth: 'date of birth',
          address: 'address',
          hospital_id: 'hospital'
        };
        
        const requiredBasic = ['full_name', 'phone', 'date_of_birth', 'address', 'hospital_id'];
        for (const field of requiredBasic) {
          if (!formData[field]) {
            setError(`Please enter your ${fieldNames[field]}`);
            return false;
          }
        }
        
        // Phone validation
        if (formData.phone && !/^\+?[\d\s-()]{10,}$/.test(formData.phone.replace(/\s+/g, ''))) {
          setError('Please enter a valid phone number');
          return false;
        }
        break;
      case 3:
        if (formData.role === 'patient') {
          if (!formData.blood_group_id) {
            setError('Please select your blood group');
            return false;
          }
          if (!formData.emergency_contact_name) {
            setError('Please enter emergency contact name');
            return false;
          }
          if (!formData.emergency_contact_phone) {
            setError('Please enter emergency contact phone number');
            return false;
          }
          // Validate emergency contact phone
          if (!/^\+?[\d\s-()]{10,}$/.test(formData.emergency_contact_phone.replace(/\s+/g, ''))) {
            setError('Please enter a valid emergency contact phone number');
            return false;
          }
        } else if (formData.role === 'doctor') {
          if (!formData.medical_license) {
            setError('Please enter your medical license number');
            return false;
          }
          if (!formData.qualification_id) {
            setError('Please select your qualification');
            return false;
          }
          if (!formData.specialization) {
            setError('Please enter your specialization');
            return false;
          }
          if (!formData.experience_years) {
            setError('Please enter your years of experience');
            return false;
          }
          if (formData.experience_years && (formData.experience_years < 0 || formData.experience_years > 70)) {
            setError('Please enter a valid number of years of experience (0-70)');
            return false;
          }
        } else if (formData.role === 'admin') {
          if (!formData.employee_id) {
            setError('Please enter your employee ID');
            return false;
          }
          if (!formData.department) {
            setError('Please enter your department');
            return false;
          }
        }
        break;
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep()) {
      setCurrentStep(prev => prev + 1);
      setError('');
    }
  };

  const handlePrevious = () => {
    setCurrentStep(prev => prev - 1);
    setError('');
  };

  const generateUniqueId = async (hospitalCode, role) => {
    const rolePrefix = role.charAt(0).toUpperCase();
    const hospitalPrefix = hospitalCode.substring(0, 3).toUpperCase();
    let attempts = 0;
    
    while (attempts < 10) {
      const randomNum = Math.floor(Math.random() * 9999) + 1000;
      const uniqueId = `${hospitalPrefix}-${rolePrefix}${randomNum}`;
      
      const { data, error } = await supabase
        .from('user_profiles')
        .select('unique_identifier')
        .eq('unique_identifier', uniqueId);
      
      if (!error && (!data || data.length === 0)) {
        return uniqueId;
      }
      attempts++;
    }
    
    throw new Error('Unable to generate unique ID');
  };

  const uploadPrescription = async (file) => {
    if (!file) return null;
    
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}_prescription_${Date.now()}.${fileExt}`;
    
    try {
      const { data, error } = await supabase.storage
        .from('prescriptions')
        .upload(fileName, file);
      
      if (error) throw error;
      
      const { data: { publicUrl } } = supabase.storage
        .from('prescriptions')
        .getPublicUrl(fileName);
      
      return publicUrl;
    } catch (error) {
      console.error('Error uploading prescription:', error);
      throw new Error('Failed to upload prescription');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateStep()) return;
    
    setIsSubmitting(true);
    setError('');

    try {
      // Get hospital information for unique ID generation
      const hospital = hospitals.find(h => h.id === formData.hospital_id);
      if (!hospital) throw new Error('Hospital not found');

      // Check if we're editing an existing profile
      const isEditing = router.query.edit === 'true';
      let uniqueId;
      
      if (isEditing) {
        // Get existing unique_identifier
        const { data: existingProfile } = await supabase
          .from('user_profiles')
          .select('unique_identifier')
          .eq('id', user.id)
          .single();
        
        uniqueId = existingProfile?.unique_identifier || await generateUniqueId(hospital.hospital_code, formData.role);
        console.log('Updating profile for role:', formData.role);
      } else {
        uniqueId = await generateUniqueId(hospital.hospital_code, formData.role);
        console.log('Creating profile for role:', formData.role);
      }

      // Create main user profile
      const mainProfileData = {
        id: user.id,
        email: user.email, // Add missing email field
        full_name: formData.full_name,
        phone: formData.phone,
        date_of_birth: formData.date_of_birth,
        address: formData.address,
        hospital_id: formData.hospital_id,
        role: formData.role,
        unique_identifier: uniqueId,
        account_status: 'active', // All users are active immediately
        phone_verified: true, // Skip phone verification for all users
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error: profileError } = await supabase
        .from('user_profiles')
        .upsert(mainProfileData);
      
      if (profileError) {
        throw profileError;
      }

      // Create role-specific profile
      if (formData.role === 'patient') {
        let prescriptionUrl = null;
        if (formData.prescriptionFile) {
          prescriptionUrl = await uploadPrescription(formData.prescriptionFile);
        }

        const patientData = {
          user_id: user.id,
          patient_id: uniqueId,
          blood_group_id: formData.blood_group_id,
          emergency_contact_name: formData.emergency_contact_name,
          emergency_contact_phone: formData.emergency_contact_phone,
          medical_history: formData.medical_history || null,
          current_medications: formData.current_medications || null,
          allergies: formData.allergies || null,
          assigned_doctor_id: formData.preferred_doctor_id || null,
          prescription_url: prescriptionUrl,
          prescription_uploaded_at: prescriptionUrl ? new Date().toISOString() : null,
          verification_status: 'pending'
        };

        const { error: patientError } = await supabase
          .from('patient_profiles')
          .upsert(patientData);

        if (patientError) {
          throw patientError;
        }

      } else if (formData.role === 'doctor') {
        const doctorData = {
          user_id: user.id,
          medical_license: formData.medical_license,
          qualification_id: formData.qualification_id,
          specialization: formData.specialization,
          experience_years: parseInt(formData.experience_years),
          consultation_fee: parseFloat(formData.consultation_fee) || null,
          verification_status: 'pending'
        };

        const { error: doctorError } = await supabase
          .from('doctor_profiles')
          .upsert(doctorData);

        if (doctorError) throw doctorError;

      } else if (formData.role === 'admin') {
        const adminData = {
          user_id: user.id,
          employee_id: formData.employee_id,
          department: formData.department,
          permissions: {
            manage_users: true,
            manage_doctors: true,
            manage_patients: true,
            view_all_reports: true
          }
        };

        const { error: adminError } = await supabase
          .from('admin_profiles')
          .upsert(adminData);

        if (adminError) throw adminError;
      }


      // Clear saved form data
      localStorage.removeItem('profileFormData');
      
      // Show success message
      setSuccess(`Profile ${isEditing ? 'updated' : 'completed'} successfully!`);
      
      // Refresh profile and redirect
      setTimeout(async () => {
        await refreshProfile();
        if (formData.role === 'admin') {
          router.replace('/admin/dashboard');
        } else {
          router.replace('/account-pending');
        }
      }, 1500);

    } catch (error) {
      console.error('Profile operation error:', error);
      
      // Provide user-friendly error messages
      let errorMessage = 'Failed to save profile. Please try again.';
      
      if (error.message?.includes('duplicate key')) {
        errorMessage = 'An account with this information already exists. Please check your details or contact support.';
      } else if (error.message?.includes('network')) {
        errorMessage = 'Network error. Please check your internet connection and try again.';
      } else if (error.message?.includes('not-null constraint')) {
        errorMessage = 'Please fill in all required fields before submitting.';
      } else if (error.message?.includes('foreign key')) {
        errorMessage = 'Please ensure you have selected valid options for all fields.';
      } else if (error.message?.includes('Hospital not found')) {
        errorMessage = 'Selected hospital is not available. Please choose a different hospital.';
      } else if (error.message?.includes('permission')) {
        errorMessage = 'You do not have permission to perform this action. Please contact support.';
      }
      
      setError(errorMessage);
      setIsSubmitting(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className={styles.stepContent}>
            <ShinyText className={styles.stepTitle}>Choose Your Role</ShinyText>
            <p className={styles.stepDescription}>
              Select the role that best describes how you'll use our platform
            </p>
            
            <div className={styles.roleGrid}>
              <div 
                className={`${styles.roleCard} ${formData.role === 'patient' ? styles.selected : ''}`}
                onClick={() => setFormData(prev => ({ ...prev, role: 'patient' }))}
              >
                <div className={styles.roleIcon}>
                  <span className={styles.iconPatient}>👤</span>
                </div>
                <h3>Patient</h3>
                <p>I am seeking neurological analysis and medical care</p>
              </div>

              <div 
                className={`${styles.roleCard} ${formData.role === 'doctor' ? styles.selected : ''}`}
                onClick={() => setFormData(prev => ({ ...prev, role: 'doctor' }))}
              >
                <div className={styles.roleIcon}>
                  <span className={styles.iconDoctor}>⚕️</span>
                </div>
                <h3>Doctor</h3>
                <p>I am a healthcare professional providing medical services</p>
              </div>

              <div 
                className={`${styles.roleCard} ${formData.role === 'admin' ? styles.selected : ''}`}
                onClick={() => setFormData(prev => ({ ...prev, role: 'admin' }))}
              >
                <div className={styles.roleIcon}>
                  <span className={styles.iconAdmin}>⚙️</span>
                </div>
                <h3>Administrator</h3>
                <p>I manage hospital operations and user verification</p>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className={styles.stepContent}>
            <ShinyText className={styles.stepTitle}>Basic Information</ShinyText>
            <p className={styles.stepDescription}>
              Please provide your basic personal and contact information
            </p>

            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label htmlFor="full_name">Full Name</label>
                <input
                  type="text"
                  id="full_name"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleInputChange}
                  required
                  placeholder="Enter your full name"
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="phone">Phone Number</label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  required
                  placeholder="Enter your phone number"
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="date_of_birth">Date of Birth</label>
                <input
                  type="date"
                  id="date_of_birth"
                  name="date_of_birth"
                  value={formData.date_of_birth}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="hospital_id">Hospital</label>
                <select
                  id="hospital_id"
                  name="hospital_id"
                  value={formData.hospital_id}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">Select your hospital</option>
                  {hospitals.map(hospital => (
                    <option key={hospital.id} value={hospital.id}>
                      {hospital.name} ({hospital.hospital_code})
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="address">Address</label>
                <textarea
                  id="address"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  required
                  rows="3"
                  placeholder="Enter your complete address"
                />
              </div>
            </div>
          </div>
        );

      case 3:
        if (formData.role === 'patient') {
          return (
            <div className={styles.stepContent}>
              <ShinyText className={styles.stepTitle}>Patient Details</ShinyText>
              <p className={styles.stepDescription}>
                Please provide your medical information and emergency contacts
              </p>

              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label htmlFor="blood_group_id">Blood Group</label>
                  <select
                    id="blood_group_id"
                    name="blood_group_id"
                    value={formData.blood_group_id}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="">Select blood group</option>
                    {bloodGroups.map(group => (
                      <option key={group.id} value={group.id}>
                        {group.blood_type}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="emergency_contact_name">Emergency Contact Name</label>
                  <input
                    type="text"
                    id="emergency_contact_name"
                    name="emergency_contact_name"
                    value={formData.emergency_contact_name}
                    onChange={handleInputChange}
                    required
                    placeholder="Emergency contact full name"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="emergency_contact_phone">Emergency Contact Phone</label>
                  <input
                    type="tel"
                    id="emergency_contact_phone"
                    name="emergency_contact_phone"
                    value={formData.emergency_contact_phone}
                    onChange={handleInputChange}
                    required
                    placeholder="Emergency contact phone number"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="preferred_doctor_id">Preferred Doctor (Optional)</label>
                  <select
                    id="preferred_doctor_id"
                    name="preferred_doctor_id"
                    value={formData.preferred_doctor_id}
                    onChange={handleInputChange}
                  >
                    <option value="">Select a doctor (will be assigned if not selected)</option>
                    {availableDoctors.map(doctor => (
                      <option key={doctor.user_id} value={doctor.user_id}>
                        {doctor.user_profiles.full_name} - {doctor.specialization}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="medical_history">Medical History (Optional)</label>
                  <textarea
                    id="medical_history"
                    name="medical_history"
                    value={formData.medical_history}
                    onChange={handleInputChange}
                    rows="3"
                    placeholder="Any relevant medical history..."
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="current_medications">Current Medications (Optional)</label>
                  <textarea
                    id="current_medications"
                    name="current_medications"
                    value={formData.current_medications}
                    onChange={handleInputChange}
                    rows="2"
                    placeholder="List current medications..."
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="allergies">Allergies (Optional)</label>
                  <textarea
                    id="allergies"
                    name="allergies"
                    value={formData.allergies}
                    onChange={handleInputChange}
                    rows="2"
                    placeholder="Any known allergies..."
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="prescriptionFile">Upload Prescription (Optional)</label>
                  <input
                    type="file"
                    id="prescriptionFile"
                    name="prescriptionFile"
                    onChange={handleInputChange}
                    accept=".pdf,.jpg,.jpeg,.png"
                    className={styles.fileInput}
                  />
                  <p className={styles.fileHelp}>
                    Upload your latest prescription or medical report (PDF or Image files only)
                  </p>
                </div>
              </div>
            </div>
          );
        } else if (formData.role === 'doctor') {
          return (
            <div className={styles.stepContent}>
              <ShinyText className={styles.stepTitle}>Doctor Details</ShinyText>
              <p className={styles.stepDescription}>
                Please provide your medical credentials and professional information
              </p>

              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label htmlFor="medical_license">Medical License Number</label>
                  <input
                    type="text"
                    id="medical_license"
                    name="medical_license"
                    value={formData.medical_license}
                    onChange={handleInputChange}
                    required
                    placeholder="Enter your medical license number"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="qualification_id">Qualification</label>
                  <select
                    id="qualification_id"
                    name="qualification_id"
                    value={formData.qualification_id}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="">Select your qualification</option>
                    {qualifications.map(qual => (
                      <option key={qual.id} value={qual.id}>
                        {qual.qualification_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="specialization">Specialization</label>
                  <input
                    type="text"
                    id="specialization"
                    name="specialization"
                    value={formData.specialization}
                    onChange={handleInputChange}
                    required
                    placeholder="e.g., Neurology, Cardiology"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="experience_years">Years of Experience</label>
                  <input
                    type="number"
                    id="experience_years"
                    name="experience_years"
                    value={formData.experience_years}
                    onChange={handleInputChange}
                    required
                    min="0"
                    max="50"
                    placeholder="Years of medical experience"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="consultation_fee">Consultation Fee (Optional)</label>
                  <input
                    type="number"
                    id="consultation_fee"
                    name="consultation_fee"
                    value={formData.consultation_fee}
                    onChange={handleInputChange}
                    min="0"
                    step="0.01"
                    placeholder="Consultation fee amount"
                  />
                </div>
              </div>
            </div>
          );
        } else if (formData.role === 'admin') {
          return (
            <div className={styles.stepContent}>
              <ShinyText className={styles.stepTitle}>Administrator Details</ShinyText>
              <p className={styles.stepDescription}>
                Please provide your administrative credentials and department information
              </p>

              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label htmlFor="employee_id">Employee ID</label>
                  <input
                    type="text"
                    id="employee_id"
                    name="employee_id"
                    value={formData.employee_id}
                    onChange={handleInputChange}
                    required
                    placeholder="Enter your employee ID"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="department">Department</label>
                  <input
                    type="text"
                    id="department"
                    name="department"
                    value={formData.department}
                    onChange={handleInputChange}
                    required
                    placeholder="e.g., Administration, IT, Medical Records"
                  />
                </div>
              </div>
            </div>
          );
        }
        break;

      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <>
        <Navbar />
        <div className={styles.loadingContainer}>
          <LoadingSpinner />
          <p>Loading profile setup...</p>
        </div>
      </>
    );
  }

  const totalSteps = 3;

  return (
    <>
      <Navbar />
      <div className={styles.profileSetup}>
        <div className={styles.setupContainer}>
          <div className={styles.setupHeader}>
            <ShinyText className={styles.mainTitle}>Complete Your Profile</ShinyText>
            
            <div className={styles.progressBar}>
              <div className={styles.progressTrack}>
                <div 
                  className={styles.progressFill}
                  style={{ width: `${(currentStep / totalSteps) * 100}%` }}
                />
              </div>
              <div className={styles.progressSteps}>
                {Array.from({ length: totalSteps }, (_, i) => (
                  <div
                    key={i}
                    className={`${styles.progressStep} ${i + 1 <= currentStep ? styles.completed : ''}`}
                  >
                    {i + 1}
                  </div>
                ))}
              </div>
            </div>
            
            <p className={styles.stepIndicator}>
              Step {currentStep} of {totalSteps}
            </p>
          </div>

          <form onSubmit={handleSubmit} className={styles.setupForm}>
            {renderStepContent()}

            {error && (
              <div className={styles.errorMessage}>
                {error}
              </div>
            )}

            {success && (
              <div className={styles.successMessage}>
                {success}
              </div>
            )}

            <div className={styles.formActions}>
              {currentStep > 1 && (
                <ShinyButton
                  variant="secondary"
                  onClick={handlePrevious}
                  disabled={isSubmitting}
                >
                  Previous
                </ShinyButton>
              )}

              {currentStep < totalSteps ? (
                <ShinyButton
                  onClick={handleNext}
                  disabled={isSubmitting}
                >
                  Next
                </ShinyButton>
              ) : (
                <ShinyButton
                  type="submit"
                  disabled={isSubmitting}
                  variant="primary"
                >
                  {isSubmitting ? (
                    <>
                      <LoadingSpinner size={16} />
                      Creating Profile...
                    </>
                  ) : (
                    'Complete Profile'
                  )}
                </ShinyButton>
              )}
            </div>
          </form>
        </div>
      </div>
    </>
  );
}