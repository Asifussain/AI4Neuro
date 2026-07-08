import { useState, useEffect } from 'react';
import supabase from '../lib/supabaseClient';
import styles from '../styles/EditProfileModal.module.css';
import LoadingSpinner from './LoadingSpinner';

export default function EditProfileModal({ user, profile, details, onClose, onSave }) {
  const [formData, setFormData] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Pre-fill the form when the modal opens
    setFormData({
      full_name: profile?.full_name || '',
      date_of_birth: details?.date_of_birth || '',
      emergency_contact_name: details?.emergency_contact_name || '',
      emergency_contact_phone: details?.emergency_contact_phone || '',
      clinic_name: details?.clinic_name || '',
      specialization: details?.specialization || '',
      license_number: details?.license_number || '',
      hospital_affiliation: details?.hospital_affiliation || '',
      certification_id: details?.certification_id || '',
    });
  }, [profile, details]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ full_name: formData.full_name })
        .eq('id', user.id);
      if (profileError) throw profileError;

      const detailsData = {
        profile_id: user.id,
        ...(profile.role === 'patient' && { date_of_birth: formData.date_of_birth, emergency_contact_name: formData.emergency_contact_name, emergency_contact_phone: formData.emergency_contact_phone }),
        ...(profile.role === 'clinician' && { clinic_name: formData.clinic_name, specialization: formData.specialization, license_number: formData.license_number }),
        ...(profile.role === 'technician' && { hospital_affiliation: formData.hospital_affiliation, certification_id: formData.certification_id }),
      };

      const { error: detailsError } = await supabase
        .from('profile_details')
        .upsert(detailsData, { onConflict: 'profile_id' });
      if (detailsError) throw detailsError;

      // Call the onSave function passed from the parent to refresh the profile page
      onSave();

    } catch (err) {
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderRoleSpecificFields = () => {
    switch (profile.role) {
      case 'patient':
        return (
          <>
            <div className={styles.formGroup}><label>Date of Birth</label><input type="date" name="date_of_birth" value={formData.date_of_birth} onChange={handleChange} /></div>
            <div className={styles.formGroup}><label>Emergency Contact Name</label><input name="emergency_contact_name" value={formData.emergency_contact_name} onChange={handleChange} /></div>
            <div className={styles.formGroup}><label>Emergency Contact Phone</label><input name="emergency_contact_phone" value={formData.emergency_contact_phone} onChange={handleChange} /></div>
          </>
        );
      case 'clinician':
        return (
          <>
            <div className={styles.formGroup}><label>Clinic Name</label><input name="clinic_name" value={formData.clinic_name} onChange={handleChange} required /></div>
            <div className={styles.formGroup}><label>Specialization</label><input name="specialization" value={formData.specialization} onChange={handleChange} required /></div>
            <div className={styles.formGroup}><label>License Number</label><input name="license_number" value={formData.license_number} onChange={handleChange} required /></div>
          </>
        );
      case 'technician':
        return (
          <>
            <div className={styles.formGroup}><label>Hospital Affiliation</label><input name="hospital_affiliation" value={formData.hospital_affiliation} onChange={handleChange} required /></div>
            <div className={styles.formGroup}><label>Certification ID</label><input name="certification_id" value={formData.certification_id} onChange={handleChange} required /></div>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className={styles.modalBackdrop}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h2>Edit Profile</h2>
          <button onClick={onClose} className={styles.closeButton}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className={styles.formSection}>
            <h3 className={styles.sectionTitle}>Account Information</h3>
            <div className={styles.formGroup}>
              <label htmlFor="fullName">Full Name</label>
              <input id="fullName" name="full_name" value={formData.full_name} onChange={handleChange} />
            </div>
          </div>
          <div className={styles.formSection}>
            <h3 className={styles.sectionTitle}>Role-Specific Details</h3>
            {renderRoleSpecificFields()}
          </div>

          {error && <p className={styles.errorMessage}>{error}</p>}

          <div className={styles.formActions}>
            <button type="button" onClick={onClose} className={styles.cancelButton}>Cancel</button>
            <button type="submit" disabled={isSubmitting} className={styles.saveButton}>
              {isSubmitting ? <LoadingSpinner /> : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}