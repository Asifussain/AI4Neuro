// frontend/components/admin/UserManagement.jsx
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/components/AuthProvider';
import axios from 'axios';
import styles from '@/styles/DashboardLayout.module.css'; // Re-using the same style module

export default function UserManagement() {
    const { profile, session } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filter, setFilter] = useState('all'); // 'all', 'pending', 'active'

    const fetchUsers = useCallback(async () => {
        if (!profile?.hospital_id) return;
        
        setLoading(true);
        setError(null);
        try {
            let query = supabase
                .from('user_profiles')
                .select('*')
                .eq('hospital_id', profile.hospital_id);

            if (filter !== 'all') {
                query = query.eq('account_status', filter);
            }

            const { data, error } = await query;
            if (error) throw error;
            setUsers(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [profile?.hospital_id, filter]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const handleVerifyUser = async (userId) => {
        if (!confirm(`Are you sure you want to approve this user?`)) return;

        try {
            const apiUrl = `${process.env.NEXT_PUBLIC_API_URL}/api/admin/users/verify`;
            await axios.post(
                apiUrl, 
                { userId: userId, status: 'active' },
                { headers: { Authorization: `Bearer ${session.access_token}` } }
            );
            // Refresh the list to show the updated status
            fetchUsers(); 
        } catch (err) {
            alert('Failed to verify user: ' + (err.response?.data?.error || err.message));
        }
    };

    if (loading) return <p>Loading users...</p>;
    if (error) return <p className={styles.error}>Error: {error}</p>;

    return (
        <div className={styles.managementPanel}>
            <h2>Manage Users</h2>
            <div className={styles.filters}>
                <button onClick={() => setFilter('all')} className={filter === 'all' ? styles.activeFilter : ''}>All</button>
                <button onClick={() => setFilter('pending')} className={filter === 'pending' ? styles.activeFilter : ''}>Pending</button>
                <button onClick={() => setFilter('active')} className={filter === 'active' ? styles.activeFilter : ''}>Active</button>
            </div>
            <table className={styles.table}>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Unique ID</th>
                        <th>Role</th>
                        <th>Email</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {users.length > 0 ? users.map(user => (
                        <tr key={user.id}>
                            <td>{user.full_name}</td>
                            <td>{user.unique_identifier}</td>
                            <td>{user.role}</td>
                            <td>{user.email}</td>
                            <td>
                                <span className={`${styles.statusBadge} ${styles[user.account_status]}`}>
                                    {user.account_status}
                                </span>
                            </td>
                            <td>
                                {user.account_status === 'pending' && (
                                    <button 
                                        onClick={() => handleVerifyUser(user.id)}
                                        className={styles.actionButton}
                                    >
                                        Approve
                                    </button>
                                )}
                            </td>
                        </tr>
                    )) : (
                        <tr>
                            <td colSpan="6">No users found.</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
