'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

// ============================================================================
// ACCENT TOKENS — one accent per role, used consistently across a dashboard
// ============================================================================
export type Accent = 'green' | 'indigo' | 'blue' | 'teal';

export const ACCENT_STYLES: Record<
  Accent,
  { solid: string; soft: string; text: string; ring: string; gradient: string }
> = {
  green: {
    solid: 'bg-emerald-600',
    soft: 'bg-emerald-50',
    text: 'text-emerald-700',
    ring: 'ring-emerald-200',
    gradient: 'from-emerald-500 to-emerald-600',
  },
  indigo: {
    solid: 'bg-indigo-600',
    soft: 'bg-indigo-50',
    text: 'text-indigo-700',
    ring: 'ring-indigo-200',
    gradient: 'from-indigo-500 to-violet-600',
  },
  blue: {
    solid: 'bg-blue-600',
    soft: 'bg-blue-50',
    text: 'text-blue-700',
    ring: 'ring-blue-200',
    gradient: 'from-blue-500 to-indigo-600',
  },
  teal: {
    solid: 'bg-teal-600',
    soft: 'bg-teal-50',
    text: 'text-teal-700',
    ring: 'ring-teal-200',
    gradient: 'from-teal-500 to-cyan-600',
  },
};

/** Real hex values for the same accents, for contexts (Recharts SVG fills)
 * that need an actual color rather than a Tailwind class. Keeps chart colors
 * in sync with ACCENT_STYLES instead of scattering hex literals per-dashboard. */
export const ACCENT_HEX: Record<Accent, string> = {
  green: '#059669',
  indigo: '#4f46e5',
  blue: '#2563eb',
  teal: '#0d9488',
};

export const NEUTRAL_CHART_HEX = '#94a3b8';

// ============================================================================
// SECTION CARD — light replacement for SpotlightCard
// ============================================================================
export function SectionCard({
  className,
  children,
  id,
}: {
  className?: string;
  children: React.ReactNode;
  /** For anchor-jump targets (e.g. "View Reports" scrolling to this card). */
  id?: string;
}) {
  return (
    <div
      id={id}
      className={cn(
        'rounded-2xl bg-white border border-slate-200/80 shadow-[0_8px_24px_rgba(15,23,42,0.05)]',
        className
      )}
    >
      {children}
    </div>
  );
}

// ============================================================================
// COUNT-UP — animates a numeric stat toward its latest value
// ============================================================================
function useCountUp(value: number, duration = 600): number {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    const from = fromRef.current;
    if (from === value) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return display;
}

// ============================================================================
// STAT CARD
// ============================================================================
export function StatCard({
  label,
  value,
  sublabel,
  icon: Icon,
  accent = 'blue',
  isLoading = false,
  onClick,
  href,
  size = 'default',
  trendText,
  isMain = false,
}: {
  label: string;
  value: string | number;
  sublabel?: string;
  icon: React.ElementType;
  accent?: Accent;
  isLoading?: boolean;
  onClick?: () => void;
  /** When provided, the whole card becomes a link to this route. */
  href?: string;
  size?: 'default' | 'lg';
  trendText?: string;
  isMain?: boolean;
}) {
  const styles = ACCENT_STYLES[accent];
  const numericValue = typeof value === 'number' ? value : null;
  const animatedValue = useCountUp(numericValue ?? 0);
  const displayValue = numericValue !== null ? animatedValue : value;

  const content = (
    <div className="relative flex flex-col justify-between h-full min-h-[110px]">
      <div className="flex items-start justify-between">
        <div>
          <p className={cn("text-xs font-semibold uppercase tracking-wider", isMain ? "text-white/80" : "text-slate-500")}>
            {label}
          </p>
          {isLoading ? (
            <div className={cn('mt-2 bg-slate-100/50 rounded animate-pulse', size === 'lg' ? 'h-10 w-20' : 'h-8 w-16')} />
          ) : (
            <p className={cn('font-bold mt-2 leading-none tracking-tight', isMain ? 'text-white' : 'text-slate-900', size === 'lg' ? 'text-4xl' : 'text-3xl')}>
              {displayValue}
            </p>
          )}
        </div>
        <div className={cn(
          'w-9 h-9 rounded-full flex items-center justify-center border transition-all duration-300',
          isMain ? 'bg-white/20 border-white/20 text-white' : cn(styles.soft, 'border-slate-100', styles.text)
        )}>
          <ArrowUpRight className="h-4.5 w-4.5" />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-1.5">
        {trendText ? (
          <span className={cn(
            'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase',
            isMain ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
          )}>
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
            {trendText}
          </span>
        ) : sublabel ? (
          <p className={cn('text-xs font-medium', isMain ? 'text-white/80' : styles.text)}>{sublabel}</p>
        ) : null}
      </div>
    </div>
  );

  const wrapperClass = isMain
    ? cn(
        'rounded-2xl border-0 bg-gradient-to-br shadow-md p-5 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 text-white',
        accent === 'indigo'
          ? 'from-indigo-600 to-violet-700'
          : accent === 'green'
          ? 'from-emerald-600 to-teal-700'
          : accent === 'teal'
          ? 'from-teal-600 to-cyan-700'
          : 'from-blue-600 to-indigo-700'
      )
    : 'p-5 hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 bg-white border border-slate-200/80';

  if (href) {
    return (
      <SectionCard className="p-0 overflow-hidden">
        <Link href={href} className={cn("block", wrapperClass)}>
          {content}
        </Link>
      </SectionCard>
    );
  }

  if (onClick) {
    return (
      <SectionCard className="p-0 overflow-hidden">
        <button type="button" onClick={onClick} className={cn("block w-full text-left", wrapperClass)}>
          {content}
        </button>
      </SectionCard>
    );
  }

  return (
    <SectionCard className="p-0 overflow-hidden">
      <div className={wrapperClass}>{content}</div>
    </SectionCard>
  );
}

// ============================================================================
// STATUS BADGE
// ============================================================================
const STATUS_STYLES: Record<string, string> = {
  completed: 'bg-emerald-50 text-emerald-700',
  reviewed: 'bg-blue-50 text-blue-700',
  ready: 'bg-emerald-50 text-emerald-700',
  processing: 'bg-amber-50 text-amber-700',
  queued: 'bg-amber-50 text-amber-700',
  uploaded: 'bg-orange-50 text-orange-700',
  pending: 'bg-amber-50 text-amber-700',
  failed: 'bg-red-50 text-red-700',
  active: 'bg-emerald-50 text-emerald-700',
  suspended: 'bg-red-50 text-red-700',
  inactive: 'bg-slate-100 text-slate-600',
};

export function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_STYLES[status?.toLowerCase()] || 'bg-slate-100 text-slate-600';
  return (
    <span className={cn('px-2.5 py-1 rounded-full text-xs font-semibold capitalize', cls)}>
      {status}
    </span>
  );
}

// ============================================================================
// QUICK ACTIONS
// ============================================================================
export function QuickActionsList({
  title = 'Quick Actions',
  actions,
  accent = 'blue',
}: {
  title?: string;
  accent?: Accent;
  actions: { label: string; onClick?: () => void; href?: string }[];
}) {
  const styles = ACCENT_STYLES[accent];
  return (
    <SectionCard className="p-5">
      <h3 className="text-sm font-semibold text-slate-900 mb-3">{title}</h3>
      <div className="space-y-2">
        {actions.map((action, i) =>
          action.href ? (
            <a
              key={i}
              href={action.href}
              className={cn(
                'block w-full text-left px-4 py-2.5 rounded-xl font-medium text-sm transition-colors',
                styles.soft,
                styles.text,
                'hover:brightness-95'
              )}
            >
              {action.label}
            </a>
          ) : (
            <button
              key={i}
              onClick={action.onClick}
              className={cn(
                'block w-full text-left px-4 py-2.5 rounded-xl font-medium text-sm transition-colors',
                styles.soft,
                styles.text,
                'hover:brightness-95'
              )}
            >
              {action.label}
            </button>
          )
        )}
      </div>
    </SectionCard>
  );
}

// ============================================================================
// ALERT LIST
// ============================================================================
export type AlertTone = 'info' | 'warning' | 'purple';

export function AlertList({
  title = 'Alerts & States',
  alerts,
}: {
  title?: string;
  alerts: { icon: React.ElementType; tone: AlertTone; heading: string; body: string }[];
}) {
  const toneStyles: Record<AlertTone, string> = {
    info: 'bg-blue-50 text-blue-700',
    warning: 'bg-amber-50 text-amber-800',
    purple: 'bg-violet-50 text-violet-700',
  };
  return (
    <SectionCard className="p-5">
      <h3 className="text-sm font-semibold text-slate-900 mb-3">{title}</h3>
      <div className="space-y-2.5">
        {alerts.map((a, i) => {
          const Icon = a.icon;
          return (
            <div key={i} className={cn('rounded-xl p-3', toneStyles[a.tone])}>
              <div className="flex gap-2">
                <Icon className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold">{a.heading}</p>
                  <p className="text-xs opacity-90 mt-0.5">{a.body}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

// ============================================================================
// MINI BAR CHART (recharts wrapper)
// ============================================================================
export function MiniBarChart({
  data,
  dataKey = 'value',
  color = ACCENT_HEX.teal,
  isLoading = false,
}: {
  data: { name: string; value: number }[];
  dataKey?: string;
  color?: string;
  isLoading?: boolean;
}) {
  const gradientColors = useMemo(() => {
    if (color === '#4f46e5' || color === 'indigo') return { start: '#818cf8', end: '#4f46e5' };
    if (color === '#0d9488' || color === 'teal') return { start: '#2dd4bf', end: '#0d9488' };
    if (color === '#2563eb' || color === 'blue') return { start: '#60a5fa', end: '#2563eb' };
    if (color === '#059669' || color === 'green') return { start: '#34d399', end: '#059669' };
    return { start: color, end: color };
  }, [color]);

  if (isLoading) {
    return <div className="h-[220px] rounded-xl bg-slate-100 animate-pulse" />;
  }

  const summary = `Bar chart: ${data.map((d) => `${d.name} ${d.value}`).join(', ')}`;
  const chartId = `bar-gradient-${color.replace('#', '')}`;

  return (
    <div role="img" aria-label={summary}>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} barSize={20} margin={{ top: 10, right: 5, left: -25, bottom: 0 }}>
          <defs>
            <linearGradient id={chartId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={gradientColors.start} stopOpacity={1} />
              <stop offset="100%" stopColor={gradientColors.end} stopOpacity={0.85} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis
            dataKey="name"
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 500 }}
            dy={8}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 500 }}
            dx={-8}
          />
          <Tooltip
            cursor={{ fill: 'rgba(241, 245, 249, 0.4)', radius: 4 }}
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                return (
                  <div className="bg-slate-900/95 backdrop-blur border border-slate-800 px-3 py-2 rounded-xl shadow-xl text-white">
                    <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">{label}</p>
                    <p className="text-xs font-black mt-0.5 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      {payload[0].value.toLocaleString()}
                    </p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Bar dataKey={dataKey} fill={`url(#${chartId})`} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ============================================================================
// DONUT STAT (recharts wrapper)
// ============================================================================
export function DonutStat({
  centerLabel = 'AI',
  segments,
  isLoading = false,
}: {
  centerLabel?: string;
  segments: { name: string; value: number; color: string }[];
  isLoading?: boolean;
}) {
  if (isLoading) {
    return <div className="h-[180px] rounded-full bg-slate-100 animate-pulse mx-auto max-w-[180px]" />;
  }
  const summary = `Donut chart: ${segments.map((s) => `${s.name} ${s.value}`).join(', ')}`;
  return (
    <div className="relative flex items-center justify-center" role="img" aria-label={summary}>
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie
            data={segments}
            dataKey="value"
            nameKey="name"
            innerRadius={55}
            outerRadius={78}
            paddingAngle={2}
            stroke="none"
          >
            {segments.map((s, i) => (
              <Cell key={i} fill={s.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className="text-lg font-bold text-slate-800">{centerLabel}</span>
      </div>
    </div>
  );
}

export function DonutLegend({
  segments,
}: {
  segments: { name: string; value: string | number; color: string }[];
}) {
  return (
    <div className="space-y-2 mt-3">
      {segments.map((s, i) => (
        <div key={i} className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-slate-600">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
            {s.name}
          </span>
          <span className="font-semibold text-slate-800">{s.value}</span>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// PAGE HEADER
// ============================================================================
export interface TimelineStep {
  label: string;
  href?: string;
  active?: boolean;
}

export function DashboardPageHeader({
  eyebrow,
  title,
  description,
  accent = 'blue',
  timelineSteps,
}: {
  eyebrow: string;
  title: string;
  description: string;
  accent?: Accent;
  timelineSteps?: TimelineStep[];
}) {
  const styles = ACCENT_STYLES[accent];
  return (
    <SectionCard className="p-6 md:p-8 relative overflow-hidden">
      <div className={cn('absolute inset-0 opacity-[0.05] bg-gradient-to-br', styles.gradient)} />
      <div className="relative">
        {timelineSteps && timelineSteps.length > 0 ? (
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider mb-2.5 flex-wrap">
            {timelineSteps.map((step, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && <span className="text-slate-400">→</span>}
                {step.active ? (
                  <span className="text-emerald-700 font-extrabold bg-emerald-50 border border-emerald-200/60 px-2.5 py-0.5 rounded shadow-sm">
                    {step.label}
                  </span>
                ) : step.href ? (
                  <Link
                    href={step.href}
                    className={cn(
                      'font-bold transition-all hover:underline',
                      styles.text,
                      'hover:brightness-90'
                    )}
                  >
                    {step.label}
                  </Link>
                ) : (
                  <span className="text-slate-500 font-semibold">{step.label}</span>
                )}
              </React.Fragment>
            ))}
          </div>
        ) : (
          <span className={cn('text-xs font-bold uppercase tracking-wider', styles.text)}>
            {eyebrow}
          </span>
        )}
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mt-1">{title}</h1>
        <p className="text-slate-500 mt-2 max-w-xl">{description}</p>
      </div>
    </SectionCard>
  );
}

// ============================================================================
// FADE IN — subtle mount transition for dashboard sections
// ============================================================================
export function FadeIn({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}

// ============================================================================
// PAGINATION — shared by admin tables (e.g. the Audit Log page)
// ============================================================================
export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  const from = (currentPage - 1) * pageSize + 1;
  const to = Math.min(currentPage * pageSize, totalItems);

  const pages: (number | string)[] = [];
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || (p >= currentPage - 1 && p <= currentPage + 1)) {
      pages.push(p);
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...');
    }
  }

  return (
    <div className="flex items-center justify-between pt-4">
      <span className="text-sm text-slate-500">
        Showing {from}-{to} of {totalItems}
      </span>
      <div className="flex items-center gap-1">
        <button
          aria-label="Previous page"
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {pages.map((p, i) =>
          typeof p === 'string' ? (
            <span key={`dots-${i}`} className="px-1 text-slate-400 text-sm">
              ...
            </span>
          ) : (
            <button
              key={p}
              aria-label={`Page ${p}`}
              aria-current={p === currentPage ? 'page' : undefined}
              onClick={() => onPageChange(p)}
              className={cn(
                'h-8 w-8 rounded-lg text-xs font-medium transition-colors',
                p === currentPage ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              )}
            >
              {p}
            </button>
          )
        )}
        <button
          aria-label="Next page"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/** Slices `items` into a page, clamping the current page when the list shrinks
 * (e.g. after a filter narrows the results) and exposing a `resetPage` to call
 * whenever a filter/search/sort input changes upstream. */
export function usePaginatedList<T>(items: T[], pageSize: number) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = items.slice((safePage - 1) * pageSize, safePage * pageSize);
  return {
    page: safePage,
    setPage,
    totalPages,
    paginated,
    resetPage: () => setPage(1),
  };
}
