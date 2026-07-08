import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../components/AuthProvider';
import withAuth from '../../components/withAuth';
import Navbar from '../../components/Navbar';
import UnifiedSidebar from '../../components/UnifiedSidebar';
import LoadingSpinner from '../../components/LoadingSpinner';
import supabase from '../../lib/supabaseClient';
import styles from '../../styles/RadiologistDashboard.module.css';

// Custom Icons (SVG)
const Icons = {
  Dashboard: () => (
    <svg className={styles.navIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>
    </svg>
  ),
  Stethoscope: () => (
    <svg className={styles.navIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/>
      <path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4"/>
      <circle cx="20" cy="10" r="2"/>
    </svg>
  ),
  Activity: () => (
    <svg className={styles.navIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  ),
  FileText: () => (
    <svg className={styles.navIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  ),
  Upload: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  ),
  ChevronLeft: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  ),
  Menu: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="3" y1="12" x2="21" y2="12"/>
      <line x1="3" y1="6" x2="21" y2="6"/>
      <line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  ),
};

function RadiologistDashboard() {
  const { user, userProfile, hospitalData } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef(null);

  const [activeTab, setActiveTab] = useState('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [allPredictions, setAllPredictions] = useState([]);

  // Sync activeTab with URL query parameter
  useEffect(() => {
    if (router.isReady) {
      const tabFromUrl = router.query.tab || 'overview';
      setActiveTab(tabFromUrl);
    }
  }, [router.isReady, router.query.tab]);

  // Pagination and filtering state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [predictionFilter, setPredictionFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState({ start: '', end: '' });

  const [dashboardStats, setDashboardStats] = useState({
    totalDoctors: 0,
    totalPatients: 0,
    totalSessions: 0,
    pendingSessions: 0,
    completedSessions: 0,
    todaySessions: 0,
  });

  const [doctors, setDoctors] = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [recentSessions, setRecentSessions] = useState([]);

  // EEG Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadData, setUploadData] = useState({
    file: null,
    channelIndex: 0, // 0-18 for 19 channels
    classificationType: 'binary' // 'binary' or 'multiclass'
  });
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const electrodeOptions = [
    'Fp1', 'Fp2', 'F3', 'F4', 'C3', 'C4', 'P3', 'P4', 'O1', 'O2',
    'F7', 'F8', 'T3', 'T4', 'T5', 'T6', 'Fz', 'Cz', 'Pz'
  ];

  // Calculate analytics from predictions data
  const calculateAnalytics = (predictions) => {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Calculate upload trend for last 7 days
    const uploadTrend = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      const count = predictions.filter(p =>
        p.created_at && p.created_at.split('T')[0] === dateStr
      ).length;

      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      uploadTrend.push({
        date: dateStr,
        label: i === 0 ? 'Today' : dayNames[date.getDay()],
        count
      });
    }

    // Calculate detection statistics
    const detectionStats = {
      cn: 0,
      mci: 0,
      ad: 0,
      normal: 0,
      alzheimers: 0
    };

    predictions.forEach(pred => {
      if (!pred.prediction) return;
      const predLower = pred.prediction.toLowerCase();

      if (predLower.includes('cn') || predLower.includes('cognitive') && predLower.includes('normal')) {
        detectionStats.cn++;
      } else if (predLower.includes('mci')) {
        detectionStats.mci++;
      } else if (predLower.includes('ad') || predLower.includes('alzheimer')) {
        detectionStats.ad++;
        detectionStats.alzheimers++;
      } else if (predLower.includes('normal')) {
        detectionStats.normal++;
      }
    });

    // Calculate analysis type distribution
    const analysisTypeDistribution = {
      binary: predictions.filter(p => p.analysis_type === 'binary').length,
      multiclass: predictions.filter(p => p.analysis_type === 'multiclass').length
    };

    // Calculate time-based counts
    const thisWeekUploads = predictions.filter(p =>
      p.created_at && new Date(p.created_at) >= oneWeekAgo
    ).length;

    const thisMonthUploads = predictions.filter(p =>
      p.created_at && new Date(p.created_at) >= oneMonthAgo
    ).length;

    setAnalyticsData({
      uploadTrend,
      detectionStats,
      analysisTypeDistribution,
      totalUploaded: predictions.length,
      thisWeekUploads,
      thisMonthUploads
    });
  };

  // State for analytics
  const [analyticsData, setAnalyticsData] = useState({
    uploadTrend: [],
    detectionStats: { cn: 0, mci: 0, ad: 0, normal: 0, alzheimers: 0 },
    analysisTypeDistribution: { binary: 0, multiclass: 0 },
    totalUploaded: 0,
    thisWeekUploads: 0,
    thisMonthUploads: 0
  });

  const fetchDashboardData = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setError('Authentication required');
        setIsLoading(false);
        return;
      }

      // Fetch ONLY the radiologist's own predictions
      const { data: allPreds } = await supabase
        .from('predictions')
        .select('*')
        .eq('user_id', user.id)  // Filter by radiologist's user_id
        .order('created_at', { ascending: false })
        .limit(100);

      setAllPredictions(allPreds || []);
      setRecentSessions(allPreds?.slice(0, 5) || []);

      // Calculate analytics data
      if (allPreds && allPreds.length > 0) {
        calculateAnalytics(allPreds);
      }

      let doctorsData = [];

      // Fetch doctors from API
      const doctorsResponse = await fetch('/api/radiologist/get-doctors', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ hospital_id: userProfile.hospital_id })
      });

      if (doctorsResponse.ok) {
        const doctorsResult = await doctorsResponse.json();
        if (doctorsResult.success && doctorsResult.data) {
          doctorsData = doctorsResult.data;
          setDoctors(doctorsData);
        }
      }

      // Use predictions for statistics instead of eeg_sessions
      const sessionsData = allPreds || [];

      const today = new Date().toISOString().split('T')[0];
      setRecentSessions(sessionsData?.slice(0, 10) || []);

      setDashboardStats({
        totalDoctors: doctorsData.length || 0,
        totalPatients: 0, // Will be calculated when doctor is selected
        totalSessions: sessionsData?.length || 0,
        pendingSessions: sessionsData?.filter(s => s.status === 'uploaded').length || 0,
        completedSessions: sessionsData?.filter(s => s.status === 'completed' || s.status === 'reports_generated').length || 0,
        todaySessions: sessionsData?.filter(s => s.session_date?.split('T')[0] === today).length || 0,
      });

    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      setError('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  }, [userProfile]);

  useEffect(() => {
    if (user && userProfile && userProfile.role === 'radiologist') {
      fetchDashboardData();
    }
  }, [user, userProfile, fetchDashboardData]);

  const handleDoctorSelect = async (doctor) => {
    setSelectedDoctor(doctor);
    setSelectedPatient(null);
    setSessions([]);
    setActiveTab('patients');

    try {
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch('/api/radiologist/get-doctor-patients', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ doctor_id: doctor.id })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setPatients(result.data.patients || []);
          setDashboardStats(prev => ({ ...prev, totalPatients: result.data.patients?.length || 0 }));
        }
      }
    } catch (error) {
      console.error('Error fetching patients:', error);
    }
  };

  const handlePatientSelect = async (patient) => {
    setSelectedPatient(patient);
    setActiveTab('sessions');

    // Fetch patient's predictions from backend
    try {
      const { data: predictionsData } = await supabase
        .from('predictions')
        .select('*')
        .eq('user_id', patient.id)
        .order('created_at', { ascending: false });

      setSessions(predictionsData || []);
    } catch (error) {
      console.error('Error fetching predictions:', error);
    }
  };

  const handleUploadEEG = () => {
    if (!selectedPatient || !selectedDoctor) {
      alert('Please select a doctor and patient first');
      return;
    }
    setShowUploadModal(true);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type (.npy files)
      if (!file.name.endsWith('.npy')) {
        alert('Please select a .npy file');
        return;
      }
      setUploadData({ ...uploadData, file });
    }
  };

  const handleSubmitUpload = async () => {
    if (!uploadData.file) {
      alert('Please select an EEG file');
      return;
    }

    // Validate required selections
    if (!selectedPatient || !selectedDoctor) {
      alert('Please select both doctor and patient before uploading');
      return;
    }

    if (!userProfile?.hospital_id) {
      alert('Hospital information missing. Please refresh and try again.');
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(10);

      const { data: { session: authSession } } = await supabase.auth.getSession();
      const { data: { user } } = await supabase.auth.getUser();

      setUploadProgress(20);

      // Call backend Flask API for prediction
      const formData = new FormData();
      formData.append('file', uploadData.file);
      formData.append('user_id', user.id);
      formData.append('channel_index', uploadData.channelIndex.toString());

      // NEW: Required metadata for role-based filtering
      // Use the correct user_id fields from the selected doctor and patient
      const patientUserId = selectedPatient.id || selectedPatient.user_id;
      const doctorUserId = selectedDoctor.id || selectedDoctor.user_id;

      console.log('📝 Uploading with metadata:', {
        patient_id: patientUserId,
        patient_name: selectedPatient.full_name,
        doctor_id: doctorUserId,
        doctor_name: selectedDoctor.full_name,
        hospital_id: userProfile.hospital_id,
        hospital_name: hospitalData?.name
      });

      formData.append('patient_id', patientUserId);
      formData.append('doctor_id', doctorUserId);
      formData.append('hospital_id', userProfile.hospital_id);
      formData.append('uploaded_by_role', userProfile.role);
      formData.append('classification_type', uploadData.classificationType);

      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:5001';
      const predictResponse = await fetch(`${backendUrl}/api/predict`, {
        method: 'POST',
        body: formData
      });

      setUploadProgress(50);

      if (!predictResponse.ok) {
        const errorData = await predictResponse.json();
        throw new Error(errorData.error || 'Failed to start prediction');
      }

      const predictResult = await predictResponse.json();
      const predictionId = predictResult.prediction_id;

      setUploadProgress(100);

      alert(`EEG file uploaded successfully! Analysis has been started.\nPrediction ID: ${predictionId}`);
      setShowUploadModal(false);
      setUploadData({
        file: null,
        channelIndex: 0,
        classificationType: 'binary'
      });

      // Refresh dashboard data
      fetchDashboardData();
      if (selectedPatient) {
        handlePatientSelect(selectedPatient);
      }

    } catch (error) {
      console.error('Upload error:', error);
      alert(`Upload failed: ${error.message}`);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // Filter and paginate predictions
  const getFilteredPredictions = () => {
    let filtered = [...allPredictions];

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(pred =>
        pred.filename?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pred.id?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(pred => pred.status?.toLowerCase() === statusFilter.toLowerCase());
    }

    // Prediction result filter
    if (predictionFilter !== 'all') {
      if (predictionFilter === 'alzheimers') {
        filtered = filtered.filter(pred => pred.prediction?.toLowerCase().includes('alz'));
      } else if (predictionFilter === 'normal') {
        filtered = filtered.filter(pred => pred.prediction?.toLowerCase().includes('normal'));
      }
    }

    // Date filter
    if (dateFilter.start) {
      filtered = filtered.filter(pred => new Date(pred.created_at) >= new Date(dateFilter.start));
    }
    if (dateFilter.end) {
      filtered = filtered.filter(pred => new Date(pred.created_at) <= new Date(dateFilter.end + 'T23:59:59'));
    }

    return filtered;
  };

  const getPaginatedPredictions = () => {
    const filtered = getFilteredPredictions();
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filtered.slice(startIndex, endIndex);
  };

  const totalPages = Math.ceil(getFilteredPredictions().length / itemsPerPage);

  // Delete prediction
  const handleDeletePrediction = async (predictionId) => {
    if (!confirm('Are you sure you want to delete this prediction? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('predictions')
        .delete()
        .eq('id', predictionId);

      if (error) throw error;

      alert('Prediction deleted successfully');
      fetchDashboardData();
    } catch (error) {
      console.error('Delete error:', error);
      alert(`Failed to delete prediction: ${error.message}`);
    }
  };

  // Reset filters
  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setPredictionFilter('all');
    setDateFilter({ start: '', end: '' });
    setCurrentPage(1);
  };

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <LoadingSpinner />
        <p>Loading dashboard...</p>
      </div>
    );
  }

  const navigationItems = [
    { id: 'overview', label: 'Overview', icon: 'Dashboard' },
    { id: 'allPredictions', label: 'Reports', icon: 'FileText', badgeKey: 'predictions' },
    { id: 'doctors', label: 'Doctors', icon: 'Stethoscope' },
    { id: 'patients', label: 'Patients', icon: 'Users', disabled: !selectedDoctor, badgeKey: 'patients' },
    { id: 'sessions', label: 'EEG Sessions', icon: 'Activity', disabled: !selectedPatient, badgeKey: 'sessions' },
  ];

  const stats = {
    predictions: allPredictions.length,
    patients: patients.length,
    sessions: sessions.length,
  };

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
      <div className={styles.dashboardContainer}>
        <UnifiedSidebar
          user={user}
          userProfile={userProfile}
          hospitalData={hospitalData}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          navigationItems={navigationItems}
          stats={stats}
        />

        {/* Main Content */}
        <main className={styles.mainContent}>
          {error && (
            <div className={styles.errorSection}>
              <p>{error}</p>
            </div>
          )}

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className={styles.section}>
              <div className={styles.welcomeSection}>
                <h1 className={styles.pageTitle}>Welcome back, {userProfile?.full_name || 'Radiologist'}!</h1>
                <p className={styles.subtitle}>Here's your personal analytics and recent activity</p>
              </div>

              {/* Personal Stats Grid */}
              <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                  <Icons.Upload />
                  <div>
                    <h3>Total Analyses</h3>
                    <div className={styles.statNumber}>{analyticsData.totalUploaded}</div>
                    <p className={styles.statSubtext}>All time</p>
                  </div>
                </div>

                <div className={styles.statCard}>
                  <svg className={styles.navIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/>
                  </svg>
                  <div>
                    <h3>This Week</h3>
                    <div className={styles.statNumber}>{analyticsData.thisWeekUploads}</div>
                    <p className={styles.statSubtext}>Analyses uploaded</p>
                  </div>
                </div>

                <div className={styles.statCard}>
                  <Icons.FileText />
                  <div>
                    <h3>This Month</h3>
                    <div className={styles.statNumber}>{analyticsData.thisMonthUploads}</div>
                    <p className={styles.statSubtext}>Analyses uploaded</p>
                  </div>
                </div>

                <div className={styles.statCard}>
                  <svg className={styles.navIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                    <polyline points="9 22 9 12 15 12 15 22"/>
                  </svg>
                  <div>
                    <h3>Hospital</h3>
                    <div className={styles.statLabel}>{hospitalData?.name || 'N/A'}</div>
                  </div>
                </div>
              </div>

              {/* Charts and Analytics */}
              <div className={styles.analyticsGrid}>
                {/* Analysis Type Distribution Pie Chart */}
                <div className={styles.chartCard}>
                  <h3 className={styles.chartTitle}>Analysis Type Distribution</h3>
                  <div className={styles.pieChartContainer}>
                    <svg viewBox="0 0 200 200" className={styles.pieChart}>
                      {(() => {
                        const total = analyticsData.analysisTypeDistribution.binary + analyticsData.analysisTypeDistribution.multiclass;
                        if (total === 0) return <text x="100" y="100" textAnchor="middle" fill="#666">No data yet</text>;

                        const binaryPercent = (analyticsData.analysisTypeDistribution.binary / total) * 100;
                        const multiclassPercent = (analyticsData.analysisTypeDistribution.multiclass / total) * 100;

                        const createArc = (startPercent, endPercent, color) => {
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
                            <path d={createArc(0, binaryPercent, '#3b82f6')} fill="#3b82f6" opacity="0.9" />
                            <path d={createArc(binaryPercent, 100, '#8b5cf6')} fill="#8b5cf6" opacity="0.9" />
                            <circle cx="100" cy="100" r="50" fill="#1e293b" />
                            <text x="100" y="95" textAnchor="middle" fill="#fff" fontSize="20" fontWeight="bold">{total}</text>
                            <text x="100" y="115" textAnchor="middle" fill="#94a3b8" fontSize="12">Total</text>
                          </>
                        );
                      })()}
                    </svg>
                    <div className={styles.pieLegend}>
                      <div className={styles.legendItem}>
                        <span className={styles.legendColor} style={{background: '#3b82f6'}}></span>
                        <span>Binary ({analyticsData.analysisTypeDistribution.binary})</span>
                      </div>
                      <div className={styles.legendItem}>
                        <span className={styles.legendColor} style={{background: '#8b5cf6'}}></span>
                        <span>Multiclass ({analyticsData.analysisTypeDistribution.multiclass})</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Upload Trend Line Chart */}
                <div className={styles.chartCard}>
                  <h3 className={styles.chartTitle}>Upload Activity (Last 7 Days)</h3>
                  <div className={styles.lineChartContainer}>
                    {analyticsData.uploadTrend.length > 0 ? (
                      <svg viewBox="0 0 400 200" className={styles.lineChart}>
                        {/* Grid */}
                        <line x1="40" y1="20" x2="40" y2="160" stroke="#1e293b" strokeWidth="2" />
                        <line x1="40" y1="160" x2="380" y2="160" stroke="#1e293b" strokeWidth="2" />

                        {/* Y-axis labels */}
                        {[0, 1, 2, 3, 4, 5].map((val, i) => {
                          const maxCount = Math.max(...analyticsData.uploadTrend.map(d => d.count), 5);
                          const yPos = 160 - (val / 5) * 140;
                          const labelVal = Math.round((val / 5) * maxCount);
                          return (
                            <g key={i}>
                              <line x1="35" y1={yPos} x2="380" y2={yPos} stroke="#1e293b" strokeWidth="1" opacity="0.3" />
                              <text x="30" y={yPos + 4} textAnchor="end" fill="#94a3b8" fontSize="10">{labelVal}</text>
                            </g>
                          );
                        })}

                        {/* Line and points */}
                        {(() => {
                          const maxCount = Math.max(...analyticsData.uploadTrend.map(d => d.count), 5);
                          const points = analyticsData.uploadTrend.map((d, i) => {
                            const x = 60 + (i * 50);
                            const y = maxCount > 0 ? 160 - (d.count / maxCount) * 140 : 160;
                            return { x, y, count: d.count, label: d.label };
                          });

                          const pathD = points.map((p, i) =>
                            i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`
                          ).join(' ');

                          return (
                            <>
                              <path d={pathD} stroke="#10b981" strokeWidth="3" fill="none" />
                              <path d={`${pathD} L ${points[points.length - 1].x} 160 L ${points[0].x} 160 Z`}
                                    fill="url(#uploadGradient)" opacity="0.3" />
                              <defs>
                                <linearGradient id="uploadGradient" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
                                  <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                                </linearGradient>
                              </defs>
                              {points.map((p, i) => (
                                <g key={i}>
                                  <circle cx={p.x} cy={p.y} r="5" fill="#10b981" stroke="#1e293b" strokeWidth="2" />
                                  <text x={p.x} y="180" textAnchor="middle" fill="#94a3b8" fontSize="10">{p.label}</text>
                                </g>
                              ))}
                            </>
                          );
                        })()}
                      </svg>
                    ) : (
                      <div className={styles.noData}>No upload data available</div>
                    )}
                  </div>
                </div>

                {/* Detection Results Bar Chart */}
                <div className={styles.chartCard}>
                  <h3 className={styles.chartTitle}>Detection Results</h3>
                  <div className={styles.barChartContainer}>
                    {analyticsData.totalUploaded > 0 ? (
                      <svg viewBox="0 0 400 200" className={styles.barChart}>
                        {(() => {
                          const stats = analyticsData.detectionStats;
                          const values = [
                            { label: 'CN', count: stats.cn, color: '#10b981' },
                            { label: 'MCI', count: stats.mci, color: '#f59e0b' },
                            { label: 'AD', count: stats.ad, color: '#ef4444' },
                            { label: 'Normal', count: stats.normal, color: '#3b82f6' }
                          ].filter(v => v.count > 0);

                          const maxVal = Math.max(...values.map(v => v.count), 1);
                          const barWidth = 60;
                          const spacing = values.length > 0 ? (360 - values.length * barWidth) / (values.length + 1) : 40;

                          return (
                            <>
                              {values.map((item, i) => {
                                const height = (item.count / maxVal) * 120;
                                const x = spacing + i * (barWidth + spacing);

                                return (
                                  <g key={i}>
                                    <rect x={x} y={160 - height} width={barWidth} height={height} fill={item.color} opacity="0.9" rx="4" />
                                    <text x={x + barWidth/2} y={150 - height} textAnchor="middle" fill="#fff" fontSize="14" fontWeight="bold">
                                      {item.count}
                                    </text>
                                    <text x={x + barWidth/2} y="180" textAnchor="middle" fill="#94a3b8" fontSize="12">{item.label}</text>
                                  </g>
                                );
                              })}
                            </>
                          );
                        })()}
                      </svg>
                    ) : (
                      <div className={styles.noData}>No detection data available</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className={styles.recentSections}>
                <h2>Recent Analysis Activity</h2>
                {recentSessions.length === 0 ? (
                  <div className={styles.emptyState}>
                    <Icons.Upload />
                    <p>No analyses yet - start by uploading your first EEG file!</p>
                  </div>
                ) : (
                  <div className={styles.sessionsList}>
                    {recentSessions.map(session => (
                      <div key={session.id} className={styles.sessionCard}>
                        <div className={styles.sessionHeader}>
                          <div>
                            <h4>{session.filename}</h4>
                            <p className={styles.predictionId}>ID: {session.id.substring(0, 8)}...</p>
                          </div>
                          <span className={`${styles.statusBadge} ${styles[session.status?.toLowerCase()]}`}>
                            {session.status}
                          </span>
                        </div>
                        <div className={styles.sessionInfo}>
                          <p><strong>Date:</strong> {new Date(session.created_at).toLocaleDateString()}</p>
                          <p><strong>Type:</strong> {session.analysis_type || 'Binary'}</p>
                          {session.prediction && (
                            <p>
                              <strong>Result:</strong>{' '}
                              <span style={{
                                color: session.prediction.toLowerCase().includes('alz') || session.prediction.toLowerCase().includes('ad') ? '#ef4444' :
                                      session.prediction.toLowerCase().includes('mci') ? '#f59e0b' :
                                      '#10b981'
                              }}>
                                {session.prediction}
                              </span>
                            </p>
                          )}
                        </div>
                        {session.status === 'Completed' && (
                          <div className={styles.sessionActions}>
                            {session.patient_pdf_url && (
                              <a href={session.patient_pdf_url} target="_blank" rel="noopener noreferrer" className={styles.viewBtn}>
                                Patient
                              </a>
                            )}
                            {session.clinician_pdf_url && (
                              <a href={session.clinician_pdf_url} target="_blank" rel="noopener noreferrer" className={styles.viewBtn}>
                                Clinician
                              </a>
                            )}
                            {session.technical_pdf_url && (
                              <a href={session.technical_pdf_url} target="_blank" rel="noopener noreferrer" className={styles.reportBtn}>
                                Technical
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* All Predictions Tab */}
          {activeTab === 'allPredictions' && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h1 className={styles.pageTitle}>All Predictions History</h1>
                <button className={styles.refreshBtn} onClick={fetchDashboardData}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
                  </svg>
                  Refresh
                </button>
              </div>

              {/* Filters Section */}
              <div className={styles.filtersSection}>
                <div className={styles.filterRow}>
                  <div className={styles.searchBox}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="11" cy="11" r="8"/>
                      <path d="m21 21-4.35-4.35"/>
                    </svg>
                    <input
                      type="text"
                      placeholder="Search by filename or ID..."
                      value={searchQuery}
                      onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                      className={styles.searchInput}
                    />
                  </div>

                  <select
                    value={statusFilter}
                    onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                    className={styles.filterSelect}
                  >
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="processing">Processing</option>
                    <option value="completed">Completed</option>
                    <option value="failed">Failed</option>
                  </select>

                  <select
                    value={predictionFilter}
                    onChange={(e) => { setPredictionFilter(e.target.value); setCurrentPage(1); }}
                    className={styles.filterSelect}
                  >
                    <option value="all">All Results</option>
                    <option value="alzheimers">Alzheimer's</option>
                    <option value="normal">Normal</option>
                  </select>

                  <input
                    type="date"
                    value={dateFilter.start}
                    onChange={(e) => { setDateFilter({...dateFilter, start: e.target.value}); setCurrentPage(1); }}
                    className={styles.dateInput}
                    placeholder="Start Date"
                  />

                  <input
                    type="date"
                    value={dateFilter.end}
                    onChange={(e) => { setDateFilter({...dateFilter, end: e.target.value}); setCurrentPage(1); }}
                    className={styles.dateInput}
                    placeholder="End Date"
                  />

                  <button className={styles.clearFiltersBtn} onClick={resetFilters}>
                    Clear Filters
                  </button>
                </div>

                <div className={styles.resultsInfo}>
                  Showing {getPaginatedPredictions().length} of {getFilteredPredictions().length} predictions
                </div>
              </div>

              {getFilteredPredictions().length === 0 ? (
                <div className={styles.emptyState}>
                  <Icons.FileText />
                  <p>No predictions found</p>
                </div>
              ) : (
                <>
                  <div className={styles.predictionsTable}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Filename</th>
                          <th>Date</th>
                          <th>Status</th>
                          <th>Prediction</th>
                          <th>Confidence</th>
                          <th>Reports</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {getPaginatedPredictions().map(pred => (
                          <tr key={pred.id}>
                            <td>
                              <div className={styles.filenameCell}>
                                <strong>{pred.filename}</strong>
                                <small>ID: {pred.id.substring(0, 8)}...</small>
                              </div>
                            </td>
                            <td>{new Date(pred.created_at).toLocaleDateString()}</td>
                            <td>
                              <span className={`${styles.statusBadge} ${styles[pred.status?.toLowerCase()]}`}>
                                {pred.status}
                              </span>
                            </td>
                            <td>
                              {pred.prediction ? (
                                <strong style={{color: pred.prediction.toLowerCase().includes('alz') ? '#ef4444' : '#10b981'}}>
                                  {pred.prediction}
                                </strong>
                              ) : (
                                <span className={styles.mutedText}>-</span>
                              )}
                            </td>
                            <td>
                              {pred.probabilities && pred.probabilities.length > 0 ? (
                                <strong>{(Math.max(...pred.probabilities) * 100).toFixed(1)}%</strong>
                              ) : (
                                <span className={styles.mutedText}>-</span>
                              )}
                            </td>
                            <td>
                              {pred.status === 'Completed' ? (
                                <div className={styles.reportLinks}>
                                  {pred.patient_pdf_url && (
                                    <a href={pred.patient_pdf_url} target="_blank" rel="noopener noreferrer" className={styles.reportLink}>
                                      P
                                    </a>
                                  )}
                                  {pred.clinician_pdf_url && (
                                    <a href={pred.clinician_pdf_url} target="_blank" rel="noopener noreferrer" className={styles.reportLink}>
                                      C
                                    </a>
                                  )}
                                  {pred.technical_pdf_url && (
                                    <a href={pred.technical_pdf_url} target="_blank" rel="noopener noreferrer" className={styles.reportLink}>
                                      T
                                    </a>
                                  )}
                                </div>
                              ) : (
                                <span className={styles.mutedText}>-</span>
                              )}
                            </td>
                            <td>
                              <button
                                className={styles.deleteBtn}
                                onClick={() => handleDeletePrediction(pred.id)}
                                title="Delete prediction"
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                </svg>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className={styles.pagination}>
                      <button
                        className={styles.pageBtn}
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="15 18 9 12 15 6"/>
                        </svg>
                        Previous
                      </button>

                      <div className={styles.pageNumbers}>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                          <button
                            key={page}
                            className={`${styles.pageNumber} ${currentPage === page ? styles.active : ''}`}
                            onClick={() => setCurrentPage(page)}
                          >
                            {page}
                          </button>
                        ))}
                      </div>

                      <button
                        className={styles.pageBtn}
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                      >
                        Next
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="9 18 15 12 9 6"/>
                        </svg>
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Doctors Tab */}
          {activeTab === 'doctors' && (
            <div className={styles.section}>
              <h1 className={styles.pageTitle}>Select Doctor</h1>
              {doctors.length === 0 ? (
                <div className={styles.emptyState}>
                  <p>No doctors found in your hospital</p>
                </div>
              ) : (
                <div className={styles.cardGrid}>
                  {doctors.map(doctor => (
                    <div
                      key={doctor.id}
                      className={`${styles.doctorCard} ${selectedDoctor?.id === doctor.id ? styles.selected : ''}`}
                      onClick={() => handleDoctorSelect(doctor)}
                    >
                      <div className={styles.avatar}>
                        {doctor.full_name?.charAt(0)?.toUpperCase() || 'D'}
                      </div>
                      <h3>{doctor.full_name}</h3>
                      <p className={styles.specialization}>{doctor.specialization || 'General Practice'}</p>
                      <p className={styles.email}>{doctor.email}</p>
                      <div className={styles.doctorStats}>
                        <span>{doctor.experience_years || 0} years exp.</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Patients Tab */}
          {activeTab === 'patients' && (
            <div className={styles.section}>
              <h1 className={styles.pageTitle}>
                Patients of Dr. {selectedDoctor?.full_name}
              </h1>
              {patients.length === 0 ? (
                <div className={styles.emptyState}>
                  <p>No patients assigned to this doctor</p>
                </div>
              ) : (
                <div className={styles.cardGrid}>
                  {patients.map(patient => (
                    <div
                      key={patient.id}
                      className={`${styles.patientCard} ${selectedPatient?.id === patient.id ? styles.selected : ''}`}
                      onClick={() => handlePatientSelect(patient)}
                    >
                      <div className={styles.cardHeader}>
                        <h3>{patient.full_name}</h3>
                        <span className={styles.patientId}>{patient.unique_identifier}</span>
                      </div>
                      <div className={styles.cardBody}>
                        <p><strong>Email:</strong> {patient.email}</p>
                        <p><strong>DOB:</strong> {patient.date_of_birth ? new Date(patient.date_of_birth).toLocaleDateString() : 'N/A'}</p>
                        {patient.patient_profiles?.[0]?.blood_groups && (
                          <p><strong>Blood Group:</strong> {patient.patient_profiles[0].blood_groups.blood_type}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Sessions Tab */}
          {activeTab === 'sessions' && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h1 className={styles.pageTitle}>
                  EEG Sessions for {selectedPatient?.full_name}
                </h1>
                <button
                  className={styles.primaryBtn}
                  onClick={handleUploadEEG}
                >
                  <Icons.Upload />
                  Upload New EEG
                </button>
              </div>

              {sessions.length === 0 ? (
                <div className={styles.emptyState}>
                  <Icons.FileText />
                  <p>No EEG sessions for this patient</p>
                  <button className={styles.primaryBtn} onClick={handleUploadEEG}>
                    Upload First EEG
                  </button>
                </div>
              ) : (
                <div className={styles.sessionsList}>
                  {sessions.map(session => (
                    <div key={session.id} className={styles.sessionCard}>
                      <div className={styles.sessionHeader}>
                        <div>
                          <h3>Prediction ID: {session.id.substring(0, 8)}...</h3>
                          <p className={styles.filename}>{session.filename}</p>
                        </div>
                        <span className={`${styles.statusBadge} ${styles[session.status?.toLowerCase()]}`}>
                          {session.status}
                        </span>
                      </div>

                      <div className={styles.sessionDetails}>
                        <div className={styles.detailRow}>
                          <span>Date:</span>
                          <span>{new Date(session.created_at).toLocaleString()}</span>
                        </div>
                        {session.prediction && (
                          <div className={styles.detailRow}>
                            <span>Prediction:</span>
                            <strong style={{color: session.prediction.toLowerCase().includes('alz') ? '#ef4444' : '#10b981'}}>
                              {session.prediction}
                            </strong>
                          </div>
                        )}
                        {session.probabilities && session.probabilities.length > 0 && (
                          <div className={styles.detailRow}>
                            <span>Confidence:</span>
                            <strong>{(Math.max(...session.probabilities) * 100).toFixed(1)}%</strong>
                          </div>
                        )}
                      </div>

                      {session.status === 'Completed' && (
                        <div className={styles.sessionActions}>
                          {session.patient_pdf_url && (
                            <a href={session.patient_pdf_url} target="_blank" rel="noopener noreferrer" className={styles.viewBtn}>
                              Patient Report
                            </a>
                          )}
                          {session.clinician_pdf_url && (
                            <a href={session.clinician_pdf_url} target="_blank" rel="noopener noreferrer" className={styles.viewBtn}>
                              Clinician Report
                            </a>
                          )}
                          {session.technical_pdf_url && (
                            <a href={session.technical_pdf_url} target="_blank" rel="noopener noreferrer" className={styles.reportBtn}>
                              Technical Report
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>

        {/* Upload EEG Modal */}
        {showUploadModal && (
          <div className={styles.modal}>
            <div className={styles.modalContent}>
              <div className={styles.modalHeader}>
                <h2>Upload EEG File</h2>
                <button
                  className={styles.closeBtn}
                  onClick={() => setShowUploadModal(false)}
                  disabled={isUploading}
                >
                  ×
                </button>
              </div>

              <div className={styles.modalBody}>
                <div className={styles.uploadSection}>
                  <label className={styles.fileUploadLabel}>
                    <input
                      type="file"
                      accept=".npy"
                      onChange={handleFileSelect}
                      disabled={isUploading}
                      style={{ display: 'none' }}
                    />
                    <div className={styles.fileUploadBox}>
                      <Icons.Upload />
                      <p>{uploadData.file ? uploadData.file.name : 'Click to select .npy file'}</p>
                    </div>
                  </label>
                </div>

                <div className={styles.formGroup}>
                  <label style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '1rem', display: 'block' }}>
                    Classification Type
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.75rem' }}>
                    {/* Binary Classification Card */}
                    <div
                      onClick={() => !isUploading && setUploadData({ ...uploadData, classificationType: 'binary' })}
                      style={{
                        border: uploadData.classificationType === 'binary' ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                        borderRadius: '8px',
                        padding: '1rem',
                        cursor: isUploading ? 'not-allowed' : 'pointer',
                        backgroundColor: uploadData.classificationType === 'binary' ? '#eff6ff' : 'white',
                        transition: 'all 0.2s',
                        opacity: isUploading ? 0.6 : 1
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                        <input
                          type="radio"
                          name="classificationType"
                          value="binary"
                          checked={uploadData.classificationType === 'binary'}
                          onChange={(e) => setUploadData({ ...uploadData, classificationType: e.target.value })}
                          disabled={isUploading}
                          style={{ marginTop: '0.25rem', cursor: 'pointer' }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: '600', fontSize: '1rem', marginBottom: '0.25rem' }}>
                            Binary Classification
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#3b82f6', fontWeight: '500', marginBottom: '0.5rem' }}>
                            2 Classes
                          </div>
                          <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.85rem', color: '#6b7280' }}>
                            <li>Normal</li>
                            <li>Alzheimer's Disease</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    {/* Multiclass Classification Card */}
                    <div
                      onClick={() => !isUploading && setUploadData({ ...uploadData, classificationType: 'multiclass' })}
                      style={{
                        border: uploadData.classificationType === 'multiclass' ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                        borderRadius: '8px',
                        padding: '1rem',
                        cursor: isUploading ? 'not-allowed' : 'pointer',
                        backgroundColor: uploadData.classificationType === 'multiclass' ? '#eff6ff' : 'white',
                        transition: 'all 0.2s',
                        opacity: isUploading ? 0.6 : 1
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                        <input
                          type="radio"
                          name="classificationType"
                          value="multiclass"
                          checked={uploadData.classificationType === 'multiclass'}
                          onChange={(e) => setUploadData({ ...uploadData, classificationType: e.target.value })}
                          disabled={isUploading}
                          style={{ marginTop: '0.25rem', cursor: 'pointer' }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: '600', fontSize: '1rem', marginBottom: '0.25rem' }}>
                            Multi-class Classification
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#3b82f6', fontWeight: '500', marginBottom: '0.5rem' }}>
                            3 Classes
                          </div>
                          <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.85rem', color: '#6b7280' }}>
                            <li>CN - Cognitive Normal</li>
                            <li>MCI - Mild Cognitive Impairment</li>
                            <li>AD - Alzheimer's Disease</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                  <small className={styles.helpText} style={{ display: 'block', marginTop: '0.5rem', lineHeight: '1.4' }}>
                    <strong>Binary:</strong> Distinguishes between Normal and Alzheimer's Disease<br/>
                    <strong>Multi-class:</strong> Provides detailed classification including early warning signs (MCI)
                  </small>
                </div>

                <div className={styles.formGroup}>
                  <label>Select Channel (0-18)</label>
                  <select
                    value={uploadData.channelIndex}
                    onChange={(e) => setUploadData({ ...uploadData, channelIndex: parseInt(e.target.value) })}
                    disabled={isUploading}
                    className={styles.channelSelect}
                  >
                    {electrodeOptions.map((electrode, index) => (
                      <option key={electrode} value={index}>
                        Channel {index} - {electrode}
                      </option>
                    ))}
                  </select>
                  <small className={styles.helpText}>Select the EEG channel to use for similarity analysis visualization</small>
                </div>

                {isUploading && (
                  <div className={styles.progressBar}>
                    <div className={styles.progressFill} style={{ width: `${uploadProgress}%` }}></div>
                    <span>{uploadProgress}%</span>
                  </div>
                )}
              </div>

              <div className={styles.modalActions}>
                <button
                  className={styles.cancelBtn}
                  onClick={() => setShowUploadModal(false)}
                  disabled={isUploading}
                >
                  Cancel
                </button>
                <button
                  className={styles.submitBtn}
                  onClick={handleSubmitUpload}
                  disabled={isUploading || !uploadData.file}
                >
                  {isUploading ? 'Uploading...' : 'Upload & Analyze'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default withAuth(RadiologistDashboard, ['radiologist']);
