import React, { useState } from 'react';
import emailAuthClient from '@/lib/emailAuthClient';
import styles from '@/styles/EmailAuth.module.css';

const PasswordResetForm = ({ onSuccess, onError, onBack }) => {
  const [step, setStep] = useState('request'); // 'request' or 'reset'
  const [formData, setFormData] = useState({
    email: '',
    token: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleRequestReset = async (e) => {
    e.preventDefault();
    
    if (!formData.email) {
      onError('Email is required');
      return;
    }

    if (!formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      onError('Please enter a valid email address');
      return;
    }

    setLoading(true);

    try {
      const result = await emailAuthClient.forgotPassword(formData.email);
      onSuccess('Password reset instructions sent to your email');
      
      // In development, show the reset token (remove in production)
      if (result.reset_token) {
        setFormData(prev => ({ ...prev, token: result.reset_token }));
        setStep('reset');
      }
    } catch (error) {
      onError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    
    if (!formData.token || !formData.newPassword || !formData.confirmPassword) {
      onError('All fields are required');
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      onError('Passwords do not match');
      return;
    }

    if (formData.newPassword.length < 8) {
      onError('Password must be at least 8 characters long');
      return;
    }

    if (!formData.newPassword.match(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)) {
      onError('Password must contain at least one uppercase letter, lowercase letter, and number');
      return;
    }

    setLoading(true);

    try {
      await emailAuthClient.resetPassword(formData.token, formData.newPassword);
      onSuccess('Password reset successfully. You can now log in with your new password.');
      if (onBack) onBack();
    } catch (error) {
      onError(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (step === 'request') {
    return (
      <div className={styles.authContainer}>
        <form onSubmit={handleRequestReset} className={styles.authForm}>
          <h2 className={styles.title}>Reset Password</h2>
          
          <p style={{ 
            color: 'var(--text-secondary)', 
            textAlign: 'center', 
            marginBottom: '2rem',
            fontSize: '0.9rem'
          }}>
            Enter your email address and we'll send you instructions to reset your password.
          </p>
          
          <div className={styles.inputGroup}>
            <label htmlFor="email" className={styles.label}>Email Address</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              className={styles.input}
              required
              autoComplete="email"
              placeholder="Enter your email address"
            />
          </div>

          <button
            type="submit"
            className={styles.submitButton}
            disabled={loading}
          >
            {loading ? 'Sending...' : 'Send Reset Instructions'}
          </button>

          <button
            type="button"
            onClick={onBack}
            className={styles.toggleButton}
            style={{ marginTop: '1rem' }}
          >
            Back to Login
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className={styles.authContainer}>
      <form onSubmit={handlePasswordReset} className={styles.authForm}>
        <h2 className={styles.title}>Set New Password</h2>
        
        <div className={styles.inputGroup}>
          <label htmlFor="token" className={styles.label}>Reset Token</label>
          <input
            type="text"
            id="token"
            name="token"
            value={formData.token}
            onChange={handleInputChange}
            className={styles.input}
            required
            placeholder="Enter the reset token from your email"
          />
        </div>

        <div className={styles.inputGroup}>
          <label htmlFor="newPassword" className={styles.label}>New Password</label>
          <input
            type="password"
            id="newPassword"
            name="newPassword"
            value={formData.newPassword}
            onChange={handleInputChange}
            className={styles.input}
            required
            autoComplete="new-password"
            placeholder="Enter your new password"
          />
        </div>

        <div className={styles.inputGroup}>
          <label htmlFor="confirmPassword" className={styles.label}>Confirm New Password</label>
          <input
            type="password"
            id="confirmPassword"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleInputChange}
            className={styles.input}
            required
            autoComplete="new-password"
            placeholder="Confirm your new password"
          />
        </div>

        <button
          type="submit"
          className={styles.submitButton}
          disabled={loading}
        >
          {loading ? 'Resetting...' : 'Reset Password'}
        </button>

        <button
          type="button"
          onClick={() => setStep('request')}
          className={styles.toggleButton}
          style={{ marginTop: '1rem' }}
        >
          Back to Email Entry
        </button>
      </form>
    </div>
  );
};

export default PasswordResetForm;