import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Navbar from '../../../../components/Navbar';
import { useAuth } from '../../../../components/AuthProvider';
import withAuth from '../../../../components/withAuth';
import LoadingSpinner from '../../../../components/LoadingSpinner';
import supabase from '../../../../lib/supabaseClient';
import styles from '../../../../styles/DashboardLayout.module.css';

function DoctorPatients() {
  const { user, userProfile, hospitalData } = useAuth();
  const router = useRouter();
  const { doctor_id } = router.query;
  
  // State management
  const [isLoading, setIsLoading] = useState(true);
  const [doctor, setDoctor] = useState(null);
  const [patients, setPatients] = useState([]);
  const [filteredPatients, setFilteredPatients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (doctor_id && userProfile?.role === 'radiologist') {
      loadDoctorAndPatients();
    }
  }, [doctor_id, userProfile]);

  useEffect(() => {
    // Filter patients based on search
    if (searchTerm) {
      const filtered = patients.filter(patient => 
        patient.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        patient.unique_identifier?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        patient.patient_profiles?.patient_id?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredPatients(filtered);
    } else {
      setFilteredPatients(patients);
    }
  }, [patients, searchTerm]);

  const loadDoctorAndPatients = async () => {
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

      // Call API to get doctor and patients
      const response = await fetch('/api/radiologist/get-doctor-patients', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          doctor_id: doctor_id
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || 'Failed to load data');
      }

      const result = await response.json();
      console.log('Doctor patients API result:', result);

      if (result.success && result.data) {
        const { doctor: doctorData, patients: patientsData } = result.data;

        // Format doctor data
        const formattedDoctor = {
          id: doctorData.id,
          full_name: doctorData.full_name,
          email: doctorData.email,
          doctor_profiles: {
            medical_license: doctorData.doctor_profiles?.[0]?.medical_license || 'N/A',
            specialization: doctorData.doctor_profiles?.[0]?.specialization || 'General Practice',
            experience_years: doctorData.doctor_profiles?.[0]?.experience_years || 0,
            verification_status: doctorData.doctor_profiles?.[0]?.verification_status || 'verified'
          }
        };

        setDoctor(formattedDoctor);
        setPatients(patientsData || []);
      } else {
        throw new Error('Invalid response from server');
      }

    } catch (error) {
      console.error('Error loading doctor and patients:', error);
      setError(error.message || 'Failed to load data. Please try again.');
      setDoctor(null);
      setPatients([]);
    } finally {
      setIsLoading(false);
    }
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

  const handleBackToDoctors = () => {
    router.push('/radiologist/doctors');
  };

  if (isLoading) {
    return (
      <>
        <Navbar />
        <div className={styles.dashboardContainer}>
          <div className={styles.loadingContainer}>
            <LoadingSpinner />
            <p>Loading doctor and patients...</p>
          </div>
        </div>
      </>
    );
  }

  if (!doctor) {
    return (
      <>
        <Navbar />
        <div className={styles.dashboardContainer}>
          <div className={styles.errorState}>
            <h2>Doctor Not Found</h2>
            <p>The requested doctor could not be found or you don't have access.</p>
            <button className={styles.primaryButton} onClick={handleBackToDoctors}>
              Back to Doctors List
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
          <button className={styles.backButton} onClick={handleBackToDoctors}>
            ← Back to Doctors
          </button>
          <h1>Patients for Dr. {doctor.full_name}</h1>
          <p>Select a patient to manage their EEG sessions</p>
          <div className={styles.doctorInfo}>
            <span>{doctor.doctor_profiles.specialization} • {hospitalData?.name}</span>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className={styles.errorAlert}>
            <span>⚠️ {error}</span>
            <button onClick={() => setError('')}>×</button>
          </div>
        )}

        {/* Doctor Information Card */}
        <div className={styles.contentSection}>
          <h2>Doctor Information</h2>
          <div className={styles.infoCard}>
            <div className={styles.doctorDetailsGrid}>
              <div>
                <p><strong>Name:</strong> {doctor.full_name}</p>
                <p><strong>Email:</strong> {doctor.email}</p>
              </div>
              <div>
                <p><strong>Specialization:</strong> {doctor.doctor_profiles.specialization}</p>
                <p><strong>Experience:</strong> {doctor.doctor_profiles.experience_years} years</p>
              </div>
              <div>
                <p><strong>License:</strong> {doctor.doctor_profiles.medical_license}</p>
                <p><strong>Status:</strong> <span className={styles.statusBadge}>✅ Verified</span></p>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Patient List */}
        <div className={styles.contentSection}>
          <div className={styles.managementHeader}>
            <h2>Active Patients ({filteredPatients.length})</h2>
            <div className={styles.controls}>
              <input
                type="text"
                placeholder="Search patients by name or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={styles.searchInput}
              />
              <button 
                onClick={loadDoctorAndPatients}
                className={styles.refreshButton}
                disabled={isLoading}
              >
                {isLoading ? <LoadingSpinner size={16} /> : '🔄'} Refresh
              </button>
            </div>
          </div>

          {/* Patients Grid */}
          {filteredPatients.length > 0 ? (
            <div className={styles.userGrid}>
              {filteredPatients.map(patient => (
                <Link 
                  key={patient.id} 
                  href={`/radiologist/patients/${patient.id}/sessions`}
                  className={styles.userCard}
                >
                  <div className={styles.userHeader}>
                    <div className={styles.userBasic}>
                      <h3>{patient.full_name}</h3>
                      <div className={styles.roleTag}>
                        🏥 Patient
                      </div>
                    </div>
                    <div className={styles.statusBadge}>
                      ✅ Active
                    </div>
                  </div>

                  <div className={styles.userDetails}>
                    <p><strong>Patient ID:</strong> {patient.unique_identifier || patient.patient_profiles?.patient_id || 'N/A'}</p>
                    <p><strong>Age:</strong> {calculateAge(patient.date_of_birth)} years</p>
                    <p><strong>Blood Type:</strong> {patient.patient_profiles?.blood_groups?.blood_type || 'N/A'}</p>
                    <p><strong>Registered:</strong> {new Date(patient.created_at).toLocaleDateString()}</p>
                  </div>

                  <div className={styles.userActions}>
                    <div className={styles.actionButton}>
                      Manage EEG Sessions →
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : patients.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>👥</div>
              <h3>No Active Patients</h3>
              <p>This doctor has no active patients in the system.</p>
              <div className={styles.emptyStateActions}>
                <button 
                  onClick={loadDoctorAndPatients}
                  className={styles.refreshDataButton}
                >
                  🔄 Refresh Data
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>🔍</div>
              <h3>No Matching Patients</h3>
              <p>No patients match your current search criteria.</p>
              <div className={styles.emptyStateActions}>
                <button 
                  onClick={() => setSearchTerm('')}
                  className={styles.refreshDataButton}
                >
                  Clear Search
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default withAuth(DoctorPatients, ['radiologist']);