import { useEffect, useState } from 'react';
import { useAuth } from '../components/AuthProvider';
import { useRouter } from 'next/router';
import Navbar from '../components/Navbar';
import LoadingSpinner from '../components/LoadingSpinner';
import supabase from '../lib/supabaseClient';
import styles from '../styles/AccountPending.module.css';

export default function AccountPendingPage() {
  const { user, userProfile, signOut, refreshProfile, isLoading } = useAuth();
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [debugInfo, setDebugInfo] = useState('');
  const [hospitalData, setHospitalData] = useState(null);

  useEffect(() => {
    if (userProfile && userProfile.account_status === 'active') {
      router.replace(`/${userProfile.role}/dashboard`);
    }
  }, [userProfile, router]);

  useEffect(() => {
    if (userProfile && userProfile.account_status === 'pending') {
      const interval = setInterval(async () => {
        await refreshProfile();
      }, 5000);

      return () => {
        clearInterval(interval);
      };
    }
  }, [userProfile, refreshProfile]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    
    await refreshProfile();
    
    setTimeout(async () => {
      setIsRefreshing(false);
    }, 2000);
  };

  const getStatusMessage = () => {
    if (!userProfile) return 'Loading account status...';
    
    switch (userProfile.account_status) {
      case 'pending':
        return 'Your account is pending admin approval';
      case 'suspended':
        return 'Your account has been suspended';
      case 'inactive':
        return 'Your account is inactive';
      default:
        return 'Account status unknown';
    }
  };

  const getStatusDescription = () => {
    if (!userProfile) return '';
    
    switch (userProfile.account_status) {
      case 'pending':
        return `We're reviewing your ${userProfile.role} application. Hospital administrators will verify your credentials and activate your account. This usually takes 1-2 business days.`;
      case 'suspended':
        return 'Your account access has been temporarily suspended. Please contact your hospital administrator for more information.';
      case 'inactive':
        return 'Your account is currently inactive. Please contact your hospital administrator to reactivate your access.';
      default:
        return '';
    }
  };

  const getNextSteps = () => {
    if (!userProfile) return [];
    
    switch (userProfile.account_status) {
      case 'pending':
        return [
          'Hospital admin will verify your credentials',
          'You will receive an email notification once approved',
          'After approval, you can verify your phone number',
          'Then access your personalized dashboard'
        ];
      case 'suspended':
      case 'inactive':
        return [
          'Contact your hospital administrator',
          'Provide any requested documentation',
          'Wait for account reactivation'
        ];
      default:
        return [];
    }
  };

  // Fetch hospital data if not included in userProfile
  useEffect(() => {
    const fetchHospitalData = async () => {
      if (userProfile?.hospital_id && !userProfile.hospitals) {
        try {
          const { data, error } = await supabase
            .from('hospitals')
            .select('id, name, hospital_code, address, phone, email')
            .eq('id', userProfile.hospital_id)
            .single();
          
          if (!error && data) {
            setHospitalData(data);
          }
        } catch (err) {
          // Error handled silently
        }
      } else if (userProfile?.hospitals) {
        setHospitalData(userProfile.hospitals);
      }
    };

    fetchHospitalData();
  }, [userProfile]);

  useEffect(() => {
    setDebugInfo(`User: ${!!user}, UserProfile: ${!!userProfile}, IsLoading: ${isLoading}, Profile Role: ${userProfile?.role}, Account Status: ${userProfile?.account_status}`);
  }, [user, userProfile, isLoading]);

  if (isLoading || !userProfile) {
    return (
      <div className={styles.loadingContainer}>
        <LoadingSpinner />
        <p>Loading account information...</p>
      </div>
    );
  }

  return (
    <>
      <Navbar />
      <div className={styles.pendingPage}>
        <div className={styles.pendingContainer}>
          <div className={styles.statusIcon}>
            {userProfile.account_status === 'pending' && '⏳'}
            {userProfile.account_status === 'suspended' && '⚠️'}
            {userProfile.account_status === 'inactive' && '❌'}
          </div>
          
          <h1 className={styles.statusTitle}>
            {getStatusMessage()}
          </h1>
          
          <p className={styles.statusDescription}>
            {getStatusDescription()}
          </p>

          <div className={styles.accountDetails}>
            <div className={styles.detailCard}>
              <h3>Account Information</h3>
              <div className={styles.detailRow}>
                <span>Name:</span>
                <span>{userProfile.full_name}</span>
              </div>
              <div className={styles.detailRow}>
                <span>Email:</span>
                <span>{userProfile.email}</span>
              </div>
              <div className={styles.detailRow}>
                <span>Role:</span>
                <span className={styles.roleTag}>{userProfile.role}</span>
              </div>
              <div className={styles.detailRow}>
                <span>Hospital:</span>
                <span>{hospitalData?.name || userProfile.hospitals?.name || 'Loading...'}</span>
              </div>
              <div className={styles.detailRow}>
                <span>ID:</span>
                <span className={styles.idTag}>{userProfile.unique_identifier}</span>
              </div>
              <div className={styles.detailRow}>
                <span>Status:</span>
                <span className={`${styles.statusTag} ${styles[userProfile.account_status]}`}>
                  {userProfile.account_status}
                </span>
              </div>
            </div>
          </div>

          {/* Role-specific Information */}
          <div className={styles.roleSpecificInfo}>
            <h3>Role-specific Information</h3>
            
            {userProfile.role === 'admin' && (
              <div className={styles.adminInfo}>
                <div className={styles.detailRow}>
                  <span>Employee ID:</span>
                  <span>{userProfile.admin_profiles?.[0]?.employee_id || 'Not specified'}</span>
                </div>
                <div className={styles.detailRow}>
                  <span>Department:</span>
                  <span>{userProfile.admin_profiles?.[0]?.department || 'Not specified'}</span>
                </div>
                <div className={styles.detailRow}>
                  <span>Permissions:</span>
                  <span>Hospital Administration</span>
                </div>
              </div>
            )}

            {userProfile.role === 'doctor' && (
              <div className={styles.doctorInfo}>
                <div className={styles.detailRow}>
                  <span>Medical License:</span>
                  <span>{userProfile.doctor_profiles?.[0]?.medical_license || 'Not specified'}</span>
                </div>
                <div className={styles.detailRow}>
                  <span>Specialization:</span>
                  <span>{userProfile.doctor_profiles?.[0]?.specialization || 'Not specified'}</span>
                </div>
                <div className={styles.detailRow}>
                  <span>Experience:</span>
                  <span>{userProfile.doctor_profiles?.[0]?.experience_years || 0} years</span>
                </div>
              </div>
            )}

            {userProfile.role === 'patient' && userProfile.patient_profiles?.[0] && (
              <div className={styles.patientInfo}>
                <div className={styles.detailRow}>
                  <span>Blood Group:</span>
                  <span>{userProfile.patient_profiles[0].blood_groups?.blood_type || 'Not specified'}</span>
                </div>
                <div className={styles.detailRow}>
                  <span>Emergency Contact:</span>
                  <span>{userProfile.patient_profiles[0].emergency_contact_name || 'Not specified'}</span>
                </div>
                <div className={styles.detailRow}>
                  <span>Emergency Phone:</span>
                  <span>{userProfile.patient_profiles[0].emergency_contact_phone || 'Not specified'}</span>
                </div>
              </div>
            )}
          </div>

          {getNextSteps().length > 0 && (
            <div className={styles.nextSteps}>
              <h3>What happens next?</h3>
              <div className={styles.stepsList}>
                {getNextSteps().map((step, index) => (
                  <div key={index} className={styles.step}>
                    <div className={styles.stepNumber}>{index + 1}</div>
                    <div className={styles.stepText}>{step}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className={styles.actions}>
            <button
              onClick={() => router.push('/complete-profile?edit=true')}
              className={styles.editButton}
            >
              ✏️ Edit Profile
            </button>
            
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className={styles.refreshButton}
            >
              {isRefreshing ? (
                <>
                  <LoadingSpinner size={16} />
                  Checking Status...
                </>
              ) : (
                <>
                  🔄 Check Status
                </>
              )}
            </button>
            
            <button
              onClick={signOut}
              className={styles.signOutButton}
            >
              Sign Out
            </button>
          </div>

          <div className={styles.helpSection}>
            <h4>Need Help?</h4>
            <p>
              If you have questions about your account status or the verification process, 
              please contact your hospital administrator or our support team.
            </p>
            <div className={styles.contactInfo}>
              <a href="mailto:support@ai4neuro.com" className={styles.contactLink}>
                📧 support@ai4neuro.com
              </a>
              <a href="tel:+1-555-AI4NEURO" className={styles.contactLink}>
                📞 +1-555-AI4NEURO
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}