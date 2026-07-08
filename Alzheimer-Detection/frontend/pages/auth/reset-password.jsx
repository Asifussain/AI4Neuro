import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../components/AuthProvider';
import Navbar from '../../components/Navbar';
import LoadingSpinner from '../../components/LoadingSpinner';
import supabase from '../../lib/supabaseClient';
import styles from '../../styles/Auth.module.css';

export default function ResetPasswordPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isValidSession, setIsValidSession] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  // Check if the user has a valid password reset session
  useEffect(() => {
    const checkResetSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Session check error:', error);
          setIsValidSession(false);
        } else if (session && session.user) {
          // Check if this is a password recovery session
          const isRecoverySession = session.user.recovery_sent_at || 
                                   session.user.email_confirmed_at || 
                                   router.query.access_token;
          
          if (isRecoverySession) {
            setIsValidSession(true);
          } else {
            setIsValidSession(false);
          }
        } else {
          setIsValidSession(false);
        }
      } catch (error) {
        console.error('Error checking reset session:', error);
        setIsValidSession(false);
      } finally {
        setIsCheckingSession(false);
      }
    };

    checkResetSession();
  }, [router.query]);

  const validatePassword = (password) => {
    const minLength = 8;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (password.length < minLength) {
      return 'Password must be at least 8 characters long';
    }
    if (!hasUppercase) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!hasLowercase) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!hasNumber) {
      return 'Password must contain at least one number';
    }
    if (!hasSpecialChar) {
      return 'Password must contain at least one special character';
    }
    return null;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const { password, confirmPassword } = formData;

      // Validate password
      const passwordError = validatePassword(password);
      if (passwordError) {
        throw new Error(passwordError);
      }

      // Check if passwords match
      if (password !== confirmPassword) {
        throw new Error('Passwords do not match');
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) {
        if (updateError.message.includes('session_not_found')) {
          throw new Error('Reset link has expired. Please request a new password reset.');
        } else if (updateError.message.includes('weak_password')) {
          throw new Error('Password is too weak. Please choose a stronger password.');
        } else {
          throw new Error(updateError.message || 'Failed to update password');
        }
      }

      // Success
      setSuccess(true);

      // Redirect to login after a delay
      setTimeout(() => {
        router.push('/login?message=password-reset-success');
      }, 3000);

    } catch (error) {
      console.error('Password reset error:', error);
      setError(error.message || 'Failed to reset password');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackToLogin = () => {
    router.push('/login');
  };

  const handleRequestNewReset = () => {
    router.push('/auth/forgot-password');
  };

  if (isCheckingSession) {
    return (
      <>
        <Navbar />
        <div className={styles.authContainer}>
          <div className={styles.loadingContainer}>
            <LoadingSpinner />
            <p>Verifying reset link...</p>
          </div>
        </div>
      </>
    );
  }

  if (!isValidSession) {
    return (
      <>
        <Navbar />
        <div className={styles.authContainer}>
          <div className={styles.authCard}>
            <div className={styles.authHeader}>
              <h1 className={styles.authTitle}>⚠️ Invalid Reset Link</h1>
              <p className={styles.authDescription}>
                This password reset link is invalid or has expired
              </p>
            </div>

            <div className={styles.errorMessage}>
              ❌ The password reset link you used is either invalid or has expired. 
              Please request a new password reset email.
            </div>

            <div className={styles.authForm}>
              <button
                onClick={handleRequestNewReset}
                className={styles.primaryButton}
              >
                Request New Reset Link
              </button>
              
              <div className={styles.helpLinks}>
                <button
                  onClick={handleBackToLogin}
                  className={styles.linkButton}
                >
                  ← Back to Login
                </button>
              </div>
            </div>

            <div className={styles.authFooter}>
              <div className={styles.infoMessage}>
                <h4>📝 About Reset Links</h4>
                <ul>
                  <li>Password reset links expire after 1 hour for security</li>
                  <li>Each link can only be used once</li>
                  <li>Make sure you're clicking the latest reset link in your email</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (success) {
    return (
      <>
        <Navbar />
        <div className={styles.authContainer}>
          <div className={styles.authCard}>
            <div className={styles.authHeader}>
              <h1 className={styles.authTitle}>✅ Password Reset Successful</h1>
              <p className={styles.authDescription}>
                Your password has been updated successfully
              </p>
            </div>

            <div className={styles.successMessage}>
              ✅ Your password has been reset successfully! You will be redirected to the login page in a few seconds.
            </div>

            <div className={styles.successActions}>
              <div className={styles.successIcon}>🎉</div>
              <p>You can now sign in with your new password.</p>
              
              <button
                onClick={handleBackToLogin}
                className={styles.primaryButton}
              >
                Continue to Login
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
            <h1 className={styles.authTitle}>🔒 Set New Password</h1>
            <p className={styles.authDescription}>
              Create a strong new password for your account
            </p>
          </div>

          {error && (
            <div className={styles.errorMessage}>
              ❌ {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className={styles.authForm}>
            <div className={styles.formGroup}>
              <label htmlFor="password">New Password</label>
              <div className={styles.passwordInputContainer}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className={styles.formInput}
                  placeholder="Enter your new password"
                  disabled={isSubmitting}
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className={styles.passwordToggle}
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isSubmitting}
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
              <div className={styles.passwordHelp}>
                <p>Password must contain:</p>
                <ul>
                  <li>At least 8 characters</li>
                  <li>One uppercase letter (A-Z)</li>
                  <li>One lowercase letter (a-z)</li>
                  <li>One number (0-9)</li>
                  <li>One special character (!@#$%^&*)</li>
                </ul>
              </div>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="confirmPassword">Confirm New Password</label>
              <div className={styles.passwordInputContainer}>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  className={styles.formInput}
                  placeholder="Confirm your new password"
                  disabled={isSubmitting}
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className={styles.passwordToggle}
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={isSubmitting}
                >
                  {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
              {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                <div className={styles.passwordMismatch}>
                  ⚠️ Passwords do not match
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !formData.password || !formData.confirmPassword}
              className={styles.primaryButton}
            >
              {isSubmitting ? (
                <>
                  <LoadingSpinner size={16} />
                  Updating Password...
                </>
              ) : (
                'Update Password'
              )}
            </button>

            <div className={styles.helpLinks}>
              <button
                type="button"
                onClick={handleBackToLogin}
                className={styles.linkButton}
                disabled={isSubmitting}
              >
                ← Cancel and Return to Login
              </button>
            </div>
          </form>

          <div className={styles.authFooter}>
            <div className={styles.infoMessage}>
              <h4>🔐 Security Tips</h4>
              <ul>
                <li>Use a unique password that you don't use elsewhere</li>
                <li>Consider using a password manager</li>
                <li>Don't share your password with anyone</li>
                <li>Sign out of shared computers after use</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}