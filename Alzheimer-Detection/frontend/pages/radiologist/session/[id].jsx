import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Navbar from '../../../components/Navbar';
import { useAuth } from '../../../components/AuthProvider';
import withAuth from '../../../components/withAuth';
import LoadingSpinner from '../../../components/LoadingSpinner';
import supabase from '../../../lib/supabaseClient';
import styles from '../../../styles/DashboardLayout.module.css';

function EEGSessionDetails() {
  const { user, userProfile } = useAuth();
  const router = useRouter();
  const { id: sessionId } = router.query;

  // State management
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [session, setSession] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [reports, setReports] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (sessionId && userProfile) {
      loadSessionData();
    }
  }, [sessionId, userProfile]);

  const loadSessionData = async () => {
    try {
      setIsLoading(true);
      setError('');

      // Load session details with related data
      const { data: sessionData, error: sessionError } = await supabase
        .from('eeg_sessions')
        .select(`
          *,
          doctor:user_profiles!doctor_id(
            full_name,
            email,
            doctor_profiles(specialization)
          ),
          patient:user_profiles!patient_id(
            full_name,
            patient_profiles(patient_id, blood_groups(blood_type))
          )
        `)
        .eq('id', sessionId)
        .eq('hospital_id', userProfile.hospital_id)
        .single();

      if (sessionError) throw sessionError;
      setSession(sessionData);

      // Load analysis results if available
      const { data: analysisData, error: analysisError } = await supabase
        .from('eeg_analysis_results')
        .select('*')
        .eq('session_id', sessionId)
        .maybeSingle();

      if (!analysisError && analysisData) {
        setAnalysisResult(analysisData);
      }

      // Load generated reports
      const { data: reportsData, error: reportsError } = await supabase
        .from('reports')
        .select(`
          *,
          generated_for:user_profiles!generated_for_user_id(full_name, role)
        `)
        .eq('session_id', sessionId)
        .order('generated_at', { ascending: false });

      if (!reportsError && reportsData) {
        setReports(reportsData);
      }

    } catch (error) {
      console.error('Error loading session data:', error);
      setError('Failed to load session data. Please refresh the page.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartAnalysis = async () => {
    try {
      setIsProcessing(true);
      setError('');
      setSuccess('');

      // Call the backend EEG analysis API
      const response = await fetch('/api/analyze-eeg', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session.access_token}`
        },
        body: JSON.stringify({
          session_id: sessionId,
          eeg_data_url: session.eeg_data_url,
          analysis_type: session.analysis_type,
          electrodes_used: session.electrodes_used,
          sampling_rate: session.sampling_rate
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Analysis failed');
      }

      setSuccess('EEG analysis started successfully! Processing may take a few minutes.');
      
      // Update session status
      await supabase
        .from('eeg_sessions')
        .update({ status: 'processing' })
        .eq('id', sessionId);

      // Reload data to reflect changes
      setTimeout(() => {
        loadSessionData();
        setSuccess('');
      }, 3000);

    } catch (error) {
      console.error('Error starting analysis:', error);
      setError(error.message || 'Failed to start EEG analysis');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGenerateReports = async () => {
    if (!analysisResult) {
      setError('Analysis results not available for report generation');
      return;
    }

    try {
      setIsProcessing(true);
      setError('');
      setSuccess('');

      // Call the backend report generation API
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
      
      // Reload data to show new reports
      setTimeout(() => {
        loadSessionData();
        setSuccess('');
      }, 2000);

    } catch (error) {
      console.error('Error generating reports:', error);
      setError(error.message || 'Failed to generate reports');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadReport = (reportUrl, reportType) => {
    const link = document.createElement('a');
    link.href = reportUrl;
    link.download = `${session?.session_code || 'session'}-${reportType}-report.pdf`;
    link.target = '_blank';
    link.click();
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

  if (!session) {
    return (
      <>
        <Navbar />
        <div className={styles.dashboardContainer}>
          <div className={styles.errorState}>
            <h2>Session Not Found</h2>
            <p>The requested EEG session could not be found.</p>
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
          <h1>EEG Session Details</h1>
          <p>Session Code: {session.session_code}</p>
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

        {/* Session Information */}
        <div className={styles.contentSection}>
          <h2>Session Information</h2>
          <div className={styles.infoGrid}>
            <div className={styles.infoCard}>
              <h3>Doctor</h3>
              <p><strong>{session.doctor?.full_name}</strong></p>
              <p>{session.doctor?.doctor_profiles?.specialization}</p>
              <p>{session.doctor?.email}</p>
            </div>
            <div className={styles.infoCard}>
              <h3>Patient</h3>
              <p><strong>{session.patient?.full_name}</strong></p>
              <p>ID: {session.patient?.patient_profiles?.patient_id}</p>
              <p>Blood Type: {session.patient?.patient_profiles?.blood_groups?.blood_type || 'N/A'}</p>
            </div>
            <div className={styles.infoCard}>
              <h3>Session Details</h3>
              <p><strong>Status:</strong> 
                <span className={`${styles.statusBadge} ${styles[`status-${session.status}`]}`}>
                  {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
                </span>
              </p>
              <p><strong>Duration:</strong> {session.session_duration} minutes</p>
              <p><strong>Sampling Rate:</strong> {session.sampling_rate} Hz</p>
              <p><strong>Analysis Type:</strong> {session.analysis_type}</p>
            </div>
            <div className={styles.infoCard}>
              <h3>EEG Data</h3>
              <p><strong>Filename:</strong> {session.filename}</p>
              <p><strong>Electrodes:</strong> {session.electrodes_used?.length || 0} channels</p>
              <p><strong>Date:</strong> {new Date(session.session_date).toLocaleString()}</p>
            </div>
          </div>

          {session.session_notes && (
            <div className={styles.notesSection}>
              <h3>Session Notes</h3>
              <p>{session.session_notes}</p>
            </div>
          )}
        </div>

        {/* Analysis Section */}
        <div className={styles.contentSection}>
          <h2>EEG Analysis</h2>
          
          {!analysisResult && session.status === 'uploaded' && (
            <div className={styles.analysisPrompt}>
              <p>This EEG session is ready for analysis. Click the button below to start the automated analysis process.</p>
              <button
                className={styles.primaryButton}
                onClick={handleStartAnalysis}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <>
                    <LoadingSpinner size={16} />
                    Starting Analysis...
                  </>
                ) : (
                  'Start EEG Analysis'
                )}
              </button>
            </div>
          )}

          {session.status === 'processing' && (
            <div className={styles.processingState}>
              <LoadingSpinner />
              <h3>Analysis in Progress</h3>
              <p>The EEG data is currently being analyzed. This may take several minutes.</p>
            </div>
          )}

          {analysisResult && (
            <div className={styles.analysisResults}>
              <h3>Analysis Results</h3>
              <div className={styles.resultsGrid}>
                <div className={styles.resultCard}>
                  <h4>Prediction</h4>
                  <p className={styles.predictionResult}>{analysisResult.prediction}</p>
                </div>
                <div className={styles.resultCard}>
                  <h4>Confidence Score</h4>
                  <p className={styles.confidenceScore}>
                    {(analysisResult.confidence_score * 100).toFixed(1)}%
                  </p>
                </div>
                <div className={styles.resultCard}>
                  <h4>Analysis Completed</h4>
                  <p>{new Date(analysisResult.analysis_completed_at).toLocaleString()}</p>
                </div>
              </div>

              {analysisResult.probabilities && (
                <div className={styles.probabilitiesSection}>
                  <h4>Class Probabilities</h4>
                  <div className={styles.probabilitiesList}>
                    {Object.entries(analysisResult.probabilities).map(([className, probability]) => (
                      <div key={className} className={styles.probabilityItem}>
                        <span className={styles.className}>{className}:</span>
                        <span className={styles.probabilityValue}>
                          {(probability * 100).toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Reports Section */}
        <div className={styles.contentSection}>
          <div className={styles.sectionHeader}>
            <h2>Generated Reports</h2>
            {analysisResult && reports.length === 0 && (
              <button
                className={styles.primaryButton}
                onClick={handleGenerateReports}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <>
                    <LoadingSpinner size={16} />
                    Generating Reports...
                  </>
                ) : (
                  'Generate Reports'
                )}
              </button>
            )}
          </div>

          {reports.length > 0 ? (
            <div className={styles.reportsGrid}>
              {reports.map(report => (
                <div key={report.id} className={styles.reportCard}>
                  <div className={styles.reportInfo}>
                    <h3>{report.report_type.charAt(0).toUpperCase() + report.report_type.slice(1)} Report</h3>
                    <p>Generated for: {report.generated_for.full_name} ({report.generated_for.role})</p>
                    <p>Generated: {new Date(report.generated_at).toLocaleString()}</p>
                    <p className={`${styles.accessStatus} ${report.is_accessible ? styles.accessible : styles.restricted}`}>
                      {report.is_accessible ? 'Accessible' : 'Restricted'}
                    </p>
                  </div>
                  <div className={styles.reportActions}>
                    <button
                      className={styles.secondaryButton}
                      onClick={() => handleDownloadReport(report.report_url, report.report_type)}
                    >
                      Download PDF
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : analysisResult ? (
            <div className={styles.emptyState}>
              <p>No reports have been generated yet. Click "Generate Reports" to create patient, doctor, and technical reports.</p>
            </div>
          ) : (
            <div className={styles.emptyState}>
              <p>Reports will be available after EEG analysis is completed.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default withAuth(EEGSessionDetails, ['radiologist']);