import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Navbar from '../../../../components/Navbar';
import { useAuth } from '../../../../components/AuthProvider';
import withAuth from '../../../../components/withAuth';
import LoadingSpinner from '../../../../components/LoadingSpinner';
import supabase from '../../../../lib/supabaseClient';
import styles from '../../../../styles/DashboardLayout.module.css';

function PatientEEGSessions() {
  const { user, userProfile, hospitalData } = useAuth();
  const router = useRouter();
  const { patient_id } = router.query;
  const fileInputRef = useRef(null);
  
  // State management
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isGeneratingReports, setIsGeneratingReports] = useState(false);
  const [patient, setPatient] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Form data for new session
  const [formData, setFormData] = useState({
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
    if (patient_id && userProfile?.role === 'radiologist') {
      loadPatientAndSessions();
      // Set up real-time subscription for session updates
      setupRealtimeSubscription();
    }

    return () => {
      // Cleanup subscription on unmount
      if (window.sessionsSubscription) {
        window.sessionsSubscription.unsubscribe();
      }
    };
  }, [patient_id, userProfile]);

  const setupRealtimeSubscription = () => {
    // Subscribe to real-time updates for EEG sessions
    const subscription = supabase
      .channel('eeg_sessions_updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'eeg_sessions',
          filter: `patient_id=eq.${patient_id}`
        },
        (payload) => {
          console.log('Real-time session update:', payload);
          // Reload sessions when status changes
          loadSessions();
        }
      )
      .subscribe();

    window.sessionsSubscription = subscription;
  };

  const loadPatientAndSessions = async () => {
    try {
      setIsLoading(true);
      setError('');

      // Verify hospital access and load patient info
      if (!userProfile?.hospital_id) {
        throw new Error('Hospital information not available');
      }

      // Load patient information with hospital verification
      const { data: patientData, error: patientError } = await supabase
        .from('user_profiles')
        .select(`
          id,
          full_name,
          email,
          date_of_birth,
          unique_identifier,
          patient_profiles!inner(
            patient_id,
            blood_group_id,
            verification_status,
            medical_history,
            allergies,
            blood_groups(blood_type)
          )
        `)
        .eq('id', patient_id)
        .eq('hospital_id', userProfile.hospital_id)
        .eq('role', 'patient')
        .eq('account_status', 'active')
        .single();

      if (patientError || !patientData) {
        throw new Error('Patient not found or access denied');
      }

      setPatient(patientData);

      // Load sessions
      await loadSessions();

    } catch (error) {
      console.error('Error loading patient and sessions:', error);
      setError(error.message || 'Failed to load data. Please try again.');
      setPatient(null);
      setSessions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSessions = async () => {
    try {
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('eeg_sessions')
        .select(`
          *,
          doctor:user_profiles!doctor_id(
            full_name,
            doctor_profiles(specialization)
          )
        `)
        .eq('patient_id', patient_id)
        .eq('hospital_id', userProfile.hospital_id)
        .order('created_at', { ascending: false });

      if (sessionsError) {
        throw new Error(`Failed to load sessions: ${sessionsError.message}`);
      }

      setSessions(sessionsData || []);
    } catch (error) {
      console.error('Error loading sessions:', error);
      setError('Failed to load EEG sessions');
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type and size
      const allowedTypes = ['.edf', '.bdf', '.gdf', '.csv', '.mat'];
      const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
      
      if (!allowedTypes.includes(fileExtension)) {
        setError('Please upload a valid EEG file (.edf, .bdf, .gdf, .csv, .mat)');
        return;
      }

      if (file.size > 200 * 1024 * 1024) { // 200MB limit
        setError('File size must be less than 200MB');
        return;
      }

      setSelectedFile(file);
      setError('');
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (error) setError('');
  };

  const handleElectrodeToggle = (electrode) => {
    setFormData(prev => ({
      ...prev,
      electrodesUsed: prev.electrodesUsed.includes(electrode)
        ? prev.electrodesUsed.filter(e => e !== electrode)
        : [...prev.electrodesUsed, electrode]
    }));
  };

  const validateUploadForm = () => {
    if (!selectedFile) {
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

  const handleUpload = async (e) => {
    e.preventDefault();
    
    if (!validateUploadForm()) return;

    try {
      setIsUploading(true);
      setError('');
      setUploadProgress(0);

      // Generate session code
      const timestamp = Date.now();
      const sessionCode = `EEG-${hospitalData?.hospital_code || 'HSP'}-${timestamp.toString().slice(-6)}`;

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      // Upload EEG file to storage
      const fileName = `eeg-sessions/${sessionCode}/${selectedFile.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('eeg-data')
        .upload(fileName, selectedFile);

      if (uploadError) throw uploadError;

      // Complete progress
      setUploadProgress(100);

      // Get the public URL for the uploaded file
      const { data: { publicUrl } } = supabase.storage
        .from('eeg-data')
        .getPublicUrl(fileName);

      // Create EEG session record
      const sessionData = {
        session_code: sessionCode,
        patient_id: patient_id,
        doctor_id: null, // Will be assigned later by a doctor
        hospital_id: userProfile.hospital_id,
        filename: selectedFile.name,
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

      setSuccess('EEG session uploaded successfully!');
      
      // Reset form
      setSelectedFile(null);
      setFormData({
        sessionNotes: '',
        sessionDuration: '',
        electrodesUsed: [],
        samplingRate: '',
        analysisType: 'binary'
      });
      fileInputRef.current.value = '';
      
      // Reload sessions
      await loadSessions();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);

    } catch (error) {
      console.error('Error uploading EEG session:', error);
      setError(error.message || 'Failed to upload EEG session. Please try again.');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleGenerateReports = async (sessionId) => {
    try {
      setIsGeneratingReports(true);
      setError('');

      // Check if session has completed analysis
      const session = sessions.find(s => s.id === sessionId);
      if (!session || session.status !== 'completed') {
        setError('Session must be completed before generating reports');
        return;
      }

      // Get analysis results
      const { data: analysisResult, error: analysisError } = await supabase
        .from('eeg_analysis_results')
        .select('*')
        .eq('session_id', sessionId)
        .single();

      if (analysisError || !analysisResult) {
        setError('Analysis results not found for this session');
        return;
      }

      // Call the report generation API
      const response = await fetch('/api/generate-reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session.access_token}`
        },
        body: JSON.stringify({
          session_id: sessionId,
          analysis_result_id: analysisResult.id
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Report generation failed');
      }

      setSuccess('Reports generated successfully!');
      
      // Update session status to indicate reports are ready
      await supabase
        .from('eeg_sessions')
        .update({ status: 'reports_generated' })
        .eq('id', sessionId);

      // Reload sessions to reflect changes
      await loadSessions();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);

    } catch (error) {
      console.error('Error generating reports:', error);
      setError(error.message || 'Failed to generate reports');
    } finally {
      setIsGeneratingReports(false);
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'uploaded': return styles.uploaded;
      case 'processing': return styles.processing;
      case 'completed': return styles.completed;
      case 'reports_generated': return styles.completed;
      case 'failed': return styles.failed;
      default: return '';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'uploaded': return '📁';
      case 'processing': return '⚡';
      case 'completed': return '✅';
      case 'reports_generated': return '📋';
      case 'failed': return '❌';
      default: return '❓';
    }
  };

  const isReportsButtonEnabled = (session) => {
    return session.status === 'completed' && !isGeneratingReports;
  };

  const calculateAge = (dateOfBirth) => {
    if (!dateOfBirth) return 'N/A';
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const handleBackToPatients = () => {
    router.push('/radiologist/doctors');
  };

  if (isLoading) {
    return (
      <>
        <Navbar />
        <div className={styles.dashboardContainer}>
          <div className={styles.loadingContainer}>
            <LoadingSpinner />
            <p>Loading patient and EEG sessions...</p>
          </div>
        </div>
      </>
    );
  }

  if (!patient) {
    return (
      <>
        <Navbar />
        <div className={styles.dashboardContainer}>
          <div className={styles.errorState}>
            <h2>Patient Not Found</h2>
            <p>The requested patient could not be found or you don't have access.</p>
            <button className={styles.primaryButton} onClick={handleBackToPatients}>
              Back to Patient Selection
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
          <button className={styles.backButton} onClick={handleBackToPatients}>
            ← Back to Patient Selection
          </button>
          <h1>EEG Session Management</h1>
          <p>Manage EEG data uploads and analysis for {patient.full_name}</p>
        </div>

        {/* Messages */}
        {error && (
          <div className={styles.errorAlert}>
            <span>⚠️ {error}</span>
            <button onClick={() => setError('')}>×</button>
          </div>
        )}

        {success && (
          <div className={styles.successAlert}>
            <span>✅ {success}</span>
          </div>
        )}

        {/* Patient Information */}
        <div className={styles.contentSection}>
          <h2>Patient Information</h2>
          <div className={styles.infoCard}>
            <div className={styles.patientDetailsGrid}>
              <div>
                <p><strong>Name:</strong> {patient.full_name}</p>
                <p><strong>Patient ID:</strong> {patient.unique_identifier || patient.patient_profiles?.patient_id || 'N/A'}</p>
              </div>
              <div>
                <p><strong>Age:</strong> {calculateAge(patient.date_of_birth)} years</p>
                <p><strong>Blood Type:</strong> {patient.patient_profiles?.blood_groups?.blood_type || 'N/A'}</p>
              </div>
              <div>
                <p><strong>Email:</strong> {patient.email}</p>
                <p><strong>Hospital:</strong> {hospitalData?.name}</p>
              </div>
            </div>
          </div>
        </div>

        {/* EEG Upload Form */}
        <div className={styles.contentSection}>
          <h2>Upload New EEG Session</h2>
          <form onSubmit={handleUpload} className={styles.uploadForm}>
            {/* File Upload */}
            <div className={styles.formGroup}>
              <label htmlFor="eegFile">EEG Data File *</label>
              <input
                ref={fileInputRef}
                type="file"
                id="eegFile"
                name="eegFile"
                onChange={handleFileSelect}
                accept=".edf,.bdf,.gdf,.csv,.mat"
                className={styles.fileInput}
                disabled={isUploading}
                required
              />
              {selectedFile && (
                <div className={styles.fileInfo}>
                  📁 {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                </div>
              )}
              <p className={styles.inputNote}>
                Supported formats: .edf, .bdf, .gdf, .csv, .mat (Max size: 200MB)
              </p>
            </div>

            {/* Upload Progress */}
            {isUploading && (
              <div className={styles.uploadProgress}>
                <div className={styles.progressBar}>
                  <div 
                    className={styles.progressFill} 
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
                <p>Uploading... {uploadProgress}%</p>
              </div>
            )}

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
                  disabled={isUploading}
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
                  disabled={isUploading}
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
                  disabled={isUploading}
                  required
                >
                  <option value="binary">Binary Classification</option>
                  <option value="multiclass">Multiclass Classification</option>
                  <option value="regression">Regression Analysis</option>
                </select>
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
                    disabled={isUploading}
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
                rows={3}
                disabled={isUploading}
              />
            </div>

            {/* Form Actions */}
            <div className={styles.formActions}>
              <button
                type="submit"
                className={styles.primaryButton}
                disabled={isUploading}
              >
                {isUploading ? (
                  <>
                    <LoadingSpinner size={16} />
                    Uploading Session...
                  </>
                ) : (
                  'Upload EEG Session'
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Session History */}
        <div className={styles.contentSection}>
          <div className={styles.sectionHeader}>
            <h2>EEG Session History ({sessions.length})</h2>
            <button 
              onClick={loadSessions}
              className={styles.refreshButton}
            >
              🔄 Refresh
            </button>
          </div>

          {sessions.length > 0 ? (
            <div className={styles.sessionsTable}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Session Code</th>
                    <th>Upload Date</th>
                    <th>Duration</th>
                    <th>Status</th>
                    <th>Doctor</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map(session => (
                    <tr key={session.id}>
                      <td>{session.session_code}</td>
                      <td>{new Date(session.created_at).toLocaleDateString()}</td>
                      <td>{session.session_duration} min</td>
                      <td>
                        <span className={`${styles.statusBadge} ${getStatusBadgeClass(session.status)}`}>
                          {getStatusIcon(session.status)} {session.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td>{session.doctor?.full_name || 'Unassigned'}</td>
                      <td>
                        <div className={styles.actionButtons}>
                          <button
                            className={styles.secondaryButton}
                            onClick={() => router.push(`/radiologist/session/${session.id}`)}
                          >
                            View Details
                          </button>
                          <button
                            className={styles.primaryButton}
                            onClick={() => handleGenerateReports(session.id)}
                            disabled={!isReportsButtonEnabled(session)}
                            title={
                              session.status !== 'completed' 
                                ? 'Status must be "completed" to generate reports' 
                                : 'Generate patient, doctor, and technical reports'
                            }
                          >
                            {isGeneratingReports ? (
                              <>
                                <LoadingSpinner size={14} />
                                Generating...
                              </>
                            ) : (
                              'Generate Reports'
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>📊</div>
              <h3>No EEG Sessions</h3>
              <p>No EEG sessions have been uploaded for this patient yet.</p>
              <p>Use the upload form above to add the first EEG session.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default withAuth(PatientEEGSessions, ['radiologist']);