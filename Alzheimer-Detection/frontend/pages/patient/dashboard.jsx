import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Navbar from '../../components/Navbar';
import UnifiedSidebar from '../../components/UnifiedSidebar';
import { useAuth, usePatientData, useHospital } from '../../components/AuthProvider';
import withAuth from '../../components/withAuth';
import LoadingSpinner from '../../components/LoadingSpinner';
import supabase from '../../lib/supabaseClient';
import styles from '../../styles/PatientDashboard.module.css';

function PatientDashboard() {
  const router = useRouter();
  const { user, userProfile } = useAuth();
  const patientData = usePatientData();
  const hospitalData = useHospital();
  const [activeTab, setActiveTab] = useState('overview');
  const [recentSessions, setRecentSessions] = useState([]);
  const [assignedDoctor, setAssignedDoctor] = useState(null);
  const [patientReports, setPatientReports] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [analyticsData, setAnalyticsData] = useState({
    testTrend: [],
    resultDistribution: { cn: 0, mci: 0, ad: 0, normal: 0, alzheimers: 0 },
    statusBreakdown: { completed: 0, pending: 0 },
    totalTests: 0,
    thisMonthTests: 0,
    latestResult: null
  });

  // Sync activeTab with URL query parameter
  useEffect(() => {
    if (router.isReady) {
      const tabFromUrl = router.query.tab || 'overview';
      setActiveTab(tabFromUrl);
    }
  }, [router.isReady, router.query.tab]);

  useEffect(() => {
    if (userProfile) {
      fetchPatientData();
    }
  }, [userProfile]);

  const calculateAnalytics = (sessions) => {
    const now = new Date();
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Calculate test trend for last 7 days
    const testTrend = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      const count = sessions.filter(s =>
        s.created_at && s.created_at.split('T')[0] === dateStr
      ).length;
      testTrend.push({
        date: dateStr,
        label: i === 0 ? 'Today' : dayNames[date.getDay()],
        count
      });
    }

    // Calculate result distribution
    const resultDistribution = {
      cn: 0,
      mci: 0,
      ad: 0,
      normal: 0,
      alzheimers: 0
    };

    sessions.forEach(session => {
      if (session.prediction) {
        const pred = session.prediction.toLowerCase();
        if (pred.includes('cn') || pred === 'cognitive normal') {
          resultDistribution.cn++;
        } else if (pred.includes('mci')) {
          resultDistribution.mci++;
        } else if (pred === 'ad' || pred.includes('alzheimer')) {
          resultDistribution.ad++;
          resultDistribution.alzheimers++;
        } else if (pred.includes('normal')) {
          resultDistribution.normal++;
        }
      }
    });

    // Calculate status breakdown
    const statusBreakdown = {
      completed: sessions.filter(s => s.status === 'Completed').length,
      pending: sessions.filter(s => s.status !== 'Completed').length
    };

    // Calculate this month tests
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthTests = sessions.filter(s =>
      s.created_at && new Date(s.created_at) >= thisMonthStart
    ).length;

    // Get latest result
    const latestResult = sessions[0]?.prediction || null;

    setAnalyticsData({
      testTrend,
      resultDistribution,
      statusBreakdown,
      totalTests: sessions.length,
      thisMonthTests,
      latestResult
    });
  };

  const fetchPatientData = async () => {
    try {
      setIsLoading(true);

      // Fetch EEG sessions from predictions table - RELAXED: show patient_id match OR user_id match
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('predictions')
        .select(`
          id,
          filename,
          status,
          prediction,
          created_at,
          patient_id,
          patient_name,
          doctor_id,
          doctor_name,
          session_code,
          probabilities,
          patient_pdf_url,
          user_id
        `)
        .or(`patient_id.eq.${userProfile.id},user_id.eq.${userProfile.id}`)
        .order('created_at', { ascending: false })
        .limit(10);

      if (sessionsError) {
        console.error('❌ Error fetching sessions:', sessionsError);
      } else {
        console.log(`✅ Fetched ${sessionsData?.length || 0} patient sessions (including unassigned)`);
        setRecentSessions(sessionsData || []);
        calculateAnalytics(sessionsData || []);
      }

      // Fetch assigned doctor information
      let doctorInfo = null;
      if (patientData?.assigned_doctor_id) {
        const { data: doctorData } = await supabase
          .from('doctor_profiles')
          .select(`
            *,
            user_profiles!doctor_profiles_user_fkey(
              full_name,
              email,
              phone
            ),
            qualifications(qualification_name)
          `)
          .eq('user_id', patientData.assigned_doctor_id)
          .single();

        if (doctorData) doctorInfo = doctorData;
      }

      // Fetch patient reports (PDFs) from predictions table - RELAXED filtering
      const { data: reportsData, error: reportsError } = await supabase
        .from('predictions')
        .select(`
          id,
          filename,
          status,
          prediction,
          created_at,
          session_code,
          patient_pdf_url,
          probabilities,
          patient_id,
          user_id
        `)
        .or(`patient_id.eq.${userProfile.id},user_id.eq.${userProfile.id}`)
        .not('patient_pdf_url', 'is', null)
        .order('created_at', { ascending: false })
        .limit(10);

      if (reportsError) {
        console.error('❌ Error fetching reports:', reportsError);
      } else {
        console.log(`✅ Fetched ${reportsData?.length || 0} patient reports (including unassigned)`);
        setPatientReports(reportsData || []);
      }

      setAssignedDoctor(doctorInfo);
    } catch (error) {
      console.error('❌ Error fetching patient data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const navigationItems = [
    { id: 'overview', label: 'Dashboard', icon: 'Dashboard' },
    { id: 'doctor', label: 'My Doctor', icon: 'Stethoscope' },
    { id: 'sessions', label: 'EEG Sessions', icon: 'Activity', badgeKey: 'sessions' },
    { id: 'reports', label: 'Reports', icon: 'FileText', badgeKey: 'reports' },
  ];

  const stats = {
    sessions: recentSessions.length,
    reports: patientReports.length,
    verified: patientData?.verification_status === 'verified' ? 1 : 0
  };

  const getVerificationStatus = () => {
    if (!patientData) return { status: 'unknown', message: 'Setting up...', color: '#6b7280' };

    const statusMap = {
      pending: { status: 'pending', message: 'Pending Verification', color: '#f59e0b' },
      verified: { status: 'verified', message: 'Verified', color: '#10b981' },
      rejected: { status: 'rejected', message: 'Verification Rejected', color: '#ef4444' }
    };

    return statusMap[patientData.verification_status] || { status: 'unknown', message: 'Unknown', color: '#6b7280' };
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderOverview = () => {
    const verificationStatus = getVerificationStatus();
    const { testTrend, resultDistribution, statusBreakdown } = analyticsData;

    // Helper function to get result color
    const getResultColor = (result) => {
      if (!result) return '#94a3b8';
      const pred = result.toLowerCase();
      if (pred.includes('cn') || pred.includes('cognitive normal')) return '#10b981';
      if (pred.includes('mci')) return '#f59e0b';
      if (pred.includes('ad') || pred.includes('alzheimer')) return '#ef4444';
      if (pred.includes('normal')) return '#10b981';
      return '#94a3b8';
    };

    return (
      <>
        {/* Welcome Section */}
        <div className={styles.welcomeSection}>
          <h1>Welcome back, {userProfile?.full_name}!</h1>
          <p className={styles.subtitle}>Here's your personal health tracking and recent test results</p>
        </div>

        {/* Compact Status Bar */}
        {patientData?.verification_status !== 'verified' && (
          <div className={styles.statusBanner} style={{ backgroundColor: `${verificationStatus.color}15`, borderColor: verificationStatus.color }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <div>
              <strong style={{ color: verificationStatus.color }}>{verificationStatus.message}</strong>
              <p>Your doctor will verify your profile soon.</p>
            </div>
          </div>
        )}

        {/* Enhanced Stats Grid */}
        <div className={styles.quickStatsGrid}>
          <div className={styles.quickStatCard}>
            <div className={styles.quickStatIcon} style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
            </div>
            <div>
              <h3>Total Tests</h3>
              <p className={styles.quickStatNumber}>{analyticsData.totalTests}</p>
            </div>
          </div>

          <div className={styles.quickStatCard}>
            <div className={styles.quickStatIcon} style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 6v6l4 2"/>
              </svg>
            </div>
            <div>
              <h3>Latest Result</h3>
              <p className={styles.quickStatName} style={{ color: getResultColor(analyticsData.latestResult) }}>
                {analyticsData.latestResult || 'No tests yet'}
              </p>
            </div>
          </div>

          <div className={styles.quickStatCard}>
            <div className={styles.quickStatIcon} style={{ background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <div>
              <h3>This Month</h3>
              <p className={styles.quickStatNumber}>{analyticsData.thisMonthTests}</p>
            </div>
          </div>

          <div className={styles.quickStatCard}>
            <div className={styles.quickStatIcon} style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/>
                <path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4"/>
                <circle cx="20" cy="10" r="2"/>
              </svg>
            </div>
            <div>
              <h3>My Doctor</h3>
              <p className={styles.quickStatName}>{assignedDoctor?.user_profiles?.full_name || 'Not Assigned'}</p>
            </div>
          </div>
        </div>

        {/* Analytics Charts Grid */}
        <div className={styles.analyticsGrid}>
          {/* Test History Timeline */}
          <div className={styles.chartCard}>
            <h3 className={styles.chartTitle}>Test History (Last 7 Days)</h3>
            {testTrend.length > 0 ? (
              <div className={styles.lineChartContainer}>
                <svg className={styles.lineChart} viewBox="0 0 400 200">
                  {/* Y-axis labels */}
                  {[0, 1, 2, 3, 4, 5].map((val) => {
                    const maxCount = Math.max(...testTrend.map(d => d.count), 5);
                    const y = 160 - (val / maxCount) * 140;
                    return (
                      <g key={val}>
                        <line x1="40" y1={y} x2="360" y2={y} stroke="rgba(148, 163, 184, 0.1)" strokeWidth="1"/>
                        <text x="25" y={y + 4} fill="#64748b" fontSize="10" textAnchor="end">{val}</text>
                      </g>
                    );
                  })}

                  {/* Line chart path */}
                  {(() => {
                    const maxCount = Math.max(...testTrend.map(d => d.count), 5);
                    const points = testTrend.map((d, i) => {
                      const x = 60 + (i * 50);
                      const y = maxCount > 0 ? 160 - (d.count / maxCount) * 140 : 160;
                      return { x, y, count: d.count, label: d.label };
                    });

                    const pathD = points.map((p, i) =>
                      i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`
                    ).join(' ');

                    const areaD = `${pathD} L ${points[points.length - 1].x} 160 L ${points[0].x} 160 Z`;

                    return (
                      <>
                        <defs>
                          <linearGradient id="testGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3"/>
                            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0"/>
                          </linearGradient>
                        </defs>
                        <path d={areaD} fill="url(#testGradient)"/>
                        <path d={pathD} stroke="#3b82f6" strokeWidth="3" fill="none"/>
                        {points.map((p, i) => (
                          <g key={i}>
                            <circle cx={p.x} cy={p.y} r="4" fill="#3b82f6" stroke="white" strokeWidth="2"/>
                            <text x={p.x} y="185" fill="#cbd5e1" fontSize="11" textAnchor="middle">{p.label}</text>
                          </g>
                        ))}
                      </>
                    );
                  })()}
                </svg>
              </div>
            ) : (
              <div className={styles.noData}>No test history available</div>
            )}
          </div>

          {/* Results Over Time */}
          <div className={styles.chartCard}>
            <h3 className={styles.chartTitle}>Detection Results</h3>
            {analyticsData.totalTests > 0 ? (
              <div className={styles.barChartContainer}>
                <svg className={styles.barChart} viewBox="0 0 400 200">
                  {(() => {
                    const results = [
                      { label: 'CN', count: resultDistribution.cn, color: '#10b981' },
                      { label: 'MCI', count: resultDistribution.mci, color: '#f59e0b' },
                      { label: 'AD', count: resultDistribution.ad, color: '#ef4444' },
                      { label: 'Normal', count: resultDistribution.normal, color: '#3b82f6' }
                    ].filter(r => r.count > 0);

                    if (results.length === 0) {
                      return <text x="200" y="100" fill="#64748b" fontSize="14" textAnchor="middle">No results yet</text>;
                    }

                    const maxCount = Math.max(...results.map(r => r.count));
                    const barWidth = 50;
                    const spacing = (360 - results.length * barWidth) / (results.length + 1);

                    return results.map((result, i) => {
                      const x = 40 + spacing + i * (barWidth + spacing);
                      const barHeight = (result.count / maxCount) * 140;
                      const y = 160 - barHeight;

                      return (
                        <g key={i}>
                          <rect
                            x={x}
                            y={y}
                            width={barWidth}
                            height={barHeight}
                            fill={result.color}
                            rx="4"
                            opacity="0.8"
                          />
                          <text x={x + barWidth / 2} y={y - 8} fill="#f1f5f9" fontSize="14" fontWeight="bold" textAnchor="middle">
                            {result.count}
                          </text>
                          <text x={x + barWidth / 2} y="185" fill="#cbd5e1" fontSize="12" textAnchor="middle">
                            {result.label}
                          </text>
                        </g>
                      );
                    });
                  })()}
                </svg>
              </div>
            ) : (
              <div className={styles.noData}>No results available</div>
            )}
          </div>

          {/* Test Status Distribution */}
          <div className={styles.chartCard}>
            <h3 className={styles.chartTitle}>Test Status</h3>
            {analyticsData.totalTests > 0 ? (
              <div className={styles.pieChartContainer}>
                <svg className={styles.pieChart} viewBox="0 0 200 200">
                  {(() => {
                    const total = statusBreakdown.completed + statusBreakdown.pending;
                    if (total === 0) {
                      return <text x="100" y="100" fill="#64748b" fontSize="14" textAnchor="middle">No tests</text>;
                    }

                    const completedPercent = (statusBreakdown.completed / total) * 100;
                    const pendingPercent = (statusBreakdown.pending / total) * 100;

                    const createArc = (startPercent, endPercent, color) => {
                      const startAngle = (startPercent / 100) * 360 - 90;
                      const endAngle = (endPercent / 100) * 360 - 90;
                      const startRad = startAngle * Math.PI / 180;
                      const endRad = endAngle * Math.PI / 180;

                      const outerRadius = 70;
                      const innerRadius = 40;

                      const x1Outer = 100 + outerRadius * Math.cos(startRad);
                      const y1Outer = 100 + outerRadius * Math.sin(startRad);
                      const x2Outer = 100 + outerRadius * Math.cos(endRad);
                      const y2Outer = 100 + outerRadius * Math.sin(endRad);

                      const x1Inner = 100 + innerRadius * Math.cos(endRad);
                      const y1Inner = 100 + innerRadius * Math.sin(endRad);
                      const x2Inner = 100 + innerRadius * Math.cos(startRad);
                      const y2Inner = 100 + innerRadius * Math.sin(startRad);

                      const largeArc = (endPercent - startPercent) > 50 ? 1 : 0;

                      return `M ${x1Outer} ${y1Outer} A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x2Outer} ${y2Outer} L ${x1Inner} ${y1Inner} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x2Inner} ${y2Inner} Z`;
                    };

                    return (
                      <>
                        {completedPercent > 0 && (
                          <path d={createArc(0, completedPercent, '#10b981')} fill="#10b981" opacity="0.8"/>
                        )}
                        {pendingPercent > 0 && (
                          <path d={createArc(completedPercent, 100, '#f59e0b')} fill="#f59e0b" opacity="0.8"/>
                        )}
                        <text x="100" y="95" fill="#f1f5f9" fontSize="28" fontWeight="bold" textAnchor="middle">
                          {total}
                        </text>
                        <text x="100" y="115" fill="#94a3b8" fontSize="12" textAnchor="middle">
                          Total Tests
                        </text>
                      </>
                    );
                  })()}
                </svg>
                <div className={styles.pieLegend}>
                  <div className={styles.legendItem}>
                    <div className={styles.legendColor} style={{ background: '#10b981' }}></div>
                    <span>Completed ({statusBreakdown.completed})</span>
                  </div>
                  <div className={styles.legendItem}>
                    <div className={styles.legendColor} style={{ background: '#f59e0b' }}></div>
                    <span>Pending ({statusBreakdown.pending})</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className={styles.noData}>No test data</div>
            )}
          </div>
        </div>

        {/* Recent Reports Section */}
        <div className={styles.recentReportsSection}>
          <div className={styles.sectionHeaderSmall}>
            <h3>Recent Test Results</h3>
            <button onClick={() => handleTabChange('sessions')} className={styles.viewAllBtn}>
              View All →
            </button>
          </div>

          {recentSessions.length > 0 ? (
            <div className={styles.reportsGrid}>
              {recentSessions.slice(0, 3).map((session) => {
                const confidence = session.probabilities && Array.isArray(session.probabilities)
                  ? (Math.max(...session.probabilities) * 100).toFixed(1)
                  : 'N/A';

                return (
                  <div key={session.id} className={styles.reportPreviewCard}>
                    <div className={styles.reportPreviewHeader}>
                      <h4>{session.session_code || `Test-${session.id.substring(0, 8)}`}</h4>
                      <span className={`${styles.statusBadgeSmall} ${styles[session.status?.toLowerCase()]}`}>
                        {session.status}
                      </span>
                    </div>
                    <div className={styles.reportPreviewDetails}>
                      <p><strong>Date:</strong> {formatDate(session.created_at)}</p>
                      {session.prediction && (
                        <p><strong>Result:</strong> <span style={{ color: getResultColor(session.prediction) }}>{session.prediction}</span></p>
                      )}
                      {confidence !== 'N/A' && (
                        <p><strong>Confidence:</strong> {confidence}%</p>
                      )}
                    </div>
                    {session.patient_pdf_url && (
                      <button
                        className={styles.viewReportBtn}
                        onClick={() => window.open(session.patient_pdf_url, '_blank')}
                      >
                        View Report
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={styles.emptyStateSmall}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
              <p>No test results yet</p>
              <span>Your test results will appear here once completed</span>
            </div>
          )}
        </div>

        {/* Doctor & Medical Info Row */}
        <div className={styles.bottomInfoRow}>
          <div className={styles.doctorInfoCard}>
            <div className={styles.sectionHeaderSmall}>
              <h3>Assigned Doctor</h3>
              <button onClick={() => handleTabChange('doctor')} className={styles.viewAllBtn}>
                View Details →
              </button>
            </div>
            {assignedDoctor ? (
              <div className={styles.doctorQuickInfo}>
                <div className={styles.doctorAvatarSmall}>
                  {assignedDoctor.user_profiles.full_name.charAt(0)}
                </div>
                <div className={styles.doctorDetailsSmall}>
                  <h4>{assignedDoctor.user_profiles.full_name}</h4>
                  <p>{assignedDoctor.specialization || 'General Practice'}</p>
                  <p className={styles.contactItem}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                    </svg>
                    {assignedDoctor.user_profiles.phone}
                  </p>
                </div>
              </div>
            ) : (
              <div className={styles.emptyStateSmall}>
                <p>No doctor assigned yet</p>
              </div>
            )}
          </div>

          <div className={styles.medicalInfoCard}>
            <h3>Medical Information</h3>
            <div className={styles.medicalInfoGrid}>
              <div className={styles.medicalInfoItem}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z"/>
                  <path d="M12 6v6l4 2"/>
                </svg>
                <div>
                  <span>Blood Group</span>
                  <strong>{patientData?.blood_groups?.blood_type || 'Not specified'}</strong>
                </div>
              </div>
              <div className={styles.medicalInfoItem}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                </svg>
                <div>
                  <span>Emergency Contact</span>
                  <strong>{patientData?.emergency_contact_name || 'Not specified'}</strong>
                </div>
              </div>
              <div className={styles.medicalInfoItem}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
                <div>
                  <span>Emergency Phone</span>
                  <strong>{patientData?.emergency_contact_phone || 'Not specified'}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  };

  const renderDoctor = () => (
    <div className={styles.doctorSection}>
      <h2>Assigned Doctor</h2>
      {assignedDoctor ? (
        <div className={styles.doctorCard}>
          <div className={styles.doctorInfo}>
            <div className={styles.doctorAvatar}>
              {assignedDoctor.user_profiles.full_name.charAt(0)}
            </div>
            <div>
              <h3>{assignedDoctor.user_profiles.full_name}</h3>
              <p>{assignedDoctor.specialization || 'General Practice'}</p>
              <p className={styles.license}>License: {assignedDoctor.medical_license}</p>
            </div>
          </div>
          <div className={styles.contactInfo}>
            <p>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '8px', verticalAlign: 'middle' }}>
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
              {assignedDoctor.user_profiles.email}
            </p>
            <p>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '8px', verticalAlign: 'middle' }}>
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
              {assignedDoctor.user_profiles.phone}
            </p>
          </div>
        </div>
      ) : (
        <div className={styles.emptyState}>
          <p>No doctor assigned yet.</p>
        </div>
      )}
    </div>
  );

  const renderSessions = () => (
    <div className={styles.sessionsSection}>
      <h2>Recent EEG Sessions</h2>
      {recentSessions.length > 0 ? (
        <div className={styles.sessionsList}>
          {recentSessions.map((session) => {
            const confidence = session.probabilities && Array.isArray(session.probabilities)
              ? (Math.max(...session.probabilities) * 100).toFixed(1)
              : 'N/A';

            return (
              <div key={session.id} className={styles.sessionCard}>
                <div className={styles.sessionHeader}>
                  <h4>{session.session_code || `Session-${session.id.substring(0, 8)}`}</h4>
                  <span className={`${styles.statusBadge} ${styles[session.status?.toLowerCase()]}`}>
                    {session.status}
                  </span>
                </div>
                <div className={styles.sessionDetails}>
                  <p><strong>File:</strong> {session.filename}</p>
                  <p><strong>Date:</strong> {formatDate(session.created_at)}</p>
                  <p><strong>Doctor:</strong> {session.doctor_name || 'Not assigned'}</p>
                  {session.prediction && (
                    <div className={styles.analysisResult}>
                      <p><strong>Result:</strong> <span style={{ color: session.prediction.toLowerCase().includes('alz') ? '#ef4444' : '#10b981' }}>{session.prediction}</span></p>
                      {confidence !== 'N/A' && (
                        <p><strong>Confidence:</strong> {confidence}%</p>
                      )}
                    </div>
                  )}
                  {session.patient_pdf_url && (
                    <button
                      className={styles.downloadButton}
                      onClick={() => window.open(session.patient_pdf_url, '_blank')}
                    >
                      View My Report
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className={styles.emptyState}>
          <p>No EEG sessions found.</p>
        </div>
      )}
    </div>
  );

  const renderReports = () => (
    <div className={styles.reportsSection}>
      <h2>My EEG Reports</h2>
      {patientReports.length > 0 ? (
        <div className={styles.reportsList}>
          {patientReports.map((report) => {
            const confidence = report.probabilities && Array.isArray(report.probabilities)
              ? (Math.max(...report.probabilities) * 100).toFixed(1)
              : 'N/A';

            return (
              <div key={report.id} className={styles.reportCard}>
                <div className={styles.reportHeader}>
                  <h4>{report.session_code || `Session-${report.id.substring(0, 8)}`}</h4>
                  <span className={`${styles.statusBadge} ${styles[report.status?.toLowerCase()]}`}>
                    {report.status}
                  </span>
                </div>
                <p><strong>File:</strong> {report.filename}</p>
                <p><strong>Date:</strong> {formatDate(report.created_at)}</p>
                {report.prediction && (
                  <p><strong>Result:</strong> <span style={{ color: report.prediction.toLowerCase().includes('alz') ? '#ef4444' : '#10b981' }}>{report.prediction}</span></p>
                )}
                {confidence !== 'N/A' && (
                  <p><strong>Confidence:</strong> {confidence}%</p>
                )}
                {report.patient_pdf_url && (
                  <button
                    className={styles.downloadButton}
                    onClick={() => window.open(report.patient_pdf_url, '_blank')}
                  >
                    Download Report
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className={styles.emptyState}>
          <p>No reports available yet.</p>
        </div>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <LoadingSpinner />
        <p>Loading dashboard...</p>
      </div>
    );
  }

  // Handle tab change with URL update
  const handleTabChange = (tabId) => {
    router.push({
      pathname: router.pathname,
      query: { tab: tabId }
    }, undefined, { shallow: true });
  };

  return (
    <>
      <Navbar />
      <div className={styles.dashboardLayout}>
        <UnifiedSidebar
          user={user}
          userProfile={userProfile}
          hospitalData={hospitalData}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          navigationItems={navigationItems}
          stats={stats}
        />

        <main className={styles.mainContent}>
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'doctor' && renderDoctor()}
          {activeTab === 'sessions' && renderSessions()}
          {activeTab === 'reports' && renderReports()}
        </main>
      </div>
    </>
  );
}

export default withAuth(PatientDashboard, ['patient']);
