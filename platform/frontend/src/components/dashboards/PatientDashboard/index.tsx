'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ReportViewer } from '@/components/shared/ReportViewer';
import { usePatientStats, useMySessions, useCurrentPatient } from '@/lib/hooks/useApi';
import { useAuth } from '@/components/providers/AuthProvider';
import {
  Eye,
  Calendar,
  Activity,
  Download,
  Brain,
  FileText,
  Stethoscope,
  Clock,
  CheckCircle,
  AlertCircle,
  X,
  Loader2,
  Search,
  ArrowUpDown,
  List,
  AlignJustify,
  ChevronLeft,
  ChevronRight,
  Filter,
  TrendingUp,
  BarChart3,
} from 'lucide-react';
import Link from 'next/link';
import {
  SpotlightCard,
  GradientText,
  AnimatedCounter,
  AuroraBackground,
  GridPattern,
  PulseRing,
} from '@/components/ui/animated';

// ============================================================================
// STAT CARD
// ============================================================================
function StatCard({
  title,
  value,
  icon: Icon,
  description,
  color = 'teal',
  isLoading = false,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  description: string;
  color?: 'teal' | 'blue' | 'green' | 'purple';
  isLoading?: boolean;
}) {
  const colorStyles: Record<string, string> = {
    teal: 'from-teal-500 to-cyan-500',
    blue: 'from-blue-500 to-indigo-500',
    green: 'from-green-500 to-emerald-500',
    purple: 'from-purple-500 to-violet-500',
  };
  const bgColorStyles: Record<string, string> = {
    teal: 'bg-teal-500/10',
    blue: 'bg-blue-500/10',
    green: 'bg-green-500/10',
    purple: 'bg-purple-500/10',
  };
  const iconColors: Record<string, string> = {
    teal: '#14b8a6',
    blue: '#3b82f6',
    green: '#22c55e',
    purple: '#a855f7',
  };

  return (
    <SpotlightCard className="p-5">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm text-slate-400">{title}</p>
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : (
            <span className={`text-2xl font-bold bg-gradient-to-r ${colorStyles[color]} bg-clip-text text-transparent`}>
              {typeof value === 'number' ? <AnimatedCounter value={value} /> : value}
            </span>
          )}
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
// PREDICTION DISPLAY
// ============================================================================
function PredictionDisplay({
  prediction,
  probabilities,
  confidence,
}: {
  prediction: string;
  probabilities: Record<string, number>;
  confidence: number;
}) {
  const predictionInfo: Record<string, { label: string; description: string }> = {
    CN: { label: 'Cognitively Normal', description: 'No significant abnormalities detected' },
    MCI: { label: 'Mild Cognitive Impairment', description: 'Early signs of cognitive changes detected' },
    AD: { label: "Alzheimer's Disease", description: 'Patterns consistent with AD pathology' },
  };

  const info = predictionInfo[prediction] || predictionInfo['CN'];
  const confidencePercent = Math.round(confidence * 100);
  const isNormal = prediction === 'CN';
  const isMCI = prediction === 'MCI';

  const predColor = isNormal ? 'green' : isMCI ? 'yellow' : 'red';
  const colorClasses = {
    green: { text: 'text-green-400', bg: 'bg-green-500/10', bar: 'bg-green-500' },
    yellow: { text: 'text-yellow-400', bg: 'bg-yellow-500/10', bar: 'bg-yellow-500' },
    red: { text: 'text-red-400', bg: 'bg-red-500/10', bar: 'bg-red-500' },
  }[predColor];

  return (
    <SpotlightCard className="p-5">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Latest Analysis Result</h3>
          <PulseRing color={isNormal ? 'green' : 'purple'} />
        </div>

        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-xl ${colorClasses.bg}`}>
            <Brain className={`h-8 w-8 ${colorClasses.text}`} />
          </div>
          <div>
            <p className={`text-xl font-bold ${colorClasses.text}`}>{info.label}</p>
            <p className="text-xs text-muted-foreground">{info.description}</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Confidence</span>
            <span className={`font-medium ${colorClasses.text}`}>{confidencePercent}%</span>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${colorClasses.bar} transition-all duration-1000`} style={{ width: `${confidencePercent}%` }} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-1">
          {Object.entries(probabilities).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white/[0.03]">
              <span className="text-xs text-muted-foreground">{key}</span>
              <span className={`text-xs font-medium ${key === prediction ? colorClasses.text : 'text-muted-foreground'}`}>
                {Math.round(value * 100)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </SpotlightCard>
  );
}

// ============================================================================
// VIEW SCAN CARD
// ============================================================================
function ViewScanCard({ sessionId, sessionCode }: { sessionId: string; sessionCode: string }) {
  return (
    <SpotlightCard className="p-5">
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">View Your Scan</h3>
        <p className="text-xs text-muted-foreground">
          Access your brain scan images and explore the analysis results in detail.
        </p>
        <div className="p-3 bg-white/[0.03] rounded-xl">
          <p className="text-xs text-muted-foreground">
            Session: <span className="font-medium text-foreground">{sessionCode}</span>
          </p>
        </div>
        <Button className="w-full gap-2 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600" asChild>
          <Link href={`/patient/viewer/${sessionId}`}>
            <Eye className="h-4 w-4" />
            View Scan Images
          </Link>
        </Button>
      </div>
    </SpotlightCard>
  );
}

// ============================================================================
// TIMELINE ITEM
// ============================================================================
function TimelineItem({
  session,
  isLast,
  onViewReport,
}: {
  session: any;
  isLast: boolean;
  onViewReport: (session: any) => void;
}) {
  const prediction = session.prediction?.prediction || session.prediction;
  const sessionCode = session.session_code || session.sessionCode;
  const scanDate = session.scan_date || session.scanDate;
  const confidence = session.prediction?.confidence_score;
  const isCompleted = session.status === 'completed' || session.status === 'reviewed';

  const dotColors: Record<string, string> = {
    CN: 'bg-green-500',
    MCI: 'bg-yellow-500',
    AD: 'bg-red-500',
  };
  const dotColor = prediction ? dotColors[prediction] || 'bg-slate-500' : 'bg-slate-500';

  const predBadgeColors: Record<string, { bg: string; text: string }> = {
    CN: { bg: 'bg-green-500/10', text: 'text-green-400' },
    MCI: { bg: 'bg-yellow-500/10', text: 'text-yellow-400' },
    AD: { bg: 'bg-red-500/10', text: 'text-red-400' },
  };

  const statusConfig: Record<string, { icon: React.ElementType; color: string; bg: string; animate?: boolean }> = {
    completed: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/10' },
    reviewed: { icon: CheckCircle, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    processing: { icon: Loader2, color: 'text-yellow-400', bg: 'bg-yellow-500/10', animate: true },
    uploaded: { icon: Clock, color: 'text-orange-400', bg: 'bg-orange-500/10' },
    failed: { icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-500/10' },
  };
  const status = statusConfig[session.status] || statusConfig.uploaded;
  const StatusIcon = status.icon;

  return (
    <div className="flex gap-4">
      {/* Timeline line + dot */}
      <div className="flex flex-col items-center">
        <div className={`w-3 h-3 rounded-full ${dotColor} shrink-0 mt-4 ring-4 ring-background`} />
        {!isLast && <div className="w-0.5 flex-1 bg-white/[0.08] mt-1" />}
      </div>

      {/* Card */}
      <div className="flex-1 pb-4">
        <SpotlightCard className="p-4 hover:border-teal-500/30 transition-all duration-300">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Brain className="h-4 w-4 text-teal-400" />
                <span className="text-sm font-semibold text-foreground">{sessionCode}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {new Date(scanDate).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {prediction && predBadgeColors[prediction] && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${predBadgeColors[prediction].bg} ${predBadgeColors[prediction].text}`}>
                  {prediction}
                </span>
              )}
              <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full ${status.bg}`}>
                <StatusIcon className={`h-3 w-3 ${status.color} ${status.animate ? 'animate-spin' : ''}`} />
                <span className={`text-[10px] font-medium capitalize ${status.color}`}>{session.status}</span>
              </div>
            </div>
          </div>

          {/* Confidence bar */}
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
          {isCompleted && (
            <div className="flex gap-2 pt-2 border-t border-white/[0.05]">
              <Button size="sm" variant="outline" className="flex-1 h-7 text-xs gap-1 border-teal-500/30 text-teal-400 hover:bg-teal-500/10" asChild>
                <Link href={`/patient/viewer/${session.id}`}>
                  <Eye className="h-3 w-3" />View
                </Link>
              </Button>
              <Button size="sm" variant="outline" className="flex-1 h-7 text-xs gap-1 border-purple-500/30 text-purple-400 hover:bg-purple-500/10" onClick={() => onViewReport(session)}>
                <FileText className="h-3 w-3" />Report
              </Button>
            </div>
          )}
          {!isCompleted && (
            <div className="pt-2 border-t border-white/[0.05]">
              <span className="text-xs text-muted-foreground">
                {session.status === 'processing' ? 'Analyzing scan...' : `Status: ${session.status}`}
              </span>
            </div>
          )}
        </SpotlightCard>
      </div>
    </div>
  );
}

// ============================================================================
// SCAN LIST ROW
// ============================================================================
function ScanListRow({
  session,
  onViewReport,
}: {
  session: any;
  onViewReport: (session: any) => void;
}) {
  const prediction = session.prediction?.prediction || session.prediction;
  const sessionCode = session.session_code || session.sessionCode;
  const scanDate = session.scan_date || session.scanDate;
  const isCompleted = session.status === 'completed' || session.status === 'reviewed';

  const statusConfig: Record<string, { icon: React.ElementType; color: string; bg: string; animate?: boolean }> = {
    completed: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/10' },
    reviewed: { icon: CheckCircle, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    processing: { icon: Loader2, color: 'text-yellow-400', bg: 'bg-yellow-500/10', animate: true },
    uploaded: { icon: Clock, color: 'text-orange-400', bg: 'bg-orange-500/10' },
    failed: { icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-500/10' },
  };
  const status = statusConfig[session.status] || statusConfig.uploaded;
  const StatusIcon = status.icon;

  return (
    <div className="group p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-teal-500/30 hover:bg-white/[0.04] transition-all duration-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <div className="p-2 rounded-lg bg-teal-500/10 shrink-0">
            <Brain className="h-5 w-5 text-teal-400" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-foreground truncate">{sessionCode}</p>
            <p className="text-sm text-muted-foreground truncate">
              {new Date(scanDate).toLocaleDateString()}
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
          {isCompleted && (
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-teal-500/10" asChild>
                <Link href={`/patient/viewer/${session.id}`}><Eye className="h-4 w-4 text-teal-400" /></Link>
              </Button>
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-purple-500/10" onClick={() => onViewReport(session)}>
                <Download className="h-4 w-4 text-purple-400" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
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
// DOCTOR INFO CARD (Sidebar)
// ============================================================================
function DoctorInfoCard({ doctorName }: { doctorName: string }) {
  return (
    <SpotlightCard className="p-4">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
        <Stethoscope className="h-4 w-4 text-blue-400" />
        Your Doctor
      </h3>
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-blue-500/10">
          <Stethoscope className="h-5 w-5 text-blue-400" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{doctorName}</p>
          <p className="text-xs text-muted-foreground">Neurology Specialist</p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-3">
        Your doctor will review your scan results and discuss findings with you.
      </p>
    </SpotlightCard>
  );
}

// ============================================================================
// HEALTH SUMMARY (Sidebar)
// ============================================================================
function HealthSummary({
  totalScans,
  completedScans,
  predictionCounts,
}: {
  totalScans: number;
  completedScans: number;
  predictionCounts: { CN: number; MCI: number; AD: number };
}) {
  const total = predictionCounts.CN + predictionCounts.MCI + predictionCounts.AD;

  return (
    <SpotlightCard className="p-4">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
        <BarChart3 className="h-4 w-4 text-teal-400" />
        Health Summary
      </h3>

      <div className="space-y-3">
        <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.03]">
          <span className="text-xs text-muted-foreground">Total Scans</span>
          <span className="text-sm font-bold text-foreground">{totalScans}</span>
        </div>
        <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.03]">
          <span className="text-xs text-muted-foreground">Completed</span>
          <span className="text-sm font-bold text-green-400">{completedScans}</span>
        </div>

        {total > 0 && (
          <div className="pt-2 border-t border-white/[0.05]">
            <p className="text-xs text-muted-foreground mb-2">Diagnosis Distribution</p>
            {(['CN', 'MCI', 'AD'] as const).map((cls) => {
              const pct = total > 0 ? (predictionCounts[cls] / total) * 100 : 0;
              const colors = { CN: 'bg-green-500', MCI: 'bg-yellow-500', AD: 'bg-red-500' };
              const labels = { CN: 'Normal', MCI: 'MCI', AD: "Alzheimer's" };
              return (
                <div key={cls} className="mb-2 last:mb-0">
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
        )}
      </div>
    </SpotlightCard>
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
// MAIN PATIENT DASHBOARD
// ============================================================================
export const PatientDashboard: React.FC = () => {
  // View state
  const [viewMode, setViewMode] = useState<'timeline' | 'list'>('timeline');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'status'>('date-desc');

  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [predictionFilter, setPredictionFilter] = useState<string>('all');

  // Modal state
  const [selectedSession, setSelectedSession] = useState<any>(null);

  // Auth
  const { userProfile } = useAuth();

  // Data
  const { data: stats, isLoading: statsLoading } = usePatientStats();
  const { data: sessionsData, isLoading: sessionsLoading } = useMySessions();
  const { data: patientProfile } = useCurrentPatient();

  const allSessions = sessionsData?.data || [];
  const latestSession = allSessions[0];

  // Patient info
  const patientName = userProfile?.full_name || patientProfile?.full_name || 'Patient';
  const patientCode = patientProfile?.patient_code || userProfile?.roleProfile?.patient_code || '';
  const assignedDoctor = patientProfile?.assigned_doctors?.[0]?.name || 'Not Assigned';

  // Prediction counts
  const predictionCounts = useMemo(() => {
    const counts = { CN: 0, MCI: 0, AD: 0 };
    allSessions.forEach((s: any) => {
      const p = s.prediction?.prediction;
      if (p && p in counts) counts[p as keyof typeof counts]++;
    });
    return counts;
  }, [allSessions]);

  // Filter + sort + paginate pipeline
  const PAGE_SIZE = 10;

  const filteredSessions = useMemo(() => {
    let result = [...allSessions];

    // Prediction filter
    if (predictionFilter !== 'all') {
      result = result.filter((s: any) => {
        const pred = s.prediction?.prediction || s.prediction;
        return pred === predictionFilter;
      });
    }

    // Search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter((s: any) =>
        (s.session_code || s.sessionCode || '').toLowerCase().includes(term)
      );
    }

    // Sort
    result.sort((a: any, b: any) => {
      const dateA = new Date(a.scan_date || a.scanDate).getTime();
      const dateB = new Date(b.scan_date || b.scanDate).getTime();
      switch (sortBy) {
        case 'date-desc': return dateB - dateA;
        case 'date-asc': return dateA - dateB;
        case 'status': return (a.status || '').localeCompare(b.status || '');
        default: return 0;
      }
    });

    return result;
  }, [allSessions, predictionFilter, searchTerm, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredSessions.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedSessions = filteredSessions.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Reset page when filters change
  const updateFilter = useCallback((setter: (v: any) => void, value: any) => {
    setter(value);
    setCurrentPage(1);
  }, []);

  // Active filter count
  const activeFilterCount = [
    predictionFilter !== 'all',
    searchTerm !== '',
  ].filter(Boolean).length;

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
              Welcome,{' '}
              <GradientText from="from-teal-400" via="via-cyan-400" to="to-blue-400">
                {patientName}
              </GradientText>
            </h1>
            <p className="text-muted-foreground mt-1 text-sm flex items-center gap-3">
              {patientCode && (
                <span className="px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-400 text-xs font-medium">
                  {patientCode}
                </span>
              )}
              <span className="text-muted">|</span>
              <span>Doctor: {assignedDoctor}</span>
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
          {isLoading ? (
            <>{[1, 2, 3].map((i) => <StatCardSkeleton key={i} />)}</>
          ) : (
            <>
              <StatCard title="Total Scans" value={stats?.totalScans || 0} icon={Activity} description="All-time scans" color="teal" isLoading={statsLoading} />
              <StatCard title="Completed" value={stats?.completedScans || 0} icon={CheckCircle} description="Successfully analyzed" color="green" isLoading={statsLoading} />
              <StatCard title="Last Scan" value={stats?.latestScanDate ? new Date(stats.latestScanDate).toLocaleDateString() : 'N/A'} icon={Calendar} description="Most recent scan" color="blue" isLoading={statsLoading} />
            </>
          )}
        </div>

        {/* Latest Result + View Scan */}
        {latestSession && latestSession.prediction && (
          <div className="grid gap-4 md:grid-cols-2">
            <PredictionDisplay
              prediction={latestSession.prediction.prediction || latestSession.prediction}
              probabilities={latestSession.prediction.probabilities || { CN: 0.33, MCI: 0.33, AD: 0.34 }}
              confidence={latestSession.prediction.confidence_score || 0.5}
            />
            <ViewScanCard
              sessionId={latestSession.id}
              sessionCode={latestSession.session_code}
            />
          </div>
        )}

        {/* Main + Sidebar */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          {/* Main - Scan History */}
          <div className="xl:col-span-3 space-y-4">
            {/* Toolbar */}
            <SpotlightCard className="p-4">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3 flex-wrap">
                  {/* View toggle */}
                  <div className="flex rounded-lg border border-white/[0.08] overflow-hidden">
                    <button
                      onClick={() => setViewMode('timeline')}
                      className={`p-2 transition-colors ${viewMode === 'timeline' ? 'bg-teal-500/20 text-teal-400' : 'text-muted-foreground hover:bg-white/5'}`}
                      title="Timeline view"
                    >
                      <AlignJustify className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      className={`p-2 transition-colors ${viewMode === 'list' ? 'bg-teal-500/20 text-teal-400' : 'text-muted-foreground hover:bg-white/5'}`}
                      title="List view"
                    >
                      <List className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Search */}
                  <div className="relative flex-1 min-w-[180px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by session code..."
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

                  {/* Prediction filter */}
                  <div className="flex items-center gap-2">
                    <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                    <select
                      value={predictionFilter}
                      onChange={(e) => updateFilter(setPredictionFilter, e.target.value)}
                      className="bg-white/[0.03] border border-white/[0.08] rounded-md text-sm text-foreground px-2 py-1 outline-none focus:border-teal-500/50"
                    >
                      <option value="all">All Results</option>
                      <option value="CN">CN - Normal</option>
                      <option value="MCI">MCI - Mild Impairment</option>
                      <option value="AD">AD - Alzheimer&apos;s</option>
                    </select>
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
                      <option value="status">Status</option>
                    </select>
                  </div>
                </div>
              </div>
            </SpotlightCard>

            {/* Filter chips */}
            {activeFilterCount > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                {predictionFilter !== 'all' && (
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-400 text-xs font-medium">
                    Result: {predictionFilter}
                    <button onClick={() => updateFilter(setPredictionFilter, 'all')}><X className="h-3 w-3" /></button>
                  </span>
                )}
                {searchTerm && (
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500/10 text-orange-400 text-xs font-medium">
                    Search: &quot;{searchTerm}&quot;
                    <button onClick={() => updateFilter(setSearchTerm, '')}><X className="h-3 w-3" /></button>
                  </span>
                )}
                <button
                  onClick={() => {
                    setPredictionFilter('all');
                    setSearchTerm('');
                    setCurrentPage(1);
                  }}
                  className="text-xs text-red-400 hover:text-red-300 ml-auto"
                >
                  Clear all
                </button>
              </div>
            )}

            {/* Results count */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {filteredSessions.length} {filteredSessions.length === 1 ? 'scan' : 'scans'}
                {activeFilterCount > 0 && ` (filtered from ${allSessions.length})`}
              </span>
            </div>

            {/* Sessions Display */}
            {sessionsLoading && allSessions.length === 0 ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <RowSkeleton key={i} />)}
              </div>
            ) : paginatedSessions.length === 0 ? (
              <SpotlightCard className="p-12">
                <div className="text-center">
                  <div className="p-4 rounded-full bg-teal-500/10 w-fit mx-auto mb-4">
                    <Brain className="h-8 w-8 text-teal-400" />
                  </div>
                  <p className="text-foreground font-medium mb-1">No scans found</p>
                  <p className="text-sm text-muted-foreground">
                    {activeFilterCount > 0
                      ? 'Try adjusting your filters'
                      : 'Your MRI scan history will appear here'}
                  </p>
                </div>
              </SpotlightCard>
            ) : viewMode === 'timeline' ? (
              <div>
                {paginatedSessions.map((session: any, idx: number) => (
                  <TimelineItem
                    key={session.id}
                    session={session}
                    isLast={idx === paginatedSessions.length - 1}
                    onViewReport={setSelectedSession}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {paginatedSessions.map((session: any) => (
                  <ScanListRow
                    key={session.id}
                    session={session}
                    onViewReport={setSelectedSession}
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
            {/* Health Summary */}
            <HealthSummary
              totalScans={stats?.totalScans || allSessions.length}
              completedScans={stats?.completedScans || 0}
              predictionCounts={predictionCounts}
            />

            {/* Doctor Info */}
            {assignedDoctor && assignedDoctor !== 'Not Assigned' && (
              <DoctorInfoCard doctorName={assignedDoctor} />
            )}

            {/* Latest Report Quick Access */}
            {latestSession?.prediction && (
              <SpotlightCard className="p-4">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                  <FileText className="h-4 w-4 text-purple-400" />
                  Latest Report
                </h3>
                <ReportViewer
                  sessionCode={latestSession.session_code}
                  status={latestSession.status}
                  reports={{
                    patient: latestSession.prediction.patient_pdf_url,
                    clinician: latestSession.prediction.clinician_pdf_url,
                    technical: latestSession.prediction.technical_pdf_url,
                  }}
                  userRole="patient"
                  prediction={latestSession.prediction.prediction}
                  confidence={latestSession.prediction.confidence_score}
                />
              </SpotlightCard>
            )}
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
                    Report - {selectedSession.session_code}
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
                userRole="patient"
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
