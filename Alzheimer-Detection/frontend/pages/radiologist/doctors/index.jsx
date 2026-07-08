import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Navbar from '../../../components/Navbar';
import { useAuth } from '../../../components/AuthProvider';
import withAuth from '../../../components/withAuth';
import LoadingSpinner from '../../../components/LoadingSpinner';
import supabase from '../../../lib/supabaseClient';
import styles from '../../../styles/DashboardLayout.module.css';

function DoctorsList() {
  const { user, userProfile, hospitalData } = useAuth();
  const router = useRouter();
  
  // State management
  const [isLoading, setIsLoading] = useState(true);
  const [doctors, setDoctors] = useState([]);
  const [filteredDoctors, setFilteredDoctors] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [specializationFilter, setSpecializationFilter] = useState('');
  const [error, setError] = useState('');
  const [specializations, setSpecializations] = useState([]);

  useEffect(() => {
    if (user && userProfile?.role === 'radiologist') {
      loadDoctors();
    }
  }, [user, userProfile]);

  useEffect(() => {
    // Filter doctors based on search and specialization
    let filtered = doctors;
    
    if (searchTerm) {
      filtered = filtered.filter(doctor => 
        doctor.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doctor.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (specializationFilter) {
      filtered = filtered.filter(doctor =>
        doctor.specialization === specializationFilter
      );
    }
    
    setFilteredDoctors(filtered);
  }, [doctors, searchTerm, specializationFilter]);

  const loadDoctors = async () => {
    try {
      setIsLoading(true);
      setError('');

      // Verify hospital access
      if (!userProfile?.hospital_id) {
        throw new Error('Hospital information not available');
      }

      // Get session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Authentication required');
      }

      // Call API to get doctors
      const response = await fetch('/api/radiologist/get-doctors', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          hospital_id: userProfile.hospital_id
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load doctors');
      }

      const result = await response.json();
      console.log('Doctors API result:', result);

      if (result.success && result.data) {
        const doctorsData = result.data.map(doctor => ({
          id: doctor.id,
          full_name: doctor.full_name || 'Unknown Doctor',
          email: doctor.email || 'No email',
          unique_identifier: doctor.unique_identifier,
          medical_license: doctor.medical_license || 'N/A',
          specialization: doctor.specialization || 'General Practice',
          experience_years: doctor.experience_years || 0
        }));

        setDoctors(doctorsData);

        // Extract unique specializations for filter
        const uniqueSpecializations = [...new Set(
          doctorsData
            .map(d => d.specialization)
            .filter(Boolean)
        )];
        setSpecializations(uniqueSpecializations);
      } else {
        setDoctors([]);
      }

    } catch (error) {
      console.error('Error loading doctors:', error);
      setError(error.message || 'Failed to load doctors. Please try again.');
      setDoctors([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToDashboard = () => {
    router.push('/radiologist/dashboard');
  };

  if (isLoading) {
    return (
      <>
        <Navbar />
        <div className={styles.dashboardContainer}>
          <div className={styles.loadingContainer}>
            <LoadingSpinner />
            <p>Loading doctors from your hospital...</p>
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
          <button className={styles.backButton} onClick={handleBackToDashboard}>
            ← Back to Dashboard
          </button>
          <h1>Select Doctor</h1>
          <p>Choose a doctor to view their patients for EEG analysis</p>
          <div className={styles.hospitalInfo}>
            <span>Hospital: {hospitalData?.name}</span>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className={styles.errorAlert}>
            <span>⚠️ {error}</span>
            <button onClick={() => setError('')}>×</button>
          </div>
        )}

        {/* Search and Filter Controls */}
        <div className={styles.contentSection}>
          <div className={styles.managementHeader}>
            <h2>Doctors ({filteredDoctors.length})</h2>
            <div className={styles.controls}>
              <input
                type="text"
                placeholder="Search doctors by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={styles.searchInput}
              />
              <select
                value={specializationFilter}
                onChange={(e) => setSpecializationFilter(e.target.value)}
                className={styles.filterSelect}
              >
                <option value="">All Specializations</option>
                {specializations.map(spec => (
                  <option key={spec} value={spec}>{spec}</option>
                ))}
              </select>
              <button 
                onClick={loadDoctors}
                className={styles.refreshButton}
                disabled={isLoading}
              >
                {isLoading ? <LoadingSpinner size={16} /> : '🔄'} Refresh
              </button>
            </div>
          </div>

          {/* Doctors Grid */}
          {filteredDoctors.length > 0 ? (
            <div className={styles.userGrid}>
              {filteredDoctors.map(doctor => (
                <Link 
                  key={doctor.id} 
                  href={`/radiologist/doctors/${doctor.id}/patients`}
                  className={styles.userCard}
                >
                  <div className={styles.userHeader}>
                    <div className={styles.userBasic}>
                      <h3>{doctor.full_name}</h3>
                      <div className={styles.roleTag}>
                        👨‍⚕️ Doctor
                      </div>
                    </div>
                    <div className={styles.statusBadge}>
                      ✅ Verified
                    </div>
                  </div>

                  <div className={styles.userDetails}>
                    <p><strong>Email:</strong> {doctor.email}</p>
                    <p><strong>Specialization:</strong> {doctor.specialization || 'Not specified'}</p>
                    <p><strong>Experience:</strong> {doctor.experience_years || 0} years</p>
                    <p><strong>License:</strong> {doctor.medical_license || 'N/A'}</p>
                  </div>

                  <div className={styles.userActions}>
                    <div className={styles.actionButton}>
                      View Patients →
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : doctors.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>👥</div>
              <h3>No Doctors Found</h3>
              <p>No verified doctors found in your hospital.</p>
              <div className={styles.emptyStateActions}>
                <button 
                  onClick={loadDoctors}
                  className={styles.refreshDataButton}
                >
                  🔄 Refresh Data
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>🔍</div>
              <h3>No Matching Doctors</h3>
              <p>No doctors match your current search criteria.</p>
              <div className={styles.emptyStateActions}>
                <button 
                  onClick={() => {
                    setSearchTerm('');
                    setSpecializationFilter('');
                  }}
                  className={styles.refreshDataButton}
                >
                  Clear Filters
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default withAuth(DoctorsList, ['radiologist']);