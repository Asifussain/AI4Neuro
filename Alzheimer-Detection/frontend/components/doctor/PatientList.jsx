// frontend/components/doctor/PatientList.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import axios from 'axios';
import styles from '@/styles/DashboardLayout.module.css';

export default function PatientList() {
    const { session } = useAuth();
    const [patients, setPatients] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPatients = async () => {
            try {
                const apiUrl = `${process.env.NEXT_PUBLIC_API_URL}/api/predict/doctor/patients`;
                const headers = { Authorization: `Bearer ${session.access_token}` };
                const { data } = await axios.get(apiUrl, { headers });
                setPatients(data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        if (session) {
            fetchPatients();
        }
    }, [session]);

    if (loading) return <p>Loading patients...</p>;

    return (
        <div className={styles.managementPanel}>
            <h2>My Assigned Patients</h2>
            <table className={styles.table}>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Unique ID</th>
                        <th>Email</th>
                    </tr>
                </thead>
                <tbody>
                    {patients.length > 0 ? patients.map(p => (
                        <tr key={p.id}>
                            <td>{p.full_name}</td>
                            <td>{p.unique_identifier}</td>
                            <td>{p.email}</td>
                        </tr>
                    )) : (
                        <tr><td colSpan="3">You have no patients assigned.</td></tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
