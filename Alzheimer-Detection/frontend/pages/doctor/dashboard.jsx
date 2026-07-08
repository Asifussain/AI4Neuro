import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../components/AuthProvider';
import withAuth from '../../components/withAuth';
import Navbar from '../../components/Navbar';
import UnifiedSidebar from '../../components/UnifiedSidebar';
import LoadingSpinner from '../../components/LoadingSpinner';
import supabase from '../../lib/supabaseClient';
import styles from '../../styles/DoctorDashboard.module.css';

function DoctorDashboard() {
  const router = useRouter();
  const { user, userProfile, hospitalData } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [dashboardStats, setDashboardStats] = useState({
    totalPatients: 0,
    pendingAssessments: 0,
    completedSessions: 0,
    todayAppointments: 0
  });

  // Sync activeTab with URL query parameter
  useEffect(() => {
    if (router.isReady) {
      const tabFromUrl = router.query.tab || 'overview';
      setActiveTab(tabFromUrl);
    }
  }, [router.isReady, router.query.tab]);

  const [eegSessions, setEegSessions] = useState([]);
  const [technicianReports, setTechnicianReports] = useState([]);
  const [myPatients, setMyPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientDetails, setPatientDetails] = useState(null);
  const [analyticsData, setAnalyticsData] = useState({
    assessmentTrend: [],
    patientStatusDistribution: { verified: 0, pending: 0 },
    detectionStats: { cn: 0, mci: 0, ad: 0, normal: 0, alzheimers: 0 },
    thisWeekAssessments: 0,
    totalAssessments: 0
  });

  useEffect(() => {
    if (userProfile?.id && userProfile?.role === 'doctor') {
      console.log('👨‍⚕️ Doctor Profile loaded:', {
        id: userProfile.id,
        role: userProfile.role,
        name: userProfile.full_name,
        email: userProfile.email
      });
      fetchDashboardData();
    }
  }, [userProfile]);

  // Calculate analytics when data changes
  useEffect(() => {
    if (eegSessions.length > 0 || myPatients.length > 0) {
      calculateAnalytics(eegSessions, myPatients);
    }
  }, [eegSessions, myPatients]);

  const calculateAnalytics = (sessions, patients) => {
    const now = new Date();
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Calculate assessment trend for last 7 days
    const assessmentTrend = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      const count = sessions.filter(s =>
        s.created_at && s.created_at.split('T')[0] === dateStr
      ).length;
      assessmentTrend.push({
        date: dateStr,
        label: i === 0 ? 'Today' : dayNames[date.getDay()],
        count
      });
    }

    // Calculate patient status distribution
    const patientStatusDistribution = {
      verified: patients.filter(p => p.verification_status === 'verified').length,
      pending: patients.filter(p => p.verification_status !== 'verified').length
    };

    // Calculate detection statistics
    const detectionStats = {
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
          detectionStats.cn++;
        } else if (pred.includes('mci')) {
          detectionStats.mci++;
        } else if (pred === 'ad' || pred.includes('alzheimer')) {
          detectionStats.ad++;
          detectionStats.alzheimers++;
        } else if (pred.includes('normal')) {
          detectionStats.normal++;
        }
      }
    });

    // Calculate this week assessments
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisWeekAssessments = sessions.filter(s =>
      s.created_at && new Date(s.created_at) >= oneWeekAgo
    ).length;

    setAnalyticsData({
      assessmentTrend,
      patientStatusDistribution,
      detectionStats,
      thisWeekAssessments,
      totalAssessments: sessions.length
    });
  };

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      await Promise.allSettled([
        fetchDashboardStats(),
        fetchMyPatients(),
        fetchEEGSessions(),
        fetchTechnicianReports()
      ]);

      // Calculate analytics after all data is fetched
      // Note: Using current state values via refs or callbacks
      // We'll call this again in useEffect when eegSessions and myPatients change
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDashboardStats = async () => {
    try {
      let stats = {
        totalPatients: 0,
        pendingAssessments: 0,
        completedSessions: 0,
        todayAppointments: 0
      };

      try {
        // Query through patient_profiles joined with user_profiles
        const { data, count: totalPatients } = await supabase
          .from('patient_profiles')
          .select('user_id, user_profiles!patient_profiles_user_fkey!inner(account_status)', { count: 'exact' })
          .eq('assigned_doctor_id', userProfile.id)
          .eq('user_profiles.account_status', 'active');
        stats.totalPatients = totalPatients || 0;
        console.log('📊 Total patients count:', totalPatients);
      } catch (error) {
        console.error('Error fetching patient count:', error);
      }

      try {
        // Fetch pending assessments from predictions table
        const { count: pendingPredictions } = await supabase
          .from('predictions')
          .select('id', { count: 'exact', head: true })
          .eq('doctor_id', userProfile.id)
          .eq('status', 'Pending');
        stats.pendingAssessments = pendingPredictions || 0;
      } catch (error) {
        console.error('Error fetching pending sessions:', error);
      }

      try {
        // Fetch completed assessments from predictions table
        const { count: completedPredictions } = await supabase
          .from('predictions')
          .select('id', { count: 'exact', head: true })
          .eq('doctor_id', userProfile.id)
          .eq('status', 'Completed');
        stats.completedSessions = completedPredictions || 0;
      } catch (error) {
        console.error('Error fetching completed sessions:', error);
      }

      try {
        const today = new Date().toISOString().split('T')[0];
        // Fetch today's assessments from predictions table
        const { count: todayPredictions } = await supabase
          .from('predictions')
          .select('id', { count: 'exact', head: true })
          .eq('doctor_id', userProfile.id)
          .gte('created_at', today);
        stats.todayAppointments = todayPredictions || 0;
      } catch (error) {
        console.error('Error fetching today sessions:', error);
      }

      setDashboardStats(stats);
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      setDashboardStats({
        totalPatients: 0,
        pendingAssessments: 0,
        completedSessions: 0,
        todayAppointments: 0
      });
    }
  };

  const fetchMyPatients = async () => {
    try {
      console.log('🔍 Fetching patients for doctor ID:', userProfile?.id);

      // First, try a simpler query to see all patients assigned to this doctor
      const { data: allData, error: allError } = await supabase
        .from('patient_profiles')
        .select('*')
        .eq('assigned_doctor_id', userProfile.id);

      console.log('🔍 All patient_profiles for this doctor:', allData);
      console.log('🔍 Error if any:', allError);

      // Now fetch with joins
      const { data, error } = await supabase
        .from('patient_profiles')
        .select(`
          *,
          user_profiles!patient_profiles_user_fkey(
            id,
            full_name,
            email,
            phone,
            date_of_birth,
            address,
            unique_identifier,
            created_at,
            account_status
          ),
          blood_groups(blood_type)
        `)
        .eq('assigned_doctor_id', userProfile.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching my patients:', error);
        throw error;
      }

      console.log('✅ Fetched patients with joins:', data);
      console.log('📊 Total patients:', data?.length || 0);

      // Filter for active accounts on the frontend if needed
      const activePatients = data?.filter(p =>
        p.user_profiles?.account_status === 'active'
      ) || [];

      console.log('✅ Active patients after filtering:', activePatients.length);

      setMyPatients(activePatients);
    } catch (error) {
      console.error('❌ Error fetching my patients:', error);
    }
  };

  const fetchEEGSessions = async () => {
    try {
      // Fetch from predictions table with RELAXED filtering (show null doctor_id too)
      const { data, error } = await supabase
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
          technical_pdf_url
        `)
        .or(`doctor_id.eq.${userProfile.id},doctor_id.is.null`)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      console.log(`✅ Fetched ${data?.length || 0} EEG sessions (including unassigned)`);
      setEegSessions(data || []);
    } catch (error) {
      console.error('❌ Error fetching EEG sessions:', error);
    }
  };

  const fetchTechnicianReports = async () => {
    try {
      // Fetch from predictions table - RELAXED: show reports with doctor_id match OR null
      const { data, error } = await supabase
        .from('predictions')
        .select(`
          id,
          filename,
          status,
          prediction,
          created_at,
          patient_name,
          session_code,
          technical_pdf_url,
          probabilities,
          doctor_id
        `)
        .or(`doctor_id.eq.${userProfile.id},doctor_id.is.null`)
        .not('technical_pdf_url', 'is', null)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      console.log(`✅ Fetched ${data?.length || 0} technical reports (including unassigned)`);
      setTechnicianReports(data || []);
    } catch (error) {
      console.error('❌ Error fetching technical reports:', error);
    }
  };

  const fetchPatientDetails = async (patientId) => {
    try {
      setIsLoading(true);

      const { data, error } = await supabase
        .from('patient_profiles')
        .select(`
          *,
          user_profiles!patient_profiles_user_fkey!inner(*),
          blood_groups(*)
        `)
        .eq('user_id', patientId)
        .single();

      if (error) throw error;

      console.log('📋 Patient details loaded:', data);

      setPatientDetails(data);
      setSelectedPatient(patientId);
    } catch (error) {
      console.error('Error fetching patient details:', error);
      alert('Error loading patient details. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateAge = (dateOfBirth) => {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    return age;
  };

  const navigationItems = [
    { id: 'overview', label: 'Dashboard', icon: 'Dashboard' },
    { id: 'patients', label: 'My Patients', icon: 'Users', badgeKey: 'totalPatients' },
    { id: 'eeg-sessions', label: 'EEG Sessions', icon: 'Activity', badgeKey: 'pendingAssessments' },
    { id: 'reports', label: 'Reports', icon: 'FileText' },
  ];

  const renderOverview = () => {
    const { assessmentTrend, patientStatusDistribution, detectionStats } = analyticsData;

    return (
      <>
        {/* Welcome Section */}
        <div className={styles.welcomeSection}>
          <h1>Welcome back, Dr. {userProfile?.full_name?.split(' ').pop()}!</h1>
          <p className={styles.subtitle}>Here's your professional dashboard with patient management and analytics</p>
        </div>

        {/* Enhanced Stats Grid */}
        <div className={styles.overviewGrid}>
          <div className={styles.statCard} onClick={() => setActiveTab('patients')}>
            <div className={styles.statIconWrapper}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              </svg>
            </div>
            <div className={styles.statContent}>
              <h3>Total Patients</h3>
              <div className={styles.statNumber}>{dashboardStats.totalPatients}</div>
              <p>Under your care</p>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIconWrapper}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
            <div className={styles.statContent}>
              <h3>This Week</h3>
              <div className={styles.statNumber}>{analyticsData.thisWeekAssessments}</div>
              <p>Assessments completed</p>
            </div>
          </div>

          <div className={styles.statCard} onClick={() => setActiveTab('eeg-sessions')}>
            <div className={styles.statIconWrapper}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
            </div>
            <div className={styles.statContent}>
              <h3>Pending Reviews</h3>
              <div className={styles.statNumber}>{dashboardStats.pendingAssessments}</div>
              <p>Awaiting action</p>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIconWrapper}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </div>
            <div className={styles.statContent}>
              <h3>Hospital</h3>
              <div className={styles.hospitalName}>{hospitalData?.name || 'Not assigned'}</div>
            </div>
          </div>
        </div>

        {/* Analytics Charts Grid */}
        <div className={styles.analyticsGrid}>
          {/* Patient Status Distribution */}
          <div className={styles.chartCard}>
            <h3 className={styles.chartTitle}>Patient Status</h3>
            {dashboardStats.totalPatients > 0 ? (
              <div className={styles.pieChartContainer}>
                <svg className={styles.pieChart} viewBox="0 0 200 200">
                  {(() => {
                    const total = patientStatusDistribution.verified + patientStatusDistribution.pending;
                    if (total === 0) {
                      return <text x="100" y="100" fill="#64748b" fontSize="14" textAnchor="middle">No patients</text>;
                    }

                    const verifiedPercent = (patientStatusDistribution.verified / total) * 100;
                    const pendingPercent = (patientStatusDistribution.pending / total) * 100;

                    const createArc = (startPercent, endPercent) => {
                      const startAngle = (startPercent / 100) * 360 - 90;
                      const endAngle = (endPercent / 100) * 360 - 90;
                      const startRad = startAngle * Math.PI / 180;
                      const endRad = endAngle * Math.PI / 180;

                      const x1 = 100 + 80 * Math.cos(startRad);
                      const y1 = 100 + 80 * Math.sin(startRad);
                      const x2 = 100 + 80 * Math.cos(endRad);
                      const y2 = 100 + 80 * Math.sin(endRad);

                      const largeArc = (endPercent - startPercent) > 50 ? 1 : 0;
                      return `M 100 100 L ${x1} ${y1} A 80 80 0 ${largeArc} 1 ${x2} ${y2} Z`;
                    };

                    return (
                      <>
                        {verifiedPercent > 0 && (
                          <path d={createArc(0, verifiedPercent)} fill="#10b981" opacity="0.8"/>
                        )}
                        {pendingPercent > 0 && (
                          <path d={createArc(verifiedPercent, 100)} fill="#f59e0b" opacity="0.8"/>
                        )}
                        <text x="100" y="95" fill="#f1f5f9" fontSize="28" fontWeight="bold" textAnchor="middle">
                          {total}
                        </text>
                        <text x="100" y="115" fill="#94a3b8" fontSize="12" textAnchor="middle">
                          Patients
                        </text>
                      </>
                    );
                  })()}
                </svg>
                <div className={styles.pieLegend}>
                  <div className={styles.legendItem}>
                    <div className={styles.legendColor} style={{ background: '#10b981' }}></div>
                    <span>Verified ({patientStatusDistribution.verified})</span>
                  </div>
                  <div className={styles.legendItem}>
                    <div className={styles.legendColor} style={{ background: '#f59e0b' }}></div>
                    <span>Pending ({patientStatusDistribution.pending})</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className={styles.noData}>No patient data</div>
            )}
          </div>

          {/* Assessment Activity Trend */}
          <div className={styles.chartCard}>
            <h3 className={styles.chartTitle}>Assessment Activity (Last 7 Days)</h3>
            {assessmentTrend.length > 0 ? (
              <div className={styles.lineChartContainer}>
                <svg className={styles.lineChart} viewBox="0 0 400 200">
                  {/* Y-axis labels */}
                  {[0, 1, 2, 3, 4, 5].map((val) => {
                    const maxCount = Math.max(...assessmentTrend.map(d => d.count), 5);
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
                    const maxCount = Math.max(...assessmentTrend.map(d => d.count), 5);
                    const points = assessmentTrend.map((d, i) => {
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
                          <linearGradient id="assessmentGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#10b981" stopOpacity="0.3"/>
                            <stop offset="100%" stopColor="#10b981" stopOpacity="0"/>
                          </linearGradient>
                        </defs>
                        <path d={areaD} fill="url(#assessmentGradient)"/>
                        <path d={pathD} stroke="#10b981" strokeWidth="3" fill="none"/>
                        {points.map((p, i) => (
                          <g key={i}>
                            <circle cx={p.x} cy={p.y} r="4" fill="#10b981" stroke="white" strokeWidth="2"/>
                            <text x={p.x} y="185" fill="#cbd5e1" fontSize="11" textAnchor="middle">{p.label}</text>
                          </g>
                        ))}
                      </>
                    );
                  })()}
                </svg>
              </div>
            ) : (
              <div className={styles.noData}>No assessment history</div>
            )}
          </div>

          {/* Detection Statistics */}
          <div className={styles.chartCard}>
            <h3 className={styles.chartTitle}>Detection Statistics</h3>
            {analyticsData.totalAssessments > 0 ? (
              <div className={styles.barChartContainer}>
                <svg className={styles.barChart} viewBox="0 0 400 200">
                  {(() => {
                    const results = [
                      { label: 'CN', count: detectionStats.cn, color: '#10b981' },
                      { label: 'MCI', count: detectionStats.mci, color: '#f59e0b' },
                      { label: 'AD', count: detectionStats.ad, color: '#ef4444' },
                      { label: 'Normal', count: detectionStats.normal, color: '#3b82f6' }
                    ].filter(r => r.count > 0);

                    if (results.length === 0) {
                      return <text x="200" y="100" fill="#64748b" fontSize="14" textAnchor="middle">No detection data</text>;
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
              <div className={styles.noData}>No detection data</div>
            )}
          </div>
        </div>

        {/* Recent Activity Section */}
        <div className={styles.activitySection}>
          <div className={styles.activityColumn}>
            <div className={styles.sectionHeaderSmall}>
              <h3>Recent Patients</h3>
              <button onClick={() => setActiveTab('patients')} className={styles.viewAllBtn}>
              View All →
            </button>
          </div>
          <div className={styles.recentList}>
            {myPatients.slice(0, 5).map(patient => (
              <div key={patient.user_id} className={styles.recentItem}>
                <div className={styles.recentItemAvatar}>
                  {patient.user_profiles?.full_name?.charAt(0)?.toUpperCase() || 'P'}
                </div>
                <div className={styles.recentItemContent}>
                  <h4>{patient.user_profiles?.full_name}</h4>
                  <p>ID: {patient.user_profiles?.unique_identifier}</p>
                </div>
                <button
                  onClick={() => fetchPatientDetails(patient.user_id)}
                  className={styles.quickViewBtn}
                >
                  View
                </button>
              </div>
            ))}
            {myPatients.length === 0 && (
              <div className={styles.emptyStateSmall}>
                <p>No patients yet</p>
              </div>
            )}
          </div>
        </div>

        <div className={styles.activityColumn}>
          <div className={styles.sectionHeaderSmall}>
            <h3>Recent EEG Sessions</h3>
            <button onClick={() => setActiveTab('eeg-sessions')} className={styles.viewAllBtn}>
              View All →
            </button>
          </div>
          <div className={styles.recentList}>
            {eegSessions.slice(0, 5).map(session => (
              <div key={session.id} className={styles.recentItem}>
                <div className={styles.recentItemIcon}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                  </svg>
                </div>
                <div className={styles.recentItemContent}>
                  <h4>{session.session_code || `Session-${session.id.substring(0, 8)}`}</h4>
                  <p>{session.patient_name || 'Unknown Patient'}</p>
                </div>
                <span className={`${styles.statusBadgeSmall} ${styles[session.status?.toLowerCase()]}`}>
                  {session.status}
                </span>
              </div>
            ))}
            {eegSessions.length === 0 && (
              <div className={styles.emptyStateSmall}>
                <p>No sessions yet</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Latest Reports Preview */}
      {technicianReports.length > 0 && (
        <div className={styles.reportsPreview}>
          <div className={styles.sectionHeaderSmall}>
            <h3>Latest Technical Reports</h3>
            <button onClick={() => setActiveTab('reports')} className={styles.viewAllBtn}>
              View All →
            </button>
          </div>
          <div className={styles.reportsPreviewGrid}>
            {technicianReports.slice(0, 3).map(report => {
              const confidence = report.probabilities && Array.isArray(report.probabilities)
                ? (Math.max(...report.probabilities) * 100).toFixed(1)
                : 'N/A';

              return (
                <div key={report.id} className={styles.reportPreviewCard}>
                  <div className={styles.reportPreviewHeader}>
                    <h4>{report.session_code || `Session-${report.id.substring(0, 8)}`}</h4>
                    <span className={`${styles.statusBadgeSmall} ${styles[report.status?.toLowerCase()]}`}>
                      {report.status}
                    </span>
                  </div>
                  <div className={styles.reportPreviewDetails}>
                    <p><strong>Patient:</strong> {report.patient_name || 'Unknown'}</p>
                    <p><strong>Date:</strong> {new Date(report.created_at).toLocaleDateString()}</p>
                    {report.prediction && (
                      <p><strong>Result:</strong> <span style={{ color: report.prediction.toLowerCase().includes('alz') ? '#ef4444' : '#10b981' }}>{report.prediction}</span></p>
                    )}
                    {confidence !== 'N/A' && (
                      <p><strong>Confidence:</strong> {confidence}%</p>
                    )}
                  </div>
                  {report.technical_pdf_url && (
                    <button
                      className={styles.downloadBtnSmall}
                      onClick={() => window.open(report.technical_pdf_url, '_blank')}
                    >
                      View Report
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      </>
    );
  };

  const renderMyPatients = () => (
    <div className={styles.patientManagement}>
      <div className={styles.sectionHeader}>
        <h2>My Patients</h2>
        <div className={styles.patientCount}>
          <span>Total: {myPatients.length}</span>
        </div>
      </div>

      <div className={styles.patientGrid}>
        {myPatients.map(patient => (
          <div key={patient.user_id} className={styles.patientCard}>
            <div className={styles.patientHeader}>
              <h3>{patient.user_profiles?.full_name}</h3>
              <span className={styles.patientId}>{patient.user_profiles?.unique_identifier}</span>
            </div>

            <div className={styles.patientDetails}>
              <p><strong>Age:</strong> {calculateAge(patient.user_profiles?.date_of_birth)} years</p>
              <p><strong>Phone:</strong> {patient.user_profiles?.phone}</p>
              <p><strong>Blood Group:</strong> {patient.blood_groups?.blood_type || 'N/A'}</p>
              <p><strong>Emergency:</strong> {patient.emergency_contact_name || 'N/A'}</p>

              {patient.medical_history && (
                <div className={styles.medicalInfo}>
                  <p><strong>Medical History:</strong></p>
                  <p className={styles.textPreview}>{patient.medical_history}</p>
                </div>
              )}
            </div>

            <div className={styles.patientActions}>
              <button
                onClick={() => fetchPatientDetails(patient.user_id)}
                className={styles.viewDetailsBtn}
              >
                View Full Details
              </button>
            </div>
          </div>
        ))}
      </div>

      {myPatients.length === 0 && (
        <div className={styles.emptyState}>
          <p>No patients assigned to you yet.</p>
        </div>
      )}
    </div>
  );

  const renderPatientDetails = () => {
    if (!patientDetails) return null;

    return (
      <div className={styles.patientDetailsView}>
        <button
          onClick={() => {
            setSelectedPatient(null);
            setPatientDetails(null);
          }}
          className={styles.backBtn}
        >
          ← Back to Patients
        </button>

        <h2>{patientDetails.user_profiles?.full_name}</h2>

        <div className={styles.detailsGrid}>
          <div className={styles.detailsCard}>
            <h3>Personal Information</h3>
            <div className={styles.detailRow}>
              <span>Full Name:</span>
              <span>{patientDetails.user_profiles?.full_name}</span>
            </div>
            <div className={styles.detailRow}>
              <span>Patient ID:</span>
              <span>{patientDetails.user_profiles?.unique_identifier}</span>
            </div>
            <div className={styles.detailRow}>
              <span>Age:</span>
              <span>{calculateAge(patientDetails.user_profiles?.date_of_birth)} years</span>
            </div>
            <div className={styles.detailRow}>
              <span>Phone:</span>
              <span>{patientDetails.user_profiles?.phone}</span>
            </div>
          </div>

          <div className={styles.detailsCard}>
            <h3>Medical Information</h3>
            <div className={styles.detailRow}>
              <span>Blood Group:</span>
              <span>{patientDetails.blood_groups?.blood_type || 'Not specified'}</span>
            </div>

            {patientDetails.medical_history && (
              <div className={styles.medicalSection}>
                <h4>Medical History</h4>
                <p>{patientDetails.medical_history}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderEEGSessions = () => (
    <div className={styles.sessionsView}>
      <h2>EEG Sessions</h2>
      {eegSessions.length > 0 ? (
        <div className={styles.sessionsGrid}>
          {eegSessions.map(session => {
            const confidence = session.probabilities && Array.isArray(session.probabilities)
              ? (Math.max(...session.probabilities) * 100).toFixed(1)
              : 'N/A';

            return (
              <div key={session.id} className={styles.sessionCard}>
                <div className={styles.sessionHeader}>
                  <h3>{session.session_code || `Session-${session.id.substring(0, 8)}`}</h3>
                  <span className={`${styles.statusBadge} ${styles[session.status?.toLowerCase()]}`}>
                    {session.status}
                  </span>
                </div>
                <div className={styles.sessionInfo}>
                  <p><strong>Patient:</strong> {session.patient_name || 'Unknown'}</p>
                  <p><strong>File:</strong> {session.filename}</p>
                  <p><strong>Date:</strong> {new Date(session.created_at).toLocaleDateString()}</p>
                  {session.prediction && (
                    <p><strong>Result:</strong> <span style={{ color: session.prediction.toLowerCase().includes('alz') ? '#ef4444' : '#10b981' }}>{session.prediction}</span></p>
                  )}
                  {confidence !== 'N/A' && (
                    <p><strong>Confidence:</strong> {confidence}%</p>
                  )}
                </div>
                {session.technical_pdf_url && (
                  <button
                    className={styles.downloadBtn}
                    onClick={() => window.open(session.technical_pdf_url, '_blank')}
                  >
                    View Technical Report
                  </button>
                )}
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
    <div className={styles.reportsView}>
      <h2>Technical Reports</h2>
      {technicianReports.length > 0 ? (
        <div className={styles.reportsGrid}>
          {technicianReports.map(report => {
            const confidence = report.probabilities && Array.isArray(report.probabilities)
              ? (Math.max(...report.probabilities) * 100).toFixed(1)
              : 'N/A';

            return (
              <div key={report.id} className={styles.reportCard}>
                <div className={styles.reportHeader}>
                  <h3>{report.session_code || `Session-${report.id.substring(0, 8)}`}</h3>
                  <span className={`${styles.statusBadge} ${styles[report.status?.toLowerCase()]}`}>
                    {report.status}
                  </span>
                </div>
                <p><strong>Patient:</strong> {report.patient_name || 'Unknown'}</p>
                <p><strong>File:</strong> {report.filename}</p>
                <p><strong>Date:</strong> {new Date(report.created_at).toLocaleDateString()}</p>
                {report.prediction && (
                  <p><strong>Result:</strong> <span style={{ color: report.prediction.toLowerCase().includes('alz') ? '#ef4444' : '#10b981' }}>{report.prediction}</span></p>
                )}
                {confidence !== 'N/A' && (
                  <p><strong>Confidence:</strong> {confidence}%</p>
                )}
                {report.technical_pdf_url && (
                  <button
                    className={styles.downloadBtn}
                    onClick={() => window.open(report.technical_pdf_url, '_blank')}
                  >
                    Download Technical Report
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

  // Handle tab change with URL update
  const handleTabChange = (tabId) => {
    router.push({
      pathname: router.pathname,
      query: { tab: tabId }
    }, undefined, { shallow: true });
  };

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <LoadingSpinner />
        <p>Loading dashboard...</p>
      </div>
    );
  }

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
          stats={dashboardStats}
        />

        <main className={styles.mainContent}>
          {selectedPatient ? (
            renderPatientDetails()
          ) : (
            <>
              {activeTab === 'overview' && renderOverview()}
              {activeTab === 'patients' && renderMyPatients()}
              {activeTab === 'eeg-sessions' && renderEEGSessions()}
              {activeTab === 'reports' && renderReports()}
            </>
          )}
        </main>
      </div>
    </>
  );
}

export default withAuth(DoctorDashboard, ['doctor']);
