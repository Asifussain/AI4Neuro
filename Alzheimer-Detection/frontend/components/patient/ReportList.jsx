// frontend/pages/patient/dashboard.jsx
import { useAuth } from '@/components/AuthProvider';
import PageLayout from '@/components/PageLayout';
import ReportList from '@/components/patient/ReportList'; // We will create this next
import styles from '@/styles/DashboardLayout.module.css';
import { useState, useEffect } from 'react';
import  supabase  from '@/lib/supabaseClient';

export default function PatientDashboard() {
    const { profile, logout } = useAuth();
    const [doctorName, setDoctorName] = useState('Not Assigned');

    useEffect(() => {
        const fetchAssignedDoctor = async () => {
            if (!profile?.patient_profiles?.[0]?.assigned_doctor_id) return;

            try {
                const { data, error } = await supabase
                    .from('user_profiles')
                    .select('full_name')
                    .eq('id', profile.patient_profiles[0].assigned_doctor_id)
                    .single();
                
                if (error) throw error;
                if (data) {
                    setDoctorName(`Dr. ${data.full_name}`);
                }
            } catch (err) {
                console.error("Error fetching doctor's name:", err);
                setDoctorName('Could not fetch doctor info');
            }
        };

        fetchAssignedDoctor();
    }, [profile]);

    if (!profile || profile.role !== 'patient') {
        return null; // Safeguard
    }

    return (
        <PageLayout>
            <div className={styles.dashboardContainer}>
                <header className={styles.header}>
                    <h1>Patient Dashboard</h1>
                    <div className={styles.userInfo}>
                        <span>{profile.full_name} ({profile.unique_identifier})</span>
                        <button onClick={logout} className={styles.logoutButton}>Log Out</button>
                    </div>
                </header>

                <div className={styles.profileSummary}>
                    <h2>Your Health Overview</h2>
                    <p><strong>Assigned Physician:</strong> {doctorName}</p>
                    <p><strong>Account Status:</strong> <span className={`${styles.statusBadge} ${styles[profile.account_status]}`}>{profile.account_status}</span></p>
                    {profile.account_status === 'pending' && <p><em>Your account is pending verification by a hospital administrator.</em></p>}
                </div>

                <main className={styles.content}>
                    <ReportList />
                </main>
            </div>
        </PageLayout>
    );
}
