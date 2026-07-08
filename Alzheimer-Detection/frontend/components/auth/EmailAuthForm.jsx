import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../AuthProvider';
import styles from '@/styles/EmailAuth.module.css';

const EmailAuthForm = ({ onSuccess, onError }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    phone: '',
    hospitalId: '',
    role: 'patient'
  });
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const { forceAuthCheck } = useAuth();

  React.useEffect(() => {
    // Fetch hospitals for registration
    const fetchHospitals = async () => {
      try {
        const response = await fetch('/api/public/hospitals');
        if (response.ok) {
          const data = await response.json();
          setHospitals(data.data?.hospitals || []);
        }
      } catch (error) {
        console.error('Failed to fetch hospitals:', error);
      }
    };

    if (!isLogin) {
      fetchHospitals();
    }
  }, [isLogin]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateForm = () => {
    if (!formData.email || !formData.password) {
      onError('Email and password are required');
      return false;
    }

    if (!formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      onError('Please enter a valid email address');
      return false;
    }

    if (!isLogin) {
      if (formData.password !== formData.confirmPassword) {
        onError('Passwords do not match');
        return false;
      }

      if (formData.password.length < 8) {
        onError('Password must be at least 8 characters long');
        return false;
      }

      if (!formData.password.match(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)) {
        onError('Password must contain at least one uppercase letter, lowercase letter, and number');
        return false;
      }

      if (!formData.fullName.trim()) {
        onError('Full name is required');
        return false;
      }

      if (!formData.phone.trim()) {
        onError('Phone number is required');
        return false;
      }

      if (!formData.hospitalId) {
        onError('Please select a hospital');
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000';
      const fullUrl = `${apiUrl}${endpoint}`;

      const requestBody = isLogin ? {
        email: formData.email.toLowerCase().trim(),
        password: formData.password
      } : {
        email: formData.email.toLowerCase().trim(),
        password: formData.password,
        full_name: formData.fullName.trim(),
        phone: formData.phone.trim(),
        hospital_id: formData.hospitalId,
        role: formData.role
      };

      const response = await fetch(fullUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (response.ok) {
        // Store JWT token
        localStorage.setItem('auth_token', data.token);
        
        if (onSuccess) {
          onSuccess(data);
        }

        // Trigger AuthProvider to detect the new authentication
        await forceAuthCheck();
        
        // The AuthProvider routing logic will handle the redirect
      } else {
        onError(data.error || `${isLogin ? 'Login' : 'Registration'} failed`);
      }
    } catch (error) {
      onError(`Network error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setFormData({
      email: '',
      password: '',
      confirmPassword: '',
      fullName: '',
      phone: '',
      hospitalId: '',
      role: 'patient'
    });
  };

  return (
    <div className={styles.authContainer}>
      <form onSubmit={handleSubmit} className={styles.authForm}>
        <h2 className={styles.title}>
          {isLogin ? 'Sign In' : 'Create Account'}
        </h2>
        
        <div className={styles.inputGroup}>
          <label htmlFor="email" className={styles.label}>Email</label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            className={styles.input}
            required
            autoComplete="email"
          />
        </div>

        <div className={styles.inputGroup}>
          <label htmlFor="password" className={styles.label}>Password</label>
          <div className={styles.passwordContainer}>
            <input
              type={showPassword ? 'text' : 'password'}
              id="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              className={styles.input}
              required
              autoComplete={isLogin ? 'current-password' : 'new-password'}
            />
            <button
              type="button"
              className={styles.passwordToggle}
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
            >
              {showPassword ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>
        </div>

        {!isLogin && (
          <>
            <div className={styles.inputGroup}>
              <label htmlFor="confirmPassword" className={styles.label}>Confirm Password</label>
              <input
                type={showPassword ? 'text' : 'password'}
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                className={styles.input}
                required
                autoComplete="new-password"
              />
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="fullName" className={styles.label}>Full Name</label>
              <input
                type="text"
                id="fullName"
                name="fullName"
                value={formData.fullName}
                onChange={handleInputChange}
                className={styles.input}
                required
                autoComplete="name"
              />
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="phone" className={styles.label}>Phone Number</label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                className={styles.input}
                required
                autoComplete="tel"
              />
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="role" className={styles.label}>Role</label>
              <select
                id="role"
                name="role"
                value={formData.role}
                onChange={handleInputChange}
                className={styles.select}
                required
              >
                <option value="patient">Patient</option>
                <option value="doctor">Doctor</option>
                <option value="admin">Administrator</option>
              </select>
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="hospitalId" className={styles.label}>Hospital</label>
              <select
                id="hospitalId"
                name="hospitalId"
                value={formData.hospitalId}
                onChange={handleInputChange}
                className={styles.select}
                required
              >
                <option value="">Select a hospital</option>
                {hospitals.map((hospital) => (
                  <option key={hospital.id} value={hospital.id}>
                    {hospital.name}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        <button
          type="submit"
          className={styles.submitButton}
          disabled={loading}
        >
          {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Account')}
        </button>

        <div className={styles.divider}>
          <span>or</span>
        </div>

        <button
          type="button"
          onClick={toggleMode}
          className={styles.toggleButton}
        >
          {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
        </button>
      </form>
    </div>
  );
};

export default EmailAuthForm;