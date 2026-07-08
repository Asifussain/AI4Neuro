import React, { useState, useEffect, useRef } from 'react';
import supabase from '../lib/supabaseClient';
import LoadingSpinner from './LoadingSpinner';
import styles from '../styles/ReportViewer.module.css';
import pageStyles from '../styles/PageLayout.module.css';
import { useAuth } from './AuthProvider';
import { FiDownload, FiActivity, FiCheckCircle, FiAlertTriangle, FiBarChart2, FiTarget, FiZap, FiCompass, FiHash, FiMessageSquare, FiInfo, FiCpu, FiShield, FiThumbsUp, FiFileText, FiEye, FiCalendar, FiBarChart } from 'react-icons/fi';

const formatMetric = (value, type = 'float', precision = 1) => {
    if (value === null || value === undefined || isNaN(value)) return 'N/A';
    if (type === 'percent') return `${(Number(value) * 100).toFixed(precision)}%`;
    if (type === 'float') return Number(value).toFixed(precision);
    return String(value);
};

const MetricItem = ({ icon, label, value, unit = '', description = '', variant = 'technical', highlightValue = false }) => (
    <div className={styles.metricItem} style={{
        backgroundColor: variant === 'patient' ? 'rgba(74, 144, 226, 0.07)' : 'rgba(50, 50, 70, 0.5)',
        borderLeft: variant === 'patient' ? '4px solid var(--primary-blue)' : '4px solid var(--accent-teal)',
        padding: variant === 'patient' ? '0.8rem 1rem' : '1rem 1.2rem',
        marginBottom: variant === 'patient' ? '0.75rem': '1rem',
    }}>
        <div className={styles.metricIconLabel}>
            {icon && React.createElement(icon, { className: styles.metricIcon, style: { color: variant === 'patient' ? 'var(--primary-blue)' : 'var(--accent-teal)' } })}
            <span className={styles.metricLabel} style={{color: variant === 'patient' ? 'var(--text-heading)' : '#e0e0e0', fontWeight: variant === 'patient' ? '500' : 'normal', fontSize: variant === 'patient' ? '0.9rem' : '0.9rem'}}>{label}</span>
        </div>
        <span className={styles.metricValue} style={{
            color: highlightValue ? (String(value).includes("Alzheimer") ? 'var(--error-color)' : 'var(--success-color)') : (variant === 'patient' ? 'var(--primary-blue)' : '#fff'),
            fontSize: variant === 'patient' ? '1.3rem' : '1.6rem',
            fontWeight: variant === 'patient' ? '600' : '600'
            }}>{value}{unit}</span>
        {description && <span className={styles.metricDescription} style={{color: variant === 'patient' ? 'var(--text-secondary)' : '#a0a0b0', fontSize: variant === 'patient' ? '0.75rem' : '0.8rem'}}>{description}</span>}
    </div>
);

export default function ReportViewer({ predictionId }) {
  const { profile, isLoading: authLoading } = useAuth();
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const isMounted = useRef(false);
  const userRole = profile?.role;

  useEffect(() => { isMounted.current = true; return () => { isMounted.current = false; }; }, []);

  useEffect(() => {
    if (authLoading) return;
    isMounted.current && (setReportData(null), setLoading(true), setError(null));
    if (!predictionId) { isMounted.current && (setLoading(false), setError("No prediction ID provided.")); return; }
    if (!userRole && !authLoading) { isMounted.current && (setLoading(false), setError("User role not determined.")); return; }

    let currentFetchId = predictionId;
    const fetchReportRecord = async () => {
        try {
            const { data, error: dbError } = await supabase.from('predictions').select('*').eq('id', predictionId).maybeSingle();
            if (!isMounted.current || currentFetchId !== predictionId) return;
            if (dbError) throw new Error(`DB fetch failed: ${dbError.message}`);
            if (!data) { setError(`Report record not found.`); setLoading(false); return; }
            setReportData(data); setError(null);
        } catch (err) {
            console.error("Error fetching report record:", err);
            if (isMounted.current && currentFetchId === predictionId) setError(err.message);
        } finally {
            if (isMounted.current && currentFetchId === predictionId) setLoading(false);
        }
    };
    if (userRole) fetchReportRecord();
  }, [predictionId, userRole, authLoading]);

  if (loading || authLoading) return <div className={styles.loadingContainer}><LoadingSpinner /> <p>Loading Report Details...</p></div>;
  if (error) return <div className={styles.errorContainer}>Error: {error}</div>;
  if (!reportData) return <div className={styles.container}><p>No report data found for this ID.</p></div>;

  const {
      filename, created_at, prediction, probabilities,
      stats_data, timeseries_plot_url, psd_plot_url,
      technical_pdf_url, patient_pdf_url, clinician_pdf_url,
      similarity_results, similarity_plot_url, consistency_metrics
  } = reportData;

  let displayPdfUrl;
  let downloadFilename;
  let reportTypeString;

  if (userRole === 'patient') {
    displayPdfUrl = patient_pdf_url;
    downloadFilename = `Patient_Report_${filename || predictionId}.pdf`;
    reportTypeString = 'Patient Report';
  } else if (userRole === 'technician' || userRole === 'radiologist') {
    displayPdfUrl = technical_pdf_url;
    downloadFilename = `Technical_Report_${filename || predictionId}.pdf`;
    reportTypeString = 'Technical Report';
  } else if (userRole === 'clinician' || userRole === 'doctor') {
    displayPdfUrl = clinician_pdf_url;
    downloadFilename = `Clinical_Report_${filename || predictionId}.pdf`;
    reportTypeString = 'Clinical Report';
  } else if (userRole === 'admin') {
    // Admins can see all three reports - default to technical
    displayPdfUrl = technical_pdf_url;
    downloadFilename = `Full_Report_${filename || predictionId}.pdf`;
    reportTypeString = 'Full Report';
  } else {
    displayPdfUrl = technical_pdf_url;
    downloadFilename = `Report_${filename || predictionId}.pdf`;
    reportTypeString = 'Report';
    console.warn(`ReportViewer: Unknown user role ${userRole}, defaulting to technical PDF.`);
  }

  if (!displayPdfUrl) {
    console.warn(`ReportViewer: PDF URL missing for prediction ${predictionId}, role ${userRole}.`);
  }

  const formattedProbs = () => {
    if (!probabilities || typeof probabilities !== 'object') return 'N/A';
    if (Array.isArray(probabilities) && probabilities.length === 2) {
      return `Normal: ${formatMetric(probabilities[0], 'percent')}, Alzheimer's Pattern: ${formatMetric(probabilities[1], 'percent')}`;
    }
    if (probabilities.Normal !== undefined && probabilities["Alzheimer's"] !== undefined) {
        return `Normal: ${formatMetric(probabilities.Normal, 'percent')}, Alzheimer's Pattern: ${formatMetric(probabilities["Alzheimer's"], 'percent')}`;
    }
    return 'N/A';
  };
  const createdDate = created_at ? new Date(created_at).toLocaleString() : 'N/A';
  const createdDateShort = created_at ? new Date(created_at).toLocaleDateString() : 'N/A';

  if (userRole === 'patient') {
    const mainPredictionText = prediction === "Alzheimer's" ? "Patterns Suggestive of Alzheimer's Characteristics" : "Normal Brainwave Patterns Observed";
    let confidenceValue = "N/A";
    if (probabilities && Array.isArray(probabilities) && probabilities.length === 2) {
        const confVal = prediction === "Alzheimer's" ? probabilities[1] : probabilities[0];
        confidenceValue = formatMetric(confVal, 'percent');
    }
    const showPatientConsistency = consistency_metrics && !consistency_metrics.error && typeof consistency_metrics.num_trials === 'number' && consistency_metrics.num_trials > 0;
    return (
        <div className={`${styles.container} ${styles.patientReportContainer}`}>
            <div className={styles.reportHeader}>
                <h2 className={pageStyles.pageTitle} style={{textAlign: 'left', borderBottom: 'none', marginBottom: '0.5rem', color: 'var(--text-heading)'}}>Your AI EEG Pattern Report</h2>
                {displayPdfUrl ? (
                    <a href={displayPdfUrl} download={downloadFilename} className={`${styles.downloadButton} ${styles.patientDownloadButton}`} target="_blank" rel="noopener noreferrer">
                        <FiDownload /> Download {reportTypeString}
                    </a>
                ) : (
                    <p className={styles.errorTextSmall} style={{textAlign:'right', color: 'var(--error-color)'}}>PDF Report Not Available.</p>
                )}
            </div>
            <hr className={styles.sectionSeparator}/>
            <section className={styles.patientSection}>
                <h3 className={styles.patientSectionTitle}><FiInfo style={{marginRight: '8px'}}/>Analysis Summary</h3>
                <div className={styles.infoGridAlt}>
                    <div><strong>File Analyzed:</strong><span>{filename || 'N/A'}</span></div>
                    <div><strong>Date of Analysis:</strong><span>{created_at ? new Date(created_at).toLocaleDateString() : 'N/A'}</span></div>
                </div>
            </section>
            <hr className={styles.sectionSeparator}/>
            <section className={styles.patientSection}>
                <h3 className={styles.patientSectionTitle}><FiCpu style={{marginRight: '8px'}}/>AI Pattern Assessment</h3>
                <div className={styles.predictionSummary} style={{padding:'1.5rem', borderRadius:'8px', backgroundColor: 'var(--card-bg)'}}>
                    <h4 className={styles.patientSubHeading}>AI's Main Finding:</h4>
                    <p className={`${styles.mainPredictionValue} ${prediction === "Alzheimer's" ? styles.predictionAlz : styles.predictionNorm}`}
                        style={{fontWeight: '700', fontSize: '1.7rem', padding: '0.75rem', borderRadius:'6px', textAlign:'center',
                        backgroundColor: prediction === "Alzheimer's" ? 'rgba(200, 50, 50, 0.15)' : 'rgba(46, 204, 113, 0.15)',
                        border: `1px solid ${prediction === "Alzheimer's" ? 'rgba(200, 50, 50, 0.3)' : 'rgba(30, 150, 80, 0.3)'}`
                        }}>
                        {mainPredictionText}
                    </p>
                    <h4 className={styles.patientSubHeading} style={{marginTop:'1.5rem'}}>AI Confidence:</h4>
                    <p className={styles.technicalDetail} style={{fontSize: '1rem', color:'var(--text-primary)'}}>
                        The AI is <strong style={{color: prediction === "Alzheimer's" ? 'var(--error-color)' : 'var(--success-color)'}}>{confidenceValue}</strong> confident its finding aligns with the pattern category mentioned above (based on the first segment of your EEG data).
                    </p>
                </div>
                <div className={styles.patientExplanationBlock} style={{marginTop:'1.2rem'}}>
                    <FiMessageSquare className={styles.patientExplanationIcon} />
                    <div className={styles.patientExplanationContent}>
                        <h4 style={{fontWeight:'600'}}>Understanding Your Result</h4>
                        <p>The AI system analyzed patterns in your EEG (brainwave) data. This finding indicates whether these patterns are more similar to those typically associated with Alzheimer's characteristics or with normal brainwave activity, based on data the AI was trained on.</p>
                    </div>
                </div>
            </section>
            <hr className={styles.sectionSeparator}/>
            {showPatientConsistency && (
            <section className={styles.patientSection}>
                <h3 className={styles.patientSectionTitle}><FiCheckCircle style={{marginRight: '8px'}}/>AI's Internal Consistency Check</h3>
                <p className={styles.patientIntroText} style={{marginBottom:'1rem'}}>
                    To double-check its work, the AI looked at {consistency_metrics.num_trials} smaller pieces (segments) of your EEG data. Here's how consistent it was for your sample:
                </p>
                <div className={styles.metricsGridSimple} style={{gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))'}}>
                    <MetricItem variant="patient" icon={FiZap} label="Overall Consistency" value={formatMetric(consistency_metrics.accuracy, 'percent',0)} description="How often segment checks matched the main finding."/>
                    <MetricItem variant="patient" icon={FiHash} label="Segments Checked" value={String(consistency_metrics.num_trials)} description="Number of small EEG pieces the AI checked."/>
                    {prediction === "Alzheimer's" ? (
                    <>
                        <MetricItem variant="patient" icon={FiTarget} label="Finding Alzheimer's-like Patterns" value={formatMetric(consistency_metrics.recall_sensitivity, 'percent',0)} description="How often AI found these patterns if present in segments."/>
                        <MetricItem variant="patient" icon={FiThumbsUp} label="Confirming Alzheimer's-like Patterns" value={formatMetric(consistency_metrics.precision, 'percent',0)} description="When AI ID'd a segment as Alzheimer's-like, how often it matched the main finding."/>
                        <MetricItem variant="patient" icon={FiZap} label="Balanced Score (Alzheimer's)" value={formatMetric(consistency_metrics.f1_score, 'float',2)} description="Combined score (0-1) for finding & confirming Alz-like patterns." />
                    </>
                    ) : (
                    <MetricItem variant="patient" icon={FiShield} label="Finding Normal Patterns" value={formatMetric(consistency_metrics.specificity, 'percent',0)} description="How often AI found Normal patterns if present in segments."/>
                    )}
                </div>
                <div className={styles.patientExplanationBlock} style={{marginTop: '1.5rem'}}>
                    <FiMessageSquare className={styles.patientExplanationIcon} />
                    <div className={styles.patientExplanationContent}>
                        <h4 style={{fontWeight:'600'}}>What These Scores Mean</h4>
                        <p>Higher percentages and scores generally suggest the AI's main finding was consistently observed across different parts of your EEG sample. This is an internal quality check for this specific analysis.</p>
                    </div>
                </div>
            </section>
            )}
            <hr className={styles.sectionSeparator}/>
            {similarity_plot_url && similarity_results && !similarity_results.error && (
            <section className={styles.patientSection}>
                <h3 className={styles.patientSectionTitle}><FiActivity style={{marginRight: '8px'}}/>Comparing Your Brainwave Shape (from Channel {similarity_results.plotted_channel_index !== undefined ? similarity_results.plotted_channel_index + 1 : 'Selected'})</h3>
                <img src={similarity_plot_url} alt={`Signal Shape Comparison Plot`} className={styles.plotImage} style={{border: '1px solid var(--border-color)', borderRadius: '8px', marginTop: '1rem', marginBottom:'1rem'}}/>
                <div className={styles.patientExplanationBlock}>
                    <FiMessageSquare className={styles.patientExplanationIcon} />
                    <div className={styles.patientExplanationContent}>
                        <h4 style={{fontWeight:'600'}}>Understanding This Graph</h4>
                        <p>This graph shows an electrical activity pattern from one of your EEG channels (the <strong>white line</strong>, "Your Sample"). It's compared to typical reference patterns for 'Normal' (blue dashed line) and 'Alzheimer's' (red dotted line).</p>
                        <ul className={styles.patientList}>
                            <li>The AI measures how closely the shape of your brainwave activity on this channel, and others not shown here, matches these references.</li>
                            {similarity_results.interpretation && <li dangerouslySetInnerHTML={{__html: "<strong>Overall Finding from Shape Comparison:</strong> " + similarity_results.interpretation.split("Disclaimer:")[0].replace("Similarity Analysis (DTW):", "").replace("Overall Assessment:", "").trim()}}></li>}
                        </ul>
                    </div>
                </div>
            </section>
            )}
            <hr className={styles.sectionSeparator}/>
            <section className={`${styles.patientFinalNote}`} style={{backgroundColor:'rgba(255, 245, 230, 0.95)', border:'1px solid #e67e22', borderRadius:'8px', padding:'1.2rem'}}>
                <FiAlertTriangle size={36} style={{ color: '#d35400', flexShrink: 0, marginRight:'1rem', marginTop:'0.1rem' }} />
                <div>
                    <h4 style={{color:'#b45309', fontSize:'1.1rem', fontWeight:'700', marginBottom:'0.4rem'}}>Important: Next Steps & Disclaimer</h4>
                    <p style={{color: '#654321', lineHeight: '1.55', fontSize:'0.88rem'}}>
                        This AI report is for informational purposes and is <strong>NOT a medical diagnosis</strong>.
                        Diagnosis requires a comprehensive evaluation by a qualified healthcare professional.
                        Please <strong>share this report with your doctor</strong> to discuss the findings in context of your health.
                    </p>
                </div>
            </section>
        </div>
    );
  }
  else if (userRole === 'clinician') {
    const clinicianPredictionText = prediction === "Alzheimer's" ? "Pattern Suggestive of Alzheimer's-related Changes" : "Normal EEG Pattern";

    let consistencySummary = "N/A";
    let consistencyDetails = "";
    if (consistency_metrics) {
        if (consistency_metrics.error) {
            consistencySummary = `Error: ${consistency_metrics.error}`;
        } else if (consistency_metrics.message) {
            consistencySummary = consistency_metrics.message;
        } else if (typeof consistency_metrics.num_trials === 'number' && consistency_metrics.num_trials > 0) {
            const accuracy = consistency_metrics.accuracy;
            if (accuracy >= 0.85) consistencySummary = "High";
            else if (accuracy >= 0.70) consistencySummary = "Moderate";
            else consistencySummary = "Low";
            consistencyDetails = `(Overall segment agreement: ${formatMetric(accuracy, 'percent', 0)} across ${consistency_metrics.num_trials} segments)`;
        } else {
            consistencySummary = "Consistency metrics not calculated or not applicable.";
        }
    }

    return (
        <div className={styles.container}>
            <div className={styles.reportHeader} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem'}}>
                <h2 className={styles.title} style={{borderBottom:'none', margin:0}}>Clinician AI EEG Report</h2>
                {displayPdfUrl ? (
                    <a href={displayPdfUrl} download={downloadFilename} className={`${styles.downloadButton} ${styles.clinicianDownloadButton}`} target="_blank" rel="noopener noreferrer">
                        <FiDownload style={{marginRight:'5px'}}/> Download {reportTypeString}
                    </a>
                ) : (
                    <p className={styles.errorTextSmall} style={{textAlign:'right', color: 'var(--error-color)'}}>PDF Report Not Available.</p>
                )}
            </div>
            <hr className={styles.sectionSeparator}/>

            <section className={styles.section}>
                <h3 className={styles.sectionTitle}><FiInfo /> Analysis Overview</h3>
                <div className={styles.infoGridSimple}>
                    <p><strong>File Analyzed:</strong> {filename || 'N/A'}</p>
                    <p><strong>Date of Analysis:</strong> {createdDateShort}</p>
                </div>
            </section>
            <hr className={styles.sectionSeparator}/>

            <section className={styles.section}>
                <h3 className={styles.sectionTitle}><FiCpu /> AI Assessment</h3>
                <div className={styles.infoGridSimple}>
                    <p><strong>Primary AI Finding:</strong> <span className={prediction === "Alzheimer's" ? styles.predictionAlz : styles.predictionNorm}>{clinicianPredictionText}</span></p>
                    <p><strong>Assessment Confidence:</strong> {formattedProbs()}</p>
                    <p><strong>Finding Consistency:</strong> {consistencySummary} {consistencyDetails && <span style={{fontSize: '0.8em', color: 'var(--text-secondary)'}}>{consistencyDetails}</span>}</p>
                </div>
            </section>
            <hr className={styles.sectionSeparator}/>

            { (similarity_results || similarity_plot_url) &&
                <section className={styles.section}>
                    <h3 className={styles.sectionTitle}><FiCompass/> EEG Waveform Characteristics</h3>
                    {similarity_results && !similarity_results.error && similarity_results.interpretation &&
                        <div className={styles.interpretationBlock} style={{marginBottom:'1rem', padding:'0.8rem', backgroundColor:'var(--background-alt)', border:'1px solid var(--border-color-extra-light)'}}>
                            <h4 style={{marginTop:0, marginBottom:'0.5rem', fontSize:'0.95rem', color: 'var(--text-heading)'}}>Interpretation:</h4>
                            <pre className={styles.interpretationText}>{similarity_results.interpretation.replace("Similarity Analysis (DTW):", "").trim()}</pre>
                        </div>
                    }
                    {similarity_plot_url &&
                        <div className={styles.plotContainer}>
                            <h4 style={{marginTop:0, marginBottom:'0.5rem', fontSize:'0.95rem', color: 'var(--text-heading)'}}>
                                Illustrative Comparison (Channel {similarity_results?.plotted_channel_index !== undefined ? similarity_results.plotted_channel_index + 1 : 'Selected'})
                            </h4>
                            <img src={similarity_plot_url} alt="Signal Shape Comparison Plot" className={styles.plotImage}/>
                        </div>
                    }
                    {similarity_results?.error && <p className={styles.errorTextSmall}>(Similarity analysis error: {similarity_results.error})</p>}
                </section>
            }
            { (similarity_results || similarity_plot_url) && <hr className={styles.sectionSeparator}/>}

            {stats_data && !stats_data.error && stats_data.avg_band_power && Object.keys(stats_data.avg_band_power).length > 0 &&
                <section className={styles.section}>
                    <h3 className={styles.sectionTitle}><FiBarChart /> Brainwave Frequency Profile</h3>
                    <h4 style={{marginTop:0, marginBottom:'0.5rem', fontSize:'0.95rem', color: 'var(--text-heading)'}}>Average Relative Band Power (%):</h4>
                    <ul className={styles.bandPowerList}>
                        {Object.entries(stats_data.avg_band_power).map(([band, power]) => (
                            <li key={band}><strong>{band.charAt(0).toUpperCase() + band.slice(1)}:</strong> {formatMetric(power?.relative, 'percent') || 'N/A'}</li>
                        ))}
                    </ul>
                </section>
            }
            {stats_data && !stats_data.error && stats_data.avg_band_power && Object.keys(stats_data.avg_band_power).length > 0 && <hr className={styles.sectionSeparator}/>}

            {(timeseries_plot_url || psd_plot_url) &&
                <section className={styles.section}>
                    <h3 className={styles.sectionTitle}><FiEye/> EEG Visualizations</h3>
                    {timeseries_plot_url &&
                        <div className={styles.plotContainer}>
                            <h4 style={{marginTop:0, marginBottom:'0.5rem', fontSize:'0.95rem', color: 'var(--text-heading)'}}>Selected EEG Traces</h4>
                            <img src={timeseries_plot_url} alt="Stacked EEG Time Series Plot" className={styles.plotImage}/>
                        </div>
                    }
                    {!timeseries_plot_url && <p className={styles.loadingTextSmall}>(Time series plot not available)</p>}

                    {psd_plot_url &&
                        <div className={styles.plotContainer} style={{marginTop: timeseries_plot_url ? '1.5rem':'0'}}>
                            <h4 style={{marginTop:0, marginBottom:'0.5rem', fontSize:'0.95rem', color: 'var(--text-heading)'}}>Overall Frequency Spectrum (PSD)</h4>
                            <img src={psd_plot_url} alt="Average PSD Plot" className={styles.plotImage}/>
                        </div>
                    }
                    {!psd_plot_url && <p className={styles.loadingTextSmall}>(PSD plot not available)</p>}
                </section>
            }
            {(timeseries_plot_url || psd_plot_url) && <hr className={styles.sectionSeparator}/>}

            <div className={styles.disclaimer} style={{marginTop:'2rem', textAlign:'center', padding:'1rem', backgroundColor:'rgba(var(--text-secondary-rgb),0.05)', borderRadius:'var(--border-radius)'}}>
                <FiAlertTriangle style={{ marginRight: '8px', color:'var(--text-secondary)', verticalAlign:'middle' }} />
                <span style={{color:'var(--text-secondary)', fontSize:'0.85rem'}}>This AI report is a decision-support tool. Interpret in conjunction with full clinical assessment. Not a standalone diagnosis.</span>
            </div>
        </div>
    );
  }
  else if (userRole === 'technician') {
    const consistencyError = consistency_metrics?.error;
    const consistencyMessage = consistency_metrics?.message;
    const showConsistencyMetrics = consistency_metrics && !consistencyError && !consistencyMessage && typeof consistency_metrics.num_trials === 'number' && consistency_metrics.num_trials > 0;

    return (
    <div className={styles.container}>
            <div className={styles.reportHeader} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem'}}>
                <h2 className={styles.title} style={{borderBottom:'none', margin:0}}>Comprehensive Analysis Report</h2>
                {displayPdfUrl ? (
                    <a href={displayPdfUrl} download={downloadFilename} className={styles.downloadButton} target="_blank" rel="noopener noreferrer">
                        <FiDownload style={{marginRight:'5px'}}/> Download {reportTypeString}
                    </a>
                ) : (
                    <p className={styles.errorTextSmall} style={{textAlign:'right', color: 'var(--error-color)'}}>PDF Report Not Available.</p>
                )}
            </div>
            <hr className={styles.sectionSeparator}/>
            <section className={styles.section}>
                <h3 className={styles.sectionTitle}><FiInfo /> Analysis Overview</h3>
                <div className={styles.infoGrid}>
                    <div><strong>Filename:</strong> {filename || 'N/A'}</div>
                    <div><strong>Analyzed On:</strong> {createdDate}</div>
                    <div><strong>AI Prediction:</strong> <span className={prediction === "Alzheimer's" ? styles.predictionAlz : styles.predictionNorm}>{prediction || 'N/A'}</span></div>
                    <div><strong>Confidence (Initial Segment):</strong> {formattedProbs()}</div>
                </div>
            </section>
            <hr className={styles.sectionSeparator}/>
            <section className={styles.section}>
                <h3 className={styles.sectionTitle}><FiTarget /> Internal Consistency Metrics</h3>
                <p className={styles.metricsDisclaimer}>
                    These metrics evaluate the consistency of the AI's predictions across multiple segments of the input EEG data, using the AI's overall prediction for this file as the reference point. They reflect model stability on this sample, not diagnostic accuracy against external ground truth.
                    Calculated using {consistency_metrics?.num_trials || 'N/A'} segments.
                </p>
                {showConsistencyMetrics ? (
                <>
                    <div className={styles.metricsGrid}>
                        <MetricItem icon={FiZap} label="Accuracy" value={formatMetric(consistency_metrics.accuracy, 'percent')} description="Overall segment agreement" />
                        <MetricItem icon={FiCheckCircle} label="Precision (Alzheimer's)" value={formatMetric(consistency_metrics.precision, 'float', 3)} description="TP / (TP + FP) for Alzheimer's class" />
                        <MetricItem icon={FiActivity} label="Recall/Sensitivity (Alzheimer's)" value={formatMetric(consistency_metrics.recall_sensitivity, 'float', 3)} description="TP / (TP + FN) for Alzheimer's class" />
                        <MetricItem icon={FiShield} label="Specificity (Normal)" value={formatMetric(consistency_metrics.specificity, 'float', 3)} description="TN / (TN + FP) for Normal class" />
                        <MetricItem icon={FiBarChart2} label="F1-Score (Alzheimer's)" value={formatMetric(consistency_metrics.f1_score, 'float', 3)} description="Harmonic mean of Precision & Recall" />
                        <MetricItem icon={FiHash} label="Segments Analyzed" value={String(consistency_metrics.num_trials)} description="Number of EEG segments processed" />
                    </div>
                    <div className={styles.confusionMatrix}>
                        <span>Confusion Matrix (Ref: '{prediction === "Alzheimer's" ? "Alzheimer's" : "Normal"}'):</span>
                        <span>TP: {consistency_metrics.true_positives ?? '?'}</span>|
                        <span>TN: {consistency_metrics.true_negatives ?? '?'}</span>|
                        <span>FP: {consistency_metrics.false_positives ?? '?'}</span>|
                        <span>FN: {consistency_metrics.false_negatives ?? '?'}</span>
                    </div>
                </>
                ) : consistencyMessage ? (
                    <p className={styles.loadingTextSmall}>({consistencyMessage})</p>
                ) : consistencyError ? (
                    <p className={styles.errorTextSmall}>(Error: {consistencyError})</p>
                ) : (
                    <p className={styles.loadingTextSmall}>(Internal consistency metrics not applicable or not calculated for this sample.)</p>
                )}
            </section>
            <hr className={styles.sectionSeparator}/>
            <section className={styles.section}>
                <h3 className={styles.sectionTitle}><FiCompass/> Signal Shape Similarity (DTW)</h3>
                {similarity_results && !similarity_results.error ? (<>
                    <div className={styles.patientExplanationBlock} style={{borderColor:'var(--primary-blue)', backgroundColor: 'rgba(var(--primary-blue-rgb), 0.03)'}}>
                            <FiMessageSquare className={styles.patientExplanationIcon} style={{color:'var(--primary-blue)'}} />
                        <div className={styles.patientExplanationContent}>
                            <h4 style={{color: 'var(--primary-blue)'}}>Interpretation from DTW Analysis</h4>
                            <pre className={styles.interpretationText} style={{whiteSpace:'pre-wrap', fontFamily:'var(--font-body)', color: 'var(--text-primary)'}}> {similarity_results.interpretation || "Similarity analysis interpretation not available."} </pre>
                        </div>
                    </div>
                    {similarity_plot_url &&
                        <div className={styles.plotContainer} style={{marginTop:'1.5rem'}}>
                            <h4>Channel {similarity_results.plotted_channel_index !== undefined ? similarity_results.plotted_channel_index + 1 : '?'} Comparison Plot</h4>
                            <img src={similarity_plot_url} alt={`Signal Shape Comparison Plot`} className={styles.plotImage}/>
                        </div>
                    }
                </>) : <p className={styles.errorTextSmall}>(Similarity analysis error: {similarity_results?.error || 'data not available'})</p>}
            </section>
            <hr className={styles.sectionSeparator}/>
            <section className={styles.section}>
                <h3 className={styles.sectionTitle}><FiBarChart2 /> Descriptive Statistics</h3>
                {stats_data && !stats_data.error && stats_data.avg_band_power ? (
                <div className={styles.statsBlock}>
                    <h4 style={{color:'var(--text-heading)', marginBottom:'0.75rem'}}>Average Relative Band Power (%):</h4>
                    <ul style={{listStyle:'none', paddingLeft:0, columns: 2, columnGap:'20px', WebkitColumns: 2, MozColumns:2}}> {Object.entries(stats_data.avg_band_power).map(([band, power]) => (<li key={band} style={{marginBottom:'0.5rem', fontSize:'0.9rem'}}><strong style={{color:'var(--accent-teal)'}}>{band.charAt(0).toUpperCase() + band.slice(1)}:</strong> <span style={{color:'var(--text-primary)'}}>{formatMetric(power?.relative, 'percent') || 'N/A'}</span></li> ))} </ul>
                    {stats_data.std_dev_per_channel && userRole !== 'patient' && (
                        <>
                            <h4 style={{marginTop:'1.5rem', color:'var(--text-heading)', marginBottom:'0.5rem'}}>Standard Deviation per Channel (µV):</h4>
                            <p className={styles.smallText} style={{wordBreak:'break-all', color:'var(--text-secondary)', lineHeight:'1.6'}}>{stats_data.std_dev_per_channel.map(v => formatMetric(v, 'float', 2)).join(', ')}</p>
                        </>
                    )}
                </div>
                ) : <p className={styles.errorTextSmall}>(Statistics error: {stats_data?.error || 'data not available'})</p>}
            </section>
            <hr className={styles.sectionSeparator}/>
            <section className={styles.section}>
                <h3 className={styles.sectionTitle}><FiActivity/> Standard Visualizations</h3>
                {timeseries_plot_url &&
                    <div className={styles.plotContainer}> <h4 style={{color:'var(--text-heading)'}}>Stacked Time Series</h4> <img src={timeseries_plot_url} alt="Stacked EEG Time Series Plot" className={styles.plotImage}/> </div>
                }
                {!timeseries_plot_url && <p className={styles.loadingTextSmall}>(Time series plot not available)</p>}

                {psd_plot_url &&
                    <div className={styles.plotContainer} style={{marginTop:'1.5rem'}}> <h4 style={{color:'var(--text-heading)'}}>Average Power Spectral Density</h4> <img src={psd_plot_url} alt="Average PSD Plot" className={styles.plotImage}/> </div>
                }
                {!psd_plot_url && <p className={styles.loadingTextSmall}>(PSD plot not available)</p>}
            </section>
            <hr className={styles.sectionSeparator}/>
            <div className={styles.disclaimer} style={{marginTop:'2rem', textAlign:'center', padding:'1rem', backgroundColor:'rgba(var(--text-secondary-rgb),0.05)', borderRadius:'var(--border-radius)'}}>
                <FiAlertTriangle style={{ marginRight: '8px', color:'var(--text-secondary)', verticalAlign:'middle' }} />
                <span style={{color:'var(--text-secondary)', fontSize:'0.85rem'}}>This AI-driven report is for informational and technical review purposes. It is not a substitute for professional medical diagnosis.</span>
            </div>
    </div>
    );
  } else {
    return <div className={styles.container}><p>Report view not available for your current role ({userRole || 'unknown'}).</p></div>;
  }
}
