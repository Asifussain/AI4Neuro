'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRadiologistStats, useMySessions, useDeleteSession } from '@/lib/hooks/useApi';
import { toast } from 'sonner';
import { ReportViewer } from '@/components/shared/ReportViewer';
import type { MRISession } from '@/lib/api/sessions';
import {
  Upload,
  Activity,
  Clock,
  CheckCircle2,
  Eye,
  Download,
  Search,
  Brain,
  FileText,
  X,
  ChevronRight,
  ChevronLeft,
  CheckCircle,
  AlertCircle,
  Loader2,
  Trash2,
  LayoutGrid,
  List,
  ArrowUpDown,
  Filter,
  CalendarDays,
} from 'lucide-react';
import Link from 'next/link';
import {
  SpotlightCard,
  GradientText,
  AnimatedCounter,
  AuroraBackground,
  GridPattern,
} from '@/components/ui/animated';

// ============================================================================
// STAT CARD
// ============================================================================
function StatCard({
  title,
  value,
  icon: Icon,
  description,
  color = 'purple',
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  description: string;
  color?: 'purple' | 'teal' | 'blue' | 'green' | 'orange';
}) {
  const colorStyles: Record<string, string> = {
    purple: 'from-purple-500 to-violet-500',
    teal: 'from-teal-500 to-cyan-500',
    blue: 'from-blue-500 to-indigo-500',
    green: 'from-green-500 to-emerald-500',
    orange: 'from-orange-500 to-amber-500',
  };
  const bgColorStyles: Record<string, string> = {
    purple: 'bg-purple-500/10',
    teal: 'bg-teal-500/10',
    blue: 'bg-blue-500/10',
    green: 'bg-green-500/10',
    orange: 'bg-orange-500/10',
  };
  const iconColors: Record<string, string> = {
    purple: '#a855f7',
    teal: '#14b8a6',
    blue: '#3b82f6',
    green: '#22c55e',
    orange: '#f97316',
  };

  return (
    <SpotlightCard className="p-5">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm text-slate-400">{title}</p>
          <span className={`text-2xl font-bold bg-gradient-to-r ${colorStyles[color]} bg-clip-text text-transparent`}>
            {typeof value === 'number' ? <AnimatedCounter value={value} /> : value}
          </span>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
        <div className={`p-3 rounded-xl ${bgColorStyles[color]}`}>
          <Icon className="h-5 w-5" style={{ color: iconColors[color] }} />
        </div>
      </div>
    </SpotlightCard>
  );
}

// ============================================================================
// SESSION ROW (List View)
// ============================================================================
function SessionRow({
  session,
  onViewReport,
  onDelete,
}: {
  session: MRISession;
  onViewReport: (session: MRISession) => void;
  onDelete?: (sessionId: string) => void;
}) {
  const statusConfig: Record<string, { icon: React.ElementType; color: string; bg: string; animate?: boolean }> = {
    completed: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/10' },
    reviewed: { icon: CheckCircle, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    processing: { icon: Loader2, color: 'text-yellow-400', bg: 'bg-yellow-500/10', animate: true },
    uploaded: { icon: Clock, color: 'text-orange-400', bg: 'bg-orange-500/10' },
    failed: { icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-500/10' },
  };

  const status = statusConfig[session.status] || statusConfig.processing;
  const StatusIcon = status.icon;
  const patientName = session.patient?.user_profile?.full_name || 'Unknown';
  const prediction = session.prediction?.prediction;

  return (
    <div className="group p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-teal-500/30 hover:bg-white/[0.04] transition-all duration-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <div className="p-2 rounded-lg bg-teal-500/10 shrink-0">
            <Brain className="h-5 w-5 text-teal-400" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-foreground truncate">{session.session_code}</p>
            <p className="text-sm text-muted-foreground truncate">
              {patientName} <span className="hidden sm:inline">| {new Date(session.scan_date).toLocaleDateString()}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {prediction && (
            <div className={`px-3 py-1 rounded-full text-sm font-medium hidden sm:block ${
              prediction === 'CN' ? 'bg-green-500/10 text-green-400'
                : prediction === 'MCI' ? 'bg-yellow-500/10 text-yellow-400'
                : 'bg-red-500/10 text-red-400'
            }`}>
              {prediction}
            </div>
          )}
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${status.bg}`}>
            <StatusIcon className={`h-3.5 w-3.5 ${status.color} ${status.animate ? 'animate-spin' : ''}`} />
            <span className={`text-xs font-medium capitalize ${status.color} hidden sm:inline`}>{session.status}</span>
          </div>
          <div className="flex gap-1">
            {(session.status === 'completed' || session.status === 'reviewed') && (
              <>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-teal-500/10" asChild>
                  <Link href={`/radiologist/viewer/${session.id}`}><Eye className="h-4 w-4 text-teal-400" /></Link>
                </Button>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-purple-500/10" onClick={() => onViewReport(session)}>
                  <Download className="h-4 w-4 text-purple-400" />
                </Button>
              </>
            )}
            {onDelete && (
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-red-500/10" onClick={() => onDelete(session.id)}>
                <Trash2 className="h-4 w-4 text-red-400" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SCAN GRID CARD (Grid View)
// ============================================================================
function ScanGridCard({
  session,
  onViewReport,
  onDelete,
}: {
  session: MRISession;
  onViewReport: (session: MRISession) => void;
  onDelete?: (sessionId: string) => void;
}) {
  const prediction = session.prediction?.prediction;
  const confidence = session.prediction?.confidence_score;
  const patientName = session.patient?.user_profile?.full_name || 'Unknown';
  const isCompleted = session.status === 'completed' || session.status === 'reviewed';

  const predictionColors: Record<string, { border: string; bg: string; text: string }> = {
    CN: { border: 'border-green-500/30', bg: 'bg-green-500/10', text: 'text-green-400' },
    MCI: { border: 'border-yellow-500/30', bg: 'bg-yellow-500/10', text: 'text-yellow-400' },
    AD: { border: 'border-red-500/30', bg: 'bg-red-500/10', text: 'text-red-400' },
  };
  const pColor = prediction ? predictionColors[prediction] : null;

  const statusColors: Record<string, string> = {
    completed: 'text-green-400',
    reviewed: 'text-blue-400',
    processing: 'text-yellow-400',
    uploaded: 'text-orange-400',
    failed: 'text-red-400',
  };

  return (
    <SpotlightCard className={`p-4 h-full flex flex-col ${pColor ? pColor.border : 'border-white/[0.05]'}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-teal-400" />
          <span className="text-sm font-semibold text-foreground truncate">{session.session_code}</span>
        </div>
        {prediction && pColor && (
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${pColor.bg} ${pColor.text}`}>
            {prediction}
          </span>
        )}
      </div>

      {/* Patient & Date */}
      <div className="space-y-1.5 mb-3 flex-1">
        <p className="text-sm text-foreground truncate">{patientName}</p>
        <p className="text-xs text-muted-foreground">{new Date(session.scan_date).toLocaleDateString()}</p>
        <div className="flex items-center gap-1.5">
          <span className={`text-xs font-medium capitalize ${statusColors[session.status] || 'text-slate-400'}`}>
            {session.status}
          </span>
          {session.status === 'processing' && <Loader2 className="h-3 w-3 text-yellow-400 animate-spin" />}
        </div>
      </div>

      {/* Confidence Bar */}
      {confidence != null && confidence > 0 && (
        <div className="mb-3">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-muted-foreground">Confidence</span>
            <span className="text-foreground font-medium">{(confidence * 100).toFixed(0)}%</span>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${
                prediction === 'CN' ? 'bg-green-500' : prediction === 'MCI' ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${confidence * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-1.5 pt-2 border-t border-white/[0.05]">
        {isCompleted && (
          <>
            <Button size="sm" variant="outline" className="flex-1 h-7 text-xs gap-1 border-teal-500/30 text-teal-400 hover:bg-teal-500/10" asChild>
              <Link href={`/radiologist/viewer/${session.id}`}><Eye className="h-3 w-3" />View</Link>
            </Button>
            <Button size="sm" variant="outline" className="flex-1 h-7 text-xs gap-1 border-purple-500/30 text-purple-400 hover:bg-purple-500/10" onClick={() => onViewReport(session)}>
              <FileText className="h-3 w-3" />Reports
            </Button>
          </>
        )}
        {!isCompleted && (
          <span className="flex-1 text-xs text-muted-foreground text-center py-1">
            {session.status === 'processing' ? 'Analyzing...' : session.status}
          </span>
        )}
        {onDelete && (
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 hover:bg-red-500/10" onClick={() => onDelete(session.id)}>
            <Trash2 className="h-3 w-3 text-red-400" />
          </Button>
        )}
      </div>
    </SpotlightCard>
  );
}

// ============================================================================
// MINI CALENDAR (No External Deps)
// ============================================================================
function MiniCalendar({
  selectedDate,
  onSelectDate,
  scanDates,
}: {
  selectedDate: Date | null;
  onSelectDate: (date: Date | null) => void;
  scanDates: Set<string>;
}) {
  const [viewMonth, setViewMonth] = useState(new Date());
  const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = viewMonth.toLocaleString('default', { month: 'long', year: 'numeric' });

  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);

  const toKey = (d: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const isSelected = (d: number) => {
    if (!selectedDate) return false;
    return selectedDate.getFullYear() === year && selectedDate.getMonth() === month && selectedDate.getDate() === d;
  };
  const isToday = (d: number) => {
    const now = new Date();
    return now.getFullYear() === year && now.getMonth() === month && now.getDate() === d;
  };

  return (
    <SpotlightCard className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-teal-400" />
          {monthName}
        </h3>
        <div className="flex gap-1">
          <button onClick={() => setViewMonth(new Date(year, month - 1, 1))} className="p-1 rounded hover:bg-white/10 text-muted-foreground">
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setViewMonth(new Date(year, month + 1, 1))} className="p-1 rounded hover:bg-white/10 text-muted-foreground">
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {dayNames.map((d) => (
          <div key={d} className="text-center text-[10px] text-muted-foreground font-medium py-1">{d}</div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((day, i) => {
          if (day === null) return <div key={`e-${i}`} />;
          const hasScan = scanDates.has(toKey(day));
          const sel = isSelected(day);
          const today = isToday(day);

          return (
            <button
              key={day}
              onClick={() => onSelectDate(sel ? null : new Date(year, month, day))}
              className={`relative text-xs py-1.5 rounded transition-all ${
                sel
                  ? 'bg-teal-500 text-white font-bold'
                  : today
                  ? 'bg-white/10 text-foreground font-medium'
                  : 'text-muted-foreground hover:bg-white/5'
              }`}
            >
              {day}
              {hasScan && !sel && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-teal-400" />
              )}
            </button>
          );
        })}
      </div>

      {selectedDate && (
        <button
          onClick={() => onSelectDate(null)}
          className="mt-2 w-full text-xs text-teal-400 hover:text-teal-300 transition-colors"
        >
          Clear date filter
        </button>
      )}
    </SpotlightCard>
  );
}

// ============================================================================
// PAGINATION
// ============================================================================
function Pagination({
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
      <span className="text-sm text-muted-foreground">
        Showing {from}-{to} of {totalItems}
      </span>
      <div className="flex items-center gap-1">
        <Button size="sm" variant="ghost" disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)} className="h-8 w-8 p-0">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {pages.map((p, i) =>
          typeof p === 'string' ? (
            <span key={`dots-${i}`} className="px-1 text-muted-foreground text-sm">...</span>
          ) : (
            <Button
              key={p}
              size="sm"
              variant={p === currentPage ? 'default' : 'ghost'}
              className={`h-8 w-8 p-0 text-xs ${p === currentPage ? 'bg-teal-500 hover:bg-teal-600' : ''}`}
              onClick={() => onPageChange(p)}
            >
              {p}
            </Button>
          )
        )}
        <Button size="sm" variant="ghost" disabled={currentPage === totalPages} onClick={() => onPageChange(currentPage + 1)} className="h-8 w-8 p-0">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// LOADING SKELETONS
// ============================================================================
function StatCardSkeleton() {
  return (
    <div className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.05] animate-pulse">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="h-4 w-20 bg-slate-700 rounded" />
          <div className="h-7 w-14 bg-slate-600 rounded" />
          <div className="h-3 w-24 bg-slate-700 rounded" />
        </div>
        <div className="h-11 w-11 bg-slate-700 rounded-xl" />
      </div>
    </div>
  );
}

function GridCardSkeleton() {
  return (
    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] animate-pulse">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-4 w-4 bg-slate-700 rounded" />
        <div className="h-4 w-24 bg-slate-600 rounded" />
      </div>
      <div className="space-y-2 mb-3">
        <div className="h-4 w-32 bg-slate-700 rounded" />
        <div className="h-3 w-20 bg-slate-700 rounded" />
      </div>
      <div className="h-1.5 w-full bg-slate-700 rounded-full mb-3" />
      <div className="h-7 w-full bg-slate-700 rounded" />
    </div>
  );
}

function RowSkeleton() {
  return (
    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-9 w-9 bg-slate-700 rounded-lg" />
          <div className="space-y-2">
            <div className="h-4 w-28 bg-slate-600 rounded" />
            <div className="h-3 w-20 bg-slate-700 rounded" />
          </div>
        </div>
        <div className="h-6 w-16 bg-slate-700 rounded-full" />
      </div>
    </div>
  );
}

// ============================================================================
// MAIN RADIOLOGIST DASHBOARD
// ============================================================================
export const RadiologistDashboard: React.FC = () => {
  // View state
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'patient' | 'status'>('date-desc');

  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [predictionFilter, setPredictionFilter] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Modal state
  const [selectedSession, setSelectedSession] = useState<MRISession | null>(null);

  // Data
  const { data: stats, isLoading: statsLoading, error: statsError } = useRadiologistStats();
  const { data: sessionsData, isLoading: sessionsLoading, refetch: refetchSessions } = useMySessions();
  const { deleteSession } = useDeleteSession();

  const allSessions = sessionsData?.data || [];

  const handleDelete = useCallback(async (sessionId: string) => {
    if (!confirm('Delete this session? This cannot be undone.')) return;
    const success = await deleteSession(sessionId);
    if (success) {
      toast.success('Session deleted');
      refetchSessions();
    } else {
      toast.error('Failed to delete session');
    }
  }, [deleteSession, refetchSessions]);

  // Scan dates for calendar
  const scanDates = useMemo(() => {
    const dates = new Set<string>();
    allSessions.forEach((s) => {
      const d = new Date(s.scan_date);
      dates.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    });
    return dates;
  }, [allSessions]);

  // Filtering + sorting + pagination pipeline
  const PAGE_SIZE = 12;

  const filteredSessions = useMemo(() => {
    let result = [...allSessions];

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((s) => s.status === statusFilter);
    }

    // Prediction filter
    if (predictionFilter !== 'all') {
      result = result.filter((s) => s.prediction?.prediction === predictionFilter);
    }

    // Date filter
    if (selectedDate) {
      result = result.filter((s) => {
        const d = new Date(s.scan_date);
        return d.getFullYear() === selectedDate.getFullYear() &&
          d.getMonth() === selectedDate.getMonth() &&
          d.getDate() === selectedDate.getDate();
      });
    }

    // Search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter((s) =>
        s.session_code.toLowerCase().includes(term) ||
        s.patient?.user_profile?.full_name?.toLowerCase().includes(term)
      );
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'date-desc': return new Date(b.scan_date).getTime() - new Date(a.scan_date).getTime();
        case 'date-asc': return new Date(a.scan_date).getTime() - new Date(b.scan_date).getTime();
        case 'patient': return (a.patient?.user_profile?.full_name || '').localeCompare(b.patient?.user_profile?.full_name || '');
        case 'status': return a.status.localeCompare(b.status);
        default: return 0;
      }
    });

    return result;
  }, [allSessions, statusFilter, predictionFilter, selectedDate, searchTerm, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredSessions.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedSessions = filteredSessions.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Reset page when filters change
  const updateFilter = useCallback((setter: (v: any) => void, value: any) => {
    setter(value);
    setCurrentPage(1);
  }, []);

  // Active filters count
  const activeFilterCount = [
    statusFilter !== 'all',
    predictionFilter !== 'all',
    selectedDate !== null,
    searchTerm !== '',
  ].filter(Boolean).length;

  // Prediction distribution
  const predictionCounts = useMemo(() => {
    const counts = { CN: 0, MCI: 0, AD: 0 };
    allSessions.forEach((s) => {
      const p = s.prediction?.prediction;
      if (p && p in counts) counts[p as keyof typeof counts]++;
    });
    return counts;
  }, [allSessions]);

  // Recent activity
  const recentActivity = useMemo(() => {
    return [...allSessions]
      .sort((a, b) => new Date(b.scan_date).getTime() - new Date(a.scan_date).getTime())
      .slice(0, 5);
  }, [allSessions]);

  const isLoading = statsLoading && sessionsLoading && allSessions.length === 0;

  return (
    <div className="relative min-h-screen bg-background">
      <AuroraBackground />
      <GridPattern />

      <div className="relative z-10 p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              <GradientText from="from-teal-400" via="via-cyan-400" to="to-purple-400">
                Radiologist Dashboard
              </GradientText>
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Welcome back
              <span className="mx-2 text-muted">|</span>
              <span className="px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-400 text-xs font-medium">
                Radiology Department
              </span>
            </p>
          </div>
          <Button className="gap-2 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600" asChild>
            <Link href="/radiologist/upload">
              <Upload className="h-4 w-4" />
              Upload Scan
            </Link>
          </Button>
        </div>

        {/* Error */}
        {statsError && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            Failed to load stats: {statsError}
          </div>
        )}

        {/* Stats */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {isLoading ? (
            <>{[1, 2, 3, 4].map((i) => <StatCardSkeleton key={i} />)}</>
          ) : (
            <>
              <StatCard title="Total Scans" value={stats?.totalScans || allSessions.length} icon={Activity} description="All-time processed" color="teal" />
              <StatCard title="Processing" value={stats?.processingScans || allSessions.filter((s) => s.status === 'processing').length} icon={Clock} description="Currently in queue" color="orange" />
              <StatCard title="Completed Today" value={stats?.completedToday || 0} icon={CheckCircle2} description="Finished today" color="green" />
              <StatCard title="This Week" value={stats?.completedThisWeek || 0} icon={CalendarDays} description="Completed this week" color="blue" />
            </>
          )}
        </div>

        {/* Main Content + Sidebar */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          {/* Main Content Area */}
          <div className="xl:col-span-3 space-y-4">
            {/* Toolbar */}
            <SpotlightCard className="p-4">
              <div className="flex flex-col gap-3">
                {/* Top row: View toggle, filters button, search, sort */}
                <div className="flex items-center gap-3 flex-wrap">
                  {/* View mode toggle */}
                  <div className="flex rounded-lg border border-white/[0.08] overflow-hidden">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`p-2 transition-colors ${viewMode === 'grid' ? 'bg-teal-500/20 text-teal-400' : 'text-muted-foreground hover:bg-white/5'}`}
                    >
                      <LayoutGrid className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      className={`p-2 transition-colors ${viewMode === 'list' ? 'bg-teal-500/20 text-teal-400' : 'text-muted-foreground hover:bg-white/5'}`}
                    >
                      <List className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Filter toggle */}
                  <Button
                    size="sm"
                    variant="outline"
                    className={`gap-1.5 ${showFilters || activeFilterCount > 0 ? 'border-teal-500/30 text-teal-400' : 'border-white/[0.08]'}`}
                    onClick={() => setShowFilters(!showFilters)}
                  >
                    <Filter className="h-3.5 w-3.5" />
                    Filters
                    {activeFilterCount > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 rounded-full bg-teal-500 text-white text-[10px] font-bold">
                        {activeFilterCount}
                      </span>
                    )}
                  </Button>

                  {/* Search */}
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by session or patient..."
                      className="pl-9 h-9 bg-white/[0.02] border-white/[0.08] text-foreground placeholder:text-muted-foreground focus:border-teal-500/50"
                      value={searchTerm}
                      onChange={(e) => updateFilter(setSearchTerm, e.target.value)}
                    />
                    {searchTerm && (
                      <button onClick={() => updateFilter(setSearchTerm, '')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Sort */}
                  <div className="flex items-center gap-1.5">
                    <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                      className="bg-transparent text-sm text-muted-foreground border-none outline-none cursor-pointer"
                    >
                      <option value="date-desc">Newest</option>
                      <option value="date-asc">Oldest</option>
                      <option value="patient">Patient</option>
                      <option value="status">Status</option>
                    </select>
                  </div>
                </div>

                {/* Filter dropdowns (collapsible) */}
                {showFilters && (
                  <div className="flex items-center gap-3 flex-wrap pt-2 border-t border-white/[0.05]">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Status:</span>
                      <select
                        value={statusFilter}
                        onChange={(e) => updateFilter(setStatusFilter, e.target.value)}
                        className="bg-white/[0.03] border border-white/[0.08] rounded-md text-sm text-foreground px-2 py-1 outline-none focus:border-teal-500/50"
                      >
                        <option value="all">All</option>
                        <option value="completed">Completed</option>
                        <option value="processing">Processing</option>
                        <option value="reviewed">Reviewed</option>
                        <option value="uploaded">Uploaded</option>
                        <option value="failed">Failed</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Prediction:</span>
                      <select
                        value={predictionFilter}
                        onChange={(e) => updateFilter(setPredictionFilter, e.target.value)}
                        className="bg-white/[0.03] border border-white/[0.08] rounded-md text-sm text-foreground px-2 py-1 outline-none focus:border-teal-500/50"
                      >
                        <option value="all">All</option>
                        <option value="CN">CN - Normal</option>
                        <option value="MCI">MCI - Mild Impairment</option>
                        <option value="AD">AD - Alzheimer's</option>
                      </select>
                    </div>
                    {activeFilterCount > 0 && (
                      <button
                        onClick={() => {
                          setStatusFilter('all');
                          setPredictionFilter('all');
                          setSelectedDate(null);
                          setSearchTerm('');
                          setCurrentPage(1);
                        }}
                        className="text-xs text-red-400 hover:text-red-300 ml-auto"
                      >
                        Clear all filters
                      </button>
                    )}
                  </div>
                )}
              </div>
            </SpotlightCard>

            {/* Active Filter Chips */}
            {activeFilterCount > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                {statusFilter !== 'all' && (
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-500/10 text-teal-400 text-xs font-medium">
                    Status: {statusFilter}
                    <button onClick={() => updateFilter(setStatusFilter, 'all')}><X className="h-3 w-3" /></button>
                  </span>
                )}
                {predictionFilter !== 'all' && (
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-400 text-xs font-medium">
                    Prediction: {predictionFilter}
                    <button onClick={() => updateFilter(setPredictionFilter, 'all')}><X className="h-3 w-3" /></button>
                  </span>
                )}
                {selectedDate && (
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-medium">
                    Date: {selectedDate.toLocaleDateString()}
                    <button onClick={() => updateFilter(setSelectedDate, null)}><X className="h-3 w-3" /></button>
                  </span>
                )}
                {searchTerm && (
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500/10 text-orange-400 text-xs font-medium">
                    Search: "{searchTerm}"
                    <button onClick={() => updateFilter(setSearchTerm, '')}><X className="h-3 w-3" /></button>
                  </span>
                )}
              </div>
            )}

            {/* Results count */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {filteredSessions.length} {filteredSessions.length === 1 ? 'session' : 'sessions'}
                {activeFilterCount > 0 && ` (filtered from ${allSessions.length})`}
              </span>
            </div>

            {/* Sessions Display */}
            {sessionsLoading && allSessions.length === 0 ? (
              viewMode === 'grid' ? (
                <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                  {[1, 2, 3, 4, 5, 6].map((i) => <GridCardSkeleton key={i} />)}
                </div>
              ) : (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => <RowSkeleton key={i} />)}
                </div>
              )
            ) : paginatedSessions.length === 0 ? (
              <SpotlightCard className="p-12">
                <div className="text-center">
                  <div className="p-4 rounded-full bg-teal-500/10 w-fit mx-auto mb-4">
                    <Brain className="h-8 w-8 text-teal-400" />
                  </div>
                  <p className="text-foreground font-medium mb-1">No sessions found</p>
                  <p className="text-sm text-muted-foreground">
                    {activeFilterCount > 0
                      ? 'Try adjusting your filters'
                      : 'Upload a new MRI scan to get started'}
                  </p>
                  {activeFilterCount === 0 && (
                    <Button className="mt-4 gap-2" variant="outline" asChild>
                      <Link href="/radiologist/upload"><Upload className="h-4 w-4" />Upload Scan</Link>
                    </Button>
                  )}
                </div>
              </SpotlightCard>
            ) : viewMode === 'grid' ? (
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {paginatedSessions.map((session) => (
                  <ScanGridCard
                    key={session.id}
                    session={session}
                    onViewReport={setSelectedSession}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {paginatedSessions.map((session) => (
                  <SessionRow
                    key={session.id}
                    session={session}
                    onViewReport={setSelectedSession}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}

            {/* Pagination */}
            <Pagination
              currentPage={safePage}
              totalPages={totalPages}
              totalItems={filteredSessions.length}
              pageSize={PAGE_SIZE}
              onPageChange={setCurrentPage}
            />
          </div>

          {/* Right Sidebar */}
          <div className="space-y-4">
            {/* Mini Calendar */}
            <MiniCalendar
              selectedDate={selectedDate}
              onSelectDate={(d) => updateFilter(setSelectedDate, d)}
              scanDates={scanDates}
            />

            {/* Recent Activity */}
            <SpotlightCard className="p-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                <Activity className="h-4 w-4 text-teal-400" />
                Recent Activity
              </h3>
              <div className="space-y-2">
                {recentActivity.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No recent activity</p>
                ) : (
                  recentActivity.map((s) => {
                    const statusIcons: Record<string, { icon: React.ElementType; color: string }> = {
                      completed: { icon: CheckCircle, color: 'text-green-400' },
                      reviewed: { icon: CheckCircle, color: 'text-blue-400' },
                      processing: { icon: Loader2, color: 'text-yellow-400' },
                      failed: { icon: AlertCircle, color: 'text-red-400' },
                      uploaded: { icon: Clock, color: 'text-orange-400' },
                    };
                    const si = statusIcons[s.status] || statusIcons.uploaded;
                    const SIcon = si.icon;
                    return (
                      <div key={s.id} className="flex items-center gap-2 py-1.5 border-b border-white/[0.03] last:border-0">
                        <SIcon className={`h-3.5 w-3.5 shrink-0 ${si.color} ${s.status === 'processing' ? 'animate-spin' : ''}`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-foreground truncate">{s.session_code}</p>
                          <p className="text-[10px] text-muted-foreground">{new Date(s.scan_date).toLocaleDateString()}</p>
                        </div>
                        <span className={`text-[10px] capitalize ${si.color}`}>{s.status}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </SpotlightCard>

            {/* Prediction Distribution */}
            <SpotlightCard className="p-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                <Brain className="h-4 w-4 text-purple-400" />
                Prediction Distribution
              </h3>
              <div className="space-y-2">
                {(['CN', 'MCI', 'AD'] as const).map((cls) => {
                  const total = predictionCounts.CN + predictionCounts.MCI + predictionCounts.AD;
                  const pct = total > 0 ? (predictionCounts[cls] / total) * 100 : 0;
                  const colors = { CN: 'bg-green-500', MCI: 'bg-yellow-500', AD: 'bg-red-500' };
                  const labels = { CN: 'Normal', MCI: 'MCI', AD: "Alzheimer's" };
                  return (
                    <div key={cls}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">{labels[cls]}</span>
                        <span className="text-foreground font-medium">{predictionCounts[cls]}</span>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${colors[cls]} transition-all`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </SpotlightCard>
          </div>
        </div>
      </div>

      {/* Report Modal */}
      {selectedSession && selectedSession.prediction && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-auto">
            <SpotlightCard className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-teal-500/10">
                    <FileText className="h-5 w-5 text-teal-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">
                    Reports - {selectedSession.session_code}
                  </h3>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedSession(null)} className="hover:bg-white/10">
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <ReportViewer
                sessionCode={selectedSession.session_code}
                status={selectedSession.status}
                reports={{
                  patient: selectedSession.prediction.patient_pdf_url || undefined,
                  clinician: selectedSession.prediction.clinician_pdf_url || undefined,
                  technical: selectedSession.prediction.technical_pdf_url || undefined,
                }}
                userRole="radiologist"
                prediction={selectedSession.prediction.prediction}
                confidence={selectedSession.prediction.confidence_score}
              />
            </SpotlightCard>
          </div>
        </div>
      )}
    </div>
  );
};
