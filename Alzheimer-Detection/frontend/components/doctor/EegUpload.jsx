// frontend/components/doctor/EegUpload.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import axios from 'axios';
import styles from '@/styles/DashboardLayout.module.css';

export default function EegUpload() {
    const { session } = useAuth();
    const [patients, setPatients] = useState([]);
    const [selectedPatient, setSelectedPatient] = useState('');
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [message, setMessage] = useState('');
    const [uploadProgress, setUploadProgress] = useState(0);

    useEffect(() => {
        const fetchPatients = async () => {
            try {
                const apiUrl = `${process.env.NEXT_PUBLIC_API_URL}/api/predict/doctor/patients`;
                const headers = { Authorization: `Bearer ${session.access_token}` };
                const { data } = await axios.get(apiUrl, { headers });
                setPatients(data);
            } catch (err) {
                setError('Could not fetch your assigned patients.');
            }
        };
        if (session) {
            fetchPatients();
        }
    }, [session]);

    const handleFileChange = (e) => {
        setFile(e.target.files[0]);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedPatient || !file) {
            setError('Please select a patient and a file.');
            return;
        }
        setLoading(true);
        setError(null);
        setMessage('');
        setUploadProgress(0);

        const formData = new FormData();
        formData.append('patientId', selectedPatient);
        formData.append('file', file);

        try {
            const apiUrl = `${process.env.NEXT_PUBLIC_API_URL}/api/predict/session/create`;
            const headers = { 
                Authorization: `Bearer ${session.access_token}`,
                'Content-Type': 'multipart/form-data',
            };
            
            const response = await axios.post(apiUrl, formData, { 
                headers,
                onUploadProgress: (progressEvent) => {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    setUploadProgress(percentCompleted);
                }
            });

            setMessage(`Session ${response.data.sessionCode} created. Analysis is now running in the background.`);
            // Reset form
            setSelectedPatient('');
            setFile(null);
            e.target.reset();

        } catch (err) {
            const errorMessage = err.response?.data?.error || err.message;
            setError(`Upload failed: ${errorMessage}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.managementPanel}>
            <h2>Start a New EEG Analysis Session</h2>
            <form onSubmit={handleSubmit} className={styles.form}>
                <div className={styles.formGroup}>
                    <label htmlFor="patient-select">Select Patient</label>
                    <select 
                        id="patient-select"
                        value={selectedPatient} 
                        onChange={(e) => setSelectedPatient(e.target.value)}
                        required
                    >
                        <option value="">-- Select an Assigned Patient --</option>
                        {patients.map(p => (
                            <option key={p.id} value={p.id}>
                                {p.full_name} ({p.unique_identifier})
                            </option>
                        ))}
                    </select>
                </div>

                <div className={styles.formGroup}>
                    <label htmlFor="file-upload">Upload EEG File (.npy)</label>
                    <input 
                        type="file" 
                        id="file-upload" 
                        onChange={handleFileChange} 
                        accept=".npy" 
                        required 
                    />
                </div>
                
                {loading && (
                    <div className={styles.progressContainer}>
                        <p>Uploading: {uploadProgress}%</p>
                        <progress value={uploadProgress} max="100" style={{width: '100%'}} />
                    </div>
                )}

                <button type="submit" className={styles.actionButton} disabled={loading}>
                    {loading ? 'Uploading...' : 'Start Analysis'}
                </button>
                {error && <p className={styles.error}>{error}</p>}
                {message && <p className={styles.success}>{message}</p>}
            </form>
        </div>
    );
}
