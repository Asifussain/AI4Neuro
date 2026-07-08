import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '../components/AuthProvider'
import supabase from '../lib/supabaseClient'
import Navbar from '../components/Navbar'
import LoadingSpinner from '../components/LoadingSpinner'
import styles from '../styles/Auth.module.css'

export default function ChangePasswordPage() {
  const { user, userProfile, refreshProfile } = useAuth()
  const router = useRouter()
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isFirstLogin, setIsFirstLogin] = useState(false)

  useEffect(() => {
    if (user && userProfile) {
      // Check if this is a first login (admin-created account)
      setIsFirstLogin(userProfile.first_login_required || user.user_metadata?.first_login)
    }
  }, [user, userProfile])

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    setError('')
  }

  const validatePassword = (password) => {
    const minLength = 8
    const hasUppercase = /[A-Z]/.test(password)
    const hasLowercase = /[a-z]/.test(password)
    const hasNumber = /\d/.test(password)
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password)

    if (password.length < minLength) {
      return 'Password must be at least 8 characters long'
    }
    if (!hasUppercase) {
      return 'Password must contain at least one uppercase letter'
    }
    if (!hasLowercase) {
      return 'Password must contain at least one lowercase letter'
    }
    if (!hasNumber) {
      return 'Password must contain at least one number'
    }
    if (!hasSpecialChar) {
      return 'Password must contain at least one special character'
    }
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    setSuccess('')

    try {
      // Validate new password
      const passwordError = validatePassword(formData.newPassword)
      if (passwordError) {
        setError(passwordError)
        setIsLoading(false)
        return
      }

      // Check if passwords match
      if (formData.newPassword !== formData.confirmPassword) {
        setError('New passwords do not match')
        setIsLoading(false)
        return
      }

      // For first login, we don't need to verify current password
      if (!isFirstLogin) {
        // Verify current password by attempting to sign in
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: formData.currentPassword
        })

        if (signInError) {
          setError('Current password is incorrect')
          setIsLoading(false)
          return
        }
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: formData.newPassword
      })

      if (updateError) {
        throw updateError
      }

      // Update user metadata to mark first login as complete
      if (isFirstLogin) {
        const { error: metadataError } = await supabase.auth.updateUser({
          data: {
            ...user.user_metadata,
            first_login: false
          }
        })

        if (metadataError) {
          console.warn('Failed to update user metadata:', metadataError)
        }

        // Update user profile to mark first login as complete
        const { error: profileUpdateError } = await supabase
          .from('user_profiles')
          .update({
            first_login_required: false,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id)

        if (profileUpdateError) {
          console.warn('Failed to update profile:', profileUpdateError)
        }
      }

      setSuccess('Password changed successfully!')
      setFormData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      })

      // Refresh profile and redirect after successful password change
      setTimeout(async () => {
        await refreshProfile()
        if (isFirstLogin && userProfile?.role) {
          router.push(`/${userProfile.role}/dashboard`)
        } else {
          router.push('/profile')
        }
      }, 2000)

    } catch (error) {
      console.error('Password change error:', error)
      setError('Failed to change password. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  if (!user) {
    return (
      <>
        <Navbar />
        <div className={styles.authContainer}>
          <div className={styles.authCard}>
            <h2>Access Denied</h2>
            <p>You must be logged in to change your password.</p>
            <button onClick={() => router.push('/login')} className={styles.primaryButton}>
              Go to Login
            </button>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Navbar />
      <div className={styles.authContainer}>
        <div className={styles.authCard}>
          <div className={styles.authHeader}>
            <h1 className={styles.authTitle}>
              {isFirstLogin ? (
                <>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: '8px', verticalAlign: 'middle' }}>
                    <path d="M12,17A2,2 0 0,0 14,15C14,13.89 13.1,13 12,13A2,2 0 0,0 10,15A2,2 0 0,0 12,17M18,8A2,2 0 0,1 20,10V20A2,2 0 0,1 18,22H6A2,2 0 0,1 4,20V10C4,8.89 4.9,8 6,8H7V6A5,5 0 0,1 12,1A5,5 0 0,1 17,6V8H18M12,3A3,3 0 0,0 9,6V8H15V6A3,3 0 0,0 12,3Z"/>
                  </svg>
                  First Login - Change Password
                </>
              ) : (
                <>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: '8px', verticalAlign: 'middle' }}>
                    <path d="M12,4V2A10,10 0 0,0 2,12H4A8,8 0 0,1 12,4Z"/>
                  </svg>
                  Change Password
                </>
              )}
            </h1>
            {isFirstLogin && (
              <div className={styles.warningMessage}>
                <p><strong>Security Notice:</strong> You must change your temporary password before accessing the system.</p>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className={styles.authForm}>
            {!isFirstLogin && (
              <div className={styles.formGroup}>
                <label htmlFor="currentPassword">Current Password</label>
                <input
                  type="password"
                  id="currentPassword"
                  name="currentPassword"
                  value={formData.currentPassword}
                  onChange={handleInputChange}
                  required
                  placeholder="Enter your current password"
                  className={styles.formInput}
                />
              </div>
            )}

            <div className={styles.formGroup}>
              <label htmlFor="newPassword">New Password</label>
              <input
                type="password"
                id="newPassword"
                name="newPassword"
                value={formData.newPassword}
                onChange={handleInputChange}
                required
                placeholder="Enter your new password"
                className={styles.formInput}
              />
              <div className={styles.passwordHelp}>
                <p>Password must contain:</p>
                <ul>
                  <li>At least 8 characters</li>
                  <li>One uppercase letter</li>
                  <li>One lowercase letter</li>
                  <li>One number</li>
                  <li>One special character (!@#$%^&*)</li>
                </ul>
              </div>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="confirmPassword">Confirm New Password</label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                required
                placeholder="Confirm your new password"
                className={styles.formInput}
              />
            </div>

            {error && (
              <div className={styles.errorMessage}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: '8px', verticalAlign: 'middle' }}>
                  <path d="M12,2L13.09,8.26L22,9L13.09,9.74L12,16L10.91,9.74L2,9L10.91,8.26L12,2M12,7A2,2 0 0,0 10,9A2,2 0 0,0 12,11A2,2 0 0,0 14,9A2,2 0 0,0 12,7Z"/>
                </svg>
                {error}
              </div>
            )}

            {success && (
              <div className={styles.successMessage}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: '8px', verticalAlign: 'middle' }}>
                  <path d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M11,16.5L6.5,12L7.91,10.59L11,13.67L16.59,8.09L18,9.5L11,16.5Z"/>
                </svg>
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className={styles.primaryButton}
            >
              {isLoading ? (
                <>
                  <LoadingSpinner size={16} />
                  Changing Password...
                </>
              ) : (
                'Change Password'
              )}
            </button>

            {!isFirstLogin && (
              <button
                type="button"
                onClick={() => router.back()}
                className={styles.secondaryButton}
              >
                Cancel
              </button>
            )}
          </form>

          {isFirstLogin && (
            <div className={styles.infoMessage}>
              <h4>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: '8px', verticalAlign: 'middle' }}>
                  <path d="M9,17H15V15H9V17M9,13H15V11H9V13M9,9H15V7H9V9M3,3V21H21V3H3M5,19V5H19V19H5Z"/>
                </svg>
                Next Steps:
              </h4>
              <ol>
                <li>Create a strong password following the requirements above</li>
                <li>Remember your new password - it cannot be recovered by administrators</li>
                <li>You'll be redirected to your dashboard after changing your password</li>
              </ol>
            </div>
          )}
        </div>
      </div>
    </>
  )
}