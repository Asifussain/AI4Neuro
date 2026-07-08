// frontend/components/admin/RelationshipManagement.jsx
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/components/AuthProvider';
import axios from 'axios';
import styles from '@/styles/DashboardLayout.module.css';

export default function RelationshipManagement() {
    const { profile, session } = useAuth();
    const [doctors, setDoctors] = useState([]);
    const [unassignedPatients, setUnassignedPatients] = useState([]);
    const [selectedPatient, setSelectedPatient] = useState('');
    const [selectedDoctor, setSelectedDoctor] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [message, setMessage] = useState('');

    const fetchData = useCallback(async () => {
        if (!profile?.hospital_id) return;

        setLoading(true);
        setError(null);
        try {
            // Fetch all active doctors in the hospital
            const { data: doctorsData, error: doctorsError } = await supabase
                .from('user_profiles')
                .select('id, full_name')
                .eq('hospital_id', profile.hospital_id)
                .eq('role', 'doctor')
                .eq('account_status', 'active');
            if (doctorsError) throw doctorsError;
            setDoctors(doctorsData);

            // Fetch all active patients in the hospital who are not yet in a relationship
            const { data: patientsData, error: patientsError } = await supabase
                .rpc('get_unassigned_patients', { hosp_id: profile.hospital_id });
            
            if (patientsError) throw patientsError;
            setUnassignedPatients(patientsData);

        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [profile?.hospital_id]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleAssign = async (e) => {
        e.preventDefault();
        if (!selectedPatient || !selectedDoctor) {
            setError('Please select both a patient and a doctor.');
            return;
        }
        setError(null);
        setMessage('');

        try {
            const apiUrl = `${process.env.NEXT_PUBLIC_API_URL}/api/admin/relationships/assign`;
            const payload = {
                patientId: selectedPatient,
                doctorId: selectedDoctor,
                hospitalId: profile.hospital_id,
            };
            const headers = { Authorization: `Bearer ${session.access_token}` };

            await axios.post(apiUrl, payload, { headers });

            setMessage(`Successfully assigned patient to doctor.`);
            // Reset form and refresh lists
            setSelectedPatient('');
            setSelectedDoctor('');
            fetchData();

        } catch (err) {
            const errorMessage = err.response?.data?.error || err.message;
            setError(`Assignment failed: ${errorMessage}`);
        }
    };

    if (loading) return <p>Loading doctors and patients...</p>;
    if (error) return <p className={styles.error}>Error: {error}</p>;

    return (
        <div className={styles.managementPanel}>
            <h2>Assign Patient to Doctor</h2>
            <p>Select a patient and a doctor to create an official assignment.</p>
            <form onSubmit={handleAssign} className={styles.form}>
                <div className={styles.formGroup}>
                    <label htmlFor="patient-select">Patient</label>
                    <select 
                        id="patient-select"
                        value={selectedPatient} 
                        onChange={(e) => setSelectedPatient(e.target.value)}
                        required
                    >
                        <option value="">-- Select an Unassigned Patient --</option>
                        {unassignedPatients.map(p => (
                            <option key={p.id} value={p.id}>
                                {p.full_name} ({p.unique_identifier})
                            </option>
                        ))}
                    </select>
                </div>

                <div className={styles.formGroup}>
                    <label htmlFor="doctor-select">Doctor</label>
                    <select 
                        id="doctor-select"
                        value={selectedDoctor} 
                        onChange={(e) => setSelectedDoctor(e.target.value)}
                        required
                    >
                        <option value="">-- Select a Doctor --</option>
                        {doctors.map(d => (
                            <option key={d.id} value={d.id}>
                                {d.full_name}
                            </option>
                        ))}
                    </select>
                </div>

                <button type="submit" className={styles.actionButton} disabled={!selectedPatient || !selectedDoctor}>
                    Assign
                </button>
                {message && <p className={styles.success}>{message}</p>}
            </form>
        </div>
    );
}
