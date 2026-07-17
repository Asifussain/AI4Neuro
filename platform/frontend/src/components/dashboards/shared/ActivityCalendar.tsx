'use client';

import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ACCENT_STYLES, type Accent } from './primitives';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/**
 * Month calendar marking days that have activity (analysis sessions), in the
 * caller's dashboard accent. Driven entirely by an already-fetched list of
 * timestamps — no separate API call — so it reflects whatever the current
 * role already sees (patients for a doctor, assigned scans for a radiologist,
 * hospital-wide sessions for an admin, etc. — the backend's existing
 * role-scoping on the session list is what makes this "act accordingly").
 */
export function ActivityCalendar({
  title,
  timestamps,
  accent,
  onClose,
}: {
  title: string;
  timestamps: (string | null | undefined)[];
  accent: Accent;
  onClose: () => void;
}) {
  const styles = ACCENT_STYLES[accent];
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const countsByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const ts of timestamps) {
      if (!ts) continue;
      const d = new Date(ts);
      if (Number.isNaN(d.getTime())) continue;
      const key = dateKey(d);
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  }, [timestamps]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const cells: (Date | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];

  const monthLabel = cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl bg-white border border-slate-200 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <p className="text-sm font-semibold text-slate-900">{title}</p>
            <p className="text-xs text-slate-500">Dates with recorded activity</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setCursor(new Date(year, month - 1, 1))}
              className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="text-sm font-semibold text-slate-900">{monthLabel}</p>
            <button
              onClick={() => setCursor(new Date(year, month + 1, 1))}
              className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAYS.map((w) => (
              <div key={w} className="text-center text-[10px] font-semibold text-slate-400 py-1">
                {w}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              if (!d) return <div key={`blank-${i}`} />;
              const count = countsByDay.get(dateKey(d)) || 0;
              const isToday = dateKey(d) === dateKey(today);
              return (
                <div
                  key={dateKey(d)}
                  title={count > 0 ? `${count} analysis session${count === 1 ? '' : 's'}` : undefined}
                  className={cn(
                    'aspect-square rounded-lg flex items-center justify-center text-xs font-medium transition-colors',
                    count > 0 ? cn(styles.solid, 'text-white') : 'text-slate-600 hover:bg-slate-50',
                    isToday && count === 0 && cn('ring-2', styles.ring)
                  )}
                >
                  {d.getDate()}
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-2 mt-4 text-xs text-slate-500">
            <span className={cn('w-2.5 h-2.5 rounded', styles.solid)} />
            Has activity
          </div>
        </div>
      </div>
    </div>
  );
}
