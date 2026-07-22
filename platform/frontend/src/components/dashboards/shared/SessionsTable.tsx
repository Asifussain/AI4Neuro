'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import Swal from 'sweetalert2';
import { FileText, Loader2, Waves, Brain, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StatusBadge, ACCENT_STYLES, type Accent } from './primitives';
import { analysisApi } from '@/features/analysis/api';
import type { SessionStatusResponse } from '@/features/analysis/types';

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.toLocaleDateString()} · ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function classLabel(analysisType: string): string {
  if (analysisType === 'binary') return 'Binary';
  if (analysisType === 'multiclass') return 'Multiclass';
  return analysisType;
}

/**
 * Organized, tabular replacement for the old flex-row session/report lists —
 * shared by every dashboard's "Scan Sessions" / "Reports" views so the
 * column set (Sr No, Patient, Analysis Type, Date & Time, Class, Status,
 * Report, Actions) stays consistent everywhere completed analyses are listed.
 */
export function SessionsTable({
  sessions,
  accent,
  patientNameById,
  showPatientColumn = true,
  emptyLabel = 'No sessions found.',
  onSessionDeleted,
  showDeleteAction = true,
}: {
  sessions: SessionStatusResponse[];
  accent: Accent;
  /** Maps `patient_id` -> display name; omit to show a placeholder instead. */
  patientNameById?: Record<string, string>;
  showPatientColumn?: boolean;
  emptyLabel?: string;
  onSessionDeleted?: (sessionId: string) => void;
  /** Patients may never delete a scan session (backend rejects it anyway) —
   * pass false to hide the column entirely rather than show a button that
   * always 403s. */
  showDeleteAction?: boolean;
}) {
  const styles = ACCENT_STYLES[accent];
  const [loadingReportId, setLoadingReportId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Opens the session's actual generated report PDF in a new tab, rather
  // than sending the user to the full /analysis/{id} status+result page.
  // The tab is opened synchronously (before the await) so it stays inside
  // the click's user-gesture window and isn't blocked as a popup.
  const openReport = async (sessionId: string) => {
    const win = window.open('', '_blank');
    setLoadingReportId(sessionId);
    try {
      const { report_urls } = await analysisApi.reports(sessionId);
      const url = report_urls.patient ?? report_urls.clinician ?? report_urls.technical ?? null;
      if (url && win) {
        win.location.href = url;
      } else {
        win?.close();
        toast.error('Report is not available yet for this session.');
      }
    } catch (err) {
      win?.close();
      toast.error(err instanceof Error ? err.message : 'Failed to load report.');
    } finally {
      setLoadingReportId(null);
    }
  };

  const handleDelete = async (sessionId: string) => {
    const res = await Swal.fire({
      title: 'Delete Scan Session?',
      text: 'Are you sure you want to delete this session? This action cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Yes, delete',
      cancelButtonText: 'Cancel',
    });

    if (!res.isConfirmed) return;

    setDeletingId(sessionId);
    try {
      await analysisApi.delete(sessionId);
      toast.success('Session deleted successfully');
      onSessionDeleted?.(sessionId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete session');
    } finally {
      setDeletingId(null);
    }
  };

  if (sessions.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <FileText className="h-8 w-8 mx-auto mb-3 text-slate-300" />
        <p className="text-sm">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
            <th className="py-2.5 pr-4 font-medium w-12">Sr No</th>
            {showPatientColumn && <th className="py-2.5 pr-4 font-medium">Patient</th>}
            <th className="py-2.5 pr-4 font-medium">Analysis Type</th>
            <th className="py-2.5 pr-4 font-medium">Date &amp; Time</th>
            <th className="py-2.5 pr-4 font-medium">Class</th>
            <th className="py-2.5 pr-4 font-medium">Status</th>
            <th className="py-2.5 pr-4 font-medium text-right">Report</th>
            {showDeleteAction && <th className="py-2.5 pr-0 font-medium text-center w-12">Action</th>}
          </tr>
        </thead>
        <tbody>
          {sessions.map((s, idx) => {
            const ModalityIcon = s.modality === 'eeg' ? Waves : Brain;
            const patientName = s.patient_id ? patientNameById?.[s.patient_id] : undefined;
            const isCompleted = s.status?.toLowerCase() === 'completed';
            const isLoadingReport = loadingReportId === s.id;
            const isDeleting = deletingId === s.id;
            return (
              <tr key={s.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                <td className="py-3 pr-4 text-slate-500">{idx + 1}</td>
                {showPatientColumn && (
                  <td className="py-3 pr-4 text-slate-700 truncate max-w-[160px]">
                    {patientName ?? (s.patient_id ? '—' : 'N/A')}
                  </td>
                )}
                <td className="py-3 pr-4">
                  <span className="inline-flex items-center gap-1.5 font-medium text-slate-900">
                    <ModalityIcon className="h-3.5 w-3.5 text-slate-400" />
                    <span className="uppercase">{s.modality}</span>
                  </span>
                </td>
                <td className="py-3 pr-4 text-slate-500 whitespace-nowrap">{formatDateTime(s.created_at)}</td>
                <td className="py-3 pr-4 text-slate-600">{classLabel(s.analysis_type)}</td>
                <td className="py-3 pr-4">
                  <StatusBadge status={s.status} />
                </td>
                <td className="py-3 pr-4 text-right">
                  {isCompleted ? (
                    <button
                      type="button"
                      onClick={() => openReport(s.id)}
                      disabled={isLoadingReport}
                      className={cn(
                        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors hover:brightness-95 disabled:opacity-60',
                        styles.soft,
                        styles.text
                      )}
                    >
                      {isLoadingReport ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <FileText className="h-3.5 w-3.5" />
                      )}
                      View Report
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-50 text-slate-400">
                      <FileText className="h-3.5 w-3.5" />
                      N/A
                    </span>
                  )}
                </td>
                {showDeleteAction && (
                  <td className="py-3 pr-0 text-center">
                    <button
                      type="button"
                      title="Delete scan session"
                      aria-label="Delete scan session"
                      onClick={() => handleDelete(s.id)}
                      disabled={isDeleting}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
