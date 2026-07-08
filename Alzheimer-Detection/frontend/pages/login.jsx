import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../components/AuthProvider';
import Navbar from '../components/Navbar';
import LoadingSpinner from '../components/LoadingSpinner';
import supabase from '../lib/supabaseClient';
import styles from '../styles/Auth.module.css';

// Custom SVG Icons
const Icons = {
  Eye: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ),
  EyeOff: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  ),
  Mail: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="4" width="20" height="16" rx="2"/>
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
    </svg>
  ),
  Lock: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  ),
  Hospital: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2v20M17 7v10M7 7v10"/>
      <rect x="3" y="4" width="18" height="18" rx="2"/>
    </svg>
  )
};

export default function LoginPage() {
  const { user, userProfile, isLoading, session } = useAuth();
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (!isLoading && user && userProfile) {
      // Redirect based on user role
      if (userProfile.role && userProfile.account_status === 'active') {
        router.replace(`/${userProfile.role}/dashboard`);
      } else if (userProfile.account_status === 'pending') {
        router.replace('/account-pending');
      } else if (!userProfile.phone_verified) {
        router.replace('/VerifyPhone');
      }
    }
  }, [user, userProfile, isLoading, router]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (error) setError('');
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const { email, password } = formData;

      // Basic validation
      if (!email.trim() || !password.trim()) {
        throw new Error('Please enter both email and password');
      }

      // Attempt login with Supabase Auth
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password
      });

      if (signInError) {
        // Handle specific error cases
        if (signInError.message.includes('Invalid login credentials')) {
          throw new Error('Incorrect email or password. Please check your credentials.');
        } else if (signInError.message.includes('Email not confirmed')) {
          throw new Error('Your email address has not been verified. Please check your inbox.');
        } else if (signInError.message.includes('Too many requests')) {
          throw new Error('Too many login attempts. Please wait a few minutes and try again.');
        } else {
          throw new Error(signInError.message);
        }
      }

      // Login successful - AuthProvider will handle the redirect
      console.log('Login successful:', data.user?.email);

    } catch (error) {
      console.error('Login error:', error);
      setError(error.message || 'Login failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = () => {
    setShowPasswordReset(true);
  };

  // Show loading spinner while checking authentication status
  if (isLoading) {
    return (
      <>
        <Navbar />
        <div className={styles.authContainer}>
          <div className={styles.loadingContainer}>
            <LoadingSpinner />
            <p>Checking authentication status...</p>
          </div>
        </div>
      </>
    );
  }

  // Show password reset form if requested
  if (showPasswordReset) {
    return (
      <>
        <Navbar />
        <div className={styles.authContainer}>
          <div className={styles.authCard}>
            <div className={styles.authHeader}>
              <h1 className={styles.authTitle}>Reset Password</h1>
              <p className={styles.authDescription}>
                Enter your email to receive a password reset link
              </p>
            </div>

            {error && (
              <div className={styles.errorMessage}>
                ❌ {error}
              </div>
            )}

            {success && (
              <div className={styles.successMessage}>
                ✅ {success}
              </div>
            )}

            <div className={styles.authForm}>
              <button
                type="button"
                onClick={() => setShowPasswordReset(false)}
                className={styles.linkButton}
              >
                ← Back to Login
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className={styles.authContainer}>
        <div className={styles.authCard}>
          <div className={styles.authHeader}>
            <div className={styles.hospitalIcon}>
              <Icons.Hospital />
            </div>
            <h1 className={styles.authTitle}>Welcome to AI4NEURO</h1>
            <p className={styles.authDescription}>
              Sign in to access your healthcare dashboard
            </p>
          </div>

          {error && (
            <div className={styles.errorMessage}>
              {error}
            </div>
          )}

          <form onSubmit={handleEmailLogin} className={styles.authForm}>
            <div className={styles.formGroup}>
              <label htmlFor="email">
                <Icons.Mail />
                <span>Email Address</span>
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className={styles.formInput}
                placeholder="Enter your hospital email"
                disabled={isSubmitting}
                required
                autoComplete="email"
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="password">
                <Icons.Lock />
                <span>Password</span>
              </label>
              <div className={styles.passwordInputContainer}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className={styles.formInput}
                  placeholder="Enter your password"
                  disabled={isSubmitting}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className={styles.passwordToggle}
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isSubmitting}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <Icons.EyeOff /> : <Icons.Eye />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className={styles.primaryButton}
            >
              {isSubmitting ? (
                <>
                  <LoadingSpinner size={16} />
                  <span>Signing In...</span>
                </>
              ) : (
                'Sign In to Dashboard'
              )}
            </button>

            <div className={styles.helpLinks}>
              <button
                type="button"
                onClick={handleForgotPassword}
                className={styles.linkButton}
                disabled={isSubmitting}
              >
                Forgot Password?
              </button>
            </div>
          </form>

          <div className={styles.authFooter}>
            <div className={styles.infoMessage}>
              <h4>For Hospital Staff</h4>
              <p>If you need assistance accessing your account:</p>
              <ul>
                <li>Contact your hospital IT department for credentials</li>
                <li>First-time users will need to complete profile setup</li>
                <li>Ensure you're using your official hospital email</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}