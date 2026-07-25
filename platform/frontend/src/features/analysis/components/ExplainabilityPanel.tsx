'use client';

/**
 * AI Visual Explainability — the same Grad-CAM overlay vs. healthy MNI152
 * reference comparison that appears in the PDF, rendered on the web.
 *
 * Two role-appropriate variants share one component:
 *  - "clinical"  — full technical framing (method, region tags, observations)
 *                  for doctors / radiologists / admins.
 *  - "patient"   — softer, plain-language framing for patients.
 *
 * Purely presentational: it renders whatever the backend persisted at
 * visualizations.explainability (signed image URLs + observations); it renders
 * nothing when there are no panels.
 */

import Image from 'next/image';
import { Brain, Info, Sparkles } from 'lucide-react';
import type { Explainability } from '../types';

function Slide({ src, label, tone }: { src?: string | null; label: string; tone: 'affected' | 'reference' }) {
  return (
    <div className="flex-1 min-w-0">
      <p
        className={`mb-1 text-center text-[11px] font-semibold ${
          tone === 'affected' ? 'text-rose-600' : 'text-emerald-600'
        }`}
      >
        {label}
      </p>
      <div className="overflow-hidden rounded-md border bg-black/90">
        {src ? (
          <Image
            src={src}
            alt={label}
            width={320}
            height={320}
            unoptimized
            className="h-auto w-full"
          />
        ) : (
          <div className="flex aspect-square items-center justify-center text-[11px] text-slate-400">
            image unavailable
          </div>
        )}
      </div>
    </div>
  );
}

export function ExplainabilityPanel({
  explainability,
  variant = 'clinical',
}: {
  explainability?: Explainability | null;
  variant?: 'clinical' | 'patient';
}) {
  const panels = explainability?.panels ?? [];
  if (panels.length === 0) return null;

  const isPatient = variant === 'patient';
  const title = isPatient ? 'What the AI looked at' : 'AI Visual Explainability';
  const affectedLabel = isPatient ? 'Your scan (AI focus)' : 'Patient slice (Grad-CAM)';
  const referenceLabel = isPatient ? 'Healthy reference' : 'Healthy reference (MNI152)';
  const regions = explainability?.regions ?? [];
  // Observations are analysis-level (identical per panel) — show once.
  const observations = panels[0]?.observations ?? [];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-teal-600" />
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      </div>

      <p className="mb-4 text-xs leading-relaxed text-slate-500">
        {isPatient
          ? 'The coloured areas show where the AI focused on your scan. Each image sits next to a healthy reference brain so you can compare.'
          : `${
              explainability?.method || 'Grad-CAM'
            }. The heatmap marks the regions that contributed most to the prediction; each patient slice is shown beside the anatomically-matched healthy MNI152 reference.`}
      </p>

      {!isPatient && regions.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {regions.map((r) => (
            <span
              key={r}
              className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600"
            >
              <Brain className="h-3 w-3" />
              {r}
            </span>
          ))}
        </div>
      )}

      <div className="space-y-4">
        {panels.map((panel, i) => (
          <div key={i}>
            <div className="flex gap-3">
              <Slide src={panel.affected_url} label={affectedLabel} tone="affected" />
              <Slide src={panel.reference_url} label={referenceLabel} tone="reference" />
            </div>
            {panel.caption && !isPatient && (
              <p className="mt-1 text-center text-[11px] italic text-slate-400">{panel.caption}</p>
            )}
          </div>
        ))}
      </div>

      {observations.length > 0 && (
        <div className="mt-4 rounded-lg bg-slate-50 p-3">
          <p className="mb-1 text-xs font-semibold text-slate-700">
            {isPatient ? 'In simple terms' : 'AI observations'}
          </p>
          <ul className="space-y-1">
            {observations.map((o, i) => (
              <li key={i} className="flex gap-1.5 text-xs leading-relaxed text-slate-600">
                <span className="text-slate-400">•</span>
                <span>{o}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {explainability?.summary && (
        <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-400">
          <Info className="mt-0.5 h-3 w-3 shrink-0" />
          <span>{explainability.summary}</span>
        </p>
      )}
    </div>
  );
}

export default ExplainabilityPanel;
