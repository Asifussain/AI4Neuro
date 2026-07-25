import { cn } from '@/lib/utils';

/**
 * The two-image AI4Neuro logo (icon mark + wordmark), matching the landing
 * page navbar's `.brand` treatment, for reuse anywhere the app needs the real
 * logo instead of a placeholder icon-in-a-box.
 */
export function BrandLogo({
  markHeight = 40,
  textHeight = 20,
  gap = 'gap-2',
  className,
}: {
  markHeight?: number;
  textHeight?: number;
  gap?: string;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-center', gap, className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- matches the landing page's own <img> usage for this asset */}
      <img
        src="/landing_homepage/AI4NEuroLOGO copy.png"
        alt="AI4Neuro Logo"
        className="w-auto object-contain"
        style={{ height: markHeight }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/landing_homepage/AI4NeuroText.png"
        alt="AI4Neuro"
        className="w-auto object-contain"
        style={{ height: textHeight }}
      />
    </span>
  );
}
