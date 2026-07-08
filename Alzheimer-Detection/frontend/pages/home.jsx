// SWAPPED: This page now shows the MARKETING content (was in landing.jsx)
// FOR: Logged-IN users who visit /home
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Navbar from '../components/Navbar';
import { useAuth } from '../components/AuthProvider';
import { FaBrain } from 'react-icons/fa';
import { FiActivity, FiZap, FiShield, FiTrendingUp, FiUsers, FiArrowRight, FiPlay, FiCheckCircle } from 'react-icons/fi';
import styles from '../styles/LandingPage.module.css';

export default function Home() {
  const { user, userProfile, isLoading: authLoading, session } = useAuth();
  const router = useRouter();
  const [activeFeature, setActiveFeature] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveFeature(prev => (prev + 1) % 3);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // KEEP AUTH CHECKS - redirect if not logged in
  useEffect(() => {
    if (!authLoading && mounted) {
      if (!user || !session) {
        router.replace('/landing');
      } else if (!userProfile || userProfile.needsSetup || !userProfile.role) {
        router.replace('/complete-profile');
      }
    }
  }, [user, userProfile, authLoading, session, router, mounted]);

  if (authLoading || !mounted) {
    return (
      <>
        <Navbar />
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <p>Loading...</p>
        </div>
      </>
    );
  }

  const handleGetStarted = () => {
    // UPDATED FOR HOME PAGE: Logged-in users go to dashboard
    if (userProfile?.role) {
      router.push(`/${userProfile.role}/dashboard`);
    } else {
      router.push('/complete-profile');
    }
  };

  const features = [
    {
      icon: <FaBrain className={styles.featureIcon} />,
      title: "Advanced AI Analysis",
      description: "Advanced deep learning models process EEG signals with medical-grade precision"
    },
    {
      icon: <FiActivity className={styles.featureIcon} />,
      title: "Real-time Processing",
      description: "Instant EEG signal analysis with comprehensive reports tailored to your professional role"
    },
    {
      icon: <FiShield className={styles.featureIcon} />,
      title: "Secure & Compliant",
      description: "Enterprise-grade security with full HIPAA compliance for sensitive medical data"
    }
  ];

  const stats = [
    { number: "95%", label: "Accuracy Rate", icon: <FiTrendingUp /> },
    { number: "10k+", label: "Analyses Complete", icon: <FiActivity /> },
    { number: "500+", label: "Healthcare Professionals", icon: <FiUsers /> }
  ];

  return (
    <>
      <Navbar />
      <main className={styles.landingPage}>
        {/* Hero Section */}
        <section className={styles.heroSection}>
          <div className={styles.heroContainer}>
            <div className={styles.heroContent}>
              <div className={styles.heroText}>
                <h1 className={styles.heroTitle}>
                  Advanced <span className={styles.highlight}>Neural Analysis</span>
                  <br />for Alzheimer's Detection
                </h1>
                <p className={styles.heroDescription}>
                  Leverage cutting-edge AI technology to analyze EEG signals and identify
                  Alzheimer's patterns with unprecedented accuracy. Trusted by healthcare
                  professionals worldwide.
                </p>
                <div className={styles.heroActions}>
                  <button
                    onClick={handleGetStarted}
                    className={`${styles.primaryBtn} btn btn-primary`}
                  >
                    <FiZap />
                    Start Analysis
                    <FiArrowRight />
                  </button>
                  <Link href="/about" className={`${styles.secondaryBtn} btn btn-outline`}>
                    <FiPlay />
                    Learn More
                  </Link>
                </div>
                <div className={styles.trustIndicators}>
                  <div className={styles.trustItem}>
                    <FiCheckCircle />
                    <span>FDA Compliant</span>
                  </div>
                  <div className={styles.trustItem}>
                    <FiCheckCircle />
                    <span>HIPAA Secure</span>
                  </div>
                  <div className={styles.trustItem}>
                    <FiCheckCircle />
                    <span>Clinically Validated</span>
                  </div>
                </div>
              </div>

              <div className={styles.heroVisual}>
                <div className={styles.brainContainer}>
                  <div className={styles.brainScan}>
                    <div className={styles.brainOutline}>
                      <div className={styles.neuralNetwork}>
                        {[...Array(20)].map((_, i) => (
                          <div
                            key={i}
                            className={styles.neuralNode}
                            style={{
                              animationDelay: `${i * 0.1}s`,
                              left: `${20 + (i % 4) * 20}%`,
                              top: `${20 + Math.floor(i / 4) * 15}%`
                            }}
                          />
                        ))}
                      </div>
                    </div>
                    <div className={styles.eegWaveform}>
                      <svg viewBox="0 0 400 100" className={styles.waveformSvg}>
                        <path
                          d="M0,50 Q100,20 200,50 T400,50"
                          fill="none"
                          stroke="url(#waveGradient)"
                          strokeWidth="2"
                          className={styles.wavePath}
                        />
                        <defs>
                          <linearGradient id="waveGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#3b82f6" />
                            <stop offset="50%" stopColor="#0891b2" />
                            <stop offset="100%" stopColor="#7c3aed" />
                          </linearGradient>
                        </defs>
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats Section */}
            <div className={styles.statsContainer}>
              {stats.map((stat, index) => (
                <div key={index} className={styles.statCard}>
                  <div className={styles.statIcon}>{stat.icon}</div>
                  <div className={styles.statNumber}>{stat.number}</div>
                  <div className={styles.statLabel}>{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className={styles.featuresSection}>
          <div className={styles.container}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                Powering the Future of <span className="gradient-text">Neural Diagnostics</span>
              </h2>
              <p className={styles.sectionDescription}>
                Our advanced AI platform combines cutting-edge machine learning with clinical expertise
                to deliver accurate, reliable Alzheimer's pattern detection.
              </p>
            </div>

            <div className={styles.featuresGrid}>
              {features.map((feature, index) => (
                <div
                  key={index}
                  className={`${styles.featureCard} ${activeFeature === index ? styles.active : ''}`}
                  onMouseEnter={() => setActiveFeature(index)}
                >
                  <div className={styles.featureIconContainer}>
                    {feature.icon}
                  </div>
                  <h3 className={styles.featureTitle}>{feature.title}</h3>
                  <p className={styles.featureDescription}>{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className={styles.processSection}>
          <div className={styles.container}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                Simple, <span className="gradient-text">Powerful</span>, Accurate
              </h2>
              <p className={styles.sectionDescription}>
                From upload to insights in minutes, with professional-grade analysis
              </p>
            </div>

            <div className={styles.processSteps}>
              <div className={styles.processStep}>
                <div className={styles.stepNumber}>01</div>
                <div className={styles.stepContent}>
                  <h3>Upload EEG Data</h3>
                  <p>Securely upload your .npy EEG files through our encrypted platform</p>
                </div>
              </div>

              <div className={styles.processArrow}>
                <FiArrowRight />
              </div>

              <div className={styles.processStep}>
                <div className={styles.stepNumber}>02</div>
                <div className={styles.stepContent}>
                  <h3>AI Analysis</h3>
                  <p>Our advanced deep learning algorithms process signals with sophisticated pattern recognition</p>
                </div>
              </div>

              <div className={styles.processArrow}>
                <FiArrowRight />
              </div>

              <div className={styles.processStep}>
                <div className={styles.stepNumber}>03</div>
                <div className={styles.stepContent}>
                  <h3>Detailed Reports</h3>
                  <p>Receive comprehensive analysis tailored to your professional role</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className={styles.ctaSection}>
          <div className={styles.container}>
            <div className={styles.ctaContent}>
              <h2 className={styles.ctaTitle}>
                Ready to Transform Neural Analysis?
              </h2>
              <p className={styles.ctaDescription}>
                Join thousands of healthcare professionals using AI4NEURO for
                accurate Alzheimer's pattern detection.
              </p>
              <button
                onClick={handleGetStarted}
                className={`${styles.ctaButton} btn btn-primary`}
              >
                <FiZap />
                Begin Analysis Now
                <FiArrowRight />
              </button>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
