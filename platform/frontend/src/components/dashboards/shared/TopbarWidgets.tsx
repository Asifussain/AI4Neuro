'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, User as UserIcon, KeyRound, LogOut, Loader2, Activity } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import { analysisApi } from '@/features/analysis/api';
import type { SessionStatusResponse } from '@/features/analysis/types';
import { cn } from '@/lib/utils';
import { ACCENT_STYLES, type Accent } from './primitives';

const LAST_SEEN_KEY = 'ai4neuro:notifications:last-seen';

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function statusColor(status: string): string {
  switch (status) {
    case 'completed':
      return 'text-emerald-600';
    case 'failed':
    case 'cancelled':
      return 'text-red-600';
    default:
      return 'text-amber-600';
  }
}

/**
 * Notification bell backed by real recent analysis activity from the backend.
 * The unread dot reflects sessions updated since the user last opened the
 * panel (persisted in localStorage) rather than being hardcoded.
 */
export function NotificationBell({ accent }: { accent: Accent }) {
  const styles = ACCENT_STYLES[accent];
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState<SessionStatusResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastSeen, setLastSeen] = useState<number>(0);
  const ref = useRef<HTMLDivElement>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(LAST_SEEN_KEY) : null;
    setLastSeen(raw ? Number(raw) : 0);
  }, []);

  const load = useCallback(async () => {
    // Only surface the loading spinner on the very first fetch; subsequent
    // opens show the cached list immediately and refresh in the background.
    setLoading((prev) => (loadedRef.current ? prev : true));
    try {
      const rows = await analysisApi.list({ limit: 8 });
      setSessions(rows);
    } catch {
      if (!loadedRef.current) setSessions([]);
    } finally {
      loadedRef.current = true;
      setLoading(false);
    }
  }, []);

  // Initial load so the unread dot is accurate before the panel is opened.
  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const unread = sessions.filter((s) => {
    const t = new Date(s.updated_at || s.created_at || 0).getTime();
    return !Number.isNaN(t) && t > lastSeen;
  }).length;

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      load();
      const now = Date.now();
      setLastSeen(now);
      if (typeof window !== 'undefined') window.localStorage.setItem(LAST_SEEN_KEY, String(now));
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggle}
        aria-label="Notifications"
        className="relative w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-700"
      >
        <Bell className="h-4.5 w-4.5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 rounded-xl bg-white border border-slate-200 shadow-lg z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-900">Notifications</span>
            <span className={cn('text-xs font-medium', styles.text)}>Recent analyses</span>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {loading && sessions.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-slate-400">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : sessions.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-500">
                No recent analysis activity
              </div>
            ) : (
              sessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setOpen(false);
                    router.push(`/analysis/${s.id}`);
                  }}
                  className="w-full flex items-start gap-3 px-4 py-3 hover:bg-slate-50 text-left border-b border-slate-50 last:border-0"
                >
                  <div className={cn('p-1.5 rounded-lg shrink-0', styles.soft)}>
                    <Activity className={cn('h-3.5 w-3.5', styles.text)} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-slate-800 truncate">
                      <span className="uppercase font-semibold">{s.modality}</span> analysis{' '}
                      <span className={cn('font-medium capitalize', statusColor(s.status))}>{s.status}</span>
                    </p>
                    <p className="text-[10px] text-slate-400">{timeAgo(s.updated_at || s.created_at)}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/** Profile avatar with a working dropdown (Profile / Change Password / Logout). */
export function ProfileMenu({ accent }: { accent: Accent }) {
  const styles = ACCENT_STYLES[accent];
  const { user, userProfile, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const displayName = userProfile?.full_name || user?.email || 'User';
  const initials = getInitials(displayName);
  const avatarUrl = userProfile?.avatar_url || (userProfile as any)?.avatar_url;

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Account menu"
        className={cn(
          'w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0 overflow-hidden border border-slate-200 shadow-sm',
          !avatarUrl && styles.solid
        )}
        title={displayName}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
        ) : (
          initials
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-xl bg-white border border-slate-200 shadow-lg z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="text-sm font-semibold text-slate-900 truncate">{displayName}</p>
            <p className="text-xs text-slate-500 capitalize">
              {userProfile?.role?.replace(/_/g, ' ') || 'User'}
            </p>
          </div>
          <div className="py-1">
            <Link
              href="/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <UserIcon className="h-4 w-4 text-slate-400" />
              Profile
            </Link>
            <Link
              href="/change-password"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <KeyRound className="h-4 w-4 text-slate-400" />
              Change Password
            </Link>
          </div>
          <div className="py-1 border-t border-slate-100">
            <button
              onClick={() => {
                setOpen(false);
                signOut();
              }}
              className="flex items-center gap-2.5 w-full px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
