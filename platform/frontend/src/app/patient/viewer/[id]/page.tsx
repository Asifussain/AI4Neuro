'use client';

import { Navbar } from '@/components/shared/Navbar';
import { MockMRIViewer } from '@/components/viewers/MockMRIViewer';
import { RealMRIViewer } from '@/components/viewers/RealMRIViewer';
import { Button } from '@/components/ui/button';
import { useSession } from '@/lib/hooks/useApi';
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  FileText,
  ExternalLink,
  Brain,
  Download,
  HeartPulse,
  ShieldCheck,
  Lightbulb,
  BookOpen,
  ClipboardList,
} from 'lucide-react';
import Link from 'next/link';
import { use } from 'react';
import {
  SpotlightCard,
  GradientText,
  AuroraBackground,
  GridPattern,
  PulseRing,
} from '@/components/ui/animated';

// ============================================================================
// PREDICTION CONFIG — friendly patient-facing language
// ============================================================================
const predictionConfig = {
  CN: {
    label: 'Healthy Brain',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
    ringColor: 'green' as const,
    barColor: 'bg-emerald-500',
    title: 'Great News!',
    description:
      'Your brain scan looks healthy with no signs of neurodegenerative disease.',
  },
  MCI: {
    label: 'Mild Changes Detected',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    ringColor: 'yellow' as const,
    barColor: 'bg-amber-500',
    title: 'Important Information',
    description:
      'Your scan shows some early changes that your doctor should review with you. Many people with these changes remain stable.',
  },
  AD: {
    label: 'Changes Detected',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    ringColor: 'red' as const,
    barColor: 'bg-red-500',
    title: 'Important Results',
    description:
      'Your scan shows patterns that your doctor will want to discuss with you. They will explain what this means and create a care plan.',
  },
};

// ============================================================================
// NEXT STEPS CONFIG — guidance per prediction
// ============================================================================
const nextStepsConfig: Record<string, { heading: string; body: string }> = {
  CN: {
    heading: 'Stay on Track',
    body: 'Continue your regular checkups and maintain a healthy lifestyle. Exercise, a balanced diet, quality sleep, and staying mentally active all contribute to long-term brain health.',
  },
  MCI: {
    heading: 'Lifestyle & Follow-Up',
    body: 'Your doctor will discuss lifestyle changes that may help, such as increased physical activity, cognitive exercises, social engagement, and dietary adjustments. Regular follow-up scans can track any changes over time.',
  },
  AD: {
    heading: 'Your Care Plan',
    body: 'Your doctor will create a comprehensive care plan tailored to you. This may include medication options, lifestyle recommendations, support resources, and a schedule for follow-up visits. You are not alone in this journey.',
  },
};

export default function PatientViewerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: session, isLoading, error } = useSession(id);

  // ============================ LOADING STATE ============================
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background relative">
        <AuroraBackground />
        <GridPattern />
        <Navbar />
        <div className="relative z-10 flex items-center justify-center h-[80vh]">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-teal-500 mx-auto mb-4" />
            <p className="text-muted-foreground">Loading your scan...</p>
          </div>
        </div>
      </div>
    );
  }

  // ============================ ERROR STATE ==============================
  if (error || !session) {
    return (
      <div className="min-h-screen bg-background relative">
        <AuroraBackground />
        <GridPattern />
        <Navbar />
        <div className="relative z-10 flex items-center justify-center h-[80vh]">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-foreground text-lg mb-2">Scan not found</p>
            <p className="text-muted-foreground mb-4">
              {error || 'Unable to load scan data'}
            </p>
            <Button variant="outline" asChild>
              <Link href="/home">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ============================ DATA =====================================
  const prediction = session.prediction;
  const pred = prediction?.prediction as 'CN' | 'MCI' | 'AD' | undefined;
  const config = pred ? predictionConfig[pred] : null;
  const nextSteps = pred ? nextStepsConfig[pred] : null;
  const confidencePercent = prediction?.confidence_score
    ? Math.round(prediction.confidence_score * 100)
    : null;

  // Status badge styling
  const statusBadge: Record<string, string> = {
    completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    processing: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    failed: 'bg-red-500/10 text-red-400 border-red-500/30',
  };
  const statusClass =
    statusBadge[session.status] ||
    'bg-gray-500/10 text-gray-400 border-gray-500/30';

  // ============================ RENDER ===================================
  return (
    <div className="min-h-screen bg-background relative">
      <AuroraBackground />
      <GridPattern />
      <Navbar />

      <div className="relative z-10 p-4 pt-20 lg:p-6 lg:pt-22 max-w-6xl mx-auto space-y-6">
        {/* ================================================================
            HEADER
        ================================================================ */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="text-muted-foreground hover:text-foreground"
            >
              <Link href="/home">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Dashboard
              </Link>
            </Button>
            <div className="h-6 w-px bg-border" />
            <div>
              <h1 className="text-xl lg:text-2xl font-bold text-foreground flex items-center gap-2">
                <Brain className="h-5 w-5 lg:h-6 lg:w-6 text-teal-500" />
                <GradientText>My Brain Scan</GradientText>
              </h1>
              <p className="text-xs lg:text-sm text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                <span>{session.session_code}</span>
                <span className="text-muted">&middot;</span>
                <span>
                  {new Date(session.scan_date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
                <span
                  className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusClass}`}
                >
                  {session.status}
                </span>
              </p>
            </div>
          </div>

          {/* Header report download button */}
          {prediction?.patient_pdf_url && (
            <Button variant="outline" size="sm" asChild className="text-xs">
              <a
                href={prediction.patient_pdf_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Download My Report
                <ExternalLink className="h-3 w-3 ml-1 opacity-50" />
              </a>
            </Button>
          )}
        </div>

        {/* ================================================================
            MRI VIEWER
        ================================================================ */}
        <div>
          {prediction?.slice_urls &&
          (prediction.slice_urls.axial?.length > 0 ||
            prediction.slice_urls.sagittal?.length > 0 ||
            prediction.slice_urls.coronal?.length > 0) ? (
            <RealMRIViewer
              sessionId={session.session_code}
              sliceUrls={prediction.slice_urls}
              viewerMode="patient"
              prediction={prediction?.prediction}
              confidence={prediction?.confidence_score}
              showAnnotations={true}
            />
          ) : (
            <MockMRIViewer
              sessionId={session.session_code}
              viewerMode="patient"
              prediction={prediction?.prediction}
              confidence={prediction?.confidence_score}
              showAnnotations={true}
            />
          )}
        </div>

        {/* ================================================================
            2-COLUMN GRID BELOW VIEWER
        ================================================================ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* ============================================================
              LEFT COLUMN
          ============================================================ */}
          <div className="space-y-4">
            {/* ---------- YOUR RESULTS CARD ---------- */}
            <SpotlightCard spotlightColor="rgba(20, 184, 166, 0.08)">
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <HeartPulse className="h-4 w-4 text-teal-500" />
                    <h3 className="text-sm font-semibold text-foreground">
                      Your Results
                    </h3>
                  </div>
                  {config && <PulseRing color={config.ringColor} />}
                  {!config && session.status === 'processing' && (
                    <PulseRing color="blue" />
                  )}
                </div>

                {/* -- Prediction available -- */}
                {pred && config && (
                  <div className="space-y-4">
                    {/* Result badge */}
                    <div
                      className={`rounded-xl p-4 border ${config.bgColor} ${config.borderColor}`}
                    >
                      <p
                        className={`text-lg font-bold ${config.color} mb-0.5`}
                      >
                        {config.title}
                      </p>
                      <p className={`text-sm font-medium ${config.color} mb-2`}>
                        {config.label}
                      </p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {config.description}
                      </p>
                    </div>

                    {/* Confidence bar */}
                    {confidencePercent !== null && (
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">
                            Analysis Confidence
                          </span>
                          <span className={`font-medium ${config.color}`}>
                            {confidencePercent}%
                          </span>
                        </div>
                        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${config.barColor} transition-all duration-1000`}
                            style={{ width: `${confidencePercent}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* -- Processing state -- */}
                {!pred && session.status === 'processing' && (
                  <div className="rounded-xl p-4 border bg-blue-500/10 border-blue-500/30">
                    <div className="flex items-center gap-3 mb-2">
                      <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
                      <p className="text-lg font-bold text-blue-400">
                        Analysis in Progress
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Your brain scan is currently being analyzed by our AI
                      system. This usually takes a few minutes. Please check
                      back soon or refresh the page.
                    </p>
                  </div>
                )}

                {/* -- No prediction, not processing -- */}
                {!pred && session.status !== 'processing' && (
                  <div className="text-center py-6">
                    <Brain className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Results are not yet available for this scan.
                    </p>
                  </div>
                )}
              </div>
            </SpotlightCard>

            {/* ---------- UNDERSTANDING YOUR SCAN CARD ---------- */}
            <SpotlightCard spotlightColor="rgba(20, 184, 166, 0.08)">
              <div className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <BookOpen className="h-4 w-4 text-teal-500" />
                  <h3 className="text-sm font-semibold text-foreground">
                    Understanding Your Scan
                  </h3>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs font-semibold text-foreground mb-1.5">
                      What You Are Looking At
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      This is a cross-sectional view of your brain, similar to
                      looking at a slice of an orange. You can scroll through
                      different slices to see your entire brain. The highlighted
                      areas (if any) show regions that the AI system identified
                      as important for the analysis.
                    </p>
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold text-foreground mb-1.5">
                      How to Use the Viewer
                    </h4>
                    <ul className="text-xs text-muted-foreground space-y-1.5 list-disc list-inside leading-relaxed">
                      <li>
                        Use the slider below the image to scroll through
                        different brain slices
                      </li>
                      <li>
                        Click the play button to see an animated view of all
                        slices
                      </li>
                      <li>
                        Higher slice numbers show the top of your brain, lower
                        numbers show the bottom
                      </li>
                      <li>
                        You can switch between axial, sagittal, and coronal
                        views to see your brain from different angles
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </SpotlightCard>
          </div>

          {/* ============================================================
              RIGHT COLUMN
          ============================================================ */}
          <div className="space-y-4">
            {/* ---------- YOUR REPORT CARD ---------- */}
            <SpotlightCard spotlightColor="rgba(20, 184, 166, 0.08)">
              <div className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="h-4 w-4 text-teal-500" />
                  <h3 className="text-sm font-semibold text-foreground">
                    Your Report
                  </h3>
                </div>

                {prediction?.patient_pdf_url ? (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      A personalized report has been prepared for you. It
                      explains your scan results in simple language and includes
                      helpful information to share with your family or
                      healthcare provider.
                    </p>
                    <a
                      href={prediction.patient_pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 hover:scale-[1.01] ${
                        config
                          ? `${config.bgColor} ${config.borderColor}`
                          : 'bg-teal-500/10 border-teal-500/30'
                      }`}
                    >
                      <div className="p-2 rounded-lg bg-white/[0.05]">
                        <FileText className="h-5 w-5 text-teal-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          Patient Report (PDF)
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          A simplified explanation of your scan results
                        </p>
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                    </a>
                    {prediction.report_generated_at && (
                      <p className="text-[10px] text-muted-foreground">
                        Generated:{' '}
                        {new Date(
                          prediction.report_generated_at
                        ).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <FileText className="h-7 w-7 text-muted-foreground mx-auto mb-2 opacity-50" />
                    <p className="text-xs text-muted-foreground">
                      Your report will be available once the analysis is
                      complete.
                    </p>
                  </div>
                )}
              </div>
            </SpotlightCard>

            {/* ---------- WHAT'S NEXT CARD ---------- */}
            {nextSteps && (
              <SpotlightCard spotlightColor="rgba(20, 184, 166, 0.08)">
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Lightbulb className="h-4 w-4 text-teal-500" />
                    <h3 className="text-sm font-semibold text-foreground">
                      What&apos;s Next?
                    </h3>
                  </div>

                  <div
                    className={`rounded-xl p-4 border ${
                      config
                        ? `${config.bgColor} ${config.borderColor}`
                        : 'bg-white/[0.03] border-white/[0.08]'
                    }`}
                  >
                    <p
                      className={`text-sm font-semibold mb-1.5 ${
                        config ? config.color : 'text-foreground'
                      }`}
                    >
                      {nextSteps.heading}
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {nextSteps.body}
                    </p>
                  </div>

                  <div className="mt-3 flex items-start gap-2 p-3 rounded-lg bg-white/[0.03]">
                    <ClipboardList className="h-3.5 w-3.5 text-teal-400 mt-0.5 shrink-0" />
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Bring this report to your next doctor&apos;s appointment
                      so they can review the findings with you and answer any
                      questions.
                    </p>
                  </div>
                </div>
              </SpotlightCard>
            )}

            {/* ---------- IMPORTANT NOTICE CARD ---------- */}
            <SpotlightCard spotlightColor="rgba(20, 184, 166, 0.08)">
              <div className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <ShieldCheck className="h-4 w-4 text-teal-500" />
                  <h3 className="text-sm font-semibold text-foreground">
                    Important Notice
                  </h3>
                </div>
                <div className="rounded-xl p-4 bg-white/[0.03] border border-white/[0.06]">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    This AI-assisted analysis is designed to support your
                    healthcare provider and should{' '}
                    <span className="font-semibold text-foreground">not</span>{' '}
                    be used as the sole basis for any diagnosis or treatment
                    decisions. Only a qualified medical professional can
                    interpret these results in the context of your full medical
                    history. Always consult with your doctor about your results.
                  </p>
                </div>
              </div>
            </SpotlightCard>
          </div>
        </div>

        {/* Notes (if any) */}
        {session.notes && (
          <SpotlightCard spotlightColor="rgba(20, 184, 166, 0.08)">
            <div className="p-5">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-teal-500" />
                <h3 className="text-sm font-semibold text-foreground">
                  Notes from Your Doctor
                </h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {session.notes}
              </p>
            </div>
          </SpotlightCard>
        )}
      </div>
    </div>
  );
}
