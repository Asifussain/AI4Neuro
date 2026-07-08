import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../components/AuthProvider';
import withAuth from '../../components/withAuth';
import LoadingSpinner from '../../components/LoadingSpinner';
import supabase from '../../lib/supabaseClient';
import styles from '../../styles/DashboardLayout.module.css';

function CreateEEGSession() {
  const { user, userProfile, hospitalData } = useAuth();
  const router = useRouter();
  const { doctor: doctorId, patient: patientId } = router.query;

  // State management
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [doctor, setDoctor] = useState(null);
  const [patient, setPatient] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form data
  const [formData, setFormData] = useState({
    eegFile: null,
    sessionNotes: '',
    sessionDuration: '',
    electrodesUsed: [],
    samplingRate: '',
    analysisType: 'binary'
  });

  // Common electrode positions
  const electrodeOptions = [
    'Fp1', 'Fp2', 'F3', 'F4', 'C3', 'C4', 'P3', 'P4', 'O1', 'O2',
    'F7', 'F8', 'T3', 'T4', 'T5', 'T6', 'Fz', 'Cz', 'Pz'
  ];

  useEffect(() => {
    if (doctorId && patientId && userProfile) {
      loadSessionData();
    }
  }, [doctorId, patientId, userProfile]);

  const loadSessionData = async () => {
    try {
      setIsLoading(true);
      setError('');

      // Load doctor information
      const { data: doctorData, error: doctorError } = await supabase
        .from('user_profiles')
        .select(`
          id,
          full_name,
          email,
          doctor_profiles!inner(
            medical_license,
            specialization,
            experience_years
          )
        `)
        .eq('id', doctorId)
        .eq('hospital_id', userProfile.hospital_id)
        .single();

      if (doctorError) throw doctorError;
      setDoctor(doctorData);

      // Load patient information
      const { data: patientData, error: patientError } = await supabase
        .from('user_profiles')
        .select(`
          id,
          full_name,
          email,
          date_of_birth,
          patient_profiles!inner(
            patient_id,
            blood_group_id,
            medical_history,
            allergies,
            blood_groups(blood_type)
          )
        `)
        .eq('id', patientId)
        .eq('hospital_id', userProfile.hospital_id)
        .single();

      if (patientError) throw patientError;
      setPatient(patientData);

    } catch (error) {
      console.error('Error loading session data:', error);
      setError('Failed to load session data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (error) setError('');
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type and size
      const allowedTypes = ['.edf', '.bdf', '.gdf', '.csv', '.mat'];
      const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
      
      if (!allowedTypes.includes(fileExtension)) {
        setError('Please upload a valid EEG file (.edf, .bdf, .gdf, .csv, .mat)');
        return;
      }

      if (file.size > 100 * 1024 * 1024) { // 100MB limit
        setError('File size must be less than 100MB');
        return;
      }

      setFormData(prev => ({ ...prev, eegFile: file }));
      if (error) setError('');
    }
  };

  const handleElectrodeToggle = (electrode) => {
    setFormData(prev => ({
      ...prev,
      electrodesUsed: prev.electrodesUsed.includes(electrode)
        ? prev.electrodesUsed.filter(e => e !== electrode)
        : [...prev.electrodesUsed, electrode]
    }));
  };

  const validateForm = () => {
    if (!formData.eegFile) {
      setError('Please select an EEG data file');
      return false;
    }
    if (!formData.sessionDuration || parseInt(formData.sessionDuration) <= 0) {
      setError('Please enter a valid session duration');
      return false;
    }
    if (formData.electrodesUsed.length === 0) {
      setError('Please select at least one electrode position');
      return false;
    }
    if (!formData.samplingRate || parseInt(formData.samplingRate) <= 0) {
      setError('Please enter a valid sampling rate');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    try {
      setIsSubmitting(true);
      setError('');

      // Generate session code
      const timestamp = Date.now();
      const sessionCode = `EEG-${hospitalData?.hospital_code || 'HSP'}-${timestamp.toString().slice(-6)}`;

      // Upload EEG file to storage
      const fileName = `eeg-sessions/${sessionCode}/${formData.eegFile.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('eeg-data')
        .upload(fileName, formData.eegFile);

      if (uploadError) throw uploadError;

      // Get the public URL for the uploaded file
      const { data: { publicUrl } } = supabase.storage
        .from('eeg-data')
        .getPublicUrl(fileName);

      // Create EEG session record
      const sessionData = {
        session_code: sessionCode,
        patient_id: patientId,
        doctor_id: doctorId,
        hospital_id: userProfile.hospital_id,
        filename: formData.eegFile.name,
        eeg_data_url: publicUrl,
        session_duration: parseInt(formData.sessionDuration),
        electrodes_used: formData.electrodesUsed,
        sampling_rate: parseInt(formData.samplingRate),
        session_notes: formData.sessionNotes || null,
        analysis_type: formData.analysisType,
        status: 'uploaded'
      };

      const { data: session, error: sessionError } = await supabase
        .from('eeg_sessions')
        .insert(sessionData)
        .select()
        .single();

      if (sessionError) throw sessionError;

      setSuccess('EEG session created successfully! Redirecting...');
      
      // Redirect to session details page after 2 seconds
      setTimeout(() => {
        router.push(`/radiologist/session/${session.id}`);
      }, 2000);

    } catch (error) {
      console.error('Error creating EEG session:', error);
      setError(error.message || 'Failed to create EEG session. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    router.push('/radiologist/dashboard');
  };

  if (isLoading) {
    return (
      <>
        <Navbar />
        <div className={styles.dashboardContainer}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            height: '50vh' 
          }}>
            <LoadingSpinner />
          </div>
        </div>
      </>
    );
  }

  if (!doctor || !patient) {
    return (
      <>
        <Navbar />
        <div className={styles.dashboardContainer}>
          <div className={styles.errorState}>
            <h2>Session Data Not Found</h2>
            <p>Unable to load doctor or patient information.</p>
            <button className={styles.primaryButton} onClick={handleBack}>
              Back to Dashboard
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className={styles.dashboardContainer}>
        {/* Header */}
        <div className={styles.pageHeader}>
          <button className={styles.backButton} onClick={handleBack}>
            ← Back to Dashboard
          </button>
          <h1>Create New EEG Session</h1>
          <p>Upload and configure EEG data for analysis</p>
        </div>

        {/* Session Info */}
        <div className={styles.contentSection}>
          <h2>Session Information</h2>
          <div className={styles.infoGrid}>
            <div className={styles.infoCard}>
              <h3>Doctor</h3>
              <p><strong>{doctor.full_name}</strong></p>
              <p>{doctor.doctor_profiles.specialization}</p>
              <p>{doctor.email}</p>
            </div>
            <div className={styles.infoCard}>
              <h3>Patient</h3>
              <p><strong>{patient.full_name}</strong></p>
              <p>ID: {patient.patient_profiles.patient_id}</p>
              <p>Blood Type: {patient.patient_profiles.blood_groups?.blood_type || 'N/A'}</p>
            </div>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className={styles.errorAlert}>
            <span>⚠️ {error}</span>
          </div>
        )}

        {success && (
          <div className={styles.successAlert}>
            <span>✅ {success}</span>
          </div>
        )}

        {/* EEG Upload Form */}
        <form onSubmit={handleSubmit} className={styles.contentSection}>
          <h2>EEG Data Upload</h2>
          
          {/* File Upload */}
          <div className={styles.formGroup}>
            <label htmlFor="eegFile">EEG Data File *</label>
            <input
              type="file"
              id="eegFile"
              name="eegFile"
              onChange={handleFileChange}
              accept=".edf,.bdf,.gdf,.csv,.mat"
              className={styles.fileInput}
              disabled={isSubmitting}
              required
            />
            <p className={styles.inputNote}>
              Supported formats: .edf, .bdf, .gdf, .csv, .mat (Max size: 100MB)
            </p>
          </div>

          {/* Session Details */}
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label htmlFor="sessionDuration">Session Duration (minutes) *</label>
              <input
                type="number"
                id="sessionDuration"
                name="sessionDuration"
                value={formData.sessionDuration}
                onChange={handleInputChange}
                placeholder="Enter duration in minutes"
                min="1"
                max="180"
                disabled={isSubmitting}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="samplingRate">Sampling Rate (Hz) *</label>
              <input
                type="number"
                id="samplingRate"
                name="samplingRate"
                value={formData.samplingRate}
                onChange={handleInputChange}
                placeholder="e.g., 256, 512, 1024"
                min="1"
                disabled={isSubmitting}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="analysisType">Analysis Type *</label>
              <select
                id="analysisType"
                name="analysisType"
                value={formData.analysisType}
                onChange={handleInputChange}
                disabled={isSubmitting}
                required
                className={styles.selectWithInfo}
              >
                <option value="binary">Binary - Normal vs Alzheimer's Disease (2 classes)</option>
                <option value="multiclass">Multi-class - CN, MCI, AD (3 classes)</option>
                <option value="regression">Regression Analysis - Continuous severity score</option>
              </select>

              {/* Info box below dropdown */}
              <div className={styles.analysisTypeInfo} style={{
                marginTop: '0.75rem',
                padding: '0.75rem',
                backgroundColor: '#f9fafb',
                borderRadius: '6px',
                border: '1px solid #e5e7eb',
                fontSize: '0.9rem',
                lineHeight: '1.5'
              }}>
                {formData.analysisType === 'binary' && (
                  <div>
                    <strong style={{ color: '#1f2937' }}>Binary Classification</strong>
                    <p style={{ margin: '0.5rem 0 0 0', color: '#6b7280' }}>
                      Identifies whether EEG patterns match <strong>Normal</strong> or <strong>Alzheimer's Disease</strong> patterns.
                      Best for clear-cut diagnostic scenarios.
                    </p>
                  </div>
                )}
                {formData.analysisType === 'multiclass' && (
                  <div>
                    <strong style={{ color: '#1f2937' }}>Multi-class Classification</strong>
                    <p style={{ margin: '0.5rem 0', color: '#6b7280' }}>Distinguishes between three cognitive states:</p>
                    <ul style={{ margin: '0.25rem 0 0 1.25rem', color: '#6b7280' }}>
                      <li><strong>CN</strong> - Cognitively Normal</li>
                      <li><strong>MCI</strong> - Mild Cognitive Impairment (early warning signs)</li>
                      <li><strong>AD</strong> - Alzheimer's Disease</li>
                    </ul>
                    <p style={{ margin: '0.5rem 0 0 0', color: '#6b7280', fontSize: '0.85rem' }}>
                      Recommended for early detection and monitoring of cognitive decline progression.
                    </p>
                  </div>
                )}
                {formData.analysisType === 'regression' && (
                  <div>
                    <strong style={{ color: '#1f2937' }}>Regression Analysis</strong>
                    <p style={{ margin: '0.5rem 0 0 0', color: '#6b7280' }}>
                      Provides a continuous score indicating the severity of cognitive decline.
                      Useful for tracking disease progression over time.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Electrodes Used */}
          <div className={styles.formGroup}>
            <label>Electrodes Used *</label>
            <div className={styles.electrodeGrid}>
              {electrodeOptions.map(electrode => (
                <button
                  key={electrode}
                  type="button"
                  className={`${styles.electrodeButton} ${
                    formData.electrodesUsed.includes(electrode) ? styles.selected : ''
                  }`}
                  onClick={() => handleElectrodeToggle(electrode)}
                  disabled={isSubmitting}
                >
                  {electrode}
                </button>
              ))}
            </div>
            <p className={styles.inputNote}>
              Selected: {formData.electrodesUsed.length} electrodes
            </p>
          </div>

          {/* Session Notes */}
          <div className={styles.formGroup}>
            <label htmlFor="sessionNotes">Session Notes (optional)</label>
            <textarea
              id="sessionNotes"
              name="sessionNotes"
              value={formData.sessionNotes}
              onChange={handleInputChange}
              placeholder="Enter any relevant notes about this EEG session..."
              rows={4}
              disabled={isSubmitting}
            />
          </div>

          {/* Form Actions */}
          <div className={styles.formActions}>
            <button
              type="button"
              onClick={handleBack}
              className={styles.secondaryButton}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.primaryButton}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <LoadingSpinner size={16} />
                  Creating Session...
                </>
              ) : (
                'Create EEG Session'
              )}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

export default withAuth(CreateEEGSession, ['radiologist']);