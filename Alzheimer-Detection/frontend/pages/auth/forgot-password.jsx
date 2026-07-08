import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../components/AuthProvider';
import Navbar from '../../components/Navbar';
import LoadingSpinner from '../../components/LoadingSpinner';
import supabase from '../../lib/supabaseClient';
import styles from '../../styles/Auth.module.css';

export default function ForgotPasswordPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [emailSent, setEmailSent] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (!isLoading && user) {
      router.replace('/');
    }
  }, [user, isLoading, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    setMessage('');

    try {
      if (!email.trim()) {
        throw new Error('Please enter your email address');
      }

      if (!/\S+@\S+\.\S+/.test(email)) {
        throw new Error('Please enter a valid email address');
      }

      // Send password reset email
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/reset-password`
      });

      if (resetError) {
        if (resetError.message.includes('rate limit')) {
          throw new Error('Too many reset requests. Please wait a few minutes before trying again.');
        } else {
          throw new Error('Failed to send reset email. Please try again.');
        }
      }

      // Success
      setEmailSent(true);
      setMessage('Password reset instructions have been sent to your email address.');

    } catch (error) {
      console.error('Password reset error:', error);
      setError(error.message || 'Failed to send password reset email');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackToLogin = () => {
    router.push('/login');
  };

  const handleResendEmail = async () => {
    setEmailSent(false);
    setMessage('');
    setError('');
    handleSubmit({ preventDefault: () => {} });
  };

  if (isLoading) {
    return (
      <>
        <Navbar />
        <div className={styles.authContainer}>
          <div className={styles.loadingContainer}>
            <LoadingSpinner />
            <p>Loading...</p>
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
            <h1 className={styles.authTitle}>
              {emailSent ? '📧 Check Your Email' : '🔒 Reset Password'}
            </h1>
            <p className={styles.authDescription}>
              {emailSent 
                ? 'We\'ve sent password reset instructions to your email'
                : 'Enter your email address and we\'ll send you instructions to reset your password'
              }
            </p>
          </div>

          {error && (
            <div className={styles.errorMessage}>
              ❌ {error}
            </div>
          )}

          {message && (
            <div className={styles.successMessage}>
              ✅ {message}
            </div>
          )}

          {!emailSent ? (
            <form onSubmit={handleSubmit} className={styles.authForm}>
              <div className={styles.formGroup}>
                <label htmlFor="email">Email Address</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError('');
                  }}
                  className={styles.formInput}
                  placeholder="Enter your email address"
                  disabled={isSubmitting}
                  required
                  autoComplete="email"
                  autoFocus
                />
                <div className={styles.inputHint}>
                  Enter the email address associated with your hospital account
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !email.trim()}
                className={styles.primaryButton}
              >
                {isSubmitting ? (
                  <>
                    <LoadingSpinner size={16} />
                    Sending Reset Email...
                  </>
                ) : (
                  'Send Reset Instructions'
                )}
              </button>

              <div className={styles.helpLinks}>
                <button
                  type="button"
                  onClick={handleBackToLogin}
                  className={styles.linkButton}
                  disabled={isSubmitting}
                >
                  ← Back to Login
                </button>
              </div>
            </form>
          ) : (
            <div className={styles.emailSentSection}>
              <div className={styles.emailSentIcon}>
                <div className={styles.emailIcon}>📧</div>
                <div className={styles.checkMark}>✓</div>
              </div>
              
              <div className={styles.emailSentContent}>
                <h3>Email Sent Successfully!</h3>
                <p>We've sent password reset instructions to:</p>
                <div className={styles.emailDisplay}>{email}</div>
                
                <div className={styles.nextStepsInfo}>
                  <h4>Next Steps:</h4>
                  <ol>
                    <li>Check your email inbox (and spam/junk folder)</li>
                    <li>Click the reset link in the email</li>
                    <li>Create your new password</li>
                    <li>Sign in with your new credentials</li>
                  </ol>
                </div>

                <div className={styles.troubleshootingInfo}>
                  <h4>Didn't receive the email?</h4>
                  <ul>
                    <li>Check your spam/junk folder</li>
                    <li>Make sure you entered the correct email address</li>
                    <li>Wait a few minutes for the email to arrive</li>
                    <li>Contact your hospital IT department if you continue having issues</li>
                  </ul>
                </div>
              </div>

              <div className={styles.emailSentActions}>
                <button
                  onClick={handleResendEmail}
                  className={styles.secondaryButton}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Sending...' : 'Resend Email'}
                </button>
                <button
                  onClick={handleBackToLogin}
                  className={styles.primaryButton}
                >
                  Return to Login
                </button>
              </div>
            </div>
          )}

          <div className={styles.authFooter}>
            <div className={styles.infoMessage}>
              <h4>🏥 Need Help?</h4>
              <p>If you're having trouble resetting your password:</p>
              <ul>
                <li>Make sure you're using the email address provided by your hospital administrator</li>
                <li>Contact your hospital IT department for assistance</li>
                <li>Check that your account hasn't been suspended or deactivated</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}