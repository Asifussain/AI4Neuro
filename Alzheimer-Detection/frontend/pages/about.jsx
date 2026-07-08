import Navbar from '../components/Navbar';
import styles from '../styles/PageLayout.module.css';

export default function AboutPage() {
  return (
    <>
      <Navbar />
      <div className={styles.pageContainer}>
        <h1 className={styles.pageTitle}>About AI4NEURO</h1>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Our Mission</h2>
          <p className={styles.paragraph}>
            Our mission is to harness the power of Artificial Intelligence and EEG analysis to contribute 
            to the early detection of Alzheimer's disease patterns. We aim to provide a valuable tool 
            for individuals and researchers, facilitating awareness and potentially enabling earlier 
            medical consultations.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Understanding Alzheimer's Disease</h2>
          <p className={styles.paragraph}>
            Alzheimer's disease is a progressive neurodegenerative disorder that affects memory, thinking, 
            and behavior. It's the most common cause of dementia, accounting for 60-80% of all dementia cases. 
            The disease typically begins with mild memory loss and can progress to severe cognitive impairment, 
            affecting daily activities and quality of life.
          </p>
          <p className={styles.paragraph}>
            Early detection is crucial for effective management and treatment planning. Traditional diagnosis 
            often requires expensive and invasive procedures. Our AI-powered EEG analysis offers a non-invasive, 
            accessible approach to identify patterns that may indicate early-stage Alzheimer's disease, 
            enabling timely intervention and better outcomes for patients and families.
          </p>
          <p className={styles.paragraph}>
            The brain's electrical activity, captured through EEG recordings, shows distinct patterns 
            in Alzheimer's patients. Our advanced machine learning algorithms can detect these subtle 
            changes, providing valuable insights for healthcare professionals and researchers.
          </p>
        </section>

         <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Data Privacy & Security</h2>
          <p className={styles.paragraph}>
            Your privacy and data security are our top priorities. We implement enterprise-grade security 
            measures to protect all medical and personal information. All data is encrypted both in transit 
            and at rest, ensuring your sensitive health information remains confidential and secure.
          </p>
          <p className={styles.paragraph}>
            Our platform follows strict HIPAA compliance guidelines and industry best practices for 
            healthcare data management. EEG files are processed using secure, isolated computing environments, 
            and all analysis results are stored with advanced encryption. Only authorized healthcare 
            professionals within your organization can access your data.
          </p>
          <p className={styles.paragraph}>
            We maintain detailed audit logs of all data access and processing activities. Your data 
            is never shared with third parties without explicit consent, and you maintain full control 
            over your information with the ability to request data deletion at any time.
          </p>
        </section>
      </div>
    </>
  );
}
