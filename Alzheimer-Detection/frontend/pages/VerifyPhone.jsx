import { useState, useEffect } from 'react';
import { useAuth } from '../components/AuthProvider';
import { useRouter } from 'next/router';
import Navbar from '../components/Navbar';
import LoadingSpinner from '../components/LoadingSpinner';
import supabase from '../lib/supabaseClient';
import styles from '../styles/VerifyPhone.module.css';

export default function VerifyPhonePage() {
  const { user, userProfile, refreshProfile } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(1); // 1: send OTP, 2: verify OTP
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    // If already verified, redirect
    if (userProfile && userProfile.phone_verified) {
      router.replace(`/${userProfile.role}/dashboard`);
    }
  }, [userProfile, router]);

  useEffect(() => {
    // Countdown timer for resend button
    let timer;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const skipVerification = async () => {
    if (process.env.NODE_ENV !== 'development') return;
    
    setIsSubmitting(true);
    setError('');
    
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ phone_verified: true })
        .eq('id', user.id);
      
      if (error) throw error;
      
      await refreshProfile();
      router.replace(`/${userProfile.role}/dashboard`);
    } catch (err) {
      setError('Failed to skip verification');
    } finally {
      setIsSubmitting(false);
    }
  };

  const sendOTP = async () => {
    setIsSubmitting(true);
    setError('');
    setSuccess('');

    try {
      // Generate a random 6-digit OTP
      const generatedOTP = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Store OTP in database with expiration
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      
      const { error } = await supabase
        .from('user_profiles')
        .update({
          phone_otp: generatedOTP,
          phone_otp_expires_at: expiresAt.toISOString(),
          phone_otp_attempts: 0
        })
        .eq('id', user.id);

      if (error) throw error;

      // For development - show OTP in console and success message
      console.log(`🔐 Development Mode - OTP for ${userProfile.phone}: ${generatedOTP}`);
      
      // In development, show OTP directly in the UI
      if (process.env.NODE_ENV === 'development') {
        setSuccess(`Development Mode: Your OTP is ${generatedOTP} (also sent to ${userProfile.phone.replace(/(\d{3})\d{4}(\d{3})/, '$1****$2')})`);
      } else {
        setSuccess(`Verification code sent to ${userProfile.phone.replace(/(\d{3})\d{4}(\d{3})/, '$1****$2')}`);
      }
      
      setStep(2);
      setCountdown(60); // 60 second cooldown
      
    } catch (err) {
      console.error('Error sending OTP:', err);
      setError('Failed to send verification code. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const verifyOTP = async () => {
    setIsSubmitting(true);
    setError('');
    
    const otpString = otp.join('');
    
    if (otpString.length !== 6) {
      setError('Please enter a complete 6-digit OTP');
      setIsSubmitting(false);
      return;
    }

    try {
      // Get current user profile to check OTP
      const { data: profileData, error: fetchError } = await supabase
        .from('user_profiles')
        .select('phone_otp, phone_otp_expires_at, phone_otp_attempts')
        .eq('id', user.id)
        .single();

      if (fetchError) throw fetchError;

      // Check if too many attempts
      if (profileData.phone_otp_attempts >= 5) {
        throw new Error('Too many incorrect attempts. Please request a new OTP.');
      }

      // Check if OTP has expired
      if (new Date() > new Date(profileData.phone_otp_expires_at)) {
        throw new Error('OTP has expired. Please request a new one.');
      }

      // Verify OTP
      if (otpString !== profileData.phone_otp) {
        // Increment attempt count
        await supabase
          .from('user_profiles')
          .update({
            phone_otp_attempts: profileData.phone_otp_attempts + 1
          })
          .eq('id', user.id);
        
        throw new Error(`Incorrect OTP. ${4 - profileData.phone_otp_attempts} attempts remaining.`);
      }

      // OTP is correct - mark phone as verified
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({
          phone_verified: true,
          phone_otp: null,
          phone_otp_expires_at: null,
          phone_otp_attempts: 0
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      // Refresh profile and redirect
      await refreshProfile();
      router.replace(`/${userProfile.role}/dashboard`);
      
    } catch (err) {
      console.error('Error verifying OTP:', err);
      setError(err.message || 'Failed to verify OTP. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOtpChange = (index, value) => {
    if (value.length > 1) return; // Only allow single digit
    
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    
    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
    
    setError('');
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`);
      if (prevInput) prevInput.focus();
    }
  };

  if (!userProfile) {
    return (
      <div className={styles.loadingContainer}>
        <LoadingSpinner />
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <>
      <Navbar />
      <div className={styles.verifyPage}>
        <div className={styles.verifyContainer}>
          <div className={styles.verifyHeader}>
            <div className={styles.phoneIcon}>📱</div>
            <h1>Verify Your Phone Number</h1>
            <p className={styles.subtitle}>
              We need to verify your phone number to secure your account
            </p>
          </div>

          <div className={styles.phoneDisplay}>
            <span className={styles.phoneLabel}>Phone Number:</span>
            <span className={styles.phoneNumber}>{userProfile.phone}</span>
          </div>

          {step === 1 ? (
            <div className={styles.stepContent}>
              <p className={styles.stepDescription}>
                Click the button below to receive a 6-digit verification code via SMS
              </p>
              
              <button
                onClick={sendOTP}
                disabled={isSubmitting}
                className={styles.sendButton}
              >
                {isSubmitting ? (
                  <>
                    <LoadingSpinner size={16} />
                    Sending OTP...
                  </>
                ) : (
                  <>
                    📤 Send Verification Code
                  </>
                )}
              </button>

              {process.env.NODE_ENV === 'development' && (
                <button
                  onClick={skipVerification}
                  disabled={isSubmitting}
                  className={styles.skipButton}
                  style={{
                    marginTop: '1rem',
                    background: '#6b7280',
                    color: 'white',
                    border: 'none',
                    padding: '12px 24px',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  🚀 Skip Verification (Dev Only)
                </button>
              )}
            </div>
          ) : (
            <div className={styles.stepContent}>
              <p className={styles.stepDescription}>
                Enter the 6-digit code sent to your phone
              </p>
              
              <div className={styles.otpContainer}>
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    id={`otp-${index}`}
                    type="text"
                    maxLength="1"
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    className={styles.otpInput}
                  />
                ))}
              </div>
              
              <button
                onClick={verifyOTP}
                disabled={isSubmitting}
                className={styles.verifyButton}
              >
                {isSubmitting ? (
                  <>
                    <LoadingSpinner size={16} />
                    Verifying...
                  </>
                ) : (
                  <>
                    ✅ Verify Code
                  </>
                )}
              </button>
              
              <div className={styles.resendSection}>
                {countdown > 0 ? (
                  <p className={styles.countdown}>
                    Resend code in {countdown} seconds
                  </p>
                ) : (
                  <button
                    onClick={sendOTP}
                    disabled={isSubmitting}
                    className={styles.resendButton}
                  >
                    🔄 Resend Code
                  </button>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className={styles.errorMessage}>
              {error}
            </div>
          )}
          
          {success && (
            <div className={styles.successMessage}>
              {success}
            </div>
          )}

          <div className={styles.helpSection}>
            <h4>Having trouble?</h4>
            <ul>
              <li>Make sure your phone has signal</li>
              <li>Check your spam/junk folder</li>
              <li>Wait a few minutes for the message to arrive</li>
              <li>Contact support if issues persist</li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}