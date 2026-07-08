// frontend/components/doctor/SessionHistory.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/lib/supabaseClient';
import styles from '@/styles/DashboardLayout.module.css';

export default function SessionHistory() {
    const { profile } = useAuth();
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSessions = async () => {
            if (!profile?.id) return;
            try {
                const { data, error } = await supabase
                    .from('eeg_sessions')
                    .select('*, patient:patient_id(full_name)')
                    .eq('doctor_id', profile.id)
                    .order('created_at', { ascending: false });
                
                if (error) throw error;
                setSessions(data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchSessions();
    }, [profile]);

    if (loading) return <p>Loading session history...</p>;

    return (
        <div className={styles.managementPanel}>
            <h2>EEG Session History</h2>
            <table className={styles.table}>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Session Code</th>
                        <th>Patient</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {sessions.length > 0 ? sessions.map(s => (
                        <tr key={s.id}>
                            <td>{new Date(s.created_at).toLocaleString()}</td>
                            <td>{s.session_code}</td>
                            <td>{s.patient?.full_name || 'N/A'}</td>
                            <td>
                                <span className={`${styles.statusBadge} ${styles[s.status]}`}>
                                    {s.status}
                                </span>
                            </td>
                            <td>
                                {s.status === 'completed' && <button className={styles.actionButton}>View Report</button>}
                            </td>
                        </tr>
                    )) : (
                        <tr><td colSpan="5">No sessions found.</td></tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
