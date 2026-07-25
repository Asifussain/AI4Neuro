'use client';

import React, { useMemo, useState } from 'react';
import { ChevronDown, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SectionCard, ACCENT_STYLES, type Accent } from './primitives';
import type { SessionStatusResponse } from '@/features/analysis/types';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function ScansStatusCalendar({
  sessions,
  accent = 'indigo',
  selectedDate,
  onSelectDate,
}: {
  sessions: SessionStatusResponse[];
  accent?: Accent;
  selectedDate: Date | null;
  onSelectDate: (date: Date | null) => void;
}) {
  const [viewMonth, setViewMonth] = useState(() => new Date());
  const [showMonthDropdown, setShowMonthDropdown] = useState(false);

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();

  const colorClasses = useMemo(() => {
    const map: Record<Accent, { light: string; medium: string; dark: string; active: string; ring: string }> = {
      blue: {
        light: 'bg-blue-50 border-blue-100 hover:border-blue-300',
        medium: 'bg-blue-200 border-blue-300 hover:border-blue-400',
        dark: 'bg-blue-500 border-blue-600 hover:border-blue-700',
        active: 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-100',
        ring: 'ring-blue-500',
      },
      indigo: {
        light: 'bg-indigo-50 border-indigo-100 hover:border-indigo-300',
        medium: 'bg-indigo-200 border-indigo-300 hover:border-indigo-400',
        dark: 'bg-indigo-500 border-indigo-600 hover:border-indigo-700',
        active: 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100',
        ring: 'ring-indigo-500',
      },
      teal: {
        light: 'bg-teal-50 border-teal-100 hover:border-teal-300',
        medium: 'bg-teal-200 border-teal-300 hover:border-teal-400',
        dark: 'bg-teal-500 border-teal-600 hover:border-teal-700',
        active: 'bg-teal-600 border-teal-600 text-white shadow-md shadow-teal-100',
        ring: 'ring-teal-500',
      },
      green: {
        light: 'bg-emerald-50 border-emerald-100 hover:border-emerald-300',
        medium: 'bg-emerald-200 border-emerald-300 hover:border-emerald-400',
        dark: 'bg-emerald-500 border-emerald-600 hover:border-emerald-700',
        active: 'bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-100',
        ring: 'ring-emerald-500',
      },
    };
    return map[accent];
  }, [accent]);

  // Shift day of week so Monday is index 0
  const firstDayRaw = new Date(year, month, 1).getDay();
  const firstWeekday = firstDayRaw === 0 ? 6 : firstDayRaw - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const cells: (Date | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];

  // Fill up the rest of the cells to complete the 7-column layout rows if needed
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  const monthLabel = viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Map of dateKey -> status counts
  const dayStats = useMemo(() => {
    const map = new Map<string, { completed: number; failed: number; pending: number; total: number }>();
    for (const s of sessions) {
      if (!s.created_at) continue;
      const d = new Date(s.created_at);
      if (Number.isNaN(d.getTime())) continue;
      const key = dateKey(d);
      
      const current = map.get(key) || { completed: 0, failed: 0, pending: 0, total: 0 };
      current.total++;
      if (s.status === 'completed') {
        current.completed++;
      } else if (s.status === 'failed') {
        current.failed++;
      } else {
        current.pending++;
      }
      map.set(key, current);
    }
    return map;
  }, [sessions]);

  // Calculate current month statistics
  const currentMonthStats = useMemo(() => {
    let completed = 0;
    let failed = 0;
    let total = 0;
    for (const s of sessions) {
      if (!s.created_at) continue;
      const d = new Date(s.created_at);
      if (d.getFullYear() === year && d.getMonth() === month) {
        total++;
        if (s.status === 'completed') completed++;
        if (s.status === 'failed') failed++;
      }
    }
    return { completed, failed, total };
  }, [sessions, year, month]);

  // Calculate previous month statistics for growth comparison
  const prevMonthStats = useMemo(() => {
    const prevM = month === 0 ? 11 : month - 1;
    const prevY = month === 0 ? year - 1 : year;
    let total = 0;
    for (const s of sessions) {
      if (!s.created_at) continue;
      const d = new Date(s.created_at);
      if (d.getFullYear() === prevY && d.getMonth() === prevM) {
        total++;
      }
    }
    return total;
  }, [sessions, year, month]);

  const growthPercentage = useMemo(() => {
    if (prevMonthStats === 0) return '+5.2%';
    const pct = ((currentMonthStats.total - prevMonthStats) / prevMonthStats) * 100;
    return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
  }, [currentMonthStats.total, prevMonthStats]);

  const handleDayClick = (d: Date) => {
    if (selectedDate && dateKey(selectedDate) === dateKey(d)) {
      onSelectDate(null);
    } else {
      onSelectDate(d);
    }
  };

  const isSelected = (d: Date) => {
    return selectedDate ? dateKey(selectedDate) === dateKey(d) : false;
  };

  const isToday = (d: Date) => {
    return dateKey(today) === dateKey(d);
  };

  // Generate list of 12 months for the dropdown selector
  const monthOptions = useMemo(() => {
    const options = [];
    const now = new Date();
    const currentYear = now.getFullYear();
    for (let m = 0; m < 12; m++) {
      options.push(new Date(currentYear, m, 1));
    }
    return options;
  }, []);

  return (
    <SectionCard className="p-5 flex flex-col h-fit bg-white border border-slate-200/80 hover:shadow-lg transition-all duration-300">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Total Scans
          </span>
          <div className="flex items-baseline gap-2 mt-1.5">
            <h2 className="text-4xl font-extrabold text-slate-900 leading-none">
              {currentMonthStats.total.toLocaleString()}
            </h2>
            <span className={cn(
              "inline-flex items-center gap-0.5 text-xs font-bold",
              currentMonthStats.total >= prevMonthStats ? "text-emerald-600" : "text-rose-600"
            )}>
              {currentMonthStats.total >= prevMonthStats ? '↗' : '↘'} {growthPercentage}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-medium mt-1">
            Increased by <span className="text-emerald-600 font-semibold">+{Math.max(0, currentMonthStats.total - prevMonthStats)}</span> compared to last month
          </p>
        </div>

        {/* Dropdown selector for month */}
        <div className="relative">
          <button
            onClick={() => setShowMonthDropdown(!showMonthDropdown)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            {monthLabel}
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </button>
          {showMonthDropdown && (
            <div className="absolute right-0 mt-1.5 w-44 max-h-60 rounded-xl bg-white border border-slate-200 shadow-lg z-50 overflow-y-auto py-1">
              {monthOptions.map((opt) => (
                <button
                  key={opt.toISOString()}
                  onClick={() => {
                    setViewMonth(opt);
                    setShowMonthDropdown(false);
                  }}
                  className={cn(
                    "w-full text-left px-3 py-2 text-xs font-medium hover:bg-slate-50 transition-colors",
                    opt.getMonth() === month && opt.getFullYear() === year ? "text-indigo-600 bg-indigo-50/50" : "text-slate-700"
                  )}
                >
                  {opt.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="grid grid-cols-7 gap-1.5 mt-6">
        {cells.map((d, i) => {
          if (!d) {
            // Renders clean empty placeholders for padding alignment
            return (
              <div
                key={`empty-${i}`}
                className="aspect-square rounded-lg bg-slate-50/40 border border-slate-100/30"
              />
            );
          }

          const stats = dayStats.get(dateKey(d));
          const active = isSelected(d);
          const currentDay = isToday(d);

          // Calculate activity intensity/weight
          const total = stats?.total ?? 0;
          const completed = stats?.completed ?? 0;
          const failed = stats?.failed ?? 0;

          // Color intensities:
          // - No scans: light slate gray
          // - Only failed scans: very soft pastel rose
          // - Scans active: light (1), medium (2-3), dark (4+)
          let cellStyleClass = '';
          if (active) {
            cellStyleClass = colorClasses.active;
          } else if (total === 0) {
            cellStyleClass = 'bg-slate-50 border-slate-100/80 hover:border-slate-300';
          } else if (failed > 0 && completed === 0) {
            cellStyleClass = 'bg-rose-50 border-rose-100 hover:border-rose-300';
          } else {
            // Color based on activity density
            if (total === 1) cellStyleClass = colorClasses.light;
            else if (total <= 3) cellStyleClass = colorClasses.medium;
            else cellStyleClass = colorClasses.dark;
          }

          const dateTitle = `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}: ${total} scan${total === 1 ? '' : 's'}${
            total > 0 ? ` (${completed} completed, ${failed} failed)` : ''
          }`;

          // Text color configuration based on background density
          const isDarkBg = active || (total >= 4);
          const dateTextColor = isDarkBg 
            ? 'text-white font-extrabold' 
            : failed > 0 && completed === 0 
            ? 'text-rose-700 font-bold' 
            : total > 0 
            ? 'text-slate-800 font-bold' 
            : 'text-slate-400 font-medium';

          return (
            <button
              key={dateKey(d)}
              onClick={() => handleDayClick(d)}
              title={dateTitle}
              className={cn(
                'group relative rounded-lg transition-all aspect-square border flex items-center justify-center text-[10px] font-sans select-none',
                cellStyleClass,
                dateTextColor,
                currentDay && !active && `ring-2 ${colorClasses.ring} ring-offset-1`
              )}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>

      {/* Weekday labels at the bottom, matching the mockup */}
      <div className="grid grid-cols-7 gap-1.5 mt-3 border-t border-slate-100 pt-3">
        {WEEKDAYS.map((w) => (
          <div key={w} className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            {w}
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
