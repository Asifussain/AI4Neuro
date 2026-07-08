import Navbar from '../components/Navbar';
import styles from '../styles/PageLayout.module.css'; 

export default function ServicePage() {
  return (
    <>
      <Navbar />
      <div className={styles.pageContainer}>
        <h1 className={styles.pageTitle}>Our AI-Powered Alzheimer's Detection Service</h1>
        
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Leveraging Advanced EEG Analysis</h2>
          <p className={styles.paragraph}>
            AI4NEURO utilizes state-of-the-art Artificial Intelligence and advanced deep learning models 
            to analyze Electroencephalogram (EEG) data. Our service aims to provide an accessible, non-invasive 
            method for early-stage Alzheimer's disease pattern detection.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>How It Works</h2>
          <ol className={styles.orderedList}>
            <li><strong>Secure Upload:</strong> Users securely upload their anonymized EEG data in `.npy` format through our platform.</li>
            <li><strong>AI Analysis:</strong> The uploaded data is processed by our advanced deep learning models, which analyze complex patterns and biomarkers associated with Alzheimer's disease.</li>
            <li><strong>Clear Results:</strong> We provide a clear indication based on the analysis – "Normal" or "Alzheimer Detected Pattern". Results are stored securely and accessible in your history.</li>
          </ol>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Key Benefits</h2>
          <ul className={styles.unorderedList}>
            <li><strong>Early Indication:</strong> Potentially aids in the early detection of patterns associated with Alzheimer's, facilitating timely consultation with healthcare professionals.</li>
            <li><strong>Non-Invasive:</strong> Analysis is based purely on EEG data, a non-invasive brain activity recording method.</li>
            <li><strong>AI-Driven Accuracy:</strong> Utilizes sophisticated deep learning models trained for EEG pattern recognition in Alzheimer's research contexts.</li>
            <li><strong>Secure & Private:</strong> We prioritize user data security and privacy, leveraging secure storage and handling practices.</li>
          </ul>
        </section>
        
        <section className={`${styles.section} ${styles.disclaimerSection}`}>
          <h2 className={styles.sectionTitle}>Important Disclaimer</h2>
          <p className={styles.paragraph}>
            AI4NEURO is an informational tool based on AI pattern recognition and is **not** a substitute for professional medical diagnosis. 
            The results provided indicate the presence of patterns that may be associated with Alzheimer's disease based on the model's training. 
            Always consult with a qualified healthcare provider for any health concerns or before making any decisions related to your health or treatment.
          </p>
        </section>
      </div>
    </>
  );
}