import { useState, useEffect } from 'react';
import { useAuth } from '../components/AuthProvider';
import withAuth from '../components/withAuth';
import Navbar from '../components/Navbar';
import styles from '../styles/Appearance.module.css';

function AppearancePage() {
  const { userProfile } = useAuth();
  const [theme, setTheme] = useState('dark');
  const [accentColor, setAccentColor] = useState('#3b82f6'); // Blue default

  const accentColors = [
    { name: 'Blue', value: '#3b82f6', rgb: '59, 130, 246' },
    { name: 'Purple', value: '#8b5cf6', rgb: '139, 92, 246' },
    { name: 'Green', value: '#10b981', rgb: '16, 185, 129' },
    { name: 'Pink', value: '#ec4899', rgb: '236, 72, 153' },
    { name: 'Orange', value: '#f97316', rgb: '249, 115, 22' },
    { name: 'Teal', value: '#14b8a6', rgb: '20, 184, 166' },
  ];

  useEffect(() => {
    // Load saved preferences from localStorage
    const savedTheme = localStorage.getItem('theme') || 'dark';
    const savedColor = localStorage.getItem('accentColor') || '#3b82f6';
    setTheme(savedTheme);
    setAccentColor(savedColor);
    applyTheme(savedTheme, savedColor);
  }, []);

  const applyTheme = (selectedTheme, selectedColor) => {
    const root = document.documentElement;
    const body = document.body;

    // Apply theme to entire body
    if (selectedTheme === 'dark') {
      body.style.background = 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)';
      body.style.color = '#f1f5f9';
      body.setAttribute('data-theme', 'dark');

      root.style.setProperty('--bg-primary', '#0f172a');
      root.style.setProperty('--bg-secondary', '#1e293b');
      root.style.setProperty('--bg-card', 'rgba(30, 41, 59, 0.8)');
      root.style.setProperty('--bg-sidebar', 'linear-gradient(135deg, rgba(15, 23, 42, 0.98) 0%, rgba(30, 41, 59, 0.95) 100%)');
      root.style.setProperty('--text-primary', '#f1f5f9');
      root.style.setProperty('--text-secondary', '#cbd5e1');
      root.style.setProperty('--border-color', 'rgba(59, 130, 246, 0.2)');
    } else {
      body.style.background = 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)';
      body.style.color = '#0f172a';
      body.setAttribute('data-theme', 'light');

      root.style.setProperty('--bg-primary', '#ffffff');
      root.style.setProperty('--bg-secondary', '#f8fafc');
      root.style.setProperty('--bg-card', 'rgba(255, 255, 255, 0.8)');
      root.style.setProperty('--bg-sidebar', 'linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 250, 252, 0.95) 100%)');
      root.style.setProperty('--text-primary', '#0f172a');
      root.style.setProperty('--text-secondary', '#475569');
      root.style.setProperty('--border-color', 'rgba(203, 213, 225, 0.5)');
    }

    // Apply sidebar/accent color
    const colorObj = accentColors.find(c => c.value === selectedColor);
    if (colorObj) {
      root.style.setProperty('--role-color', colorObj.value);
      root.style.setProperty('--role-color-rgb', colorObj.rgb);

      // Apply to sidebar elements
      root.style.setProperty('--sidebar-accent', colorObj.value);
      root.style.setProperty('--sidebar-hover', `${colorObj.value}20`);
      root.style.setProperty('--sidebar-active', `${colorObj.value}30`);
    }
  };

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    applyTheme(newTheme, accentColor);
  };

  const handleColorChange = (newColor) => {
    setAccentColor(newColor);
    localStorage.setItem('accentColor', newColor);
    applyTheme(theme, newColor);
  };

  return (
    <>
      <Navbar />
      <div className={styles.pageContainer}>
        <div className={styles.contentWrapper}>
          <h1 className={styles.pageTitle}>Appearance Settings</h1>
          <p className={styles.pageSubtitle}>
            Customize how AI4NEURO looks and feels for you
          </p>

          {/* Theme Selection */}
          <div className={styles.settingSection}>
            <h2 className={styles.sectionTitle}>Theme</h2>
            <p className={styles.sectionDescription}>
              Choose between light and dark mode
            </p>
            <div className={styles.themeOptions}>
              <button
                className={`${styles.themeOption} ${theme === 'light' ? styles.active : ''}`}
                onClick={() => handleThemeChange('light')}
              >
                <div className={styles.themePreview} style={{background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)'}}>
                  <div className={styles.previewContent}>
                    <div className={styles.previewBar} style={{background: '#e2e8f0'}}></div>
                    <div className={styles.previewBar} style={{background: '#cbd5e1', width: '60%'}}></div>
                    <div className={styles.previewBar} style={{background: '#94a3b8', width: '80%'}}></div>
                  </div>
                </div>
                <span>Light</span>
              </button>
              <button
                className={`${styles.themeOption} ${theme === 'dark' ? styles.active : ''}`}
                onClick={() => handleThemeChange('dark')}
              >
                <div className={styles.themePreview} style={{background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)'}}>
                  <div className={styles.previewContent}>
                    <div className={styles.previewBar} style={{background: '#1e293b'}}></div>
                    <div className={styles.previewBar} style={{background: '#334155', width: '60%'}}></div>
                    <div className={styles.previewBar} style={{background: '#475569', width: '80%'}}></div>
                  </div>
                </div>
                <span>Dark</span>
              </button>
            </div>
          </div>

          {/* Secondary Color Selection */}
          <div className={styles.settingSection}>
            <h2 className={styles.sectionTitle}>Secondary Color</h2>
            <p className={styles.sectionDescription}>
              Choose your preferred color for sidebar, buttons, links, and highlights
            </p>
            <div className={styles.colorGrid}>
              {accentColors.map((color) => (
                <button
                  key={color.value}
                  className={`${styles.colorOption} ${accentColor === color.value ? styles.active : ''}`}
                  onClick={() => handleColorChange(color.value)}
                  style={{ '--color': color.value }}
                >
                  <div className={styles.colorCircle} style={{background: color.value}}>
                    {accentColor === color.value && (
                      <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </div>
                  <span>{color.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Preview Card */}
          <div className={styles.settingSection}>
            <h2 className={styles.sectionTitle}>Preview</h2>
            <div className={styles.previewCard}>
              <h3>Sample Card</h3>
              <p>This is how your interface will look with the selected theme and accent color.</p>
              <button className={styles.previewButton} style={{background: accentColor}}>
                Sample Button
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default withAuth(AppearancePage);
