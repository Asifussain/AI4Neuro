import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Navbar from '../../components/Navbar';
import UnifiedSidebar from '../../components/UnifiedSidebar';
import { useAuth } from '../../components/AuthProvider';
import withAuth from '../../components/withAuth';
import LoadingSpinner from '../../components/LoadingSpinner';
import supabase from '../../lib/supabaseClient';
import styles from '../../styles/Reports.module.css';

// Custom SVG Icons
const Icons = {
  Search: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8"/>
      <path d="m21 21-4.35-4.35"/>
    </svg>
  ),
  Filter: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
    </svg>
  ),
  Download: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  ),
  Eye: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ),
  FileText: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
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
  User: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  Hospital: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2v20M17 7v10M7 7v10"/>
      <rect x="3" y="4" width="18" height="18" rx="2"/>
    </svg>
  ),
  Activity: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  ),
  X: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  ChevronLeft: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  ),
  ChevronRight: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  ),
  Grid: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7"/>
      <rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/>
      <rect x="3" y="14" width="7" height="7"/>
    </svg>
  ),
  List: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="8" y1="6" x2="21" y2="6"/>
      <line x1="8" y1="12" x2="21" y2="12"/>
      <line x1="8" y1="18" x2="21" y2="18"/>
      <line x1="3" y1="6" x2="3.01" y2="6"/>
      <line x1="3" y1="12" x2="3.01" y2="12"/>
      <line x1="3" y1="18" x2="3.01" y2="18"/>
    </svg>
  ),
};

function ReportsPage() {
  const { user, userProfile, hospitalData } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('reports');
  const [isLoading, setIsLoading] = useState(true);
  const [reports, setReports] = useState([]);
  const [filteredReports, setFilteredReports] = useState([]);

  // View Mode
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [predictionFilter, setPredictionFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState({ start: '', end: '' });
  const [doctorFilter, setDoctorFilter] = useState('all');
  const [patientFilter, setPatientFilter] = useState('all');

  // Dropdown options for admin/radiologist
  const [uniqueDoctors, setUniqueDoctors] = useState([]);
  const [uniquePatients, setUniquePatients] = useState([]);

  useEffect(() => {
    if (userProfile) {
      fetchReports();
    }
  }, [userProfile]);

  useEffect(() => {
    applyFilters();
  }, [reports, searchQuery, statusFilter, predictionFilter, dateFilter, doctorFilter, patientFilter]);

  // Extract unique doctors and patients from reports for filtering
  useEffect(() => {
    if (reports.length > 0) {
      const doctors = [...new Set(reports.map(r => r.doctor_name).filter(Boolean))];
      const patients = [...new Set(reports.map(r => r.patient_name).filter(Boolean))];
      setUniqueDoctors(doctors);
      setUniquePatients(patients);
    }
  }, [reports]);

  const fetchReports = async () => {
    try {
      setIsLoading(true);

      // Fetch from predictions table with enhanced metadata
      let query = supabase
        .from('predictions')
        .select(`
          id,
          filename,
          prediction,
          status,
          created_at,
          report_generated_at,
          patient_id,
          patient_name,
          doctor_id,
          doctor_name,
          radiologist_id,
          radiologist_name,
          hospital_id,
          hospital_name,
          technician_id,
          technician_name,
          session_code,
          patient_pdf_url,
          technical_pdf_url,
          clinician_pdf_url,
          probabilities,
          consistency_metrics,
          user_id
        `)
        .not('status', 'is', null)
        .order('created_at', { ascending: false });

      // RELAXED FILTERING: Show reports with OR logic instead of strict filtering
      if (userProfile.role === 'patient') {
        // Patients see reports where patient_id matches OR user_id matches (backward compatibility)
        query = query.or(`patient_id.eq.${userProfile.id},user_id.eq.${userProfile.id}`);
      } else if (userProfile.role === 'doctor') {
        // Doctors see reports where doctor_id matches OR show all if null (relaxed)
        query = query.or(`doctor_id.eq.${userProfile.id},doctor_id.is.null`);
      } else if (userProfile.role === 'radiologist' || userProfile.role === 'admin') {
        // Radiologists and Admins see all reports in their hospital OR all if hospital_id is null
        if (userProfile.hospital_id) {
          query = query.or(`hospital_id.eq.${userProfile.hospital_id},hospital_id.is.null`);
        }
        // If no hospital_id, show everything
      }

      const { data, error } = await query;

      if (error) throw error;

      console.log(`✅ Fetched ${data?.length || 0} reports for ${userProfile.role}`);

      // Set reports directly with metadata
      setReports(data || []);
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...reports];

    // Search filter - search across filename, patient name, doctor name, session code
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(report =>
        report.filename?.toLowerCase().includes(query) ||
        report.patient_name?.toLowerCase().includes(query) ||
        report.doctor_name?.toLowerCase().includes(query) ||
        report.session_code?.toLowerCase().includes(query) ||
        report.id?.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(report =>
        report.status?.toLowerCase() === statusFilter.toLowerCase()
      );
    }

    // Prediction result filter
    if (predictionFilter !== 'all') {
      if (predictionFilter === 'alzheimers') {
        filtered = filtered.filter(report =>
          report.prediction?.toLowerCase().includes('alz')
        );
      } else if (predictionFilter === 'normal') {
        filtered = filtered.filter(report =>
          report.prediction?.toLowerCase().includes('normal')
        );
      }
    }

    // Date filter
    if (dateFilter.start) {
      filtered = filtered.filter(report =>
        new Date(report.created_at) >= new Date(dateFilter.start)
      );
    }
    if (dateFilter.end) {
      filtered = filtered.filter(report =>
        new Date(report.created_at) <= new Date(dateFilter.end + 'T23:59:59')
      );
    }

    // Doctor filter (by name)
    if (doctorFilter !== 'all') {
      filtered = filtered.filter(report => report.doctor_name === doctorFilter);
    }

    // Patient filter (by name)
    if (patientFilter !== 'all') {
      filtered = filtered.filter(report => report.patient_name === patientFilter);
    }

    setFilteredReports(filtered);
    setCurrentPage(1);
  };

  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setPredictionFilter('all');
    setDateFilter({ start: '', end: '' });
    setDoctorFilter('all');
    setPatientFilter('all');
    setCurrentPage(1);
  };

  const getPaginatedReports = () => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredReports.slice(startIndex, endIndex);
  };

  const totalPages = Math.ceil(filteredReports.length / itemsPerPage);

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

  const getReportTypeBadge = (type) => {
    const badges = {
      patient: { label: 'Patient', color: '#10b981' },
      doctor: { label: 'Doctor', color: '#3b82f6' },
      technical: { label: 'Technical', color: '#f59e0b' }
    };
    return badges[type] || { label: type, color: '#6b7280' };
  };

  const navigationItems = [
    { id: 'reports', label: 'EEG Analysis Reports', icon: 'FileText' },
  ];

  const stats = {
    total: reports.length,
    completed: reports.filter(r => r.status?.toLowerCase() === 'completed').length,
    pending: reports.filter(r => r.status?.toLowerCase() === 'pending').length,
  };

  const getStatusColor = (status) => {
    const statusLower = status?.toLowerCase();
    if (statusLower === 'completed') return '#10b981';
    if (statusLower === 'pending' || statusLower === 'processing') return '#f59e0b';
    if (statusLower === 'failed') return '#ef4444';
    return '#6b7280';
  };

  const getPDFUrl = (report) => {
    if (userProfile.role === 'patient') return report.patient_pdf_url;
    if (userProfile.role === 'doctor') return report.technical_pdf_url; // Doctors see radiologist/technician reports
    if (userProfile.role === 'radiologist' || userProfile.role === 'admin') return report.technical_pdf_url;
    return report.technical_pdf_url;
  };

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <LoadingSpinner />
        <p>Loading reports...</p>
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
          onTabChange={setActiveTab}
          navigationItems={navigationItems}
          stats={stats}
        />

        <main className={styles.mainContent}>
          <div className={styles.pageHeader}>
            <div>
              <h1>EEG Analysis Reports</h1>
              <p>View and manage all brain activity analysis reports</p>
            </div>
            <div className={styles.pageStats}>
              <div className={styles.viewToggle}>
                <button
                  className={`${styles.viewToggleBtn} ${viewMode === 'grid' ? styles.active : ''}`}
                  onClick={() => setViewMode('grid')}
                  title="Grid View"
                >
                  <Icons.Grid />
                </button>
                <button
                  className={`${styles.viewToggleBtn} ${viewMode === 'list' ? styles.active : ''}`}
                  onClick={() => setViewMode('list')}
                  title="List View"
                >
                  <Icons.List />
                </button>
              </div>
              <div className={styles.statPill}>
                <Icons.FileText />
                <span>{reports.length} Total</span>
              </div>
              <div className={styles.statPill} style={{borderColor: '#10b981', color: '#10b981'}}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
                <span>{stats.completed} Completed</span>
              </div>
            </div>
          </div>

          {/* Filters Section */}
          <div className={styles.filtersCard}>
            <div className={styles.filterHeader}>
              <Icons.Filter />
              <h3>Search & Filter</h3>
            </div>

            <div className={styles.filterRow}>
              <div className={styles.searchBox}>
                <Icons.Search />
                <input
                  type="text"
                  placeholder="Search by patient, doctor, filename, or session code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={styles.searchInput}
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className={styles.clearSearchBtn}>
                    <Icons.X />
                  </button>
                )}
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={styles.filterSelect}
              >
                <option value="all">All Status</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="failed">Failed</option>
              </select>

              <select
                value={predictionFilter}
                onChange={(e) => setPredictionFilter(e.target.value)}
                className={styles.filterSelect}
              >
                <option value="all">All Results</option>
                <option value="alzheimers">Alzheimer's Pattern</option>
                <option value="normal">Normal Pattern</option>
              </select>

              {(userProfile.role === 'admin' || userProfile.role === 'radiologist') && (
                <>
                  <select
                    value={doctorFilter}
                    onChange={(e) => setDoctorFilter(e.target.value)}
                    className={styles.filterSelect}
                  >
                    <option value="all">All Doctors</option>
                    {uniqueDoctors.map(doctor => (
                      <option key={doctor} value={doctor}>{doctor}</option>
                    ))}
                  </select>

                  <select
                    value={patientFilter}
                    onChange={(e) => setPatientFilter(e.target.value)}
                    className={styles.filterSelect}
                  >
                    <option value="all">All Patients</option>
                    {uniquePatients.map(patient => (
                      <option key={patient} value={patient}>{patient}</option>
                    ))}
                  </select>
                </>
              )}
            </div>

            <div className={styles.filterRow} style={{marginTop: '1rem'}}>
              <div className={styles.dateFilterGroup}>
                <Icons.Calendar />
                <input
                  type="date"
                  value={dateFilter.start}
                  onChange={(e) => setDateFilter({...dateFilter, start: e.target.value})}
                  className={styles.dateInput}
                  placeholder="Start Date"
                />
                <span style={{color: '#64748b'}}>to</span>
                <input
                  type="date"
                  value={dateFilter.end}
                  onChange={(e) => setDateFilter({...dateFilter, end: e.target.value})}
                  className={styles.dateInput}
                  placeholder="End Date"
                />
              </div>

              <button className={styles.clearFiltersBtn} onClick={resetFilters}>
                <Icons.X />
                Clear All Filters
              </button>
            </div>

            <div className={styles.resultsInfo}>
              <Icons.Activity />
              Showing <strong>{getPaginatedReports().length}</strong> of <strong>{filteredReports.length}</strong> reports
              {searchQuery && <span className={styles.searchIndicator}>(filtered by search)</span>}
            </div>
          </div>

          {/* Reports Grid */}
          {filteredReports.length === 0 ? (
            <div className={styles.emptyState}>
              <Icons.FileText />
              <h3>No reports found</h3>
              <p>Try adjusting your filters or search query</p>
              {(searchQuery || statusFilter !== 'all' || predictionFilter !== 'all') && (
                <button className={styles.resetBtn} onClick={resetFilters}>
                  Reset Filters
                </button>
              )}
            </div>
          ) : (
            <>
              <div className={`${styles.reportsGrid} ${viewMode === 'list' ? styles.listView : ''}`}>
                {getPaginatedReports().map((report) => {
                  const pdfUrl = getPDFUrl(report);
                  const confidence = report.probabilities && Array.isArray(report.probabilities)
                    ? (Math.max(...report.probabilities) * 100).toFixed(1)
                    : 'N/A';

                  return (
                    <div key={report.id} className={`${styles.reportCard} ${viewMode === 'list' ? styles.listLayout : ''}`}>
                      <div className={styles.reportHeader}>
                        <div className={styles.reportTitle}>
                          <Icons.Activity />
                          <div>
                            <h3>{report.session_code || `Session-${report.id.substring(0, 8)}`}</h3>
                            <p className={styles.filename}>{report.filename}</p>
                          </div>
                        </div>
                        <span
                          className={styles.statusBadge}
                          style={{
                            backgroundColor: `${getStatusColor(report.status)}15`,
                            color: getStatusColor(report.status),
                            border: `1px solid ${getStatusColor(report.status)}40`
                          }}
                        >
                          {report.status || 'Unknown'}
                        </span>
                      </div>

                      <div className={styles.reportMetadata}>
                        {/* Show warning if metadata is missing */}
                        {(!report.patient_id || !report.doctor_id || !report.hospital_id) && (
                          <div className={styles.warningBanner}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                              <line x1="12" y1="9" x2="12" y2="13"/>
                              <line x1="12" y1="17" x2="12.01" y2="17"/>
                            </svg>
                            <span>Incomplete metadata - uploaded before system update</span>
                          </div>
                        )}

                        <div className={styles.metadataRow}>
                          <div className={styles.metadataItem}>
                            <Icons.User />
                            <div>
                              <span className={styles.metadataLabel}>Patient</span>
                              <strong style={{ color: !report.patient_id ? '#f59e0b' : '#f1f5f9' }}>
                                {report.patient_name || 'Unassigned ⚠️'}
                              </strong>
                            </div>
                          </div>
                          <div className={styles.metadataItem}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/>
                              <path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4"/>
                              <circle cx="20" cy="10" r="2"/>
                            </svg>
                            <div>
                              <span className={styles.metadataLabel}>Doctor</span>
                              <strong style={{ color: !report.doctor_id ? '#f59e0b' : '#f1f5f9' }}>
                                {report.doctor_name || 'Unassigned ⚠️'}
                              </strong>
                            </div>
                          </div>
                        </div>

                        {userProfile.role !== 'patient' && (
                          <div className={styles.metadataRow}>
                            <div className={styles.metadataItem}>
                              <Icons.Hospital />
                              <div>
                                <span className={styles.metadataLabel}>Hospital</span>
                                <strong style={{ color: !report.hospital_id ? '#f59e0b' : '#f1f5f9' }}>
                                  {report.hospital_name || hospitalData?.name || 'Unassigned ⚠️'}
                                </strong>
                              </div>
                            </div>
                            {report.radiologist_name && (
                              <div className={styles.metadataItem}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <circle cx="12" cy="12" r="10"/>
                                  <path d="M12 16v-4M12 8h.01"/>
                                </svg>
                                <div>
                                  <span className={styles.metadataLabel}>Radiologist</span>
                                  <strong>{report.radiologist_name}</strong>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        <div className={styles.metadataRow}>
                          <div className={styles.metadataItem}>
                            <Icons.Calendar />
                            <div>
                              <span className={styles.metadataLabel}>Analysis Date</span>
                              <strong>{formatDate(report.created_at)}</strong>
                            </div>
                          </div>
                          {report.prediction && (
                            <div className={styles.metadataItem}>
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                              </svg>
                              <div>
                                <span className={styles.metadataLabel}>Result</span>
                                <strong style={{
                                  color: report.prediction.toLowerCase().includes('alz') ? '#ef4444' : '#10b981'
                                }}>
                                  {report.prediction}
                                </strong>
                              </div>
                            </div>
                          )}
                        </div>

                        {confidence !== 'N/A' && (
                          <div className={styles.confidenceBar}>
                            <div className={styles.confidenceLabel}>
                              <span>Confidence</span>
                              <strong>{confidence}%</strong>
                            </div>
                            <div className={styles.confidenceProgress}>
                              <div
                                className={styles.confidenceFill}
                                style={{
                                  width: `${confidence}%`,
                                  backgroundColor: parseFloat(confidence) > 75 ? '#10b981' : '#f59e0b'
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      <div className={styles.reportActions}>
                        {pdfUrl ? (
                          <button
                            className={styles.downloadBtn}
                            onClick={() => window.open(pdfUrl, '_blank')}
                          >
                            <Icons.Download />
                            Download Report
                          </button>
                        ) : (
                          <div className={styles.noPdfNotice}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="10"/>
                              <line x1="12" y1="8" x2="12" y2="12"/>
                              <line x1="12" y1="16" x2="12.01" y2="16"/>
                            </svg>
                            Report being generated...
                          </div>
                        )}
                        <button
                          className={styles.viewDetailsBtn}
                          onClick={() => router.push(`/result?prediction_id=${report.id}`)}
                        >
                          <Icons.Eye />
                          View Details
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className={styles.pagination}>
                  <button
                    className={styles.pageBtn}
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                  >
                    <Icons.ChevronLeft />
                    Previous
                  </button>

                  <div className={styles.pageNumbers}>
                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 7) {
                        pageNum = i + 1;
                      } else if (currentPage <= 4) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 3) {
                        pageNum = totalPages - 6 + i;
                      } else {
                        pageNum = currentPage - 3 + i;
                      }

                      return (
                        <button
                          key={pageNum}
                          className={`${styles.pageNumber} ${currentPage === pageNum ? styles.active : ''}`}
                          onClick={() => setCurrentPage(pageNum)}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    className={styles.pageBtn}
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <Icons.ChevronRight />
                  </button>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </>
  );
}

export default withAuth(ReportsPage, ['patient', 'doctor', 'admin', 'radiologist']);
