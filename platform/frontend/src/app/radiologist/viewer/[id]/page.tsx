'use client';

import { Navbar } from '@/components/shared/Navbar';
import { MockMRIViewer } from '@/components/viewers/MockMRIViewer';
import { RealMRIViewer } from '@/components/viewers/RealMRIViewer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSession } from '@/lib/hooks/useApi';
import {
  Download,
  ArrowLeft,
  FileText,
  Loader2,
  AlertCircle,
  ExternalLink,
  Brain,
  Activity,
  User,
  Calendar,
  Clock,
  Stethoscope,
  BarChart3,
  ChevronRight,
  Info,
  Scan,
  Image as ImageIcon,
} from 'lucide-react';
import Link from 'next/link';
import { use, useState } from 'react';
import {
  SpotlightCard,
  GradientText,
  AuroraBackground,
  GridPattern,
  PulseRing,
} from '@/components/ui/animated';

// Prediction display config
const predictionConfig = {
  CN: {
    label: 'Cognitively Normal',
    shortLabel: 'CN',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
    ringColor: 'green' as const,
    barColor: 'bg-emerald-500',
    description: 'No signs of neurodegenerative disease detected.',
  },
  MCI: {
    label: 'Mild Cognitive Impairment',
    shortLabel: 'MCI',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    ringColor: 'yellow' as const,
    barColor: 'bg-amber-500',
    description: 'Early signs of cognitive decline detected. May or may not progress.',
  },
  AD: {
    label: "Alzheimer's Disease",
    shortLabel: 'AD',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    ringColor: 'red' as const,
    barColor: 'bg-red-500',
    description: "Patterns consistent with Alzheimer's disease.",
  },
};

export default function RadiologistViewerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: session, isLoading, error } = useSession(id);
  const [activeVizTab, setActiveVizTab] = useState<'similarity' | 'volume' | 'confidence'>('similarity');

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center h-[80vh]">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-teal-500 mx-auto mb-4" />
            <p className="text-muted-foreground">Loading session data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center h-[80vh]">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-foreground text-lg mb-2">Session not found</p>
            <p className="text-muted-foreground mb-4">{error || 'Unable to load session data'}</p>
            <Button variant="outline" asChild>
              <Link href="/radiologist/dashboard">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const prediction = session.prediction;
  const patientName = session.patient?.user_profile?.full_name || 'Unknown Patient';
  const predConfig = prediction ? predictionConfig[prediction.prediction] : null;

  // Status badge styling
  const statusStyles: Record<string, string> = {
    completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    processing: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    uploaded: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
    failed: 'bg-red-500/10 text-red-400 border-red-500/30',
    reviewed: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  };

  // Check if viz URLs exist
  const hasVisualizations = prediction && (
    prediction.similarity_plot_url ||
    prediction.volume_chart_url ||
    prediction.confidence_chart_url
  );

  // Viz tab data
  const vizTabs = [
    { key: 'similarity', label: 'Similarity', url: prediction?.similarity_plot_url },
    { key: 'volume', label: 'Volumes', url: prediction?.volume_chart_url },
    { key: 'confidence', label: 'Confidence', url: prediction?.confidence_chart_url },
  ].filter((t) => t.url) as { key: string; label: string; url: string }[];

  return (
    <div className="min-h-screen bg-background relative">
      {/* Background effects - matching dashboard */}
      <AuroraBackground />
      <GridPattern />

      <Navbar />

      <div className="relative z-10 p-4 pt-20 lg:p-6 lg:pt-22 max-w-[1920px] mx-auto space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground">
              <Link href="/radiologist/dashboard">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Dashboard
              </Link>
            </Button>
            <div className="h-6 w-px bg-border" />
            <div>
              <h1 className="text-xl lg:text-2xl font-bold text-foreground flex items-center gap-2">
                <Brain className="h-5 w-5 lg:h-6 lg:w-6 text-teal-500" />
                <GradientText>MRI Viewer</GradientText>
              </h1>
              <p className="text-xs lg:text-sm text-muted-foreground mt-0.5">
                {session.session_code} &middot; {patientName}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {prediction?.technical_pdf_url && (
              <Button variant="outline" size="sm" asChild className="text-xs">
                <a href={prediction.technical_pdf_url} target="_blank" rel="noopener noreferrer">
                  <FileText className="h-3.5 w-3.5 mr-1.5" />
                  Technical Report
                  <ExternalLink className="h-3 w-3 ml-1 opacity-50" />
                </a>
              </Button>
            )}
            {prediction?.clinician_pdf_url && (
              <Button variant="outline" size="sm" asChild className="text-xs">
                <a href={prediction.clinician_pdf_url} target="_blank" rel="noopener noreferrer">
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  Clinician Report
                  <ExternalLink className="h-3 w-3 ml-1 opacity-50" />
                </a>
              </Button>
            )}
            {prediction?.patient_pdf_url && (
              <Button variant="outline" size="sm" asChild className="text-xs">
                <a href={prediction.patient_pdf_url} target="_blank" rel="noopener noreferrer">
                  <FileText className="h-3.5 w-3.5 mr-1.5" />
                  Patient Report
                  <ExternalLink className="h-3 w-3 ml-1 opacity-50" />
                </a>
              </Button>
            )}
          </div>
        </div>

        {/* Main Layout */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          {/* ===== Left Sidebar ===== */}
          <div className="xl:col-span-3 space-y-4">
            {/* AI Prediction Card */}
            {prediction && predConfig && (
              <SpotlightCard spotlightColor="rgba(20, 184, 166, 0.08)">
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Activity className="h-4 w-4 text-teal-500" />
                    <h3 className="text-sm font-semibold text-foreground">AI Prediction</h3>
                    <PulseRing color={predConfig.ringColor} className="ml-auto" />
                  </div>

                  {/* Prediction badge */}
                  <div className={`rounded-lg p-3 border ${predConfig.bgColor} ${predConfig.borderColor} mb-3`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-lg font-bold ${predConfig.color}`}>
                        {predConfig.shortLabel}
                      </span>
                      <span className={`text-xs font-medium ${predConfig.color}`}>
                        {(prediction.confidence_score * 100).toFixed(1)}%
                      </span>
                    </div>
                    <p className={`text-xs font-medium ${predConfig.color} mb-2`}>
                      {predConfig.label}
                    </p>
                    <div className="w-full bg-white/5 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full ${predConfig.barColor} transition-all duration-500`}
                        style={{ width: `${prediction.confidence_score * 100}%` }}
                      />
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                    {predConfig.description}
                  </p>

                  {/* Probability distribution */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Probabilities
                    </h4>
                    {prediction.probabilities && Object.entries(prediction.probabilities).map(([key, value]) => {
                      const cfg = predictionConfig[key as keyof typeof predictionConfig];
                      return (
                        <div key={key} className="flex items-center gap-2">
                          <span className="text-xs w-8 font-medium text-muted-foreground">{key}</span>
                          <div className="flex-1 bg-white/5 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full ${cfg?.barColor || 'bg-gray-500'} transition-all duration-500`}
                              style={{ width: `${(value || 0) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs w-12 text-right tabular-nums text-muted-foreground">
                            {((value || 0) * 100).toFixed(1)}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </SpotlightCard>
            )}

            {/* No prediction state */}
            {!prediction && (
              <SpotlightCard spotlightColor="rgba(20, 184, 166, 0.08)">
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Activity className="h-4 w-4 text-teal-500" />
                    <h3 className="text-sm font-semibold text-foreground">AI Prediction</h3>
                  </div>
                  <div className="text-center py-4">
                    {session.status === 'processing' ? (
                      <>
                        <Loader2 className="h-8 w-8 animate-spin text-teal-500 mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">Analysis in progress...</p>
                      </>
                    ) : (
                      <>
                        <Brain className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">No prediction available</p>
                      </>
                    )}
                  </div>
                </div>
              </SpotlightCard>
            )}

            {/* Session Details */}
            <SpotlightCard spotlightColor="rgba(20, 184, 166, 0.06)">
              <div className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Scan className="h-4 w-4 text-teal-500" />
                  <h3 className="text-sm font-semibold text-foreground">Session Details</h3>
                </div>
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Calendar className="h-3 w-3" /> Scan Date
                    </span>
                    <span className="text-foreground font-medium">
                      {new Date(session.scan_date).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                      })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Activity className="h-3 w-3" /> Status
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 ${statusStyles[session.status] || ''}`}
                    >
                      {session.status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Brain className="h-3 w-3" /> Analysis
                    </span>
                    <span className="text-foreground font-medium capitalize">
                      {session.analysis_type?.replace('-', ' ') || 'Multi-disease'}
                    </span>
                  </div>

                  {/* Patient info */}
                  <div className="pt-2 mt-2 border-t border-border/50">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <User className="h-3 w-3" /> Patient
                      </span>
                      <span className="text-foreground font-medium truncate ml-2 max-w-[140px]">
                        {patientName}
                      </span>
                    </div>
                    {session.patient?.patient_code && (
                      <div className="flex items-center justify-between text-xs mt-1.5">
                        <span className="text-muted-foreground ml-[18px]">Code</span>
                        <span className="text-foreground font-mono text-[10px]">
                          {session.patient.patient_code}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Doctor info */}
                  {session.doctor && (
                    <div className="pt-2 mt-1 border-t border-border/50">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          <Stethoscope className="h-3 w-3" /> Doctor
                        </span>
                        <span className="text-foreground font-medium truncate ml-2 max-w-[140px]">
                          {session.doctor.user_profile?.full_name || '--'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Scanner info */}
                  {(session.scanner_manufacturer || session.scanner_model || session.scanner_field_strength) && (
                    <div className="pt-2 mt-1 border-t border-border/50">
                      <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
                        Scanner
                      </h4>
                      {session.scanner_manufacturer && (
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Manufacturer</span>
                          <span className="text-foreground">{session.scanner_manufacturer}</span>
                        </div>
                      )}
                      {session.scanner_model && (
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Model</span>
                          <span className="text-foreground">{session.scanner_model}</span>
                        </div>
                      )}
                      {session.scanner_field_strength && (
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Field Strength</span>
                          <span className="text-foreground">{session.scanner_field_strength}</span>
                        </div>
                      )}
                      {session.sequence_type && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Sequence</span>
                          <span className="text-foreground">{session.sequence_type}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </SpotlightCard>

            {/* Model info */}
            {prediction?.model_version && (
              <SpotlightCard spotlightColor="rgba(20, 184, 166, 0.06)">
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Info className="h-4 w-4 text-teal-500" />
                    <h3 className="text-sm font-semibold text-foreground">Model Info</h3>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Version</span>
                      <span className="text-foreground font-mono">{prediction.model_version}</span>
                    </div>
                    {prediction.processing_time && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Processing</span>
                        <span className="text-foreground">{prediction.processing_time}ms</span>
                      </div>
                    )}
                    {prediction.report_generated_at && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Generated</span>
                        <span className="text-foreground">
                          {new Date(prediction.report_generated_at).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </SpotlightCard>
            )}

            {/* Notes */}
            {session.notes && (
              <SpotlightCard spotlightColor="rgba(20, 184, 166, 0.06)">
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-4 w-4 text-teal-500" />
                    <h3 className="text-sm font-semibold text-foreground">Notes</h3>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{session.notes}</p>
                </div>
              </SpotlightCard>
            )}
          </div>

          {/* ===== Center - Viewer ===== */}
          <div className="xl:col-span-6 space-y-4">
            {prediction?.slice_urls &&
             (prediction.slice_urls.axial?.length > 0 ||
              prediction.slice_urls.sagittal?.length > 0 ||
              prediction.slice_urls.coronal?.length > 0) ? (
              <RealMRIViewer
                sessionId={session.session_code}
                sliceUrls={prediction.slice_urls}
                viewerMode="radiologist"
                prediction={prediction?.prediction}
                confidence={prediction?.confidence_score}
                showAnnotations={true}
              />
            ) : (
              <MockMRIViewer
                sessionId={session.session_code}
                viewerMode="radiologist"
                prediction={prediction?.prediction}
                confidence={prediction?.confidence_score}
                showAnnotations={true}
              />
            )}
          </div>

          {/* ===== Right Sidebar ===== */}
          <div className="xl:col-span-3 space-y-4">
            {/* Brain Volumes */}
            {prediction && (prediction.brain_volume || prediction.gm_volume || prediction.wm_volume) && (
              <SpotlightCard spotlightColor="rgba(20, 184, 166, 0.08)">
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <BarChart3 className="h-4 w-4 text-teal-500" />
                    <h3 className="text-sm font-semibold text-foreground">Brain Volumes</h3>
                  </div>
                  <div className="space-y-3">
                    {/* Total Brain */}
                    {prediction.brain_volume != null && prediction.brain_volume > 0 && (
                      <VolumeBar
                        label="Total Brain"
                        value={prediction.brain_volume}
                        normMin={1100}
                        normMax={1400}
                        unit="cm³"
                      />
                    )}
                    {/* Gray Matter */}
                    {prediction.gm_volume != null && prediction.gm_volume > 0 && (
                      <VolumeBar
                        label="Gray Matter"
                        value={prediction.gm_volume}
                        normMin={450}
                        normMax={600}
                        unit="cm³"
                      />
                    )}
                    {/* White Matter */}
                    {prediction.wm_volume != null && prediction.wm_volume > 0 && (
                      <VolumeBar
                        label="White Matter"
                        value={prediction.wm_volume}
                        normMin={400}
                        normMax={550}
                        unit="cm³"
                      />
                    )}
                    {/* CSF */}
                    {prediction.csf_volume != null && prediction.csf_volume > 0 && (
                      <VolumeBar
                        label="CSF"
                        value={prediction.csf_volume}
                        normMin={150}
                        normMax={300}
                        unit="cm³"
                      />
                    )}
                    {/* Hippocampal */}
                    {prediction.hippocampal_volume != null && prediction.hippocampal_volume > 0 && (
                      <VolumeBar
                        label="Hippocampus"
                        value={prediction.hippocampal_volume}
                        normMin={3.0}
                        normMax={4.5}
                        unit="cm³"
                      />
                    )}
                    {/* Ventricular */}
                    {prediction.ventricular_volume != null && prediction.ventricular_volume > 0 && (
                      <VolumeBar
                        label="Ventricles"
                        value={prediction.ventricular_volume}
                        normMin={20}
                        normMax={50}
                        unit="cm³"
                        invertWarning
                      />
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-3 leading-relaxed">
                    Green = within normative range. Amber = borderline. Red = outside range.
                  </p>
                </div>
              </SpotlightCard>
            )}

            {/* Visualizations - Inline Preview */}
            {hasVisualizations && vizTabs.length > 0 && (
              <SpotlightCard spotlightColor="rgba(20, 184, 166, 0.08)">
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <ImageIcon className="h-4 w-4 text-teal-500" />
                    <h3 className="text-sm font-semibold text-foreground">Visualizations</h3>
                  </div>
                  {/* Tab buttons */}
                  <div className="flex gap-1 mb-3">
                    {vizTabs.map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => setActiveVizTab(tab.key as any)}
                        className={`text-[10px] px-2.5 py-1 rounded-md font-medium transition-colors ${
                          activeVizTab === tab.key
                            ? 'bg-teal-500/15 text-teal-400 border border-teal-500/30'
                            : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                  {/* Preview image */}
                  {vizTabs.map((tab) => (
                    <div
                      key={tab.key}
                      className={activeVizTab === tab.key ? 'block' : 'hidden'}
                    >
                      <a
                        href={tab.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block rounded-lg overflow-hidden border border-border/50 hover:border-teal-500/30 transition-colors"
                      >
                        <img
                          src={tab.url}
                          alt={tab.label}
                          className="w-full h-auto bg-black/20"
                          loading="lazy"
                        />
                      </a>
                      <p className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1">
                        <ExternalLink className="h-2.5 w-2.5" />
                        Click to open full size
                      </p>
                    </div>
                  ))}
                </div>
              </SpotlightCard>
            )}

            {/* Reports */}
            {prediction && (prediction.technical_pdf_url || prediction.clinician_pdf_url || prediction.patient_pdf_url) && (
              <SpotlightCard spotlightColor="rgba(20, 184, 166, 0.06)">
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="h-4 w-4 text-teal-500" />
                    <h3 className="text-sm font-semibold text-foreground">Reports</h3>
                  </div>
                  <div className="space-y-1.5">
                    {prediction.technical_pdf_url && (
                      <a
                        href={prediction.technical_pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-teal-400 transition-colors p-1.5 rounded-md hover:bg-white/5 group"
                      >
                        <FileText className="h-3.5 w-3.5 text-teal-500/70" />
                        <span className="flex-1">Technical Report</span>
                        <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </a>
                    )}
                    {prediction.clinician_pdf_url && (
                      <a
                        href={prediction.clinician_pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-teal-400 transition-colors p-1.5 rounded-md hover:bg-white/5 group"
                      >
                        <FileText className="h-3.5 w-3.5 text-blue-500/70" />
                        <span className="flex-1">Clinician Report</span>
                        <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </a>
                    )}
                    {prediction.patient_pdf_url && (
                      <a
                        href={prediction.patient_pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-teal-400 transition-colors p-1.5 rounded-md hover:bg-white/5 group"
                      >
                        <FileText className="h-3.5 w-3.5 text-purple-500/70" />
                        <span className="flex-1">Patient Report</span>
                        <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </a>
                    )}
                  </div>
                  {prediction.report_generated_at && (
                    <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" />
                      Generated {new Date(prediction.report_generated_at).toLocaleString()}
                    </p>
                  )}
                </div>
              </SpotlightCard>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Volume Bar Component - mini inline volume indicator
// ============================================================================
function VolumeBar({
  label,
  value,
  normMin,
  normMax,
  unit = 'cm³',
  invertWarning = false,
}: {
  label: string;
  value: number;
  normMin: number;
  normMax: number;
  unit?: string;
  invertWarning?: boolean;
}) {
  // Determine status
  const range = normMax - normMin;
  const borderLow = normMin - range * 0.1;
  const borderHigh = normMax + range * 0.1;

  let status: 'normal' | 'borderline' | 'abnormal';
  if (value >= normMin && value <= normMax) {
    status = 'normal';
  } else if (value >= borderLow && value <= borderHigh) {
    status = 'borderline';
  } else {
    status = 'abnormal';
  }

  // For ventricles, high = bad
  if (invertWarning && value > normMax) {
    if (value <= borderHigh) status = 'borderline';
    else status = 'abnormal';
  }

  const colors = {
    normal: { dot: 'bg-emerald-500', text: 'text-emerald-400' },
    borderline: { dot: 'bg-amber-500', text: 'text-amber-400' },
    abnormal: { dot: 'bg-red-500', text: 'text-red-400' },
  };

  // Calculate position on a visual scale
  const scaleMin = Math.min(normMin * 0.7, value * 0.9);
  const scaleMax = Math.max(normMax * 1.3, value * 1.1);
  const pct = ((value - scaleMin) / (scaleMax - scaleMin)) * 100;
  const normStartPct = ((normMin - scaleMin) / (scaleMax - scaleMin)) * 100;
  const normWidthPct = ((normMax - normMin) / (scaleMax - scaleMin)) * 100;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={`text-xs font-medium tabular-nums ${colors[status].text}`}>
          {value.toFixed(1)} {unit}
        </span>
      </div>
      <div className="relative h-2 bg-white/5 rounded-full overflow-hidden">
        {/* Normative range band */}
        <div
          className="absolute h-full bg-emerald-500/20 rounded-full"
          style={{ left: `${normStartPct}%`, width: `${normWidthPct}%` }}
        />
        {/* Value marker */}
        <div
          className={`absolute top-0 h-full w-1 rounded-full ${colors[status].dot}`}
          style={{ left: `${Math.min(Math.max(pct, 1), 99)}%` }}
        />
      </div>
    </div>
  );
}
