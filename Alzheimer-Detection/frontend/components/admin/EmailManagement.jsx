import { useState, useEffect } from 'react';
import { useAuth } from '../AuthProvider';
import LoadingSpinner from '../LoadingSpinner';
import supabase from '../../lib/supabaseClient';
import styles from '../../styles/EmailManagement.module.css';

export default function EmailManagement() {
  const { user, userProfile } = useAuth();
  const [emailLogs, setEmailLogs] = useState([]);
  const [emailStats, setEmailStats] = useState({
    totalSent: 0,
    successRate: 0,
    failedEmails: 0,
    todaysSent: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all', 'success', 'failed', 'pending'
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (userProfile && userProfile.role === 'admin') {
      fetchEmailData();
    }
  }, [userProfile]);

  const fetchEmailData = async () => {
    try {
      setIsLoading(true);
      
      // Mock email logs data (in real implementation, this would come from your email service)
      const mockEmailLogs = [
        {
          id: '1',
          recipient_email: 'john.doe@hospital.com',
          recipient_name: 'John Doe',
          email_type: 'account_creation',
          status: 'delivered',
          sent_at: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
          delivered_at: new Date(Date.now() - 2 * 60 * 60 * 1000 + 30000),
          subject: 'Your AI4NEURO Account Credentials',
          role: 'patient',
          unique_id: 'HSP-PAT-1001'
        },
        {
          id: '2',
          recipient_email: 'dr.smith@hospital.com',
          recipient_name: 'Dr. Sarah Smith',
          email_type: 'account_creation',
          status: 'delivered',
          sent_at: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
          delivered_at: new Date(Date.now() - 4 * 60 * 60 * 1000 + 45000),
          subject: 'Your AI4NEURO Account Credentials',
          role: 'doctor',
          unique_id: 'HSP-DOC-2001'
        },
        {
          id: '3',
          recipient_email: 'admin@hospital.com',
          recipient_name: 'Admin User',
          email_type: 'password_reset',
          status: 'failed',
          sent_at: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
          error_message: 'Invalid email address',
          subject: 'Password Reset Instructions',
          role: 'admin',
          unique_id: 'HSP-ADM-3001'
        },
        {
          id: '4',
          recipient_email: 'patient2@hospital.com',
          recipient_name: 'Jane Wilson',
          email_type: 'account_creation',
          status: 'pending',
          sent_at: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
          subject: 'Your AI4NEURO Account Credentials',
          role: 'patient',
          unique_id: 'HSP-PAT-1002'
        }
      ];

      setEmailLogs(mockEmailLogs);

      // Calculate stats
      const totalSent = mockEmailLogs.length;
      const delivered = mockEmailLogs.filter(log => log.status === 'delivered').length;
      const failed = mockEmailLogs.filter(log => log.status === 'failed').length;
      const todaysSent = mockEmailLogs.filter(log => {
        const today = new Date();
        const logDate = new Date(log.sent_at);
        return logDate.toDateString() === today.toDateString();
      }).length;

      setEmailStats({
        totalSent,
        successRate: totalSent > 0 ? Math.round((delivered / totalSent) * 100) : 0,
        failedEmails: failed,
        todaysSent
      });

    } catch (error) {
      console.error('Error fetching email data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetryEmail = async (emailId) => {
    try {
      // In real implementation, this would call your email service API
      console.log('Retrying email:', emailId);
      
      // Update the email status to pending
      setEmailLogs(prev => prev.map(log => 
        log.id === emailId 
          ? { ...log, status: 'pending', sent_at: new Date() }
          : log
      ));

      // Simulate API call delay
      setTimeout(() => {
        setEmailLogs(prev => prev.map(log => 
          log.id === emailId 
            ? { 
                ...log, 
                status: 'delivered', 
                delivered_at: new Date(),
                error_message: null 
              }
            : log
        ));
        
        // Refresh stats
        fetchEmailData();
      }, 2000);

      alert('Email retry initiated. Check the logs in a few moments.');
      
    } catch (error) {
      console.error('Error retrying email:', error);
      alert('Failed to retry email. Please try again.');
    }
  };

  const handleViewDetails = (log) => {
    setSelectedLog(log);
    setShowModal(true);
  };

  const getFilteredLogs = () => {
    let filtered = emailLogs;

    if (filter !== 'all') {
      filtered = filtered.filter(log => log.status === filter);
    }

    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(log => 
        log.recipient_email.toLowerCase().includes(search) ||
        log.recipient_name.toLowerCase().includes(search) ||
        log.unique_id.toLowerCase().includes(search)
      );
    }

    return filtered.sort((a, b) => new Date(b.sent_at) - new Date(a.sent_at));
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'delivered': return '✅';
      case 'failed': return '❌';
      case 'pending': return '⏳';
      default: return '📧';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'delivered': return styles.statusDelivered;
      case 'failed': return styles.statusFailed;
      case 'pending': return styles.statusPending;
      default: return styles.statusDefault;
    }
  };

  if (!userProfile || userProfile.role !== 'admin') {
    return (
      <div className={styles.accessDenied}>
        <h3>Access Denied</h3>
        <p>You need admin privileges to access email management.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <LoadingSpinner />
        <p>Loading email data...</p>
      </div>
    );
  }

  return (
    <div className={styles.emailManagement}>
      {/* Email Stats Cards */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>📧</div>
          <div className={styles.statContent}>
            <h3>Total Sent</h3>
            <div className={styles.statNumber}>{emailStats.totalSent}</div>
            <p>All time emails</p>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon}>📈</div>
          <div className={styles.statContent}>
            <h3>Success Rate</h3>
            <div className={styles.statNumber}>{emailStats.successRate}%</div>
            <p>Delivery success rate</p>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon}>❌</div>
          <div className={styles.statContent}>
            <h3>Failed Emails</h3>
            <div className={styles.statNumber}>{emailStats.failedEmails}</div>
            <p>Need attention</p>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon}>📅</div>
          <div className={styles.statContent}>
            <h3>Today's Emails</h3>
            <div className={styles.statNumber}>{emailStats.todaysSent}</div>
            <p>Sent today</p>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className={styles.controlsBar}>
        <div className={styles.filterTabs}>
          <button 
            className={filter === 'all' ? styles.activeFilter : styles.filter}
            onClick={() => setFilter('all')}
          >
            All ({emailLogs.length})
          </button>
          <button 
            className={filter === 'delivered' ? styles.activeFilter : styles.filter}
            onClick={() => setFilter('delivered')}
          >
            ✅ Delivered ({emailLogs.filter(log => log.status === 'delivered').length})
          </button>
          <button 
            className={filter === 'pending' ? styles.activeFilter : styles.filter}
            onClick={() => setFilter('pending')}
          >
            ⏳ Pending ({emailLogs.filter(log => log.status === 'pending').length})
          </button>
          <button 
            className={filter === 'failed' ? styles.activeFilter : styles.filter}
            onClick={() => setFilter('failed')}
          >
            ❌ Failed ({emailLogs.filter(log => log.status === 'failed').length})
          </button>
        </div>

        <div className={styles.searchBox}>
          <input
            type="text"
            placeholder="Search by email, name, or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
          <span className={styles.searchIcon}>🔍</span>
        </div>
      </div>

      {/* Email Logs Table */}
      <div className={styles.emailLogsSection}>
        <div className={styles.sectionHeader}>
          <h2>📧 Email Logs</h2>
          <button onClick={fetchEmailData} className={styles.refreshButton}>
            🔄 Refresh
          </button>
        </div>

        {getFilteredLogs().length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>📭</div>
            <h3>No emails found</h3>
            <p>No emails match your current filter criteria.</p>
          </div>
        ) : (
          <div className={styles.emailTable}>
            {getFilteredLogs().map(log => (
              <div key={log.id} className={styles.emailRow}>
                <div className={styles.emailInfo}>
                  <div className={styles.emailHeader}>
                    <div className={styles.recipient}>
                      <span className={styles.recipientName}>{log.recipient_name}</span>
                      <span className={styles.recipientEmail}>{log.recipient_email}</span>
                    </div>
                    <div className={styles.emailMeta}>
                      <span className={`${styles.status} ${getStatusColor(log.status)}`}>
                        {getStatusIcon(log.status)} {log.status}
                      </span>
                      <span className={styles.roleTag}>{log.role}</span>
                    </div>
                  </div>
                  
                  <div className={styles.emailDetails}>
                    <div className={styles.subject}>{log.subject}</div>
                    <div className={styles.metadata}>
                      <span>ID: {log.unique_id}</span>
                      <span>Type: {log.email_type.replace('_', ' ')}</span>
                      <span>Sent: {log.sent_at.toLocaleString()}</span>
                      {log.delivered_at && (
                        <span>Delivered: {log.delivered_at.toLocaleString()}</span>
                      )}
                    </div>
                    {log.error_message && (
                      <div className={styles.errorMessage}>
                        Error: {log.error_message}
                      </div>
                    )}
                  </div>
                </div>

                <div className={styles.emailActions}>
                  <button 
                    onClick={() => handleViewDetails(log)}
                    className={styles.viewButton}
                  >
                    👁️ View
                  </button>
                  {log.status === 'failed' && (
                    <button 
                      onClick={() => handleRetryEmail(log.id)}
                      className={styles.retryButton}
                    >
                      🔄 Retry
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Email Details Modal */}
      {showModal && selectedLog && (
        <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>📧 Email Details</h2>
              <button 
                onClick={() => setShowModal(false)}
                className={styles.closeButton}
              >
                ×
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.detailGrid}>
                <div className={styles.detailItem}>
                  <label>Recipient:</label>
                  <span>{selectedLog.recipient_name} ({selectedLog.recipient_email})</span>
                </div>
                <div className={styles.detailItem}>
                  <label>Status:</label>
                  <span className={`${styles.status} ${getStatusColor(selectedLog.status)}`}>
                    {getStatusIcon(selectedLog.status)} {selectedLog.status}
                  </span>
                </div>
                <div className={styles.detailItem}>
                  <label>Subject:</label>
                  <span>{selectedLog.subject}</span>
                </div>
                <div className={styles.detailItem}>
                  <label>Email Type:</label>
                  <span>{selectedLog.email_type.replace('_', ' ')}</span>
                </div>
                <div className={styles.detailItem}>
                  <label>User Role:</label>
                  <span>{selectedLog.role}</span>
                </div>
                <div className={styles.detailItem}>
                  <label>User ID:</label>
                  <span>{selectedLog.unique_id}</span>
                </div>
                <div className={styles.detailItem}>
                  <label>Sent At:</label>
                  <span>{selectedLog.sent_at.toLocaleString()}</span>
                </div>
                {selectedLog.delivered_at && (
                  <div className={styles.detailItem}>
                    <label>Delivered At:</label>
                    <span>{selectedLog.delivered_at.toLocaleString()}</span>
                  </div>
                )}
                {selectedLog.error_message && (
                  <div className={styles.detailItem}>
                    <label>Error Message:</label>
                    <span className={styles.errorText}>{selectedLog.error_message}</span>
                  </div>
                )}
              </div>
            </div>

            <div className={styles.modalActions}>
              {selectedLog.status === 'failed' && (
                <button 
                  onClick={() => {
                    handleRetryEmail(selectedLog.id);
                    setShowModal(false);
                  }}
                  className={styles.retryButton}
                >
                  🔄 Retry Email
                </button>
              )}
              <button 
                onClick={() => setShowModal(false)}
                className={styles.closeModalButton}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}