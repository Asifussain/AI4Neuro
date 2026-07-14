'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import {
  BarChart,
  Bar,
  XAxis,
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

// ============================================================================
// SECTION CARD — light replacement for SpotlightCard
// ============================================================================
export function SectionCard({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
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
// STAT CARD
// ============================================================================
export function StatCard({
  label,
  value,
  sublabel,
  icon: Icon,
  accent = 'blue',
  isLoading = false,
}: {
  label: string;
  value: string | number;
  sublabel?: string;
  icon: React.ElementType;
  accent?: Accent;
  isLoading?: boolean;
}) {
  const styles = ACCENT_STYLES[accent];
  return (
    <SectionCard className="p-5">
      <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center mb-4', styles.solid)}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <p className="text-sm text-slate-500">{label}</p>
      {isLoading ? (
        <div className="h-8 w-16 mt-1 bg-slate-100 rounded animate-pulse" />
      ) : (
        <p className="text-3xl font-bold text-slate-900 mt-0.5">{value}</p>
      )}
      {sublabel && <p className={cn('text-sm font-medium mt-1', styles.text)}>{sublabel}</p>}
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
  color = '#0d9488',
}: {
  data: { name: string; value: number }[];
  dataKey?: string;
  color?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} barSize={18}>
        <XAxis
          dataKey="name"
          tickLine={false}
          axisLine={false}
          tick={{ fill: '#64748b', fontSize: 12 }}
        />
        <Bar dataKey={dataKey} fill={color} radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ============================================================================
// DONUT STAT (recharts wrapper)
// ============================================================================
export function DonutStat({
  centerLabel = 'AI',
  segments,
}: {
  centerLabel?: string;
  segments: { name: string; value: number; color: string }[];
}) {
  return (
    <div className="relative flex items-center justify-center">
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
export function DashboardPageHeader({
  eyebrow,
  title,
  description,
  routeChip,
  accent = 'blue',
}: {
  eyebrow: string;
  title: string;
  description: string;
  routeChip?: string;
  accent?: Accent;
}) {
  const styles = ACCENT_STYLES[accent];
  return (
    <SectionCard className="p-6 md:p-8 relative overflow-hidden">
      <div className={cn('absolute inset-0 opacity-[0.05] bg-gradient-to-br', styles.gradient)} />
      <div className="relative flex items-start justify-between gap-4 flex-wrap">
        <div>
          <span className={cn('text-xs font-bold uppercase tracking-wider', styles.text)}>
            {eyebrow}
          </span>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mt-1">{title}</h1>
          <p className="text-slate-500 mt-2 max-w-xl">{description}</p>
        </div>
        {routeChip && (
          <span className={cn('text-xs font-mono px-3 py-1.5 rounded-full', styles.soft, styles.text)}>
            {routeChip}
          </span>
        )}
      </div>
    </SectionCard>
  );
}
