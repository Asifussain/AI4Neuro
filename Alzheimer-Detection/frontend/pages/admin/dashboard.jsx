import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../components/AuthProvider';
import withAuth from '../../components/withAuth';
import Navbar from '../../components/Navbar';
import UnifiedSidebar from '../../components/UnifiedSidebar';
import LoadingSpinner from '../../components/LoadingSpinner';
import AddUserInterface from '../../components/admin/AddUserInterface';
import supabase from '../../lib/supabaseClient';
import styles from '../../styles/AdminDashboard.module.css';

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
  Users: () => (
    <svg className={styles.navIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  UserPlus: () => (
    <svg className={styles.navIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="8.5" cy="7" r="4"/>
      <line x1="20" y1="8" x2="20" y2="14"/>
      <line x1="23" y1="11" x2="17" y2="11"/>
    </svg>
  ),
  CheckCircle: () => (
    <svg className={styles.navIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
      <polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  ),
  Heart: () => (
    <svg className={styles.navIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
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
  Menu: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="3" y1="12" x2="21" y2="12"/>
      <line x1="3" y1="6" x2="21" y2="6"/>
      <line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  ),
  ChevronLeft: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  ),
  AlertCircle: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
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
  Grid: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7"/>
      <rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/>
      <rect x="3" y="14" width="7" height="7"/>
    </svg>
  ),
  List: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="8" y1="6" x2="21" y2="6"/>
      <line x1="8" y1="12" x2="21" y2="12"/>
      <line x1="8" y1="18" x2="21" y2="18"/>
      <line x1="3" y1="6" x2="3.01" y2="6"/>
      <line x1="3" y1="12" x2="3.01" y2="12"/>
      <line x1="3" y1="18" x2="3.01" y2="18"/>
    </svg>
  ),
  Search: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8"/>
      <path d="m21 21-4.35-4.35"/>
    </svg>
  ),
  Eye: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ),
  Filter: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
    </svg>
  ),
  X: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  Calendar: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  ChevronDown: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  ),
  ChevronUp: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="18 15 12 9 6 15"/>
    </svg>
  ),
  // Custom Professional Healthcare SVGs
  BrainAI: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 3C9.5 3 7.5 4.5 7 6.5C6 6.2 5 6.5 4.5 7.5C4 8.5 4.5 9.8 5.5 10.2C5.2 11 5 12 5 13C5 15 6 16.8 7.5 17.8C7.2 18.5 7.5 19.5 8.5 19.8C9.5 20.1 10.5 19.5 10.8 18.5C11.2 18.7 11.6 18.8 12 18.8C12.4 18.8 12.8 18.7 13.2 18.5C13.5 19.5 14.5 20.1 15.5 19.8C16.5 19.5 16.8 18.5 16.5 17.8C18 16.8 19 15 19 13C19 12 18.8 11 18.5 10.2C19.5 9.8 20 8.5 19.5 7.5C19 6.5 18 6.2 17 6.5C16.5 4.5 14.5 3 12 3Z" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="12" cy="11" r="1" fill="currentColor"/>
      <circle cx="9.5" cy="13" r="0.8" fill="currentColor"/>
      <circle cx="14.5" cy="13" r="0.8" fill="currentColor"/>
      <path d="M10 9.5C10 9.5 10.5 10 12 10C13.5 10 14 9.5 14 9.5" strokeLinecap="round"/>
    </svg>
  ),
  EEGWave: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 12 L6 12 L8 6 L10 18 L12 9 L14 15 L16 12 L18 12 L21 12" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="3" cy="12" r="1" fill="currentColor"/>
      <circle cx="21" cy="12" r="1" fill="currentColor"/>
    </svg>
  ),
  MedicalShield: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 2L4 6V11C4 16 7 20.5 12 22C17 20.5 20 16 20 11V6L12 2Z" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12 8V13M12 16H12.01" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Pulse: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 12h4l3-9 4 18 3-9h4" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="19" cy="12" r="1" fill="currentColor"/>
    </svg>
  ),
  MedicalScan: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="18" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3 9h18M9 3v18" strokeLinecap="round"/>
      <circle cx="15" cy="15" r="2" strokeWidth="1.5"/>
      <path d="M16.5 16.5L19 19" strokeLinecap="round" strokeWidth="1.5"/>
    </svg>
  ),
  Analysis: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12 7v5l3 3" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M16 4.5c2.5 1.2 4.3 3.7 4.5 6.5" strokeLinecap="round" strokeOpacity="0.5"/>
      <path d="M19.5 16c-1.2 2.5-3.7 4.3-6.5 4.5" strokeLinecap="round" strokeOpacity="0.5"/>
    </svg>
  ),
  DoctorBadge: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="8" r="4" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12 11v3M10.5 12.5h3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  ReportClipboard: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M9 2h6a1 1 0 0 1 1 1v1H8V3a1 1 0 0 1 1-1z" strokeLinecap="round" strokeLinejoin="round"/>
      <rect x="6" y="4" width="12" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M10 10h4M10 14h4M10 18h2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Lightning: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" strokeLinecap="round" strokeLinejoin="round" fill="currentColor" fillOpacity="0.1"/>
    </svg>
  ),
  Sparkles: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3v3m0 12v3m9-9h-3m-12 0H3" strokeLinecap="round"/>
      <path d="M16.5 7.5l-1.5 1.5m-6 6l-1.5 1.5m0-12l1.5 1.5m6 6l1.5 1.5" strokeLinecap="round" strokeOpacity="0.6"/>
    </svg>
  ),
  Target: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" strokeLinecap="round"/>
      <circle cx="12" cy="12" r="6" strokeLinecap="round"/>
      <circle cx="12" cy="12" r="2" fill="currentColor"/>
    </svg>
  ),
};

function AdminDashboard() {
  const router = useRouter();
  const { user, userProfile, hospitalData } = useAuth();
  const [activeTab, setActiveTabState] = useState('overview');
  const [isLoading, setIsLoading] = useState(false); // Start with false to avoid flash
  const [error, setError] = useState('');

  // Sync activeTab with URL query parameter
  useEffect(() => {
    if (router.isReady) {
      const tabFromUrl = router.query.tab || 'overview';
      setActiveTabState(tabFromUrl);
    }
  }, [router.isReady, router.query.tab]);

  // Handle tab change with URL update
  const setActiveTab = (tabId) => {
    router.push({
      pathname: router.pathname,
      query: { tab: tabId }
    }, undefined, { shallow: true });
  };

  const [dashboardStats, setDashboardStats] = useState({
    totalUsers: 0,
    pendingApprovals: 0,
    activePatients: 0,
    activeDoctors: 0,
    activeRadiologists: 0,
    unassignedPatients: 0,
  });

  const [pendingUsers, setPendingUsers] = useState([]);
  const [allPatients, setAllPatients] = useState([]);
  const [allDoctors, setAllDoctors] = useState([]);
  const [allRadiologists, setAllRadiologists] = useState([]);

  // Assignment modal states
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Search and filter states for each tab
  const [patientSearchTerm, setPatientSearchTerm] = useState('');
  const [doctorSearchTerm, setDoctorSearchTerm] = useState('');
  const [radiologistSearchTerm, setRadiologistSearchTerm] = useState('');
  const [patientFilter, setPatientFilter] = useState('all'); // all, assigned, unassigned
  const [doctorFilter, setDoctorFilter] = useState('all'); // all, with-patients, no-patients

  // Detail view states (replacing modals with full-page views)
  const [detailView, setDetailView] = useState(null); // 'patient' | 'doctor' | 'radiologist' | 'report' | null
  const [selectedPatientDetail, setSelectedPatientDetail] = useState(null);
  const [patientReports, setPatientReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [assignedDoctors, setAssignedDoctors] = useState([]);

  // Doctor detail view
  const [selectedDoctorDetail, setSelectedDoctorDetail] = useState(null);
  const [doctorPatients, setDoctorPatients] = useState([]);
  const [loadingDoctorPatients, setLoadingDoctorPatients] = useState(false);

  // Radiologist detail view
  const [selectedRadiologistDetail, setSelectedRadiologistDetail] = useState(null);
  const [radiologistActivities, setRadiologistActivities] = useState([]);
  const [loadingActivities, setLoadingActivities] = useState(false);

  // Approval modal
  const [selectedUser, setSelectedUser] = useState(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);

  // Reports state
  const [allReports, setAllReports] = useState([]);
  const [filteredReports, setFilteredReports] = useState([]);

  // Filter states for Reports
  const [reportsSearchQuery, setReportsSearchQuery] = useState('');
  const [reportsStatusFilter, setReportsStatusFilter] = useState('all');
  const [reportsPredictionFilter, setReportsPredictionFilter] = useState('all');
  const [reportsPatientFilter, setReportsPatientFilter] = useState('all');
  const [reportsDoctorFilter, setReportsDoctorFilter] = useState('all');
  const [reportsRadiologistFilter, setReportsRadiologistFilter] = useState('all');
  const [reportsDateRange, setReportsDateRange] = useState({ start: '', end: '' });

  // Filter states for Patients
  const [patientsSearchQuery, setPatientsSearchQuery] = useState('');
  const [patientsStatusFilter, setPatientsStatusFilter] = useState('all');
  const [patientsAssignmentFilter, setPatientsAssignmentFilter] = useState('all');
  const [patientsDoctorFilter, setPatientsDoctorFilter] = useState('all');
  const [patientsDateRange, setPatientsDateRange] = useState({ start: '', end: '' });
  const [filteredPatientsData, setFilteredPatientsData] = useState([]);

  // Filter states for Doctors
  const [doctorsSearchQuery, setDoctorsSearchQuery] = useState('');
  const [doctorsStatusFilter, setDoctorsStatusFilter] = useState('all');
  const [doctorsSpecializationFilter, setDoctorsSpecializationFilter] = useState('all');
  const [doctorsPatientCountFilter, setDoctorsPatientCountFilter] = useState('all');
  const [doctorsDateRange, setDoctorsDateRange] = useState({ start: '', end: '' });
  const [filteredDoctorsData, setFilteredDoctorsData] = useState([]);

  // Filter states for Radiologists
  const [radiologistsSearchQuery, setRadiologistsSearchQuery] = useState('');
  const [radiologistsStatusFilter, setRadiologistsStatusFilter] = useState('all');
  const [radiologistsActivityFilter, setRadiologistsActivityFilter] = useState('all');
  const [radiologistsDateRange, setRadiologistsDateRange] = useState({ start: '', end: '' });
  const [filteredRadiologistsData, setFilteredRadiologistsData] = useState([]);

  // View mode states for each tab (default to compact)
  const [reportsViewMode, setReportsViewMode] = useState('compact');
  const [patientsViewMode, setPatientsViewMode] = useState('compact');
  const [doctorsViewMode, setDoctorsViewMode] = useState('compact');
  const [radiologistsViewMode, setRadiologistsViewMode] = useState('compact');

  // Filter expansion states
  const [reportsFiltersExpanded, setReportsFiltersExpanded] = useState(false);
  const [patientsFiltersExpanded, setPatientsFiltersExpanded] = useState(false);
  const [doctorsFiltersExpanded, setDoctorsFiltersExpanded] = useState(false);
  const [radiologistsFiltersExpanded, setRadiologistsFiltersExpanded] = useState(false);

  // Modal state for detailed views
  const [selectedReportDetail, setSelectedReportDetail] = useState(null);
  const [showReportDetailModal, setShowReportDetailModal] = useState(false);

  // Dashboard analytics state
  const [recentActivities, setRecentActivities] = useState([]);
  const [reportsTrend, setReportsTrend] = useState([]);
  const [detectionStats, setDetectionStats] = useState({ alzheimers: 0, normal: 0 });

  // Data cache flags to prevent unnecessary refetches - using refs + sessionStorage
  const dataFetchedRef = useRef({
    dashboard: false,
    reports: false,
    activities: false
  });

  // Initialize cache from sessionStorage on mount
  useEffect(() => {
    const cachedFlag = sessionStorage.getItem('admin_dashboard_fetched');
    const cachedData = sessionStorage.getItem('admin_dashboard_data');

    if (cachedFlag === 'true' && cachedData) {
      try {
        const data = JSON.parse(cachedData);
        dataFetchedRef.current.dashboard = true;

        // Restore data from cache
        if (data.patients) setAllPatients(data.patients);
        if (data.doctors) setAllDoctors(data.doctors);
        if (data.radiologists) setAllRadiologists(data.radiologists);
        if (data.pendingUsers) setPendingUsers(data.pendingUsers);
        if (data.stats) setDashboardStats(data.stats);

        // Restore reports data and mark as fetched
        if (data.reports) {
          setAllReports(data.reports);
          dataFetchedRef.current.reports = true;
          console.log('📊 Restored reports from cache:', data.reports.length);
        }

        // Restore detection stats
        if (data.detectionStats) {
          setDetectionStats(data.detectionStats);
        }

        setIsLoading(false);
        console.log('📦 Restored data from sessionStorage - NO RELOAD!');
      } catch (e) {
        console.error('Failed to restore cache:', e);
      }
    }
  }, []);

  const fetchDashboardData = useCallback(async () => {
    // Skip if already fetched to prevent unnecessary reloads
    if (dataFetchedRef.current.dashboard) {
      console.log('⚡ Data already fetched, skipping reload');
      return;
    }

    // Get hospital_id with fallback
    const hospitalId = userProfile?.hospital_id || hospitalData?.id;

    console.log('🔄 Admin Dashboard - Starting data fetch', {
      userProfile,
      hospitalData,
      hospitalId
    });

    try {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();

      console.log('Session status:', !!session?.access_token);

      if (!session?.access_token) {
        setError('Authentication required');
        setIsLoading(false);
        return;
      }

      console.log('Fetching from API...');

      const response = await fetch('/api/admin/users-simple', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('API Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      console.log('API Result:', result);

      if (result.success && result.data) {
        const { pendingUsers, patients, doctors, radiologists, stats } = result.data;

        console.log('Dashboard data received:', {
          patientsCount: patients?.length,
          doctorsCount: doctors?.length,
          sampleDoctor: doctors?.[0],
          samplePatient: patients?.[0],
          samplePatientProfile: patients?.[0]?.patient_profiles?.[0],
          assignedDoctor: patients?.[0]?.patient_profiles?.[0]?.assigned_doctor
        });

        setPendingUsers(pendingUsers || []);
        setAllPatients(patients || []);
        setAllDoctors(doctors || []);
        setAllRadiologists(radiologists || []);

        const unassignedCount = (patients || []).filter(p => !p.patient_profiles?.[0]?.assigned_doctor_id).length;
        console.log('📊 Patient assignment stats:', {
          totalPatients: patients?.length,
          unassignedCount,
          assignedCount: patients?.length - unassignedCount,
          samplePatientWithDoctor: patients?.find(p => p.patient_profiles?.[0]?.assigned_doctor_id)
        });

        setDashboardStats({
          totalUsers: stats?.totalUsers || 0,
          pendingApprovals: (stats?.pendingPatients || 0) + (stats?.pendingDoctors || 0) + (stats?.pendingRadiologists || 0),
          activePatients: stats?.activePatients || 0,
          activeDoctors: stats?.activeDoctors || 0,
          activeRadiologists: stats?.activeRadiologists || 0,
          unassignedPatients: unassignedCount,
        });

        // Mark as fetched to prevent re-fetching
        dataFetchedRef.current.dashboard = true;
        sessionStorage.setItem('admin_dashboard_fetched', 'true');

        // Cache data for instant restore
        const cacheData = {
          patients: patients || [],
          doctors: doctors || [],
          radiologists: radiologists || [],
          pendingUsers: pendingUsers || [],
          stats: {
            totalUsers: stats?.totalUsers || 0,
            pendingApprovals: (stats?.pendingPatients || 0) + (stats?.pendingDoctors || 0) + (stats?.pendingRadiologists || 0),
            activePatients: stats?.activePatients || 0,
            activeDoctors: stats?.activeDoctors || 0,
            activeRadiologists: stats?.activeRadiologists || 0,
            unassignedPatients: (patients || []).filter(p => !p.patient_profiles?.[0]?.assigned_doctor_id).length,
          }
        };
        sessionStorage.setItem('admin_dashboard_data', JSON.stringify(cacheData));
        console.log('💾 Saved data to sessionStorage - ready for instant restore!');
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      setError('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  }, [userProfile, hospitalData]);

  useEffect(() => {
    if (user && userProfile && userProfile.role === 'admin') {
      fetchDashboardData();
    }
  }, [user, userProfile]); // Removed fetchDashboardData to prevent infinite loop

  const handleApproveUser = async (userId, role) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch('/api/admin/approve', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId, role, action: 'approve' })
      });

      if (!response.ok) throw new Error('Approval failed');

      setShowApprovalModal(false);
      setSelectedUser(null);
      fetchDashboardData();
    } catch (error) {
      console.error('Approval error:', error);
      alert('Failed to approve user');
    }
  };

  const handleRejectUser = async (userId) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch('/api/admin/approve', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId, action: 'reject' })
      });

      if (!response.ok) throw new Error('Rejection failed');

      setShowApprovalModal(false);
      setSelectedUser(null);
      fetchDashboardData();
    } catch (error) {
      console.error('Rejection error:', error);
      alert('Failed to reject user');
    }
  };

  const handleAssignDoctor = async () => {
    if (!selectedPatient || !selectedDoctor) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch('/api/admin/assign-doctor', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          patient_id: selectedPatient.id,
          doctor_id: selectedDoctor.id
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to assign doctor');
      }

      alert(result.message || 'Doctor assigned successfully!');
      setShowAssignModal(false);
      setSelectedPatient(null);
      setSelectedDoctor(null);
      fetchDashboardData();
    } catch (error) {
      console.error('Assignment error:', error);
      alert(error.message || 'Failed to assign doctor');
    }
  };

  const fetchPatientReports = async (patientId) => {
    try {
      setLoadingReports(true);
      const { data, error } = await supabase
        .from('predictions')
        .select('*')
        .or(`patient_id.eq.${patientId},user_id.eq.${patientId}`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPatientReports(data || []);
    } catch (error) {
      console.error('Error fetching patient reports:', error);
      setPatientReports([]);
    } finally {
      setLoadingReports(false);
    }
  };

  const fetchDoctorPatients = async (doctorId) => {
    try {
      setLoadingDoctorPatients(true);
      const assignedPatients = allPatients.filter(patient => {
        const profile = Array.isArray(patient.patient_profiles)
          ? patient.patient_profiles[0]
          : patient.patient_profiles;
        return profile?.assigned_doctor_id === doctorId;
      });
      setDoctorPatients(assignedPatients);
    } catch (error) {
      console.error('Error fetching doctor patients:', error);
      setDoctorPatients([]);
    } finally {
      setLoadingDoctorPatients(false);
    }
  };

  const fetchRadiologistActivities = async (radiologistId) => {
    try {
      setLoadingActivities(true);
      const { data, error } = await supabase
        .from('predictions')
        .select('*')
        .eq('radiologist_id', radiologistId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setRadiologistActivities(data || []);
    } catch (error) {
      console.error('Error fetching radiologist activities:', error);
      setRadiologistActivities([]);
    } finally {
      setLoadingActivities(false);
    }
  };

  // Fetch all assigned doctors for a patient
  const fetchAssignedDoctors = async (patientId) => {
    try {
      const { data, error } = await supabase
        .from('doctor_patient_relationships')
        .select(`
          id,
          doctor_id,
          relationship_status,
          assigned_at,
          doctor:doctor_id (
            user_id,
            user_profiles!doctor_profiles_user_fkey (
              full_name,
              email,
              phone
            )
          )
        `)
        .eq('patient_id', patientId)
        .eq('relationship_status', 'active')
        .order('assigned_at', { ascending: false });

      if (error) throw error;

      // Transform the data to a simpler structure
      const doctors = data?.map(rel => ({
        id: rel.doctor_id,
        full_name: rel.doctor?.user_profiles?.full_name,
        email: rel.doctor?.user_profiles?.email,
        phone: rel.doctor?.user_profiles?.phone,
        assigned_at: rel.assigned_at,
        relationship_id: rel.id
      })) || [];

      setAssignedDoctors(doctors);
      console.log('📋 Assigned doctors:', doctors);
    } catch (error) {
      console.error('Error fetching assigned doctors:', error);
      setAssignedDoctors([]);
    }
  };

  const fetchAllReports = async () => {
    // Skip if already fetched
    if (dataFetchedRef.current.reports && allReports.length > 0) {
      console.log('⚡ Reports already fetched, skipping reload');
      return;
    }

    try {
      const hospitalId = userProfile?.hospital_id || hospitalData?.id;
      let query = supabase
        .from('predictions')
        .select('*')
        .order('created_at', { ascending: false });

      // Admin sees all reports in their hospital
      if (hospitalId) {
        query = query.or(`hospital_id.eq.${hospitalId},hospital_id.is.null`);
      }

      const { data, error } = await query;
      if (error) throw error;

      console.log('📊 Fetched reports:', data?.length);

      // Enrich reports with user names
      const enrichedReports = [];

      if (data && data.length > 0) {
        // Get all unique user IDs
        const patientIds = [...new Set(data.map(r => r.patient_id).filter(Boolean))];
        const doctorIds = [...new Set(data.map(r => r.doctor_id).filter(Boolean))];
        const radiologistIds = [...new Set(data.map(r => r.radiologist_id).filter(Boolean))];
        const hospitalIds = [...new Set(data.map(r => r.hospital_id).filter(Boolean))];

        // Fetch all users in parallel
        const usersMap = {};
        const hospitalsMap = {};

        if (patientIds.length > 0 || doctorIds.length > 0 || radiologistIds.length > 0) {
          const allUserIds = [...new Set([...patientIds, ...doctorIds, ...radiologistIds])];
          const { data: users } = await supabase
            .from('user_profiles')
            .select('id, full_name')
            .in('id', allUserIds);

          if (users) {
            users.forEach(user => {
              usersMap[user.id] = user.full_name;
            });
          }
        }

        if (hospitalIds.length > 0) {
          const { data: hospitals } = await supabase
            .from('hospitals')
            .select('id, name')
            .in('id', hospitalIds);

          if (hospitals) {
            hospitals.forEach(hospital => {
              hospitalsMap[hospital.id] = hospital.name;
            });
          }
        }

        // Transform reports with names
        data.forEach(report => {
          enrichedReports.push({
            ...report,
            patient_name: usersMap[report.patient_id] || null,
            doctor_name: usersMap[report.doctor_id] || null,
            radiologist_name: usersMap[report.radiologist_id] || null,
            hospital_name: hospitalsMap[report.hospital_id] || null
          });
        });
      }

      console.log('✅ Enriched reports with names:', enrichedReports.length);
      setAllReports(enrichedReports);

      // Calculate detection stats
      const detectionStatsObj = { alzheimers: 0, normal: 0 };
      if (enrichedReports && enrichedReports.length > 0) {
        const alzCount = enrichedReports.filter(r => r.prediction?.toLowerCase().includes('alz')).length;
        const normalCount = enrichedReports.filter(r => r.prediction?.toLowerCase().includes('normal')).length;
        detectionStatsObj.alzheimers = alzCount;
        detectionStatsObj.normal = normalCount;
        setDetectionStats(detectionStatsObj);
      }

      // Mark as fetched
      dataFetchedRef.current.reports = true;

      // Update sessionStorage cache with reports data
      const existingCache = sessionStorage.getItem('admin_dashboard_data');
      if (existingCache) {
        try {
          const cacheData = JSON.parse(existingCache);
          cacheData.reports = enrichedReports;
          cacheData.detectionStats = detectionStatsObj;
          sessionStorage.setItem('admin_dashboard_data', JSON.stringify(cacheData));
          console.log('💾 Saved reports to sessionStorage - ready for instant restore!');
        } catch (e) {
          console.error('Failed to update cache with reports:', e);
        }
      }
    } catch (error) {
      console.error('Error fetching reports:', error);
      setAllReports([]);
    }
  };

  // Fetch recent activities for dashboard
  const fetchRecentActivities = async () => {
    // Skip if already fetched
    if (dataFetchedRef.current.activities && recentActivities.length > 0) {
      console.log('⚡ Activities already fetched, skipping reload');
      return;
    }

    try {
      const hospitalId = userProfile?.hospital_id || hospitalData?.id;

      // Fetch recent predictions
      let query = supabase
        .from('predictions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (hospitalId) {
        query = query.or(`hospital_id.eq.${hospitalId},hospital_id.is.null`);
      }

      const { data: predictions, error } = await query;
      if (error) throw error;

      // Enrich predictions with user names
      const usersMap = {};
      if (predictions && predictions.length > 0) {
        const userIds = [...new Set([
          ...predictions.map(p => p.patient_id),
          ...predictions.map(p => p.radiologist_id)
        ].filter(Boolean))];

        if (userIds.length > 0) {
          const { data: users } = await supabase
            .from('user_profiles')
            .select('id, full_name')
            .in('id', userIds);

          if (users) {
            users.forEach(user => {
              usersMap[user.id] = user.full_name;
            });
          }
        }
      }

      // Create activity feed
      const activities = [];

      if (predictions) {
        predictions.forEach(pred => {
          const radiologistName = usersMap[pred.radiologist_id] || 'Radiologist';
          const patientName = usersMap[pred.patient_id] || 'patient';

          activities.push({
            id: `pred-${pred.id}`,
            type: 'report',
            message: `${radiologistName} analyzed report for ${patientName}`,
            timestamp: pred.created_at,
            status: pred.prediction?.toLowerCase().includes('alz') ? 'alzheimers' : 'normal',
            icon: 'FileText'
          });
        });
      }

      // Add recent patient joins
      const recentPatients = allPatients
        .filter(p => p.created_at)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 3);

      recentPatients.forEach(patient => {
        activities.push({
          id: `patient-${patient.id}`,
          type: 'patient',
          message: `New patient registered: ${patient.full_name}`,
          timestamp: patient.created_at,
          icon: 'Heart'
        });
      });

      // Add recent doctor assignments
      const assignedPatients = allPatients
        .filter(p => {
          const profile = Array.isArray(p.patient_profiles) ? p.patient_profiles[0] : p.patient_profiles;
          return profile?.assigned_doctor_id && profile?.updated_at;
        })
        .sort((a, b) => {
          const aProfile = Array.isArray(a.patient_profiles) ? a.patient_profiles[0] : a.patient_profiles;
          const bProfile = Array.isArray(b.patient_profiles) ? b.patient_profiles[0] : b.patient_profiles;
          return new Date(bProfile.updated_at) - new Date(aProfile.updated_at);
        })
        .slice(0, 3);

      assignedPatients.forEach(patient => {
        const profile = Array.isArray(patient.patient_profiles) ? patient.patient_profiles[0] : patient.patient_profiles;
        activities.push({
          id: `assign-${patient.id}`,
          type: 'assignment',
          message: `${patient.full_name} assigned to ${patient.assignedDoctor?.full_name || 'doctor'}`,
          timestamp: profile.updated_at,
          icon: 'UserPlus'
        });
      });

      // Sort by timestamp and take top 15
      activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setRecentActivities(activities.slice(0, 15));

      // Mark as fetched
      dataFetchedRef.current.activities = true;

    } catch (error) {
      console.error('Error fetching recent activities:', error);
      setRecentActivities([]);
    }
  };

  // Calculate reports trend for last 7 days
  const calculateReportsTrend = () => {
    if (!allReports || allReports.length === 0) {
      setReportsTrend([]);
      return;
    }

    const last7Days = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const count = allReports.filter(report => {
        const reportDate = new Date(report.created_at).toISOString().split('T')[0];
        return reportDate === dateStr;
      }).length;

      last7Days.push({
        date: dateStr,
        count: count,
        label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      });
    }

    setReportsTrend(last7Days);
  };

  // Fetch reports when reports tab is active (only once)
  useEffect(() => {
    if (activeTab === 'reports' && !dataFetchedRef.current.reports && userProfile) {
      fetchAllReports();
    }
  }, [activeTab, userProfile]);

  // Fetch analytics data when overview tab is active
  useEffect(() => {
    if (activeTab === 'overview' && userProfile) {
      if (!dataFetchedRef.current.reports) {
        fetchAllReports();
      }
      if (!dataFetchedRef.current.activities) {
        fetchRecentActivities();
      }
    }
  }, [activeTab, userProfile]);

  // Calculate trends when reports change
  useEffect(() => {
    if (allReports.length > 0) {
      calculateReportsTrend();
    }
  }, [allReports]);

  // Helper function to generate meaningful display name for reports
  const getReportDisplayName = (report) => {
    // Format: "Patient Name - Dr. Doctor Name" or fallback to session code
    const patientPart = report.patient_name || 'Unknown Patient';
    const doctorPart = report.doctor_name ? `Dr. ${report.doctor_name}` : 'Unassigned Doctor';
    return `${patientPart} - ${doctorPart}`;
  };

  // Get unique filter options from reports
  const getUniquePatients = () => {
    const patients = [...new Set(allReports.map(r => r.patient_name).filter(Boolean))];
    return patients.sort();
  };

  const getUniqueDoctors = () => {
    const doctors = [...new Set(allReports.map(r => r.doctor_name).filter(Boolean))];
    return doctors.sort();
  };

  const getUniqueRadiologists = () => {
    const radiologists = [...new Set(allReports.map(r => r.radiologist_name).filter(Boolean))];
    return radiologists.sort();
  };

  // Apply filters to reports
  useEffect(() => {
    let filtered = [...allReports];

    // Search query filter
    if (reportsSearchQuery) {
      const query = reportsSearchQuery.toLowerCase();
      filtered = filtered.filter(report =>
        report.patient_name?.toLowerCase().includes(query) ||
        report.doctor_name?.toLowerCase().includes(query) ||
        report.radiologist_name?.toLowerCase().includes(query) ||
        report.session_code?.toLowerCase().includes(query) ||
        report.id?.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (reportsStatusFilter !== 'all') {
      filtered = filtered.filter(report =>
        report.status?.toLowerCase() === reportsStatusFilter.toLowerCase()
      );
    }

    // Prediction filter
    if (reportsPredictionFilter !== 'all') {
      if (reportsPredictionFilter === 'alzheimers') {
        filtered = filtered.filter(report =>
          report.prediction?.toLowerCase().includes('alz')
        );
      } else if (reportsPredictionFilter === 'normal') {
        filtered = filtered.filter(report =>
          report.prediction?.toLowerCase().includes('normal')
        );
      }
    }

    // Patient filter
    if (reportsPatientFilter !== 'all') {
      filtered = filtered.filter(report => report.patient_name === reportsPatientFilter);
    }

    // Doctor filter
    if (reportsDoctorFilter !== 'all') {
      filtered = filtered.filter(report => report.doctor_name === reportsDoctorFilter);
    }

    // Radiologist filter
    if (reportsRadiologistFilter !== 'all') {
      filtered = filtered.filter(report => report.radiologist_name === reportsRadiologistFilter);
    }

    // Date range filter
    if (reportsDateRange.start) {
      filtered = filtered.filter(report =>
        new Date(report.created_at) >= new Date(reportsDateRange.start)
      );
    }
    if (reportsDateRange.end) {
      filtered = filtered.filter(report =>
        new Date(report.created_at) <= new Date(reportsDateRange.end + 'T23:59:59')
      );
    }

    setFilteredReports(filtered);
  }, [allReports, reportsSearchQuery, reportsStatusFilter, reportsPredictionFilter,
      reportsPatientFilter, reportsDoctorFilter, reportsRadiologistFilter, reportsDateRange]);

  // Reset filters function
  const resetReportsFilters = () => {
    setReportsSearchQuery('');
    setReportsStatusFilter('all');
    setReportsPredictionFilter('all');
    setReportsPatientFilter('all');
    setReportsDoctorFilter('all');
    setReportsRadiologistFilter('all');
    setReportsDateRange({ start: '', end: '' });
  };

  // Get unique values for patient filters
  const getUniqueDoctorsForPatients = () => {
    const doctors = [...new Set(allPatients
      .map(p => p.assignedDoctor?.full_name)
      .filter(Boolean))];
    return doctors.sort();
  };

  // Apply filters to patients
  useEffect(() => {
    let filtered = [...allPatients];

    // Search query
    if (patientsSearchQuery) {
      const query = patientsSearchQuery.toLowerCase();
      filtered = filtered.filter(patient =>
        patient.full_name?.toLowerCase().includes(query) ||
        patient.email?.toLowerCase().includes(query) ||
        patient.unique_identifier?.toLowerCase().includes(query) ||
        patient.phone?.includes(query)
      );
    }

    // Status filter
    if (patientsStatusFilter !== 'all') {
      filtered = filtered.filter(p => p.account_status === patientsStatusFilter);
    }

    // Assignment filter
    if (patientsAssignmentFilter === 'assigned') {
      filtered = filtered.filter(p => {
        const profile = Array.isArray(p.patient_profiles) ? p.patient_profiles[0] : p.patient_profiles;
        return profile?.assigned_doctor_id;
      });
    } else if (patientsAssignmentFilter === 'unassigned') {
      filtered = filtered.filter(p => {
        const profile = Array.isArray(p.patient_profiles) ? p.patient_profiles[0] : p.patient_profiles;
        return !profile?.assigned_doctor_id;
      });
    }

    // Doctor filter
    if (patientsDoctorFilter !== 'all') {
      filtered = filtered.filter(p => p.assignedDoctor?.full_name === patientsDoctorFilter);
    }

    // Date range
    if (patientsDateRange.start) {
      filtered = filtered.filter(p => new Date(p.created_at) >= new Date(patientsDateRange.start));
    }
    if (patientsDateRange.end) {
      filtered = filtered.filter(p => new Date(p.created_at) <= new Date(patientsDateRange.end + 'T23:59:59'));
    }

    setFilteredPatientsData(filtered);
  }, [allPatients, patientsSearchQuery, patientsStatusFilter, patientsAssignmentFilter,
      patientsDoctorFilter, patientsDateRange]);

  const resetPatientsFilters = () => {
    setPatientsSearchQuery('');
    setPatientsStatusFilter('all');
    setPatientsAssignmentFilter('all');
    setPatientsDoctorFilter('all');
    setPatientsDateRange({ start: '', end: '' });
  };

  // Helper function to get patient count for a doctor
  const getDoctorPatientCount = (doctorId) => {
    return allPatients.filter(patient => {
      const profile = Array.isArray(patient.patient_profiles)
        ? patient.patient_profiles[0]
        : patient.patient_profiles;
      return profile?.assigned_doctor_id === doctorId;
    }).length;
  };

  // Get unique specializations
  const getUniqueSpecializations = () => {
    const specs = [...new Set(allDoctors
      .map(d => d.doctor_profiles?.[0]?.specialization)
      .filter(Boolean))];
    return specs.sort();
  };

  // Apply filters to doctors
  useEffect(() => {
    let filtered = [...allDoctors];

    // Search query
    if (doctorsSearchQuery) {
      const query = doctorsSearchQuery.toLowerCase();
      filtered = filtered.filter(doctor =>
        doctor.full_name?.toLowerCase().includes(query) ||
        doctor.email?.toLowerCase().includes(query) ||
        doctor.unique_identifier?.toLowerCase().includes(query) ||
        doctor.doctor_profiles?.[0]?.specialization?.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (doctorsStatusFilter !== 'all') {
      filtered = filtered.filter(d => d.account_status === doctorsStatusFilter);
    }

    // Specialization filter
    if (doctorsSpecializationFilter !== 'all') {
      filtered = filtered.filter(d =>
        d.doctor_profiles?.[0]?.specialization === doctorsSpecializationFilter
      );
    }

    // Patient count filter
    if (doctorsPatientCountFilter === 'with-patients') {
      filtered = filtered.filter(d => getDoctorPatientCount(d.id) > 0);
    } else if (doctorsPatientCountFilter === 'no-patients') {
      filtered = filtered.filter(d => getDoctorPatientCount(d.id) === 0);
    }

    // Date range
    if (doctorsDateRange.start) {
      filtered = filtered.filter(d => new Date(d.created_at) >= new Date(doctorsDateRange.start));
    }
    if (doctorsDateRange.end) {
      filtered = filtered.filter(d => new Date(d.created_at) <= new Date(doctorsDateRange.end + 'T23:59:59'));
    }

    setFilteredDoctorsData(filtered);
  }, [allDoctors, doctorsSearchQuery, doctorsStatusFilter, doctorsSpecializationFilter,
      doctorsPatientCountFilter, doctorsDateRange]);

  const resetDoctorsFilters = () => {
    setDoctorsSearchQuery('');
    setDoctorsStatusFilter('all');
    setDoctorsSpecializationFilter('all');
    setDoctorsPatientCountFilter('all');
    setDoctorsDateRange({ start: '', end: '' });
  };

  // Apply filters to radiologists
  useEffect(() => {
    let filtered = [...allRadiologists];

    // Search query
    if (radiologistsSearchQuery) {
      const query = radiologistsSearchQuery.toLowerCase();
      filtered = filtered.filter(rad =>
        rad.full_name?.toLowerCase().includes(query) ||
        rad.email?.toLowerCase().includes(query) ||
        rad.unique_identifier?.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (radiologistsStatusFilter !== 'all') {
      filtered = filtered.filter(r => r.account_status === radiologistsStatusFilter);
    }

    // Activity filter (based on reports count)
    if (radiologistsActivityFilter === 'active') {
      filtered = filtered.filter(r => (r.activityCount || 0) > 0);
    } else if (radiologistsActivityFilter === 'inactive') {
      filtered = filtered.filter(r => (r.activityCount || 0) === 0);
    }

    // Date range
    if (radiologistsDateRange.start) {
      filtered = filtered.filter(r => new Date(r.created_at) >= new Date(radiologistsDateRange.start));
    }
    if (radiologistsDateRange.end) {
      filtered = filtered.filter(r => new Date(r.created_at) <= new Date(radiologistsDateRange.end + 'T23:59:59'));
    }

    setFilteredRadiologistsData(filtered);
  }, [allRadiologists, radiologistsSearchQuery, radiologistsStatusFilter,
      radiologistsActivityFilter, radiologistsDateRange]);

  const resetRadiologistsFilters = () => {
    setRadiologistsSearchQuery('');
    setRadiologistsStatusFilter('all');
    setRadiologistsActivityFilter('all');
    setRadiologistsDateRange({ start: '', end: '' });
  };

  const filteredDoctors = allDoctors.filter(doc =>
    doc.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.doctor_profiles?.[0]?.specialization?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Filter patients based on search and filter
  const filteredPatients = allPatients.filter(patient => {
    const profile = Array.isArray(patient.patient_profiles) ? patient.patient_profiles[0] : patient.patient_profiles;
    const matchesSearch = patient.full_name?.toLowerCase().includes(patientSearchTerm.toLowerCase()) ||
      patient.unique_identifier?.toLowerCase().includes(patientSearchTerm.toLowerCase()) ||
      patient.phone?.includes(patientSearchTerm);

    if (patientFilter === 'assigned') {
      return matchesSearch && profile?.assigned_doctor_id;
    } else if (patientFilter === 'unassigned') {
      return matchesSearch && !profile?.assigned_doctor_id;
    }
    return matchesSearch;
  });

  // Filter doctors based on search and filter
  const filteredDoctorsList = allDoctors.filter(doctor => {
    const profile = Array.isArray(doctor.doctor_profiles) ? doctor.doctor_profiles[0] : doctor.doctor_profiles;
    const matchesSearch = doctor.full_name?.toLowerCase().includes(doctorSearchTerm.toLowerCase()) ||
      doctor.unique_identifier?.toLowerCase().includes(doctorSearchTerm.toLowerCase()) ||
      profile?.specialization?.toLowerCase().includes(doctorSearchTerm.toLowerCase());

    if (doctorFilter === 'with-patients') {
      const hasPatients = allPatients.some(p => {
        const pProfile = Array.isArray(p.patient_profiles) ? p.patient_profiles[0] : p.patient_profiles;
        return pProfile?.assigned_doctor_id === doctor.id;
      });
      return matchesSearch && hasPatients;
    } else if (doctorFilter === 'no-patients') {
      const hasPatients = allPatients.some(p => {
        const pProfile = Array.isArray(p.patient_profiles) ? p.patient_profiles[0] : p.patient_profiles;
        return pProfile?.assigned_doctor_id === doctor.id;
      });
      return matchesSearch && !hasPatients;
    }
    return matchesSearch;
  });

  // Filter radiologists based on search
  const filteredRadiologists = allRadiologists.filter(radiologist => {
    return radiologist.full_name?.toLowerCase().includes(radiologistSearchTerm.toLowerCase()) ||
      radiologist.unique_identifier?.toLowerCase().includes(radiologistSearchTerm.toLowerCase()) ||
      radiologist.email?.toLowerCase().includes(radiologistSearchTerm.toLowerCase());
  });

  const navigationItems = [
    { id: 'overview', label: 'Dashboard', icon: 'Dashboard' },
    { id: 'patients', label: 'Patients', icon: 'Heart', badgeKey: 'activePatients' },
    { id: 'doctors', label: 'Doctors', icon: 'Stethoscope', badgeKey: 'activeDoctors' },
    { id: 'radiologists', label: 'Radiologists', icon: 'Activity', badgeKey: 'activeRadiologists' },
    { id: 'reports', label: 'Reports', icon: 'FileText' },
    { id: 'add-user', label: 'Add User', icon: 'UserPlus' },
  ];

  if (isLoading && !userProfile) {
    return (
      <div className={styles.loadingContainer}>
        <LoadingSpinner />
        <p>Loading dashboard...</p>
      </div>
    );
  }

  if (error && !isLoading) {
    return (
      <>
        <Navbar />
        <div className={styles.dashboardContainer}>
          <div className={styles.errorState}>
            <h2>Error Loading Dashboard</h2>
            <p>{error}</p>
            <button onClick={() => {
              setError('');
              fetchDashboardData();
            }} className={styles.primaryButton}>
              Retry
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
        <UnifiedSidebar
          user={user}
          userProfile={userProfile}
          hospitalData={hospitalData}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          navigationItems={navigationItems}
          stats={dashboardStats}
        />

        {/* Main Content */}
        <main className={styles.mainContent}>
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className={styles.overviewSection}>
              <h1 className={styles.pageTitle}>Dashboard Overview</h1>

              {/* Enhanced Stats Grid */}
              <div className={styles.statsGridEnhanced}>
                <div className={styles.statCardEnhanced} onClick={() => setActiveTab('patients')}>
                  <div className={styles.statIconWrapper} style={{background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'}}>
                    <Icons.Heart />
                  </div>
                  <div className={styles.statContent}>
                    <p className={styles.statLabel}>Active Patients</p>
                    <h2 className={styles.statValue}>{dashboardStats.activePatients}</h2>
                    <span className={styles.statTrend}>
                      {dashboardStats.unassignedPatients > 0 && `${dashboardStats.unassignedPatients} unassigned`}
                    </span>
                  </div>
                </div>

                <div className={styles.statCardEnhanced} onClick={() => setActiveTab('doctors')}>
                  <div className={styles.statIconWrapper} style={{background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)'}}>
                    <Icons.Stethoscope />
                  </div>
                  <div className={styles.statContent}>
                    <p className={styles.statLabel}>Active Doctors</p>
                    <h2 className={styles.statValue}>{dashboardStats.activeDoctors}</h2>
                    <span className={styles.statTrend}>Healthcare providers</span>
                  </div>
                </div>

                <div className={styles.statCardEnhanced} onClick={() => setActiveTab('radiologists')}>
                  <div className={styles.statIconWrapper} style={{background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)'}}>
                    <Icons.Activity />
                  </div>
                  <div className={styles.statContent}>
                    <p className={styles.statLabel}>Radiologists</p>
                    <h2 className={styles.statValue}>{dashboardStats.activeRadiologists}</h2>
                    <span className={styles.statTrend}>Analysis specialists</span>
                  </div>
                </div>

                <div className={styles.statCardEnhanced} onClick={() => setActiveTab('reports')}>
                  <div className={styles.statIconWrapper} style={{background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'}}>
                    <Icons.FileText />
                  </div>
                  <div className={styles.statContent}>
                    <p className={styles.statLabel}>Total Reports</p>
                    <h2 className={styles.statValue}>{allReports.length}</h2>
                    <span className={styles.statTrend}>EEG analyses</span>
                  </div>
                </div>
              </div>

              {/* Charts and Analytics Grid */}
              <div className={styles.analyticsGrid}>
                {/* User Distribution Pie Chart */}
                <div className={styles.chartCard}>
                  <h3 className={styles.chartTitle}>User Distribution</h3>
                  <div className={styles.pieChartContainer}>
                    <svg viewBox="0 0 200 200" className={styles.pieChart}>
                      {(() => {
                        const total = dashboardStats.activePatients + dashboardStats.activeDoctors + dashboardStats.activeRadiologists;
                        if (total === 0) return <text x="100" y="100" textAnchor="middle" fill="#666">No data</text>;

                        const patientsPercent = (dashboardStats.activePatients / total) * 100;
                        const doctorsPercent = (dashboardStats.activeDoctors / total) * 100;
                        const radiologistsPercent = (dashboardStats.activeRadiologists / total) * 100;

                        let currentAngle = 0;
                        const createArc = (percent, color) => {
                          const angle = (percent / 100) * 360;
                          const startAngle = currentAngle;
                          currentAngle += angle;

                          const startRad = (startAngle - 90) * Math.PI / 180;
                          const endRad = (startAngle + angle - 90) * Math.PI / 180;

                          const x1 = 100 + 80 * Math.cos(startRad);
                          const y1 = 100 + 80 * Math.sin(startRad);
                          const x2 = 100 + 80 * Math.cos(endRad);
                          const y2 = 100 + 80 * Math.sin(endRad);

                          const largeArc = angle > 180 ? 1 : 0;

                          return `M 100 100 L ${x1} ${y1} A 80 80 0 ${largeArc} 1 ${x2} ${y2} Z`;
                        };

                        return (
                          <>
                            <path d={createArc(patientsPercent, '#3b82f6')} fill="#3b82f6" opacity="0.9" />
                            <path d={createArc(doctorsPercent, '#10b981')} fill="#10b981" opacity="0.9" />
                            <path d={createArc(radiologistsPercent, '#8b5cf6')} fill="#8b5cf6" opacity="0.9" />
                            <circle cx="100" cy="100" r="50" fill="#0f172a" />
                            <text x="100" y="95" textAnchor="middle" fill="#fff" fontSize="16" fontWeight="bold">{total}</text>
                            <text x="100" y="110" textAnchor="middle" fill="#94a3b8" fontSize="10">Total Users</text>
                          </>
                        );
                      })()}
                    </svg>
                    <div className={styles.pieLegend}>
                      <div className={styles.legendItem}>
                        <span className={styles.legendColor} style={{background: '#3b82f6'}}></span>
                        <span>Patients ({dashboardStats.activePatients})</span>
                      </div>
                      <div className={styles.legendItem}>
                        <span className={styles.legendColor} style={{background: '#10b981'}}></span>
                        <span>Doctors ({dashboardStats.activeDoctors})</span>
                      </div>
                      <div className={styles.legendItem}>
                        <span className={styles.legendColor} style={{background: '#8b5cf6'}}></span>
                        <span>Radiologists ({dashboardStats.activeRadiologists})</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Reports Trend Line Chart */}
                <div className={styles.chartCard}>
                  <h3 className={styles.chartTitle}>Reports Trend (Last 7 Days)</h3>
                  <div className={styles.lineChartContainer}>
                    {reportsTrend.length > 0 ? (
                      <svg viewBox="0 0 400 200" className={styles.lineChart}>
                        {/* Grid lines */}
                        <line x1="40" y1="20" x2="40" y2="160" stroke="#1e293b" strokeWidth="2" />
                        <line x1="40" y1="160" x2="380" y2="160" stroke="#1e293b" strokeWidth="2" />

                        {/* Y-axis labels */}
                        {[0, 1, 2, 3, 4, 5].map((val, i) => {
                          const maxCount = Math.max(...reportsTrend.map(d => d.count), 5);
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
                          const maxCount = Math.max(...reportsTrend.map(d => d.count), 5);
                          const points = reportsTrend.map((d, i) => {
                            const x = 60 + (i * 50);
                            const y = 160 - (d.count / maxCount) * 140;
                            return { x, y, count: d.count, label: d.label };
                          });

                          const pathD = points.map((p, i) =>
                            i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`
                          ).join(' ');

                          return (
                            <>
                              <path d={pathD} stroke="#3b82f6" strokeWidth="3" fill="none" />
                              <path d={`${pathD} L ${points[points.length - 1].x} 160 L ${points[0].x} 160 Z`}
                                    fill="url(#lineGradient)" opacity="0.3" />
                              <defs>
                                <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.8" />
                                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                                </linearGradient>
                              </defs>
                              {points.map((p, i) => (
                                <g key={i}>
                                  <circle cx={p.x} cy={p.y} r="5" fill="#3b82f6" stroke="#0f172a" strokeWidth="2" />
                                  <text x={p.x} y="180" textAnchor="middle" fill="#94a3b8" fontSize="10">{p.label}</text>
                                </g>
                              ))}
                            </>
                          );
                        })()}
                      </svg>
                    ) : (
                      <div className={styles.noData}>No report data available</div>
                    )}
                  </div>
                </div>

                {/* Detection Statistics Bar Chart */}
                <div className={styles.chartCard}>
                  <h3 className={styles.chartTitle}>Detection Statistics</h3>
                  <div className={styles.barChartContainer}>
                    {(detectionStats.alzheimers > 0 || detectionStats.normal > 0) ? (
                      <svg viewBox="0 0 300 200" className={styles.barChart}>
                        {(() => {
                          const total = detectionStats.alzheimers + detectionStats.normal;
                          const maxVal = Math.max(detectionStats.alzheimers, detectionStats.normal, 1);
                          const alzHeight = (detectionStats.alzheimers / maxVal) * 120;
                          const normalHeight = (detectionStats.normal / maxVal) * 120;

                          return (
                            <>
                              {/* Alzheimer's bar */}
                              <rect x="60" y={160 - alzHeight} width="60" height={alzHeight} fill="#ef4444" opacity="0.9" rx="4" />
                              <text x="90" y={150 - alzHeight} textAnchor="middle" fill="#fff" fontSize="14" fontWeight="bold">
                                {detectionStats.alzheimers}
                              </text>
                              <text x="90" y="180" textAnchor="middle" fill="#94a3b8" fontSize="12">Alzheimer's</text>
                              <text x="90" y="195" textAnchor="middle" fill="#94a3b8" fontSize="10">
                                ({((detectionStats.alzheimers / total) * 100).toFixed(1)}%)
                              </text>

                              {/* Normal bar */}
                              <rect x="180" y={160 - normalHeight} width="60" height={normalHeight} fill="#10b981" opacity="0.9" rx="4" />
                              <text x="210" y={150 - normalHeight} textAnchor="middle" fill="#fff" fontSize="14" fontWeight="bold">
                                {detectionStats.normal}
                              </text>
                              <text x="210" y="180" textAnchor="middle" fill="#94a3b8" fontSize="12">Normal</text>
                              <text x="210" y="195" textAnchor="middle" fill="#94a3b8" fontSize="10">
                                ({((detectionStats.normal / total) * 100).toFixed(1)}%)
                              </text>
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

              {/* Recent Activity Feed */}
              <div className={styles.activitySection}>
                <h2 className={styles.sectionTitle}>Recent Activity</h2>
                <div className={styles.activityFeed}>
                  {recentActivities.length > 0 ? (
                    recentActivities.map(activity => {
                      const Icon = Icons[activity.icon] || Icons.FileText;
                      const timeDiff = Math.floor((new Date() - new Date(activity.timestamp)) / 60000);
                      const timeText = timeDiff < 1 ? 'Just now' :
                                      timeDiff < 60 ? `${timeDiff}m ago` :
                                      timeDiff < 1440 ? `${Math.floor(timeDiff / 60)}h ago` :
                                      `${Math.floor(timeDiff / 1440)}d ago`;

                      return (
                        <div key={activity.id} className={styles.activityItem}>
                          <div className={`${styles.activityIcon} ${activity.status ? styles[activity.status] : ''}`}>
                            <Icon />
                          </div>
                          <div className={styles.activityContent}>
                            <p className={styles.activityMessage}>{activity.message}</p>
                            <span className={styles.activityTime}>{timeText}</span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className={styles.noActivity}>
                      <Icons.Activity />
                      <p>No recent activity</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Add User Tab */}
          {activeTab === 'add-user' && (
            <div className={styles.section}>
              <h1 className={styles.pageTitle}>Add New User</h1>
              <AddUserInterface onUserCreated={fetchDashboardData} />
            </div>
          )}

          {/* Patients Tab */}
          {activeTab === 'patients' && (
            <div className={styles.section}>
              {detailView === 'patient' && selectedPatientDetail ? (
                // Patient Detail View
                <div>
                  <div className={styles.detailHeader}>
                    <button onClick={() => setDetailView(null)} className={styles.backButton}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="15 18 9 12 15 6"/>
                      </svg>
                      Back to Patients
                    </button>
                    <h1 className={styles.pageTitle}>Patient Details</h1>
                  </div>

                  <div className={styles.detailContent}>
                    <div className={styles.userDetails}>
                      <div className={styles.avatarLarge}>
                        {selectedPatientDetail.full_name?.[0]?.toUpperCase()}
                      </div>
                      <h3>{selectedPatientDetail.full_name}</h3>
                      <span className={styles.roleTag}>Patient</span>
                    </div>

                    <div className={styles.detailsGrid}>
                      <div><strong>Patient ID:</strong> {selectedPatientDetail.unique_identifier}</div>
                      <div><strong>Email:</strong> {selectedPatientDetail.email || 'N/A'}</div>
                      <div><strong>Phone:</strong> {selectedPatientDetail.phone}</div>
                      <div><strong>Age:</strong> {selectedPatientDetail.date_of_birth ? new Date().getFullYear() - new Date(selectedPatientDetail.date_of_birth).getFullYear() : 'N/A'} years</div>
                      <div><strong>Blood Group:</strong> {selectedPatientDetail.profile?.blood_groups?.blood_type || 'N/A'}</div>
                      <div><strong>Account Status:</strong> {selectedPatientDetail.account_status}</div>
                    </div>

                    <div className={styles.assignedDoctorSection}>
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem'}}>
                        <h4 style={{margin: 0}}>Assigned Doctors ({assignedDoctors.length})</h4>
                        <button
                          onClick={() => {
                            setSelectedPatient(selectedPatientDetail);
                            setShowAssignModal(true);
                          }}
                          className={styles.assignBtnCompact}
                        >
                          <Icons.UserPlus style={{width: '14px', height: '14px'}} />
                          Assign Doctor
                        </button>
                      </div>
                      {assignedDoctors.length > 0 ? (
                        <div className={styles.doctorsList}>
                          {assignedDoctors.map((doctor, index) => (
                            <div key={doctor.id || index} className={styles.doctorInfo}>
                              <div style={{display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between'}}>
                                <div style={{flex: 1}}>
                                  <p><strong>Name:</strong> {doctor.full_name}</p>
                                  <p><strong>Email:</strong> {doctor.email}</p>
                                  {doctor.phone && <p><strong>Phone:</strong> {doctor.phone}</p>}
                                  {doctor.assigned_at && (
                                    <p style={{fontSize: '0.85rem', color: '#888'}}>
                                      Assigned on: {new Date(doctor.assigned_at).toLocaleDateString()}
                                    </p>
                                  )}
                                </div>
                                <div style={{display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end'}}>
                                  {index === 0 && (
                                    <span style={{
                                      fontSize: '0.75rem',
                                      backgroundColor: '#3b82f6',
                                      color: 'white',
                                      padding: '0.25rem 0.5rem',
                                      borderRadius: '4px'
                                    }}>
                                      Primary
                                    </span>
                                  )}
                                  <button
                                    onClick={async () => {
                                      if (!confirm(`Unassign Dr. ${doctor.full_name} from this patient?`)) return;

                                      try {
                                        const { data: { session } } = await supabase.auth.getSession();
                                        const response = await fetch('/api/admin/unassign-doctor', {
                                          method: 'POST',
                                          headers: {
                                            'Authorization': `Bearer ${session.access_token}`,
                                            'Content-Type': 'application/json'
                                          },
                                          body: JSON.stringify({
                                            patient_id: selectedPatientDetail.id,
                                            doctor_id: doctor.id
                                          })
                                        });

                                        const result = await response.json();
                                        if (result.success) {
                                          alert('Doctor unassigned successfully!');
                                          fetchAssignedDoctors(selectedPatientDetail.id);
                                          dataFetchedRef.current.dashboard = false;
                                        } else {
                                          alert(result.error || 'Failed to unassign doctor');
                                        }
                                      } catch (error) {
                                        console.error('Unassign error:', error);
                                        alert('Failed to unassign doctor');
                                      }
                                    }}
                                    style={{
                                      background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                                      color: 'white',
                                      border: 'none',
                                      padding: '0.4rem 0.8rem',
                                      borderRadius: '6px',
                                      fontSize: '0.75rem',
                                      fontWeight: '600',
                                      cursor: 'pointer',
                                      transition: 'all 0.3s',
                                      boxShadow: '0 2px 6px rgba(239, 68, 68, 0.3)'
                                    }}
                                  >
                                    Unassign
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p style={{color: '#666', fontStyle: 'italic'}}>No doctors assigned yet</p>
                      )}
                    </div>

                    <div className={styles.reportsSection}>
                      <h4>Patient Reports ({patientReports.length})</h4>
                      {loadingReports ? (
                        <p>Loading reports...</p>
                      ) : patientReports.length > 0 ? (
                        <div className={styles.reportsListModal}>
                          {patientReports.map(report => (
                            <div key={report.id} className={styles.reportItemModal}>
                              <div className={styles.reportHeaderModal}>
                                <h5>{report.session_code || `Session-${report.id.substring(0, 8)}`}</h5>
                                <span className={styles.statusBadge}>{report.status}</span>
                              </div>
                              <p><strong>Date:</strong> {new Date(report.created_at).toLocaleDateString()}</p>
                              <p><strong>Filename:</strong> {report.filename}</p>
                              {report.prediction && (
                                <p><strong>Result:</strong> <span style={{color: report.prediction.toLowerCase().includes('alz') ? '#ef4444' : '#10b981'}}>{report.prediction}</span></p>
                              )}
                              {report.patient_pdf_url && (
                                <button
                                  onClick={() => window.open(report.patient_pdf_url, '_blank')}
                                  className={styles.viewReportBtnSmall}
                                >
                                  View Report
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p>No reports found for this patient.</p>
                      )}
                    </div>

                    {!selectedPatientDetail.profile?.assigned_doctor_id && (
                      <button
                        onClick={() => {
                          setSelectedPatient(selectedPatientDetail);
                          setShowAssignModal(true);
                        }}
                        className={styles.assignBtn}
                      >
                        <Icons.UserPlus />
                        Assign Doctor
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <>
              <div className={styles.sectionHeaderWithToggle}>
                <h1 className={styles.pageTitle}>Patient Management</h1>
                <div className={styles.viewToggle}>
                  <button
                    className={`${styles.viewToggleBtn} ${patientsViewMode === 'detailed' ? styles.active : ''}`}
                    onClick={() => setPatientsViewMode('detailed')}
                    title="Detailed View"
                  >
                    <Icons.Grid />
                  </button>
                  <button
                    className={`${styles.viewToggleBtn} ${patientsViewMode === 'compact' ? styles.active : ''}`}
                    onClick={() => setPatientsViewMode('compact')}
                    title="Compact View"
                  >
                    <Icons.List />
                  </button>
                </div>
              </div>

              {/* Advanced Filters */}
              <div className={styles.filtersCard}>
                {/* Always Visible: Search Bar */}
                <div className={styles.searchRow}>
                  <div className={styles.searchBox}>
                    <Icons.Search />
                    <input
                      type="text"
                      placeholder="Search by name, ID, email, or phone..."
                      value={patientsSearchQuery}
                      onChange={(e) => setPatientsSearchQuery(e.target.value)}
                      className={styles.searchInput}
                    />
                    {patientsSearchQuery && (
                      <button onClick={() => setPatientsSearchQuery('')} className={styles.clearBtn}>
                        <Icons.X />
                      </button>
                    )}
                  </div>
                  <button
                    className={styles.filterToggleBtn}
                    onClick={() => setPatientsFiltersExpanded(!patientsFiltersExpanded)}
                    title={patientsFiltersExpanded ? "Hide Filters" : "Show More Filters"}
                  >
                    <Icons.Filter />
                    {patientsFiltersExpanded ? <Icons.ChevronUp /> : <Icons.ChevronDown />}
                    <span>{filteredPatientsData.length}/{allPatients.length}</span>
                  </button>
                </div>

                {/* Collapsible Advanced Filters */}
                {patientsFiltersExpanded && (
                  <div className={styles.expandedFilters}>
                    <div className={styles.filtersHeaderExpanded}>
                      <h3>Advanced Filters</h3>
                      <button onClick={resetPatientsFilters} className={styles.resetFiltersBtn}>
                        <Icons.X />
                        Reset All
                      </button>
                    </div>

                    <div className={styles.filterRow}>
                      <select value={patientsStatusFilter} onChange={(e) => setPatientsStatusFilter(e.target.value)} className={styles.filterSelect}>
                        <option value="all">All Status</option>
                        <option value="active">Active</option>
                        <option value="pending">Pending</option>
                        <option value="inactive">Inactive</option>
                      </select>

                      <select value={patientsAssignmentFilter} onChange={(e) => setPatientsAssignmentFilter(e.target.value)} className={styles.filterSelect}>
                        <option value="all">All Assignments</option>
                        <option value="assigned">Assigned to Doctor</option>
                        <option value="unassigned">Unassigned</option>
                      </select>

                      <select value={patientsDoctorFilter} onChange={(e) => setPatientsDoctorFilter(e.target.value)} className={styles.filterSelect}>
                        <option value="all">All Doctors</option>
                        {getUniqueDoctorsForPatients().map(doctor => (
                          <option key={doctor} value={doctor}>Dr. {doctor}</option>
                        ))}
                      </select>
                    </div>

                    <div className={styles.dateRangeRow}>
                      <Icons.Calendar />
                      <span className={styles.dateLabel}>Joined Date:</span>
                      <input type="date" value={patientsDateRange.start} onChange={(e) => setPatientsDateRange({...patientsDateRange, start: e.target.value})} className={styles.dateInput} />
                      <span className={styles.dateSeparator}>to</span>
                      <input type="date" value={patientsDateRange.end} onChange={(e) => setPatientsDateRange({...patientsDateRange, end: e.target.value})} className={styles.dateInput} />
                    </div>
                  </div>
                )}
              </div>

              {filteredPatientsData.length > 0 ? (
                <>
                  {patientsViewMode === 'detailed' ? (
                    <div className={styles.cardGrid}>
                      {filteredPatientsData.map(patient => {
                        const profile = Array.isArray(patient.patient_profiles) ? patient.patient_profiles[0] : patient.patient_profiles;
                        const age = patient.date_of_birth ? new Date().getFullYear() - new Date(patient.date_of_birth).getFullYear() : 'N/A';

                        return (
                          <div key={patient.id} className={styles.patientCard} onClick={() => { setSelectedPatientDetail({ ...patient, profile }); setDetailView('patient'); fetchPatientReports(patient.id); fetchAssignedDoctors(patient.id); }} style={{ cursor: 'pointer' }}>
                            <div className={styles.cardHeader}>
                              <h3>{patient.full_name}</h3>
                              <span className={styles.patientId}>{patient.unique_identifier}</span>
                            </div>
                            <div className={styles.cardBody}>
                              <p><strong>Age:</strong> {age} years</p>
                              <p><strong>Blood Group:</strong> {profile?.blood_groups?.blood_type || 'N/A'}</p>
                              <p><strong>Phone:</strong> {patient.phone}</p>
                            </div>
                            <div style={{display: 'flex', gap: '0.5rem', width: '100%'}}>
                              <button onClick={(e) => { e.stopPropagation(); setSelectedPatient(patient); setShowAssignModal(true); }} className={styles.assignBtn} style={{flex: 1}}>
                                <Icons.UserPlus />
                                Assign Doctor
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); setSelectedPatientDetail({ ...patient, profile }); setDetailView('patient'); fetchPatientReports(patient.id); fetchAssignedDoctors(patient.id); }} className={styles.viewDoctorsBtn} style={{flex: 1}}>
                                <Icons.Eye style={{width: '16px', height: '16px'}} />
                                View Doctors
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className={styles.compactList}>
                      {filteredPatientsData.map((patient, index) => {
                        const profile = Array.isArray(patient.patient_profiles) ? patient.patient_profiles[0] : patient.patient_profiles;
                        const age = patient.date_of_birth ? new Date().getFullYear() - new Date(patient.date_of_birth).getFullYear() : 'N/A';

                        // Debug logging for first patient only
                        if (index === 0) {
                          console.log('🔍 Patient data check:', {
                            patientName: patient.full_name,
                            profile: profile,
                            assignedDoctorId: profile?.assigned_doctor_id,
                            assignedDoctor: profile?.assigned_doctor,
                            doctorName: profile?.assigned_doctor?.user_profiles?.full_name
                          });
                        }

                        return (
                          <div key={patient.id} className={styles.compactItem} onClick={() => { setSelectedPatientDetail({ ...patient, profile }); setDetailView('patient'); fetchPatientReports(patient.id); fetchAssignedDoctors(patient.id); }}>
                            <div className={styles.compactLeft}>
                              <h4>{patient.full_name}</h4>
                              <span className={styles.compactMeta}>
                                {patient.unique_identifier} • Age: {age} • {profile?.blood_groups?.blood_type || 'N/A'}
                              </span>
                            </div>
                            <div className={styles.compactRight}>
                              <span className={`${styles.statusBadgeSmall} ${styles[patient.account_status?.toLowerCase()]}`}>
                                {patient.account_status}
                              </span>
                              <button onClick={(e) => { e.stopPropagation(); setSelectedPatient(patient); setShowAssignModal(true); }} className={styles.assignBtnCompact}>
                                <Icons.UserPlus style={{width: '14px', height: '14px'}} />
                                Assign
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); setSelectedPatientDetail({ ...patient, profile }); setDetailView('patient'); fetchPatientReports(patient.id); fetchAssignedDoctors(patient.id); }} className={styles.viewDoctorsBtnCompact}>
                                <Icons.Eye style={{width: '14px', height: '14px'}} />
                                View Doctors
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                <div className={styles.emptyState}>
                  <Icons.Heart />
                  <p>No patients found</p>
                </div>
              )}
            </>
              )}
            </div>
          )}

          {/* Doctors Tab */}
          {activeTab === 'doctors' && (
            <div className={styles.section}>
              {detailView === 'doctor' && selectedDoctorDetail ? (
                // Doctor Detail View
                <div>
                  <div className={styles.detailHeader}>
                    <button onClick={() => setDetailView(null)} className={styles.backButton}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="15 18 9 12 15 6"/>
                      </svg>
                      Back to Doctors
                    </button>
                    <h1 className={styles.pageTitle}>Doctor Details</h1>
                  </div>

                  <div className={styles.detailContent}>
                    <div className={styles.userDetails}>
                      <div className={styles.avatarLarge}>
                        {selectedDoctorDetail.full_name?.[0]?.toUpperCase()}
                      </div>
                      <h3>{selectedDoctorDetail.full_name}</h3>
                      <span className={styles.roleTag}>Doctor</span>
                    </div>

                    <div className={styles.detailsGrid}>
                      <div><strong>Doctor ID:</strong> {selectedDoctorDetail.unique_identifier}</div>
                      <div><strong>Email:</strong> {selectedDoctorDetail.email || 'N/A'}</div>
                      <div><strong>Phone:</strong> {selectedDoctorDetail.phone || 'N/A'}</div>
                      <div><strong>Medical License:</strong> {selectedDoctorDetail.profile?.medical_license || 'N/A'}</div>
                      <div><strong>Specialization:</strong> {selectedDoctorDetail.profile?.specialization || 'General'}</div>
                      <div><strong>Experience:</strong> {selectedDoctorDetail.profile?.experience_years || 0} years</div>
                    </div>

                    <div className={styles.reportsSection}>
                      <h4>Assigned Patients ({doctorPatients.length})</h4>
                      {loadingDoctorPatients ? (
                        <p>Loading patients...</p>
                      ) : doctorPatients.length > 0 ? (
                        <div className={styles.reportsListModal}>
                          {doctorPatients.map(patient => {
                            const profile = Array.isArray(patient.patient_profiles)
                              ? patient.patient_profiles[0]
                              : patient.patient_profiles;

                            return (
                              <div key={patient.id} className={styles.reportItemModal}>
                                <div className={styles.reportHeaderModal}>
                                  <h5>{patient.full_name}</h5>
                                  <span className={styles.statusBadge}>{patient.account_status}</span>
                                </div>
                                <p><strong>Patient ID:</strong> {patient.unique_identifier}</p>
                                <p><strong>Phone:</strong> {patient.phone}</p>
                                <p><strong>Age:</strong> {patient.date_of_birth ? new Date().getFullYear() - new Date(patient.date_of_birth).getFullYear() : 'N/A'} years</p>
                                <p><strong>Blood Group:</strong> {profile?.blood_groups?.blood_type || 'N/A'}</p>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p style={{color: '#666'}}>No patients assigned yet</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <>
              <div className={styles.sectionHeaderWithToggle}>
                <h1 className={styles.pageTitle}>Doctor Management</h1>
                <div className={styles.viewToggle}>
                  <button
                    className={`${styles.viewToggleBtn} ${doctorsViewMode === 'detailed' ? styles.active : ''}`}
                    onClick={() => setDoctorsViewMode('detailed')}
                    title="Detailed View"
                  >
                    <Icons.Grid />
                  </button>
                  <button
                    className={`${styles.viewToggleBtn} ${doctorsViewMode === 'compact' ? styles.active : ''}`}
                    onClick={() => setDoctorsViewMode('compact')}
                    title="Compact View"
                  >
                    <Icons.List />
                  </button>
                </div>
              </div>

              {/* Advanced Filters */}
              <div className={styles.filtersCard}>
                {/* Always Visible: Search Bar */}
                <div className={styles.searchRow}>
                  <div className={styles.searchBox}>
                    <Icons.Search />
                    <input
                      type="text"
                      placeholder="Search by name, ID, email, or specialization..."
                      value={doctorsSearchQuery}
                      onChange={(e) => setDoctorsSearchQuery(e.target.value)}
                      className={styles.searchInput}
                    />
                    {doctorsSearchQuery && (
                      <button onClick={() => setDoctorsSearchQuery('')} className={styles.clearBtn}>
                        <Icons.X />
                      </button>
                    )}
                  </div>
                  <button
                    className={styles.filterToggleBtn}
                    onClick={() => setDoctorsFiltersExpanded(!doctorsFiltersExpanded)}
                    title={doctorsFiltersExpanded ? "Hide Filters" : "Show More Filters"}
                  >
                    <Icons.Filter />
                    {doctorsFiltersExpanded ? <Icons.ChevronUp /> : <Icons.ChevronDown />}
                    <span>{filteredDoctorsData.length}/{allDoctors.length}</span>
                  </button>
                </div>

                {/* Collapsible Advanced Filters */}
                {doctorsFiltersExpanded && (
                  <div className={styles.expandedFilters}>
                    <div className={styles.filtersHeaderExpanded}>
                      <h3>Advanced Filters</h3>
                      <button onClick={resetDoctorsFilters} className={styles.resetFiltersBtn}>
                        <Icons.X />
                        Reset All
                      </button>
                    </div>

                    <div className={styles.filterRow}>
                      <select value={doctorsStatusFilter} onChange={(e) => setDoctorsStatusFilter(e.target.value)} className={styles.filterSelect}>
                        <option value="all">All Status</option>
                        <option value="active">Active</option>
                        <option value="pending">Pending</option>
                        <option value="inactive">Inactive</option>
                      </select>

                      <select value={doctorsSpecializationFilter} onChange={(e) => setDoctorsSpecializationFilter(e.target.value)} className={styles.filterSelect}>
                        <option value="all">All Specializations</option>
                        {getUniqueSpecializations().map(spec => (
                          <option key={spec} value={spec}>{spec}</option>
                        ))}
                      </select>

                      <select value={doctorsPatientCountFilter} onChange={(e) => setDoctorsPatientCountFilter(e.target.value)} className={styles.filterSelect}>
                        <option value="all">All Patient Counts</option>
                        <option value="with-patients">Has Patients</option>
                        <option value="no-patients">No Patients</option>
                      </select>
                    </div>

                    <div className={styles.dateRangeRow}>
                      <Icons.Calendar />
                      <span className={styles.dateLabel}>Joined Date:</span>
                      <input type="date" value={doctorsDateRange.start} onChange={(e) => setDoctorsDateRange({...doctorsDateRange, start: e.target.value})} className={styles.dateInput} />
                      <span className={styles.dateSeparator}>to</span>
                      <input type="date" value={doctorsDateRange.end} onChange={(e) => setDoctorsDateRange({...doctorsDateRange, end: e.target.value})} className={styles.dateInput} />
                    </div>
                  </div>
                )}
              </div>

              {filteredDoctorsData.length > 0 ? (
                <>
                  {doctorsViewMode === 'detailed' ? (
                    <div className={styles.cardGrid}>
                      {filteredDoctorsData.map(doctor => {
                        const profile = Array.isArray(doctor.doctor_profiles) ? doctor.doctor_profiles[0] : doctor.doctor_profiles;
                        const patientCount = getDoctorPatientCount(doctor.id);

                        return (
                          <div key={doctor.id} className={styles.doctorCard} onClick={() => { setSelectedDoctorDetail({ ...doctor, profile }); setDetailView('doctor'); fetchDoctorPatients(doctor.id); }} style={{ cursor: 'pointer' }}>
                            <div className={styles.cardHeader}>
                              <h3>{doctor.full_name}</h3>
                              <span className={styles.doctorId}>{doctor.unique_identifier}</span>
                            </div>
                            <div className={styles.cardBody}>
                              <p><strong>Specialization:</strong> {profile?.specialization || 'General'}</p>
                              <p><strong>Experience:</strong> {profile?.experience_years || 0} years</p>
                              <p><strong>License:</strong> {profile?.medical_license || 'N/A'}</p>
                              <p><strong>Phone:</strong> {doctor.phone}</p>
                              <p><strong>Patients:</strong> {patientCount}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className={styles.compactList}>
                      {filteredDoctorsData.map(doctor => {
                        const profile = Array.isArray(doctor.doctor_profiles) ? doctor.doctor_profiles[0] : doctor.doctor_profiles;
                        const patientCount = getDoctorPatientCount(doctor.id);

                        return (
                          <div key={doctor.id} className={styles.compactItem} onClick={() => { setSelectedDoctorDetail({ ...doctor, profile }); setDetailView('doctor'); fetchDoctorPatients(doctor.id); }}>
                            <div className={styles.compactLeft}>
                              <h4>Dr. {doctor.full_name}</h4>
                              <span className={styles.compactMeta}>
                                {profile?.specialization || 'General'} • {profile?.experience_years || 0} yrs exp • {patientCount} patients • {doctor.unique_identifier}
                              </span>
                            </div>
                            <div className={styles.compactRight}>
                              <span className={`${styles.statusBadgeSmall} ${styles[doctor.account_status?.toLowerCase()]}`}>
                                {doctor.account_status}
                              </span>
                              <span className={styles.confidenceBadge}>{profile?.medical_license || 'No License'}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                <div className={styles.emptyState}>
                  <Icons.Stethoscope />
                  <p>No doctors found</p>
                </div>
              )}
            </>
            )}
            </div>
          )}

          {/* Radiologists Tab */}
          {activeTab === 'radiologists' && (
            <div className={styles.section}>
              {detailView === 'radiologist' && selectedRadiologistDetail ? (
                // Radiologist Detail View
                <div>
                  <div className={styles.detailHeader}>
                    <button onClick={() => setDetailView(null)} className={styles.backButton}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="15 18 9 12 15 6"/>
                      </svg>
                      Back to Radiologists
                    </button>
                    <h1 className={styles.pageTitle}>Radiologist Details</h1>
                  </div>

                  <div className={styles.detailContent}>
                    <div className={styles.userDetails}>
                      <div className={styles.avatarLarge}>
                        {selectedRadiologistDetail.full_name?.[0]?.toUpperCase()}
                      </div>
                      <h3>{selectedRadiologistDetail.full_name}</h3>
                      <span className={styles.roleTag}>Radiologist</span>
                    </div>

                    <div className={styles.detailsGrid}>
                      <div><strong>Radiologist ID:</strong> {selectedRadiologistDetail.unique_identifier}</div>
                      <div><strong>Email:</strong> {selectedRadiologistDetail.email}</div>
                      <div><strong>Phone:</strong> {selectedRadiologistDetail.phone}</div>
                      <div><strong>Account Status:</strong> {selectedRadiologistDetail.account_status}</div>
                    </div>

                    <div className={styles.reportsSection}>
                      <h4>Recent Activities & Analysis ({radiologistActivities.length})</h4>
                      {loadingActivities ? (
                        <p>Loading activities...</p>
                      ) : radiologistActivities.length > 0 ? (
                        <div className={styles.reportsListModal}>
                          {radiologistActivities.map(activity => (
                            <div key={activity.id} className={styles.reportItemModal}>
                              <div className={styles.reportHeaderModal}>
                                <h5>{activity.session_code || `Session-${activity.id.substring(0, 8)}`}</h5>
                                <span className={styles.statusBadge}>{activity.status}</span>
                              </div>
                              <p><strong>Date:</strong> {new Date(activity.created_at).toLocaleDateString()} {new Date(activity.created_at).toLocaleTimeString()}</p>
                              <p><strong>File:</strong> {activity.filename}</p>
                              {activity.prediction && (
                                <p><strong>Analysis Result:</strong> <span style={{color: activity.prediction.toLowerCase().includes('alz') ? '#ef4444' : '#10b981'}}>{activity.prediction}</span></p>
                              )}
                              {activity.confidence && (
                                <p><strong>Confidence:</strong> {(activity.confidence * 100).toFixed(1)}%</p>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p style={{color: '#666'}}>No recent activities found</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <>
              <div className={styles.sectionHeaderWithToggle}>
                <h1 className={styles.pageTitle}>Radiologist Management</h1>
                <div className={styles.viewToggle}>
                  <button
                    className={`${styles.viewToggleBtn} ${radiologistsViewMode === 'detailed' ? styles.active : ''}`}
                    onClick={() => setRadiologistsViewMode('detailed')}
                    title="Detailed View"
                  >
                    <Icons.Grid />
                  </button>
                  <button
                    className={`${styles.viewToggleBtn} ${radiologistsViewMode === 'compact' ? styles.active : ''}`}
                    onClick={() => setRadiologistsViewMode('compact')}
                    title="Compact View"
                  >
                    <Icons.List />
                  </button>
                </div>
              </div>

              {/* Advanced Filters */}
              <div className={styles.filtersCard}>
                {/* Always Visible: Search Bar */}
                <div className={styles.searchRow}>
                  <div className={styles.searchBox}>
                    <Icons.Search />
                    <input
                      type="text"
                      placeholder="Search by name, ID, or email..."
                      value={radiologistsSearchQuery}
                      onChange={(e) => setRadiologistsSearchQuery(e.target.value)}
                      className={styles.searchInput}
                    />
                    {radiologistsSearchQuery && (
                      <button onClick={() => setRadiologistsSearchQuery('')} className={styles.clearBtn}>
                        <Icons.X />
                      </button>
                    )}
                  </div>
                  <button
                    className={styles.filterToggleBtn}
                    onClick={() => setRadiologistsFiltersExpanded(!radiologistsFiltersExpanded)}
                    title={radiologistsFiltersExpanded ? "Hide Filters" : "Show More Filters"}
                  >
                    <Icons.Filter />
                    {radiologistsFiltersExpanded ? <Icons.ChevronUp /> : <Icons.ChevronDown />}
                    <span>{filteredRadiologistsData.length}/{allRadiologists.length}</span>
                  </button>
                </div>

                {/* Collapsible Advanced Filters */}
                {radiologistsFiltersExpanded && (
                  <div className={styles.expandedFilters}>
                    <div className={styles.filtersHeaderExpanded}>
                      <h3>Advanced Filters</h3>
                      <button onClick={resetRadiologistsFilters} className={styles.resetFiltersBtn}>
                        <Icons.X />
                        Reset All
                      </button>
                    </div>

                    <div className={styles.filterRow}>
                      <select value={radiologistsStatusFilter} onChange={(e) => setRadiologistsStatusFilter(e.target.value)} className={styles.filterSelect}>
                        <option value="all">All Status</option>
                        <option value="active">Active</option>
                        <option value="pending">Pending</option>
                        <option value="inactive">Inactive</option>
                      </select>

                      <select value={radiologistsActivityFilter} onChange={(e) => setRadiologistsActivityFilter(e.target.value)} className={styles.filterSelect}>
                        <option value="all">All Activity Levels</option>
                        <option value="active">Has Analyzed Reports</option>
                        <option value="inactive">No Reports Yet</option>
                      </select>
                    </div>

                    <div className={styles.dateRangeRow}>
                      <Icons.Calendar />
                      <span className={styles.dateLabel}>Joined Date:</span>
                      <input type="date" value={radiologistsDateRange.start} onChange={(e) => setRadiologistsDateRange({...radiologistsDateRange, start: e.target.value})} className={styles.dateInput} />
                      <span className={styles.dateSeparator}>to</span>
                      <input type="date" value={radiologistsDateRange.end} onChange={(e) => setRadiologistsDateRange({...radiologistsDateRange, end: e.target.value})} className={styles.dateInput} />
                    </div>
                  </div>
                )}
              </div>

              {filteredRadiologistsData.length > 0 ? (
                <>
                  {radiologistsViewMode === 'detailed' ? (
                    <div className={styles.cardGrid}>
                      {filteredRadiologistsData.map(radiologist => (
                        <div key={radiologist.id} className={styles.radiologistCard} onClick={() => { setSelectedRadiologistDetail(radiologist); setDetailView('radiologist'); fetchRadiologistActivities(radiologist.id); }} style={{ cursor: 'pointer' }}>
                          <div className={styles.cardHeader}>
                            <h3>{radiologist.full_name}</h3>
                            <span className={styles.radiologistId}>{radiologist.unique_identifier}</span>
                          </div>
                          <div className={styles.cardBody}>
                            <p><strong>Email:</strong> {radiologist.email}</p>
                            <p><strong>Phone:</strong> {radiologist.phone}</p>
                            <p><strong>Status:</strong> {radiologist.account_status}</p>
                            <p><strong>Reports Analyzed:</strong> {radiologist.activityCount || 0}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className={styles.compactList}>
                      {filteredRadiologistsData.map(radiologist => (
                        <div key={radiologist.id} className={styles.compactItem} onClick={() => { setSelectedRadiologistDetail(radiologist); setDetailView('radiologist'); fetchRadiologistActivities(radiologist.id); }}>
                          <div className={styles.compactLeft}>
                            <h4>{radiologist.full_name}</h4>
                            <span className={styles.compactMeta}>
                              {radiologist.unique_identifier} • {radiologist.email} • {radiologist.activityCount || 0} reports analyzed
                            </span>
                          </div>
                          <div className={styles.compactRight}>
                            <span className={`${styles.statusBadgeSmall} ${styles[radiologist.account_status?.toLowerCase()]}`}>
                              {radiologist.account_status}
                            </span>
                            <span className={styles.confidenceBadge}>{radiologist.phone}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className={styles.emptyState}>
                  <Icons.Activity />
                  <p>No radiologists found</p>
                </div>
              )}
            </>
            )}
            </div>
          )}

          {/* Reports Tab */}
          {activeTab === 'reports' && (
            <div className={styles.section}>
              {detailView === 'report' && selectedReportDetail ? (
                // Report Detail View
                <div>
                  <div className={styles.detailHeader}>
                    <button onClick={() => setDetailView(null)} className={styles.backButton}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="15 18 9 12 15 6"/>
                      </svg>
                      Back to Reports
                    </button>
                    <h1 className={styles.pageTitle}>Report Details</h1>
                  </div>

                  <div className={styles.detailContent}>
                    <div className={styles.reportDetailsHeader}>
                      <h3>{selectedReportDetail.session_code || `Session-${selectedReportDetail.id.substring(0, 12)}`}</h3>
                      <span className={`${styles.statusBadge} ${styles[selectedReportDetail.status?.toLowerCase()]}`}>
                        {selectedReportDetail.status}
                      </span>
                    </div>

                    <div className={styles.detailsGrid}>
                      <div><strong>Report ID:</strong> {selectedReportDetail.id.substring(0, 12)}...</div>
                      <div><strong>Patient:</strong> {selectedReportDetail.patient_name || 'Unknown'}</div>
                      <div><strong>Doctor:</strong> Dr. {selectedReportDetail.doctor_name || 'Unassigned'}</div>
                      <div><strong>Radiologist:</strong> {selectedReportDetail.radiologist_name || 'Not assigned'}</div>
                      <div><strong>Hospital:</strong> {selectedReportDetail.hospital_name || 'N/A'}</div>
                      <div><strong>Date:</strong> {new Date(selectedReportDetail.created_at).toLocaleString()}</div>
                      <div><strong>Original Filename:</strong> {selectedReportDetail.filename}</div>
                      {selectedReportDetail.session_code && (
                        <div><strong>Session Code:</strong> {selectedReportDetail.session_code}</div>
                      )}
                    </div>

                    {selectedReportDetail.prediction && (
                      <div className={styles.predictionSection}>
                        <h4>Analysis Result</h4>
                        <div className={styles.predictionResult}>
                          <span
                            className={styles.predictionLabel}
                            style={{
                              color: selectedReportDetail.prediction.toLowerCase().includes('alz') ? '#ef4444' : '#10b981',
                              fontSize: '1.5rem',
                              fontWeight: 'bold'
                            }}
                          >
                            {selectedReportDetail.prediction}
                          </span>
                        </div>
                        {selectedReportDetail.probabilities && Array.isArray(selectedReportDetail.probabilities) && (
                          <div className={styles.confidenceBar}>
                            <strong>Confidence:</strong>
                            <div className={styles.progressContainer}>
                              <div
                                className={styles.progressBar}
                                style={{
                                  width: `${(Math.max(...selectedReportDetail.probabilities) * 100).toFixed(1)}%`,
                                  backgroundColor: (Math.max(...selectedReportDetail.probabilities) * 100) > 75 ? '#10b981' : '#f59e0b'
                                }}
                              />
                              <span className={styles.progressLabel}>
                                {(Math.max(...selectedReportDetail.probabilities) * 100).toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className={styles.pdfSection}>
                      <h4>Available Reports</h4>
                      <div className={styles.pdfButtons}>
                        {selectedReportDetail.patient_pdf_url && (
                          <button
                            onClick={() => window.open(selectedReportDetail.patient_pdf_url, '_blank')}
                            className={styles.pdfBtn}
                          >
                            <Icons.FileText />
                            Patient Report
                          </button>
                        )}
                        {selectedReportDetail.technical_pdf_url && (
                          <button
                            onClick={() => window.open(selectedReportDetail.technical_pdf_url, '_blank')}
                            className={styles.pdfBtn}
                          >
                            <Icons.FileText />
                            Technical Report
                          </button>
                        )}
                        {selectedReportDetail.clinician_pdf_url && (
                          <button
                            onClick={() => window.open(selectedReportDetail.clinician_pdf_url, '_blank')}
                            className={styles.pdfBtn}
                          >
                            <Icons.FileText />
                            Clinician Report
                          </button>
                        )}
                        {!selectedReportDetail.patient_pdf_url && !selectedReportDetail.technical_pdf_url && !selectedReportDetail.clinician_pdf_url && (
                          <p style={{color: '#666', fontStyle: 'italic'}}>No PDF reports available yet</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
              <div className={styles.sectionHeaderWithToggle}>
                <h1 className={styles.pageTitle}>EEG Analysis Reports</h1>
                <div className={styles.viewToggle}>
                  <button
                    className={`${styles.viewToggleBtn} ${reportsViewMode === 'detailed' ? styles.active : ''}`}
                    onClick={() => setReportsViewMode('detailed')}
                    title="Detailed View"
                  >
                    <Icons.Grid />
                  </button>
                  <button
                    className={`${styles.viewToggleBtn} ${reportsViewMode === 'compact' ? styles.active : ''}`}
                    onClick={() => setReportsViewMode('compact')}
                    title="Compact View"
                  >
                    <Icons.List />
                  </button>
                </div>
              </div>

              {/* Advanced Filters Section */}
              <div className={styles.filtersCard}>
                {/* Always Visible: Search Bar */}
                <div className={styles.searchRow}>
                  <div className={styles.searchBox}>
                    <Icons.Search />
                    <input
                      type="text"
                      placeholder="Search by patient, doctor, radiologist, or session code..."
                      value={reportsSearchQuery}
                      onChange={(e) => setReportsSearchQuery(e.target.value)}
                      className={styles.searchInput}
                    />
                    {reportsSearchQuery && (
                      <button onClick={() => setReportsSearchQuery('')} className={styles.clearBtn}>
                        <Icons.X />
                      </button>
                    )}
                  </div>
                  <button
                    className={styles.filterToggleBtn}
                    onClick={() => setReportsFiltersExpanded(!reportsFiltersExpanded)}
                    title={reportsFiltersExpanded ? "Hide Filters" : "Show More Filters"}
                  >
                    <Icons.Filter />
                    {reportsFiltersExpanded ? <Icons.ChevronUp /> : <Icons.ChevronDown />}
                    <span>{filteredReports.length}/{allReports.length}</span>
                  </button>
                </div>

                {/* Collapsible Advanced Filters */}
                {reportsFiltersExpanded && (
                  <div className={styles.expandedFilters}>
                    <div className={styles.filtersHeaderExpanded}>
                      <h3>Advanced Filters</h3>
                      <button onClick={resetReportsFilters} className={styles.resetFiltersBtn}>
                        <Icons.X />
                        Reset All
                      </button>
                    </div>

                    {/* Filter Row 1 */}
                    <div className={styles.filterRow}>
                  <select
                    value={reportsStatusFilter}
                    onChange={(e) => setReportsStatusFilter(e.target.value)}
                    className={styles.filterSelect}
                  >
                    <option value="all">All Status</option>
                    <option value="completed">Completed</option>
                    <option value="pending">Pending</option>
                    <option value="processing">Processing</option>
                    <option value="failed">Failed</option>
                  </select>

                  <select
                    value={reportsPredictionFilter}
                    onChange={(e) => setReportsPredictionFilter(e.target.value)}
                    className={styles.filterSelect}
                  >
                    <option value="all">All Results</option>
                    <option value="alzheimers">Alzheimer's Detected</option>
                    <option value="normal">Normal/Healthy</option>
                  </select>

                  <select
                    value={reportsPatientFilter}
                    onChange={(e) => setReportsPatientFilter(e.target.value)}
                    className={styles.filterSelect}
                  >
                    <option value="all">All Patients</option>
                    {getUniquePatients().map(patient => (
                      <option key={patient} value={patient}>{patient}</option>
                    ))}
                  </select>
                </div>

                    {/* Filter Row 2 */}
                    <div className={styles.filterRow}>
                      <select
                        value={reportsDoctorFilter}
                        onChange={(e) => setReportsDoctorFilter(e.target.value)}
                        className={styles.filterSelect}
                      >
                        <option value="all">All Doctors</option>
                        {getUniqueDoctors().map(doctor => (
                          <option key={doctor} value={doctor}>Dr. {doctor}</option>
                        ))}
                      </select>

                      <select
                        value={reportsRadiologistFilter}
                        onChange={(e) => setReportsRadiologistFilter(e.target.value)}
                        className={styles.filterSelect}
                      >
                        <option value="all">All Radiologists</option>
                        {getUniqueRadiologists().map(radiologist => (
                          <option key={radiologist} value={radiologist}>{radiologist}</option>
                        ))}
                      </select>
                    </div>

                    {/* Date Range Filter */}
                    <div className={styles.dateRangeRow}>
                      <Icons.Calendar />
                      <span className={styles.dateLabel}>Date Range:</span>
                      <input
                        type="date"
                        value={reportsDateRange.start}
                        onChange={(e) => setReportsDateRange({...reportsDateRange, start: e.target.value})}
                        className={styles.dateInput}
                      />
                      <span className={styles.dateSeparator}>to</span>
                      <input
                        type="date"
                        value={reportsDateRange.end}
                        onChange={(e) => setReportsDateRange({...reportsDateRange, end: e.target.value})}
                        className={styles.dateInput}
                      />
                    </div>
                  </div>
                )}
              </div>

              {filteredReports.length > 0 ? (
                <>
                  {reportsViewMode === 'detailed' ? (
                    <div className={styles.cardGrid}>
                      {filteredReports.map(report => {
                        const confidence = report.probabilities && Array.isArray(report.probabilities)
                          ? (Math.max(...report.probabilities) * 100).toFixed(1)
                          : 'N/A';

                        return (
                          <div
                            key={report.id}
                            className={styles.reportCard}
                            onClick={() => {
                              setSelectedReportDetail(report);
                              setDetailView('report');
                            }}
                            style={{ cursor: 'pointer' }}
                          >
                            <div className={styles.cardHeader}>
                              <h3>{report.session_code || `Session-${report.id.substring(0, 8)}`}</h3>
                              <span className={`${styles.statusBadge} ${styles[report.status?.toLowerCase()]}`}>
                                {report.status}
                              </span>
                            </div>
                            <div className={styles.cardBody}>
                              <p><strong>Patient:</strong> {report.patient_name || 'Unknown'}</p>
                              <p><strong>Doctor:</strong> Dr. {report.doctor_name || 'Unassigned'}</p>
                              <p><strong>Radiologist:</strong> {report.radiologist_name || 'Not Assigned'}</p>
                              <p><strong>Date:</strong> {new Date(report.created_at).toLocaleDateString()}</p>
                              {report.prediction && (
                                <p><strong>Result:</strong> <span style={{ color: report.prediction.toLowerCase().includes('alz') ? '#ef4444' : '#10b981' }}>{report.prediction}</span></p>
                              )}
                              {confidence !== 'N/A' && (
                                <p><strong>Confidence:</strong> {confidence}%</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className={styles.compactList}>
                      {filteredReports.map(report => {
                        const confidence = report.probabilities && Array.isArray(report.probabilities)
                          ? (Math.max(...report.probabilities) * 100).toFixed(1)
                          : 'N/A';

                        return (
                          <div
                            key={report.id}
                            className={styles.compactItem}
                            onClick={() => {
                              setSelectedReportDetail(report);
                              setDetailView('report');
                            }}
                          >
                            <div className={styles.compactLeft}>
                              <h4>{report.session_code || `Session-${report.id.substring(0, 8)}`}</h4>
                              <span className={styles.compactMeta}>
                                {report.patient_name || 'Unknown Patient'} • Dr. {report.doctor_name || 'Unassigned'} • Radiologist: {report.radiologist_name || 'N/A'} • {new Date(report.created_at).toLocaleDateString()}
                              </span>
                            </div>
                            <div className={styles.compactRight}>
                              <span className={`${styles.statusBadgeSmall} ${styles[report.status?.toLowerCase()]}`}>
                                {report.status}
                              </span>
                              {report.prediction && (
                                <span
                                  className={styles.predictionBadge}
                                  style={{
                                    backgroundColor: report.prediction.toLowerCase().includes('alz') ? '#fef2f2' : '#f0fdf4',
                                    color: report.prediction.toLowerCase().includes('alz') ? '#ef4444' : '#10b981'
                                  }}
                                >
                                  {report.prediction}
                                </span>
                              )}
                              {confidence !== 'N/A' && (
                                <span className={styles.confidenceBadge}>{confidence}%</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                <div className={styles.emptyState}>
                  <Icons.FileText />
                  <p>No reports available yet</p>
                </div>
              )}
            </>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Assignment Modal */}
      {showAssignModal && selectedPatient && (
        <div className={styles.modal} onClick={() => setShowAssignModal(false)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Assign Doctor to {selectedPatient.full_name}</h2>
              <button onClick={() => setShowAssignModal(false)} className={styles.closeBtn}>×</button>
            </div>

            <input
              type="text"
              placeholder="Search doctors..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className={styles.searchInput}
            />

            <div className={styles.doctorList}>
              {filteredDoctors.map(doctor => (
                <div
                  key={doctor.id}
                  onClick={() => setSelectedDoctor(doctor)}
                  className={`${styles.doctorOption} ${selectedDoctor?.id === doctor.id ? styles.selected : ''}`}
                >
                  <h4>{doctor.full_name}</h4>
                  <p>{doctor.doctor_profiles?.[0]?.specialization || 'General Medicine'}</p>
                  <span>{doctor.doctor_profiles?.[0]?.experience_years || 0} years exp</span>
                </div>
              ))}
            </div>

            {selectedDoctor && (
              <button onClick={handleAssignDoctor} className={styles.primaryBtn}>
                Assign {selectedDoctor.full_name}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Report Detail Modal */}
      {showReportDetailModal && selectedReportDetail && (
        <div className={styles.modal} onClick={() => setShowReportDetailModal(false)}>
          <div className={styles.modalContentLarge} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Report Details</h2>
              <button onClick={() => setShowReportDetailModal(false)} className={styles.closeBtn}>×</button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.reportDetailsHeader}>
                <h3>{getReportDisplayName(selectedReportDetail)}</h3>
                <span className={`${styles.statusBadge} ${styles[selectedReportDetail.status?.toLowerCase()]}`}>
                  {selectedReportDetail.status}
                </span>
              </div>

              <div className={styles.detailsGrid}>
                <div><strong>Report ID:</strong> {selectedReportDetail.id.substring(0, 12)}...</div>
                <div><strong>Patient:</strong> {selectedReportDetail.patient_name || 'Unknown'}</div>
                <div><strong>Doctor:</strong> {selectedReportDetail.doctor_name || 'Unassigned'}</div>
                <div><strong>Radiologist:</strong> {selectedReportDetail.radiologist_name || 'Not assigned'}</div>
                <div><strong>Hospital:</strong> {selectedReportDetail.hospital_name || 'N/A'}</div>
                <div><strong>Date:</strong> {new Date(selectedReportDetail.created_at).toLocaleString()}</div>
                <div><strong>Original Filename:</strong> {selectedReportDetail.filename}</div>
                {selectedReportDetail.session_code && (
                  <div><strong>Session Code:</strong> {selectedReportDetail.session_code}</div>
                )}
              </div>

              {selectedReportDetail.prediction && (
                <div className={styles.predictionSection}>
                  <h4>Analysis Results</h4>
                  <div className={styles.predictionDetails}>
                    <div className={styles.predictionMain}>
                      <strong>Prediction:</strong>
                      <span style={{
                        fontSize: '1.2em',
                        color: selectedReportDetail.prediction.toLowerCase().includes('alz') ? '#ef4444' : '#10b981',
                        marginLeft: '10px'
                      }}>
                        {selectedReportDetail.prediction}
                      </span>
                    </div>
                    {selectedReportDetail.probabilities && Array.isArray(selectedReportDetail.probabilities) && (
                      <div className={styles.confidenceBar}>
                        <strong>Confidence:</strong>
                        <div className={styles.progressContainer}>
                          <div
                            className={styles.progressBar}
                            style={{
                              width: `${(Math.max(...selectedReportDetail.probabilities) * 100).toFixed(1)}%`,
                              backgroundColor: (Math.max(...selectedReportDetail.probabilities) * 100) > 75 ? '#10b981' : '#f59e0b'
                            }}
                          />
                          <span className={styles.progressLabel}>
                            {(Math.max(...selectedReportDetail.probabilities) * 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className={styles.pdfSection}>
                <h4>Available Reports</h4>
                <div className={styles.pdfButtons}>
                  {selectedReportDetail.patient_pdf_url && (
                    <button
                      onClick={() => window.open(selectedReportDetail.patient_pdf_url, '_blank')}
                      className={styles.pdfBtn}
                    >
                      <Icons.FileText />
                      Patient Report
                    </button>
                  )}
                  {selectedReportDetail.technical_pdf_url && (
                    <button
                      onClick={() => window.open(selectedReportDetail.technical_pdf_url, '_blank')}
                      className={styles.pdfBtn}
                    >
                      <Icons.FileText />
                      Technical Report
                    </button>
                  )}
                  {selectedReportDetail.clinician_pdf_url && (
                    <button
                      onClick={() => window.open(selectedReportDetail.clinician_pdf_url, '_blank')}
                      className={styles.pdfBtn}
                    >
                      <Icons.FileText />
                      Clinician Report
                    </button>
                  )}
                  {!selectedReportDetail.patient_pdf_url && !selectedReportDetail.technical_pdf_url && !selectedReportDetail.clinician_pdf_url && (
                    <p style={{color: '#666', fontStyle: 'italic'}}>No PDF reports available yet</p>
                  )}
                </div>
              </div>
            </div>

            <div className={styles.modalActions}>
              <button
                onClick={() => setShowReportDetailModal(false)}
                className={styles.primaryBtn}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approval Modal */}
      {showApprovalModal && selectedUser && (
        <div className={styles.modal} onClick={() => setShowApprovalModal(false)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Review Application</h2>
              <button onClick={() => setShowApprovalModal(false)} className={styles.closeBtn}>×</button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.userDetails}>
                <div className={styles.avatarLarge}>{selectedUser.full_name?.[0]?.toUpperCase()}</div>
                <h3>{selectedUser.full_name}</h3>
                <span className={`${styles.roleTag} ${styles[selectedUser.role]}`}>{selectedUser.role}</span>
              </div>

              <div className={styles.detailsGrid}>
                <div><strong>Email:</strong> {selectedUser.email}</div>
                <div><strong>Phone:</strong> {selectedUser.phone}</div>
                <div><strong>Address:</strong> {selectedUser.address}</div>
                <div><strong>ID:</strong> {selectedUser.unique_identifier}</div>
              </div>
            </div>

            <div className={styles.modalActions}>
              <button
                onClick={() => handleApproveUser(selectedUser.id, selectedUser.role)}
                className={styles.approveBtn}
              >
                Approve
              </button>
              <button
                onClick={() => handleRejectUser(selectedUser.id)}
                className={styles.rejectBtn}
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default withAuth(AdminDashboard, ['admin']);