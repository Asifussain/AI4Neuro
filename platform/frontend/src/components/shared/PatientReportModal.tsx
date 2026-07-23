'use client';

/**
 * PatientReportModal — a simple, plain-language, print-friendly report shown
 * ONLY to patients (never doctors/radiologists, who get the technical PDF).
 *
 * It presents the analysis result the way a hospital discharge summary would:
 * a clean letterhead, a patient-demographics grid, an easy-to-read result with
 * a "what this means" explanation, next steps and a safety notice. Works for
 * both MRI and EEG by branching plain-language copy on the session modality.
 *
 * Everything here is presentational — it renders whatever real session /
 * patient data the caller passes in; there is no hard-coded patient data.
 */

import React from 'react';
import { X, Printer, Brain, Waves, ShieldCheck, HeartPulse, Lightbulb, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ExplainabilityPanel } from '@/features/analysis/components/ExplainabilityPanel';
import type { Explainability } from '@/features/analysis/types';

type Modality = 'mri' | 'eeg';

export interface PatientReportData {
  // Session
  sessionCode?: string;
  modality?: Modality | string | null;
  analysisType?: string | null;
  scanDate?: string | null;
  status?: string | null;
  notes?: string | null;
  reportPdfUrl?: string | null;
  // Result
  prediction?: string | null; // CN | MCI | AD | Normal | Alzheimer's
  confidence?: number | null; // 0..1
  explainability?: Explainability | null;
  // Patient
  patientName?: string | null;
  patientCode?: string | null;
  dateOfBirth?: string | null;
  age?: number | null;
  gender?: string | null;
  bloodGroup?: string | null;
  // Care team
  doctorName?: string | null;
  hospitalName?: string | null;
  hospitalPhone?: string | null;
  hospitalAddress?: string | null;
}

interface PatientReportModalProps {
  data: PatientReportData | null;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Plain-language copy per predicted class. Shared across MRI & EEG; the two
// binary EEG labels (Normal / Alzheimer's) are mapped onto the CN / AD copy.
// ---------------------------------------------------------------------------
type Tone = 'good' | 'watch' | 'attention';

const RESULT_COPY: Record<
  string,
  { tone: Tone; label: string; title: string; description: string; whatItMeans: string; next: string }
> = {
  CN: {
    tone: 'good',
    label: 'Healthy Brain Pattern',
    title: 'Great news',
    description: 'Your scan looks healthy, with no signs of neurodegenerative changes.',
    whatItMeans:
      'The AI did not find patterns commonly linked with memory-related conditions. This is a reassuring result, but it is still just one part of your overall health picture.',
    next: 'Keep up your regular check-ups and a brain-healthy lifestyle — staying active, eating well, sleeping well and keeping socially and mentally engaged.',
  },
  MCI: {
    tone: 'watch',
    label: 'Mild Changes Detected',
    title: 'Something to keep an eye on',
    description: 'Your scan shows some early changes that your doctor should review with you.',
    whatItMeans:
      'The AI noticed subtle changes. Many people with these early changes stay stable for a long time. Your doctor will help you understand what this means for you specifically.',
    next: 'Your doctor may suggest lifestyle changes and a follow-up scan later on to track any changes over time. Bring this report to your next appointment.',
  },
  AD: {
    tone: 'attention',
    label: 'Changes Detected',
    title: 'Important results to discuss',
    description: 'Your scan shows patterns your doctor will want to talk through with you.',
    whatItMeans:
      'The AI found patterns that are sometimes associated with Alzheimer-type changes. This is not a final diagnosis — only your doctor can confirm what it means alongside your full history.',
    next: 'Your doctor will create a care plan tailored to you and explain the support and options available. You are not alone in this — please book a visit to go through the results together.',
  },
};

// EEG binary labels → reuse the closest MRI copy.
const LABEL_ALIASES: Record<string, string> = {
  NORMAL: 'CN',
  "ALZHEIMER'S": 'AD',
  ALZHEIMERS: 'AD',
  AD: 'AD',
  MCI: 'MCI',
  CN: 'CN',
};

const TONE_STYLES: Record<Tone, { badge: string; bar: string; panel: string; text: string }> = {
  good: {
    badge: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    bar: 'bg-emerald-500',
    panel: 'bg-emerald-50 border-emerald-200',
    text: 'text-emerald-700',
  },
  watch: {
    badge: 'bg-amber-100 text-amber-700 border-amber-200',
    bar: 'bg-amber-500',
    panel: 'bg-amber-50 border-amber-200',
    text: 'text-amber-700',
  },
  attention: {
    badge: 'bg-rose-100 text-rose-700 border-rose-200',
    bar: 'bg-rose-500',
    panel: 'bg-rose-50 border-rose-200',
    text: 'text-rose-700',
  },
};

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function computeAge(dob?: string | null, ageFallback?: number | null): string {
  if (typeof ageFallback === 'number') return `${ageFallback} yrs`;
  if (!dob) return '—';
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return '—';
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return `${age} yrs`;
}

function DemographicCell({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="border border-slate-200 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">{label}</p>
      <p className="text-sm text-slate-900 mt-0.5 break-words">{value || '—'}</p>
    </div>
  );
}

export function PatientReportModal({ data, onClose }: PatientReportModalProps) {
  if (!data) return null;

  const modality: Modality = (String(data.modality || 'mri').toLowerCase() === 'eeg' ? 'eeg' : 'mri');
  const ModalityIcon = modality === 'eeg' ? Waves : Brain;
  const modalityLabel = modality === 'eeg' ? 'EEG Brain Activity Analysis' : 'MRI Brain Scan Analysis';

  const rawPred = (data.prediction || '').toString().trim().toUpperCase();
  const canonical = LABEL_ALIASES[rawPred];
  const copy = canonical ? RESULT_COPY[canonical] : null;
  const tone = copy?.tone ?? 'good';
  const styles = TONE_STYLES[tone];
  const confidencePct =
    typeof data.confidence === 'number' ? Math.round(Math.max(0, Math.min(1, data.confidence)) * 100) : null;

  const handlePrint = () => window.print();

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-slate-900/50 backdrop-blur-sm p-4 print:p-0 print:bg-white print:static print:block">
      {/* Print isolation: hide everything except #patient-report when printing */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #patient-report, #patient-report * { visibility: visible !important; }
          #patient-report { position: absolute !important; left: 0; top: 0; width: 100%; box-shadow: none !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div
        id="patient-report"
        className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden my-4 print:my-0 print:rounded-none print:shadow-none"
      >
        {/* Toolbar (not printed) */}
        <div className="no-print flex items-center justify-between gap-2 bg-slate-50 border-b border-slate-200 px-4 py-2">
          <span className="text-xs text-slate-500">Patient&apos;s Copy · Simple Report</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handlePrint} className="h-8 text-xs gap-1.5">
              <Printer className="h-3.5 w-3.5" /> Print / Save PDF
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose} className="h-8 w-8 p-0">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Letterhead */}
        <div className="bg-gradient-to-r from-teal-600 to-emerald-600 text-white px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold leading-tight">Brain Health Summary</h1>
            <p className="text-teal-50 text-sm">Patient&apos;s Copy — easy-to-read report</p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2 justify-end">
              <ModalityIcon className="h-6 w-6" />
              <span className="font-semibold">{data.hospitalName || 'AI4Neuro'}</span>
            </div>
            <p className="text-[11px] text-teal-50 mt-0.5">a product by PraxiaTech</p>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Patient demographics */}
          <section>
            <h2 className="text-sm font-bold text-slate-800 mb-2">Patient Details</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-0 border border-slate-200 rounded-lg overflow-hidden [&>*]:border-t-0 [&>*]:border-l-0">
              <DemographicCell label="Name" value={data.patientName} />
              <DemographicCell label="Patient ID" value={data.patientCode} />
              <DemographicCell label="Report No." value={data.sessionCode} />
              <DemographicCell label="Date of Birth" value={formatDate(data.dateOfBirth)} />
              <DemographicCell label="Age" value={computeAge(data.dateOfBirth, data.age)} />
              <DemographicCell label="Blood Group" value={data.bloodGroup} />
              <DemographicCell label="Date of Assessment" value={formatDate(data.scanDate)} />
              <DemographicCell label="Referring Doctor" value={data.doctorName} />
              <DemographicCell label="Test" value={modalityLabel} />
            </div>
          </section>

          {/* Result */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <HeartPulse className="h-4 w-4 text-teal-600" />
              <h2 className="text-sm font-bold text-slate-800">Your Result</h2>
            </div>

            {copy ? (
              <div className={`rounded-xl border p-4 ${styles.panel}`}>
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${styles.badge}`}>
                    {copy.label}
                  </span>
                </div>
                <p className={`text-lg font-bold ${styles.text}`}>{copy.title}</p>
                <p className="text-sm text-slate-700 mt-1 leading-relaxed">{copy.description}</p>

                {confidencePct !== null && (
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-slate-600 mb-1">
                      <span>How confident the analysis is</span>
                      <span className={`font-semibold ${styles.text}`}>{confidencePct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/70 overflow-hidden">
                      <div className={`h-full rounded-full ${styles.bar}`} style={{ width: `${confidencePct}%` }} />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                Your results are not ready yet. Once the analysis is complete, your result will appear here.
              </div>
            )}
          </section>

          {/* What this means + next steps */}
          {copy && (
            <div className="grid sm:grid-cols-2 gap-4">
              <section className="rounded-xl border border-slate-200 p-4">
                <h3 className="text-sm font-semibold text-slate-800 mb-1.5">What this means for you</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{copy.whatItMeans}</p>
              </section>
              <section className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <Lightbulb className="h-4 w-4 text-teal-600" />
                  <h3 className="text-sm font-semibold text-slate-800">What happens next</h3>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">{copy.next}</p>
              </section>
            </div>
          )}

          {/* AI visual explainability (patient-friendly) */}
          {data.explainability?.panels?.length ? (
            <ExplainabilityPanel explainability={data.explainability} variant="patient" />
          ) : null}

          {/* Notes from doctor */}
          {data.notes && (
            <section className="rounded-xl border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-800 mb-1.5">Notes from your doctor</h3>
              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{data.notes}</p>
            </section>
          )}

          {/* Safety notice */}
          <section className="rounded-xl bg-slate-50 border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <ShieldCheck className="h-4 w-4 text-slate-500" />
              <h3 className="text-sm font-semibold text-slate-800">Important</h3>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              This AI-assisted summary is designed to support your healthcare provider and should{' '}
              <span className="font-semibold text-slate-700">not</span> be used as the sole basis for any diagnosis or
              treatment decision. Only a qualified doctor can interpret these results in the context of your full
              medical history. Please always discuss your results with your doctor.
            </p>
          </section>

          {/* Full report link (optional) */}
          {data.reportPdfUrl && (
            <a
              href={data.reportPdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="no-print inline-flex items-center gap-1.5 text-sm font-medium text-teal-700 hover:text-teal-800"
            >
              View the full detailed report <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-6 py-3 text-center text-[11px] text-slate-400">
          {[data.hospitalName, data.hospitalPhone, data.hospitalAddress].filter(Boolean).join(' · ') ||
            'AI4Neuro — a product by PraxiaTech'}
        </div>
      </div>
    </div>
  );
}

export default PatientReportModal;
