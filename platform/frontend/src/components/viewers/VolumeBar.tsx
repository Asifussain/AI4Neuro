'use client';

/** Mini inline volume indicator — extracted from what were two byte-identical
 * copies (doctor/radiologist viewer pages). `tone` preserves each page's
 * existing cosmetic variant (doctor: dark-ish text-*-400 / bg-white/5;
 * radiologist: light-ish text-*-600 / bg-slate-100) — no behavior change. */
export function VolumeBar({
  label,
  value,
  normMin,
  normMax,
  unit = 'cm³',
  invertWarning = false,
  tone = 'light',
}: {
  label: string;
  value: number;
  normMin: number;
  normMax: number;
  unit?: string;
  invertWarning?: boolean;
  tone?: 'dark' | 'light';
}) {
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

  // For ventricles, high = bad.
  if (invertWarning && value > normMax) {
    status = value <= borderHigh ? 'borderline' : 'abnormal';
  }

  const colors =
    tone === 'dark'
      ? {
          normal: { dot: 'bg-emerald-500', text: 'text-emerald-400' },
          borderline: { dot: 'bg-amber-500', text: 'text-amber-400' },
          abnormal: { dot: 'bg-red-500', text: 'text-red-400' },
        }
      : {
          normal: { dot: 'bg-emerald-500', text: 'text-emerald-600' },
          borderline: { dot: 'bg-amber-500', text: 'text-amber-600' },
          abnormal: { dot: 'bg-red-500', text: 'text-red-600' },
        };
  const trackBg = tone === 'dark' ? 'bg-white/5' : 'bg-slate-100';

  // Calculate position on a visual scale.
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
      <div className={`relative h-2 ${trackBg} rounded-full overflow-hidden`}>
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
