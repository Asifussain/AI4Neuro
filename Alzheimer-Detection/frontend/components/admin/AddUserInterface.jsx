import { useState, useEffect } from 'react';
import { useAuth } from '../AuthProvider';
import supabase from '../../lib/supabaseClient';
import LoadingSpinner from '../LoadingSpinner';
import styles from '../../styles/AddUser.module.css';

export default function AddUserInterface({ onUserCreated }) {
  const { user, userProfile, hospitalData } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedRole, setSelectedRole] = useState('');
  const [bloodGroups, setBloodGroups] = useState([]);
  const [qualifications, setQualifications] = useState([]);
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState('');

  // Form data
  const [formData, setFormData] = useState({
    // Basic Info
    email: '',
    full_name: '',
    phone: '',
    date_of_birth: '',
    address: '',
    role: '',
    
    // Patient-specific
    blood_group_id: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    medical_history: '',
    current_medications: '',
    allergies: '',
    
    // Doctor-specific
    medical_license: '',
    qualification_id: '',
    specialization: '',
    experience_years: '',
    consultation_fee: '',
    
    // Radiologist-specific  
    radiologist_license: '',
    certifications: '',
    imaging_expertise: ''
  });

  // Load reference data
  useEffect(() => {
    const loadReferenceData = async () => {
      try {
        const [bloodGroupsRes, qualificationsRes] = await Promise.all([
          supabase.from('blood_groups').select('*'),
          supabase.from('qualifications').select('*')
        ]);

        if (bloodGroupsRes.data) setBloodGroups(bloodGroupsRes.data);
        if (qualificationsRes.data) setQualifications(qualificationsRes.data);
      } catch (error) {
        console.error('Error loading reference data:', error);
      }
    };

    loadReferenceData();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear errors on input change
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleRoleSelect = (role) => {
    setSelectedRole(role);
    setFormData(prev => ({ ...prev, role }));
    setShowForm(true);
    setErrors({});
    setSuccess('');
  };

  const validateForm = () => {
    const newErrors = {};

    // Basic validation
    if (!formData.email) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Email is invalid';
    
    if (!formData.full_name.trim()) newErrors.full_name = 'Full name is required';
    if (!formData.phone.trim()) newErrors.phone = 'Phone number is required';
    
    // Role-specific validation
    if (selectedRole === 'patient') {
      if (!formData.blood_group_id) newErrors.blood_group_id = 'Blood group is required';
      if (!formData.emergency_contact_name.trim()) newErrors.emergency_contact_name = 'Emergency contact name is required';
      if (!formData.emergency_contact_phone.trim()) newErrors.emergency_contact_phone = 'Emergency contact phone is required';
    }
    
    if (selectedRole === 'doctor') {
      if (!formData.medical_license.trim()) newErrors.medical_license = 'Medical license is required';
      if (!formData.qualification_id) newErrors.qualification_id = 'Qualification is required';
      if (!formData.specialization.trim()) newErrors.specialization = 'Specialization is required';
      if (!formData.experience_years) newErrors.experience_years = 'Experience years is required';
      else if (parseInt(formData.experience_years) < 0) newErrors.experience_years = 'Experience years must be positive';
    }
    
    if (selectedRole === 'radiologist') {
      if (!formData.radiologist_license.trim()) newErrors.radiologist_license = 'Radiologist license is required';
      if (!formData.qualification_id) newErrors.qualification_id = 'Qualification is required';
      if (!formData.imaging_expertise.trim()) newErrors.imaging_expertise = 'Imaging expertise is required';
      if (!formData.experience_years) newErrors.experience_years = 'Experience years is required';
      else if (parseInt(formData.experience_years) < 0) newErrors.experience_years = 'Experience years must be positive';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsLoading(true);
    setSuccess('');

    try {
      // Get session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No authentication token found');
      }

      // Call the create account API
      const response = await fetch('/api/admin/create-account', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `HTTP ${response.status}: Failed to create account`);
      }

      // Success!
      setSuccess(`${selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)} account created successfully! Login credentials have been sent to ${formData.email}.`);
      
      // Reset form
      setFormData({
        email: '',
        full_name: '',
        phone: '',
        date_of_birth: '',
        address: '',
        role: '',
        blood_group_id: '',
        emergency_contact_name: '',
        emergency_contact_phone: '',
        medical_history: '',
        current_medications: '',
        allergies: '',
        medical_license: '',
        qualification_id: '',
        specialization: '',
        experience_years: '',
        consultation_fee: '',
        radiologist_license: '',
        certifications: '',
        imaging_expertise: ''
      });
      
      setSelectedRole('');
      setShowForm(false);
      
      // Notify parent component
      if (onUserCreated) {
        onUserCreated(result.data);
      }

    } catch (error) {
      console.error('Error creating user:', error);
      setErrors({ submit: error.message || 'Failed to create user account' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setSelectedRole('');
    setFormData({
      email: '',
      full_name: '',
      phone: '',
      date_of_birth: '',
      address: '',
      role: '',
      blood_group_id: '',
      emergency_contact_name: '',
      emergency_contact_phone: '',
      medical_history: '',
      current_medications: '',
      allergies: '',
      medical_license: '',
      qualification_id: '',
      specialization: '',
      experience_years: '',
      consultation_fee: ''
    });
    setErrors({});
    setSuccess('');
  };

  if (!showForm) {
    return (
      <div className={styles.addUserContainer}>
        <div className={styles.welcomeSection}>
          <div className={styles.hospitalInfo}>
            <h2>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: '8px', verticalAlign: 'middle' }}>
                <path d="M15,14C12.33,14 7,15.33 7,18V20H23V18C23,15.33 17.67,14 15,14M6,10V7H4V10H1V12H4V15H6V12H9V10M15,12A4,4 0 0,0 19,8A4,4 0 0,0 15,4A4,4 0 0,0 11,8A4,4 0 0,0 15,12Z"/>
              </svg>
              Add New User
            </h2>
            <p>Create new accounts for {hospitalData?.name || 'your hospital'}</p>
            <p className={styles.subtitle}>Select the role for the new user:</p>
          </div>
        </div>

        {success && (
          <div className={styles.successAlert}>
            <div className={styles.alertIcon}>✅</div>
            <div className={styles.alertContent}>
              <h4>Account Created Successfully!</h4>
              <p>{success}</p>
            </div>
          </div>
        )}

        <div className={styles.roleSelection}>
          <div 
            className={styles.roleCard}
            onClick={() => handleRoleSelect('patient')}
          >
            <div className={styles.roleIcon}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            </div>
            <div className={styles.roleContent}>
              <h3>Add Patient</h3>
              <p>Create a new patient account with medical history and emergency contacts</p>
              <ul className={styles.roleFeatures}>
                <li>✓ Unique hospital patient ID</li>
                <li>✓ Medical history tracking</li>
                <li>✓ Emergency contact information</li>
                <li>✓ Blood group & allergies</li>
                <li>✓ Email credentials sent automatically</li>
              </ul>
              <button className={styles.selectRoleBtn}>Create Patient Account</button>
            </div>
          </div>

          <div 
            className={styles.roleCard}
            onClick={() => handleRoleSelect('doctor')}
          >
            <div className={styles.roleIcon}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12,2A3,3 0 0,1 15,5V11A3,3 0 0,1 12,14A3,3 0 0,1 9,11V5A3,3 0 0,1 12,2M19,18V20H5V18L7,16V14H9V15.5H15V14H17V16L19,18Z"/>
              </svg>
            </div>
            <div className={styles.roleContent}>
              <h3>Add Doctor</h3>
              <p>Create a new doctor account with license verification and specialization</p>
              <ul className={styles.roleFeatures}>
                <li>✓ Unique hospital doctor ID</li>
                <li>✓ Medical license verification</li>
                <li>✓ Specialization & experience</li>
                <li>✓ Consultation fee settings</li>
                <li>✓ Email credentials sent automatically</li>
              </ul>
              <button className={styles.selectRoleBtn}>Create Doctor Account</button>
            </div>
          </div>

          <div 
            className={styles.roleCard}
            onClick={() => handleRoleSelect('radiologist')}
          >
            <div className={styles.roleIcon}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19,3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5A2,2 0 0,0 19,3M19,19H5V5H19V19M13.96,12.71L11.21,15.46L9.25,13.5L6.5,16.25L17.5,16.25L13.96,12.71Z"/>
              </svg>
            </div>
            <div className={styles.roleContent}>
              <h3>Add Radiologist</h3>
              <p>Create a radiologist account for EEG analysis and report generation</p>
              <ul className={styles.roleFeatures}>
                <li>✓ Unique radiologist ID</li>
                <li>✓ EEG signal analysis access</li>
                <li>✓ Multi-report generation (Clinical, Technical, Patient)</li>
                <li>✓ Doctor-patient assignment management</li>
                <li>✓ Imaging expertise certification</li>
              </ul>
              <button className={styles.selectRoleBtn}>Create Radiologist Account</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.addUserContainer}>
      <div className={styles.formHeader}>
        <button 
          onClick={handleCancel}
          className={styles.backButton}
        >
          ← Back to Role Selection
        </button>
        <div className={styles.formTitle}>
          <div className={styles.roleIconSmall}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: '8px', verticalAlign: 'middle' }}>
              {selectedRole === 'patient' ? (
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              ) : (
                <path d="M12,2A3,3 0 0,1 15,5V11A3,3 0 0,1 12,14A3,3 0 0,1 9,11V5A3,3 0 0,1 12,2M19,18V20H5V18L7,16V14H9V15.5H15V14H17V16L19,18Z"/>
              )}
            </svg>
          </div>
          <h2>Create New {selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)} Account</h2>
          <p>All fields marked with * are required</p>
        </div>
      </div>

      {errors.submit && (
        <div className={styles.errorAlert}>
          <div className={styles.alertIcon}>❌</div>
          <div className={styles.alertContent}>
            <h4>Error Creating Account</h4>
            <p>{errors.submit}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className={styles.userForm}>
        {/* Basic Information Section */}
        <div className={styles.formSection}>
          <h3 className={styles.sectionTitle}>📝 Basic Information</h3>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label htmlFor="full_name">Full Name *</label>
              <input
                type="text"
                id="full_name"
                name="full_name"
                value={formData.full_name}
                onChange={handleInputChange}
                className={errors.full_name ? styles.inputError : ''}
                placeholder="Enter full name"
                disabled={isLoading}
              />
              {errors.full_name && <span className={styles.errorText}>{errors.full_name}</span>}
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="email">Email Address *</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className={errors.email ? styles.inputError : ''}
                placeholder="Enter email address"
                disabled={isLoading}
              />
              {errors.email && <span className={styles.errorText}>{errors.email}</span>}
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="phone">Phone Number *</label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                className={errors.phone ? styles.inputError : ''}
                placeholder="Enter phone number"
                disabled={isLoading}
              />
              {errors.phone && <span className={styles.errorText}>{errors.phone}</span>}
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="date_of_birth">Date of Birth</label>
              <input
                type="date"
                id="date_of_birth"
                name="date_of_birth"
                value={formData.date_of_birth}
                onChange={handleInputChange}
                disabled={isLoading}
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="address">Address</label>
            <textarea
              id="address"
              name="address"
              value={formData.address}
              onChange={handleInputChange}
              placeholder="Enter full address"
              disabled={isLoading}
              rows={3}
            />
          </div>
        </div>

        {/* Role-specific sections */}
        {selectedRole === 'patient' && (
          <div className={styles.formSection}>
            <h3 className={styles.sectionTitle}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: '8px', verticalAlign: 'middle' }}>
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
              Patient Information
            </h3>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label htmlFor="blood_group_id">Blood Group *</label>
                <select
                  id="blood_group_id"
                  name="blood_group_id"
                  value={formData.blood_group_id}
                  onChange={handleInputChange}
                  className={errors.blood_group_id ? styles.inputError : ''}
                  disabled={isLoading}
                >
                  <option value="">Select blood group</option>
                  {bloodGroups.map(bg => (
                    <option key={bg.id} value={bg.id}>{bg.blood_type}</option>
                  ))}
                </select>
                {errors.blood_group_id && <span className={styles.errorText}>{errors.blood_group_id}</span>}
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="emergency_contact_name">Emergency Contact Name *</label>
                <input
                  type="text"
                  id="emergency_contact_name"
                  name="emergency_contact_name"
                  value={formData.emergency_contact_name}
                  onChange={handleInputChange}
                  className={errors.emergency_contact_name ? styles.inputError : ''}
                  placeholder="Enter emergency contact name"
                  disabled={isLoading}
                />
                {errors.emergency_contact_name && <span className={styles.errorText}>{errors.emergency_contact_name}</span>}
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="emergency_contact_phone">Emergency Contact Phone *</label>
                <input
                  type="tel"
                  id="emergency_contact_phone"
                  name="emergency_contact_phone"
                  value={formData.emergency_contact_phone}
                  onChange={handleInputChange}
                  className={errors.emergency_contact_phone ? styles.inputError : ''}
                  placeholder="Enter emergency contact phone"
                  disabled={isLoading}
                />
                {errors.emergency_contact_phone && <span className={styles.errorText}>{errors.emergency_contact_phone}</span>}
              </div>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="medical_history">Medical History</label>
              <textarea
                id="medical_history"
                name="medical_history"
                value={formData.medical_history}
                onChange={handleInputChange}
                placeholder="Enter medical history and previous conditions"
                disabled={isLoading}
                rows={4}
              />
            </div>

            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label htmlFor="current_medications">Current Medications</label>
                <textarea
                  id="current_medications"
                  name="current_medications"
                  value={formData.current_medications}
                  onChange={handleInputChange}
                  placeholder="List current medications"
                  disabled={isLoading}
                  rows={3}
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="allergies">Allergies</label>
                <textarea
                  id="allergies"
                  name="allergies"
                  value={formData.allergies}
                  onChange={handleInputChange}
                  placeholder="List known allergies"
                  disabled={isLoading}
                  rows={3}
                />
              </div>
            </div>
          </div>
        )}

        {selectedRole === 'doctor' && (
          <div className={styles.formSection}>
            <h3 className={styles.sectionTitle}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: '8px', verticalAlign: 'middle' }}>
                <path d="M12,2A3,3 0 0,1 15,5V11A3,3 0 0,1 12,14A3,3 0 0,1 9,11V5A3,3 0 0,1 12,2M19,18V20H5V18L7,16V14H9V15.5H15V14H17V16L19,18Z"/>
              </svg>
              Doctor Information
            </h3>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label htmlFor="medical_license">Medical License Number *</label>
                <input
                  type="text"
                  id="medical_license"
                  name="medical_license"
                  value={formData.medical_license}
                  onChange={handleInputChange}
                  className={errors.medical_license ? styles.inputError : ''}
                  placeholder="Enter medical license number"
                  disabled={isLoading}
                />
                {errors.medical_license && <span className={styles.errorText}>{errors.medical_license}</span>}
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="qualification_id">Qualification *</label>
                <select
                  id="qualification_id"
                  name="qualification_id"
                  value={formData.qualification_id}
                  onChange={handleInputChange}
                  className={errors.qualification_id ? styles.inputError : ''}
                  disabled={isLoading}
                >
                  <option value="">Select qualification</option>
                  {qualifications.map(qual => (
                    <option key={qual.id} value={qual.id}>{qual.qualification_name}</option>
                  ))}
                </select>
                {errors.qualification_id && <span className={styles.errorText}>{errors.qualification_id}</span>}
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="specialization">Specialization *</label>
                <input
                  type="text"
                  id="specialization"
                  name="specialization"
                  value={formData.specialization}
                  onChange={handleInputChange}
                  className={errors.specialization ? styles.inputError : ''}
                  placeholder="Enter specialization (e.g., Neurology, Cardiology)"
                  disabled={isLoading}
                />
                {errors.specialization && <span className={styles.errorText}>{errors.specialization}</span>}
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="experience_years">Years of Experience *</label>
                <input
                  type="number"
                  id="experience_years"
                  name="experience_years"
                  value={formData.experience_years}
                  onChange={handleInputChange}
                  className={errors.experience_years ? styles.inputError : ''}
                  placeholder="Enter years of experience"
                  disabled={isLoading}
                  min="0"
                />
                {errors.experience_years && <span className={styles.errorText}>{errors.experience_years}</span>}
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="consultation_fee">Consultation Fee (optional)</label>
                <input
                  type="number"
                  id="consultation_fee"
                  name="consultation_fee"
                  value={formData.consultation_fee}
                  onChange={handleInputChange}
                  placeholder="Enter consultation fee"
                  disabled={isLoading}
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
          </div>
        )}

        {/* Radiologist Information Section */}
        {selectedRole === 'radiologist' && (
          <div className={styles.sectionContainer}>
            <h3 className={styles.sectionTitle}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: '8px', verticalAlign: 'middle' }}>
                <path d="M19,3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5A2,2 0 0,0 19,3M19,19H5V5H19V19M13.96,12.71L11.21,15.46L9.25,13.5L6.5,16.25L17.5,16.25L13.96,12.71Z"/>
              </svg>
              Radiologist Information
            </h3>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label htmlFor="radiologist_license">Radiologist License Number *</label>
                <input
                  type="text"
                  id="radiologist_license"
                  name="radiologist_license"
                  value={formData.radiologist_license}
                  onChange={handleInputChange}
                  className={errors.radiologist_license ? styles.inputError : ''}
                  placeholder="Enter radiologist license number"
                  disabled={isLoading}
                />
                {errors.radiologist_license && <span className={styles.errorText}>{errors.radiologist_license}</span>}
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="qualification_id">Qualification *</label>
                <select
                  id="qualification_id"
                  name="qualification_id"
                  value={formData.qualification_id}
                  onChange={handleInputChange}
                  className={errors.qualification_id ? styles.inputError : ''}
                  disabled={isLoading}
                >
                  <option value="">Select qualification</option>
                  {qualifications.map(qual => (
                    <option key={qual.id} value={qual.id}>{qual.qualification_name}</option>
                  ))}
                </select>
                {errors.qualification_id && <span className={styles.errorText}>{errors.qualification_id}</span>}
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="imaging_expertise">Imaging Expertise *</label>
                <input
                  type="text"
                  id="imaging_expertise"
                  name="imaging_expertise"
                  value={formData.imaging_expertise}
                  onChange={handleInputChange}
                  className={errors.imaging_expertise ? styles.inputError : ''}
                  placeholder="Enter imaging expertise (e.g., EEG, MRI, CT)"
                  disabled={isLoading}
                />
                {errors.imaging_expertise && <span className={styles.errorText}>{errors.imaging_expertise}</span>}
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="experience_years">Years of Experience *</label>
                <input
                  type="number"
                  id="experience_years"
                  name="experience_years"
                  value={formData.experience_years}
                  onChange={handleInputChange}
                  className={errors.experience_years ? styles.inputError : ''}
                  placeholder="Enter years of experience"
                  disabled={isLoading}
                  min="0"
                />
                {errors.experience_years && <span className={styles.errorText}>{errors.experience_years}</span>}
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="certifications">Certifications (optional)</label>
                <textarea
                  id="certifications"
                  name="certifications"
                  value={formData.certifications}
                  onChange={handleInputChange}
                  placeholder="Enter relevant certifications and training"
                  disabled={isLoading}
                  rows="3"
                  className={styles.textArea}
                />
              </div>
            </div>
          </div>
        )}

        {/* Form Actions */}
        <div className={styles.formActions}>
          <button
            type="button"
            onClick={handleCancel}
            className={styles.cancelButton}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className={styles.createButton}
          >
            {isLoading ? (
              <>
                <LoadingSpinner size={16} />
                Creating Account...
              </>
            ) : (
              `Create ${selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)} Account`
            )}
          </button>
        </div>

        <div className={styles.formFooter}>
          <p className={styles.footerNote}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: '8px', verticalAlign: 'middle' }}>
              <path d="M20,8L12,13L4,8V6L12,11L20,6M20,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V6C22,4.89 21.1,4 20,4Z"/>
            </svg>
            Upon successful creation, login credentials will be automatically sent to the provided email address.
            The user will be required to change their password on first login.
          </p>
        </div>
      </form>
    </div>
  );
}