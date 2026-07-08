import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Navbar from '../components/Navbar';
import { useAuth } from '../components/AuthProvider';
import withAuth from '../components/withAuth';
import LoadingSpinner from '../components/LoadingSpinner';
import supabase from '../lib/supabaseClient';
import styles from '../styles/Profile.module.css';

function Profile() {
  const { user, userProfile } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    address: '',
    date_of_birth: ''
  });
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState('');
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  useEffect(() => {
    if (userProfile) {
      setFormData({
        full_name: userProfile.full_name || '',
        phone: userProfile.phone || '',
        address: userProfile.address || '',
        date_of_birth: userProfile.date_of_birth || ''
      });
    }
  }, [userProfile]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.full_name.trim()) newErrors.full_name = 'Full name is required';
    if (!formData.phone.trim()) newErrors.phone = 'Phone number is required';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validatePasswordForm = () => {
    const newErrors = {};
    if (!passwordData.current_password) newErrors.current_password = 'Current password is required';
    if (!passwordData.new_password) newErrors.new_password = 'New password is required';
    if (passwordData.new_password.length < 6) newErrors.new_password = 'Password must be at least 6 characters';
    if (passwordData.new_password !== passwordData.confirm_password) {
      newErrors.confirm_password = 'Passwords do not match';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    setSuccess('');

    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          full_name: formData.full_name,
          phone: formData.phone,
          address: formData.address || null,
          date_of_birth: formData.date_of_birth || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) throw error;

      setSuccess('Profile updated successfully!');
      setIsEditing(false);
      
      // Refresh the page to get updated profile data
      setTimeout(() => {
        window.location.reload();
      }, 1000);

    } catch (error) {
      console.error('Profile update error:', error);
      setErrors({ submit: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!validatePasswordForm()) return;

    setIsLoading(true);
    setSuccess('');

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.new_password
      });

      if (error) throw error;

      setSuccess('Password updated successfully!');
      setShowPasswordForm(false);
      setPasswordData({
        current_password: '',
        new_password: '',
        confirm_password: ''
      });

    } catch (error) {
      console.error('Password update error:', error);
      setErrors({ password_submit: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const goToDashboard = () => {
    router.push(`/${userProfile?.role}/dashboard`);
  };

  if (!userProfile) {
    return (
      <>
        <Navbar />
        <div className={styles.loadingContainer}>
          <LoadingSpinner />
          <p>Loading profile...</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className={styles.profileContainer}>
        <div className={styles.profileHeader}>
          <div className={styles.headerContent}>
            <h1>My Profile</h1>
            <p>Manage your personal information and account settings</p>
          </div>
          <button
            className={styles.backButton}
            onClick={goToDashboard}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: '8px' }}>
              <path d="M20,11V13H8L13.5,18.5L12.08,19.92L4.16,12L12.08,4.08L13.5,5.5L8,11H20Z"/>
            </svg>
            Back to Dashboard
          </button>
        </div>

        <div className={styles.profileCard}>
          <div className={styles.profileInfo}>
            <div className={styles.avatarSection}>
              <div className={styles.avatar}>
                {user?.user_metadata?.avatar_url ? (
                  <img 
                    src={user.user_metadata.avatar_url} 
                    alt="Profile" 
                  />
                ) : (
                  <div className={styles.avatarPlaceholder}>
                    {userProfile.full_name?.charAt(0) || user?.email?.charAt(0) || 'U'}
                  </div>
                )}
              </div>
              <div className={styles.userInfo}>
                <h2>{userProfile.full_name || 'No name set'}</h2>
                <p className={styles.userEmail}>{user?.email}</p>
                <p className={styles.userRole}>
                  <span className={`${styles.roleBadge} ${styles[userProfile.role]}`}>
                    {userProfile.role}
                  </span>
                </p>
              </div>
            </div>

            {!isEditing && !showPasswordForm && (
              <div className={styles.actionButtons}>
                <button 
                  className={styles.editButton}
                  onClick={() => setIsEditing(true)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: '8px' }}>
                    <path d="M3,17.25V21H6.75L17.81,9.94L14.06,6.19L3,17.25M20.71,7.04C21.1,6.65 21.1,6.02 20.71,5.63L18.37,3.29C17.98,2.9 17.35,2.9 16.96,3.29L15.13,5.12L18.88,8.87L20.71,7.04Z"/>
                  </svg>
                  Edit Profile
                </button>
                <button 
                  className={styles.passwordButton}
                  onClick={() => setShowPasswordForm(true)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: '8px' }}>
                    <path d="M12,17A2,2 0 0,0 14,15C14,13.89 13.1,13 12,13A2,2 0 0,0 10,15A2,2 0 0,0 12,17M18,8A2,2 0 0,1 20,10V20A2,2 0 0,1 18,22H6A2,2 0 0,1 4,20V10C4,8.89 4.9,8 6,8H7V6A5,5 0 0,1 12,1A5,5 0 0,1 17,6V8H18M12,3A3,3 0 0,0 9,6V8H15V6A3,3 0 0,0 12,3Z"/>
                  </svg>
                  Change Password
                </button>
              </div>
            )}
          </div>

          {success && (
            <div className={styles.successMessage}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: '8px' }}>
                <path d="M12,2C6.48,2 2,6.48 2,12C2,17.52 6.48,22 12,22C17.52,22 22,17.52 22,12C22,6.48 17.52,2 12,2M12,20C7.59,20 4,16.41 4,12C4,7.59 7.59,4 12,4C16.41,4 20,7.59 20,12C20,16.41 16.41,20 12,20M16.59,7.58L10,14.17L7.41,11.59L6,13L10,17L18,9L16.59,7.58Z"/>
              </svg>
              {success}
            </div>
          )}

          {isEditing ? (
            <form onSubmit={handleSubmit} className={styles.profileForm}>
              <div className={styles.formGroup}>
                <label htmlFor="full_name">Full Name *</label>
                <input
                  type="text"
                  id="full_name"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleInputChange}
                  className={errors.full_name ? styles.inputError : ''}
                  disabled={isLoading}
                />
                {errors.full_name && <span className={styles.errorText}>{errors.full_name}</span>}
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="phone">Phone Number *</label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className={errors.phone ? styles.inputError : ''}
                  disabled={isLoading}
                />
                {errors.phone && <span className={styles.errorText}>{errors.phone}</span>}
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="date_of_birth">Date of Birth</label>
                <input
                  type="date"
                  id="date_of_birth"
                  name="date_of_birth"
                  value={formData.date_of_birth}
                  onChange={handleInputChange}
                  disabled={isLoading}
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="address">Address</label>
                <textarea
                  id="address"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  rows="3"
                  disabled={isLoading}
                />
              </div>

              {errors.submit && (
                <div className={styles.errorMessage}>{errors.submit}</div>
              )}

              <div className={styles.formActions}>
                <button
                  type="button"
                  className={styles.cancelButton}
                  onClick={() => {
                    setIsEditing(false);
                    setErrors({});
                    setSuccess('');
                  }}
                  disabled={isLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.saveButton}
                  disabled={isLoading}
                >
                  {isLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          ) : showPasswordForm ? (
            <form onSubmit={handlePasswordSubmit} className={styles.profileForm}>
              <div className={styles.passwordFormHeader}>
                <h3>Change Password</h3>
                <p>Update your account password</p>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="current_password">Current Password *</label>
                <input
                  type="password"
                  id="current_password"
                  name="current_password"
                  value={passwordData.current_password}
                  onChange={handlePasswordChange}
                  className={errors.current_password ? styles.inputError : ''}
                  disabled={isLoading}
                />
                {errors.current_password && <span className={styles.errorText}>{errors.current_password}</span>}
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="new_password">New Password *</label>
                <input
                  type="password"
                  id="new_password"
                  name="new_password"
                  value={passwordData.new_password}
                  onChange={handlePasswordChange}
                  className={errors.new_password ? styles.inputError : ''}
                  disabled={isLoading}
                  placeholder="Minimum 6 characters"
                />
                {errors.new_password && <span className={styles.errorText}>{errors.new_password}</span>}
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="confirm_password">Confirm New Password *</label>
                <input
                  type="password"
                  id="confirm_password"
                  name="confirm_password"
                  value={passwordData.confirm_password}
                  onChange={handlePasswordChange}
                  className={errors.confirm_password ? styles.inputError : ''}
                  disabled={isLoading}
                />
                {errors.confirm_password && <span className={styles.errorText}>{errors.confirm_password}</span>}
              </div>

              {errors.password_submit && (
                <div className={styles.errorMessage}>{errors.password_submit}</div>
              )}

              <div className={styles.formActions}>
                <button
                  type="button"
                  className={styles.cancelButton}
                  onClick={() => {
                    setShowPasswordForm(false);
                    setErrors({});
                    setSuccess('');
                    setPasswordData({
                      current_password: '',
                      new_password: '',
                      confirm_password: ''
                    });
                  }}
                  disabled={isLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.saveButton}
                  disabled={isLoading}
                >
                  {isLoading ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          ) : (
            <div className={styles.profileDetails}>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Full Name:</span>
                <span className={styles.detailValue}>{userProfile.full_name || 'Not specified'}</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Email:</span>
                <span className={styles.detailValue}>{user?.email}</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Phone:</span>
                <span className={styles.detailValue}>{userProfile.phone || 'Not specified'}</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Date of Birth:</span>
                <span className={styles.detailValue}>{userProfile.date_of_birth || 'Not specified'}</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Address:</span>
                <span className={styles.detailValue}>{userProfile.address || 'Not specified'}</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Account ID:</span>
                <span className={styles.detailValue}>{userProfile.unique_identifier}</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Account Status:</span>
                <span className={`${styles.statusBadge} ${styles[userProfile.account_status]}`}>
                  {userProfile.account_status}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default withAuth(Profile, ['patient', 'doctor', 'admin', 'radiologist']);