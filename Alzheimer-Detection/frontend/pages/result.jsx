import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import supabase from '../lib/supabaseClient';
import { useAuth } from '../components/AuthProvider';
import PageLayout from '../components/PageLayout'; 
import styles from '../styles/ReportPage.module.css'; 

const MetricCard = ({ label, value }) => (
    <div className={styles.metricCard}>
        <div className={styles.metricLabel}>{label}</div>
        <div className={styles.metricValue}>{value}</div>
    </div>
);

const ResultPage = () => {
    const router = useRouter();
    const { prediction_id } = router.query;
    const { profile } = useAuth();

    const [predictionData, setPredictionData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!prediction_id) { setIsLoading(false); setError("No analysis ID found."); return; }
        let pollingInterval;
        const fetchPrediction = async () => {
            const { data, error: dbError } = await supabase.from('predictions').select('*').eq('id', prediction_id).single();
            if (dbError && dbError.code !== 'PGRST116') {
                setError(`Failed to fetch data: ${dbError.message}`); setIsLoading(false); clearInterval(pollingInterval); return;
            }
            if (data) {
                setPredictionData(data);
                if (data.status?.startsWith('Completed') || data.status?.startsWith('Failed')) {
                    setIsLoading(false); clearInterval(pollingInterval);
                }
            }
        };
        fetchPrediction();
        pollingInterval = setInterval(fetchPrediction, 5000);
        return () => clearInterval(pollingInterval);
    }, [prediction_id]);

    const getRoleBasedReport = () => {
        if (!profile || !predictionData) return null;
        switch (profile.role) {
            case 'patient':
                return { url: predictionData.patient_pdf_url, label: 'Download Patient Report' };
            case 'doctor':
            case 'clinician':
                return { url: predictionData.technical_pdf_url, label: 'Download Technical Report' }; // Doctors see radiologist/technician reports
            case 'technician':
            case 'radiologist':
                return { url: predictionData.technical_pdf_url, label: 'Download Technical Report' };
            case 'admin':
                return { url: predictionData.technical_pdf_url, label: 'Download Full Report' };
            default:
                return null;
        }
    };

    const renderReportButton = () => {
        const report = getRoleBasedReport();
        if (!report || !report.url) return null;
        return (
            <a href={report.url} target="_blank" rel="noopener noreferrer" className={styles.downloadButton}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M7 10L12 15L17 10" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M12 15V3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                {report.label}
            </a>
        );
    };

    if (isLoading) {
        return (
            <PageLayout>
                <div className={styles.statusContainer}>
                    <div className={styles.loadingSpinner}></div>
                    <p className={styles.statusText}>Analysis in progress...</p>
                    <p className={styles.statusSubtext}>{predictionData ? `Status: ${predictionData.status}` : 'Initiating analysis...'}</p>
                </div>
            </PageLayout>
        );
    }

    if (error || !predictionData || predictionData.status?.startsWith('Failed')) {
        return (
            <PageLayout>
                <div className={styles.statusContainer}>
                    <h2 className={styles.errorTitle}>Analysis Failed</h2>
                    <p>{error || predictionData?.status}</p>
                    <Link href="/"><a className={styles.homeLink}>Back to Dashboard</a></Link>
                </div>
            </PageLayout>
        );
    }
    
    const { consistency_metrics: consistency, stats_data: stats } = predictionData;

    return (
        <PageLayout>
            <div className={styles.contentWrapper}>
                <button onClick={() => router.back()} className={styles.backButton}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="15 18 9 12 15 6"/>
                    </svg>
                    Back
                </button>
                <header className={styles.header}>
                    <div>
                        <h1 className={styles.title}>Comprehensive Analysis Report</h1>
                    </div>
                    {renderReportButton()}
                </header>

                <main>
                    <section className={styles.sectionCard}>
                        <h2 className={styles.sectionTitle}>Analysis Overview</h2>
                        <div className={styles.grid}>
                            <div className={styles.overviewItem}><span className={styles.overviewLabel}>Filename:</span> <span className={styles.overviewValue}>{predictionData.filename}</span></div>
                            <div className={styles.overviewItem}><span className={styles.overviewLabel}>Analyzed On:</span> <span className={styles.overviewValue}>{new Date(predictionData.created_at).toLocaleString()}</span></div>
                            <div className={styles.overviewItem}><span className={styles.overviewLabel}>AI Prediction:</span> <span className={styles.overviewValue}>{predictionData.prediction}</span></div>
                        </div>
                    </section>
                    
                    {consistency && (
                        <section className={styles.sectionCard}>
                            <h2 className={styles.sectionTitle}>Internal Consistency Metrics</h2>
                            <p className={styles.metricDescription}>These metrics evaluate the consistency of the AI's predictions across multiple segments of the input EEG data, using the AI's overall prediction for this file as the reference point.</p>
                            <div className={styles.metricsGrid}>
                                <MetricCard label="Accuracy" value={`${(consistency.accuracy * 100).toFixed(1)}%`} />
                                <MetricCard label="Precision (AD)" value={Number(consistency.precision).toFixed(3)} />
                                <MetricCard label="Recall (AD)" value={Number(consistency.recall_sensitivity).toFixed(3)} />
                                <MetricCard label="Specificity (CN)" value={Number(consistency.specificity).toFixed(3)} />
                                <MetricCard label="F1-Score" value={Number(consistency.f1_score).toFixed(3)} />
                            </div>
                        </section>
                    )}

                    {stats && stats.relative_band_powers && stats.standard_deviations && (
                        <section className={styles.sectionCard}>
                            <h2 className={styles.sectionTitle}>Descriptive Statistics</h2>
                            <div className={styles.statsGrid}>
                                <div>
                                    <h3>Relative Band Power (%)</h3>
                                    <ul className={styles.statsList}>
                                        <li><span className={styles.statsLabel}>Delta</span> <span className={styles.statsValue}>{(stats.relative_band_powers.delta * 100).toFixed(1)}%</span></li>
                                        <li><span className={styles.statsLabel}>Theta</span> <span className={styles.statsValue}>{(stats.relative_band_powers.theta * 100).toFixed(1)}%</span></li>
                                        <li><span className={styles.statsLabel}>Alpha</span> <span className={styles.statsValue}>{(stats.relative_band_powers.alpha * 100).toFixed(1)}%</span></li>
                                        <li><span className={styles.statsLabel}>Beta</span> <span className={styles.statsValue}>{(stats.relative_band_powers.beta * 100).toFixed(1)}%</span></li>
                                        <li><span className={styles.statsLabel}>Gamma</span> <span className={styles.statsValue}>{(stats.relative_band_powers.gamma * 100).toFixed(1)}%</span></li>
                                    </ul>
                                </div>
                                <div>
                                    <h3>Standard Deviation per Channel (µV)</h3>
                                    <p className={styles.stdDevValue}>{stats.standard_deviations.map(sd => sd.toFixed(2)).join(', ')}</p>
                                </div>
                            </div>
                        </section>
                    )}

                    <section className={styles.sectionCard}>
                        <h2 className={styles.sectionTitle}>Visualizations</h2>
                        {predictionData.similarity_plot_url && <div className={styles.plotContainer}><img src={predictionData.similarity_plot_url} alt="Similarity Analysis"/></div>}
                        {predictionData.timeseries_plot_url && <div className={styles.plotContainer}><img src={predictionData.timeseries_plot_url} alt="Time Series"/></div>}
                        {predictionData.psd_plot_url && <div className={styles.plotContainer}><img src={predictionData.psd_plot_url} alt="Power Spectrum"/></div>}
                    </section>
                </main>
            </div>
        </PageLayout>
    );
};

export default ResultPage;
