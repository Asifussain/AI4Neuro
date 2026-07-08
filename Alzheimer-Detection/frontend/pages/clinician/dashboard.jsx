import React, { useState, useEffect } from 'react';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../components/AuthProvider';
import withAuth from '../../components/withAuth';
import FileUploadSection from '../../components/FileUploadSection';
import ReportViewer from '../../components/ReportViewer';
import LoadingSpinner from '../../components/LoadingSpinner';
import dashStyles from '../../styles/DashboardLayout.module.css';
import historyStyles from '../../styles/PreviousUploads.module.css';
import Link from 'next/link';
import supabase from '../../lib/supabaseClient';

function ClinicianDashboard() {
  const { user, profile } = useAuth();
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [recentHistory, setRecentHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState(null);

  const handleSelectPrediction = (id) => {
    if (id && typeof id === 'string' && id.length > 10) {
        setSelectedReportId(id);
    } else {
        console.error("Invalid prediction ID selected:", id);
    }
  };

  useEffect(() => {
    const fetchRecentHistory = async () => {
      if (!user?.id) {
        setHistoryLoading(false);
        return;
      }
      setHistoryLoading(true);
      setHistoryError(null);
      try {
        const { data, error } = await supabase
          .from('predictions')
          .select('id, filename, prediction, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(3);
        if (error) throw error;
        setRecentHistory(data || []);
      } catch (err) {
        console.error("Error fetching recent history:", err);
        setHistoryError("Failed to load recent predictions.");
        setRecentHistory([]);
      } finally {
        setHistoryLoading(false);
      }
    };
    fetchRecentHistory();
  }, [user]);

  const formatTimestamp = (timestamp) => {
      if (!timestamp) return 'N/A';
      try {
          return new Date(timestamp).toLocaleString(undefined, {
              year: 'numeric', month: 'short', day: 'numeric',
              hour: '2-digit', minute: '2-digit'
          });
      } catch (e) { return timestamp; }
    };

  return (
    <>
      <Navbar />
      <section className={dashStyles.dashboard}>
        <div className={dashStyles.dashboardContent}>
          <h1 className={dashStyles.dashboardTitle}>Clinician Dashboard</h1>
          <div style={{ marginBottom: '2.5rem' }}>
            <p style={{
              fontSize: '1.5rem',
              fontWeight: '500',
              color: 'var(--text-heading)',
              lineHeight: '1.4',
              marginBottom: '0.3rem'
            }}>
              Welcome, Dr. {profile?.full_name || user?.email}!
            </p>
            <p className={dashStyles.welcomeMessage} style={{ marginTop: '0', fontSize: '1.05rem' }}>
              Access patient analyses, upload new EEG data, and review AI-driven insights.
            </p>
          </div>
          <div className={dashStyles.dashboardCard} style={{ '--card-delay': '0.5s' }}>
            <h3 className={dashStyles.cardTitle}>Analyse New EEG Data</h3>
            <div className={dashStyles.uploadSectionWrapper}>
                <FileUploadSection />
            </div>
          </div>
          <div className={dashStyles.dashboardCard} style={{ '--card-delay': '0.7s' }}>
            <h3 className={dashStyles.cardTitle}>Recent Analysis History</h3>
            {historyLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100px' }}>
                <LoadingSpinner color="var(--accent-teal)" size="35"/>
              </div>
            ) : historyError ? (
              <p style={{ color: 'var(--error-color)', textAlign: 'center' }}>{historyError}</p>
            ) : recentHistory.length > 0 ? (
              <div className={historyStyles.predictionsTableWrapper} style={{ maxHeight: '250px', overflowY: 'auto', border: 'none', background: 'transparent' }}>
                <table className={historyStyles.predictionsTable} style={{ background: 'transparent' }}>
                  <thead>
                    <tr><th>Filename</th><th>Prediction</th><th>Date</th><th></th></tr>
                  </thead>
                  <tbody>
                    {recentHistory.map((p) => (
                      <tr key={p.id}>
                        <td>{p.filename || 'N/A'}</td>
                        <td className={p.prediction === "Alzheimer's" ? historyStyles.predictionCellAlzheimer : historyStyles.predictionCellNormal}>
                          {p.prediction || 'N/A'}
                        </td>
                        <td className={historyStyles.dateCell}>
                          {formatTimestamp(p.created_at)}
                        </td>
                        <td>
                          <button onClick={() => handleSelectPrediction(p.id)} className={historyStyles.reportLinkButton}>
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '1rem 0' }}>No recent analyses found.</p>
            )}
             <p style={{marginTop: '1rem', textAlign: 'right'}}>
                <Link href="/previous" className={historyStyles.reportLinkButton} style={{padding: '0.5rem 1rem'}}>View Full History</Link>
             </p>
          </div>
        </div>
        <div className={dashStyles.dashboardImageContainer}>
          <img
             src="/images/brain.png"
             alt="Brain Visualization"
             className={dashStyles.dashboardImage}
           />
        </div>
      </section>
      {selectedReportId && (
        <section id="report-viewer-section" style={{ maxWidth: '1100px', margin: '0 auto 4rem auto', padding: '0 2rem' }}>
          <ReportViewer
            predictionId={selectedReportId}
            userRole={profile?.role}
          />
        </section>
      )}
    </>
  );
}

export default withAuth(ClinicianDashboard, ['clinician']);
