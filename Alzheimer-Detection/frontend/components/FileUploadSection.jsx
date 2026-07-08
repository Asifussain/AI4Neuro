import { useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from './AuthProvider';
import dynamic from 'next/dynamic';
import styles from '../styles/Hero.module.css';
import dashStyles from '../styles/DashboardLayout.module.css';

const LoadingSpinner = dynamic(() => import('./LoadingSpinner'), { ssr: false });

export default function FileUploadSection() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileName, setFileName] = useState('Input EEG data (.npy)');
  const [selectedChannel, setSelectedChannel] = useState(1);
  const [classificationType, setClassificationType] = useState('binary'); // 'binary' or 'multiclass'
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user, session } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith('.npy')) {
        alert('Invalid file type. Please upload a .npy file.');
        setSelectedFile(null);
        setFileName('Input EEG data (.npy)');
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      setSelectedFile(file);
      setFileName(file.name);
    } else {
      setSelectedFile(null);
      setFileName('Input EEG data (.npy)');
    }
  };

  const handleTriggerClick = () => {
    if (user && session) {
      fileInputRef.current?.click();
    } else {
      alert("Please ensure you are logged in to upload.");
    }
  };

  const handleChannelChange = (e) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= 1 && value <= 19) {
      setSelectedChannel(value);
    } else if (e.target.value === '') {
      setSelectedChannel('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!user || !session) {
      alert('Login session expired or invalid. Please log in again.');
      return;
    }
    if (!selectedFile) {
      alert('Please select a .npy file first.');
      return;
    }
    const channelNum = parseInt(selectedChannel, 10);
    if (isNaN(channelNum) || channelNum < 1 || channelNum > 19) {
      alert('Please select a valid channel number (1-19) for the similarity plot.');
      return;
    }

    setIsSubmitting(true);
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('user_id', user.id);
    formData.append('channel_index', channelNum - 1);
    formData.append('classification_type', classificationType);

    try {
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000';
      const apiUrl = `${backendUrl}/api/predict`;

      console.log(`Sending request to: ${apiUrl}`); // For debugging

      const res = await fetch(apiUrl, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errorRes = await res.json().catch(() => ({ error: 'Upload failed with status: ' + res.status }));
        throw new Error(errorRes.error || `HTTP error ${res.status}`);
      }

      const data = await res.json();

      router.push({
        pathname: '/result',
        query: {
          prediction: data.prediction,
          filename: data.filename,
          prediction_id: data.prediction_id
        },
      });

    } catch (error) {
      console.error("Upload Error:", error);
      alert(`Error during analysis: ${error.message}`);
    } finally {
      setIsSubmitting(false);
      setSelectedFile(null);
      setFileName('Input EEG data (.npy)');
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <form onSubmit={handleSubmit} className={dashStyles.uploadFormContainer}>
      <div className={dashStyles.uploadForm}>
        <input
          type="file"
          accept=".npy"
          onChange={handleFileChange}
          ref={fileInputRef}
          className={styles.hiddenInput}
          required
          disabled={isSubmitting || !user || !session}
        />
        <div
          className={`${dashStyles.fileInputTrigger} ${selectedFile ? dashStyles.hasFile : ''}`}
          onClick={handleTriggerClick}
          tabIndex={0}
          role="button"
          aria-label="Select EEG file"
          title={fileName}
          style={{ cursor: (!user || !session) ? 'not-allowed' : 'pointer' }}
        >
          {fileName}
        </div>
        <button
          type="submit"
          className={dashStyles.analyseBtn}
          disabled={isSubmitting || !user || !session || !selectedFile || selectedChannel === ''}
        >
          {isSubmitting ? 'Analysing...' : 'Analyse'}
        </button>
      </div>

      <div className={dashStyles.classificationTypeSelector} style={{ marginTop: '1rem', marginBottom: '1rem' }}>
        <label className={dashStyles.channelLabel} style={{ display: 'block', marginBottom: '0.5rem' }}>
          Classification Type:
        </label>
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input
              type="radio"
              name="classificationType"
              value="binary"
              checked={classificationType === 'binary'}
              onChange={(e) => setClassificationType(e.target.value)}
              disabled={isSubmitting || !user || !session}
              style={{ cursor: 'pointer' }}
            />
            <span style={{ color: 'var(--text-primary)', fontSize: '1rem' }}>Binary (Normal vs Alzheimer's)</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input
              type="radio"
              name="classificationType"
              value="multiclass"
              checked={classificationType === 'multiclass'}
              onChange={(e) => setClassificationType(e.target.value)}
              disabled={isSubmitting || !user || !session}
              style={{ cursor: 'pointer' }}
            />
            <span style={{ color: 'var(--text-primary)', fontSize: '1rem' }}>Multi-class (CN, MCI, AD)</span>
          </label>
        </div>
      </div>

      <div className={dashStyles.channelSelector}>
        <label htmlFor="channelSelect" className={dashStyles.channelLabel}>Plot Similarity for Channel (1-19):</label>
        <input
          type="number"
          id="channelSelect"
          name="channelSelect"
          min="1"
          max="19"
          value={selectedChannel}
          onChange={handleChannelChange}
          className={dashStyles.channelInput}
          required
          disabled={isSubmitting || !user || !session}
          placeholder="1-19"
        />
      </div>

      {isSubmitting && (
        <div className={dashStyles.loadingContainer} style={{ marginTop: '1rem', justifyContent: 'center' }}>
          <LoadingSpinner />
          <p style={{ color: 'var(--text-secondary)' }}>Processing your file. This may take a minute...</p>
        </div>
      )}
    </form>
  );
}