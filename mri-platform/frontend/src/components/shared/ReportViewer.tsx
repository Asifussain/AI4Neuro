'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Download, ExternalLink, Clock, CheckCircle, AlertCircle } from 'lucide-react';

interface ReportUrls {
  technical?: string | null;
  clinician?: string | null;
  patient?: string | null;
}

interface ReportViewerProps {
  sessionCode?: string;
  status?: string;
  generatedAt?: string;
  reports: ReportUrls;
  userRole: 'patient' | 'doctor' | 'radiologist' | 'admin';
  prediction?: string;
  confidence?: number;
}

const getStatusBadge = (status?: string) => {
  switch (status?.toLowerCase()) {
    case 'completed':
    case 'reviewed':
      return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" /> {status}</Badge>;
    case 'processing':
      return <Badge className="bg-yellow-500"><Clock className="w-3 h-3 mr-1" /> Processing</Badge>;
    case 'failed':
      return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" /> Failed</Badge>;
    default:
      return <Badge variant="secondary">{status || 'Unknown'}</Badge>;
  }
};

const getPredictionColor = (prediction?: string) => {
  switch (prediction?.toUpperCase()) {
    case 'CN':
      return 'text-green-600 dark:text-green-400';
    case 'MCI':
      return 'text-yellow-600 dark:text-yellow-400';
    case 'AD':
      return 'text-red-600 dark:text-red-400';
    default:
      return 'text-gray-600 dark:text-gray-400';
  }
};

const getPredictionLabel = (prediction?: string) => {
  const labels: Record<string, string> = {
    'CN': 'Cognitively Normal',
    'MCI': 'Mild Cognitive Impairment',
    'AD': "Alzheimer's Disease"
  };
  return labels[prediction?.toUpperCase() || ''] || prediction || 'Unknown';
};

export const ReportViewer: React.FC<ReportViewerProps> = ({
  sessionCode,
  status,
  generatedAt,
  reports,
  userRole,
  prediction,
  confidence
}) => {
  // Check if URL is valid (real URL from storage)
  const isValidUrl = (url: string | null | undefined): boolean => {
    if (!url) return false;
    // Only allow full URLs (from Supabase storage)
    return url.startsWith('http://') || url.startsWith('https://');
  };

  const handleViewReport = (url: string | null | undefined) => {
    if (url && isValidUrl(url)) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleDownload = (url: string | null | undefined, filename: string) => {
    if (url && isValidUrl(url)) {
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Determine which reports to show based on role
  const getAvailableReports = () => {
    const reportTypes = [];

    // Patient only sees patient report
    if (userRole === 'patient') {
      if (isValidUrl(reports.patient)) {
        reportTypes.push({
          key: 'patient',
          label: 'Patient Report',
          description: 'Easy-to-understand summary of your results',
          url: reports.patient!,
          icon: FileText
        });
      }
    }

    // Doctor sees clinician report (and optionally patient report)
    if (userRole === 'doctor') {
      if (isValidUrl(reports.clinician)) {
        reportTypes.push({
          key: 'clinician',
          label: 'Clinical Report',
          description: 'Detailed clinical findings and recommendations',
          url: reports.clinician!,
          icon: FileText
        });
      }
      if (isValidUrl(reports.patient)) {
        reportTypes.push({
          key: 'patient',
          label: 'Patient Summary',
          description: 'Patient-friendly version to share',
          url: reports.patient!,
          icon: FileText
        });
      }
    }

    // Radiologist and admin see all reports
    if (userRole === 'radiologist' || userRole === 'admin') {
      if (isValidUrl(reports.technical)) {
        reportTypes.push({
          key: 'technical',
          label: 'Technical Report',
          description: 'Full technical analysis with metrics',
          url: reports.technical!,
          icon: FileText
        });
      }
      if (isValidUrl(reports.clinician)) {
        reportTypes.push({
          key: 'clinician',
          label: 'Clinical Report',
          description: 'Clinical findings for physicians',
          url: reports.clinician!,
          icon: FileText
        });
      }
      if (isValidUrl(reports.patient)) {
        reportTypes.push({
          key: 'patient',
          label: 'Patient Report',
          description: 'Patient-friendly summary',
          url: reports.patient!,
          icon: FileText
        });
      }
    }

    return reportTypes;
  };

  const availableReports = getAvailableReports();
  const hasReports = availableReports.length > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Analysis Reports
            </CardTitle>
            {sessionCode && (
              <CardDescription className="mt-1">
                Session: {sessionCode}
              </CardDescription>
            )}
          </div>
          {getStatusBadge(status)}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Prediction Summary */}
        {prediction && (
          <div className="p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">AI Prediction</p>
                <p className={`text-lg font-semibold ${getPredictionColor(prediction)}`}>
                  {getPredictionLabel(prediction)}
                </p>
              </div>
              {confidence !== undefined && (
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Confidence</p>
                  <p className="text-lg font-semibold">{(confidence * 100).toFixed(1)}%</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Report Generation Time */}
        {generatedAt && (
          <p className="text-sm text-muted-foreground">
            <Clock className="inline h-3 w-3 mr-1" />
            Generated: {new Date(generatedAt).toLocaleString()}
          </p>
        )}

        {/* Reports List */}
        {hasReports ? (
          <div className="space-y-3">
            {availableReports.map((report) => (
              <div
                key={report.key}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <report.icon className="h-8 w-8 text-primary" />
                  <div>
                    <p className="font-medium">{report.label}</p>
                    <p className="text-sm text-muted-foreground">{report.description}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleViewReport(report.url)}
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    View
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleDownload(report.url, `${sessionCode || 'report'}_${report.key}.pdf`)}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            {status === 'processing' ? (
              <>
                <Clock className="h-12 w-12 mx-auto mb-3 animate-pulse" />
                <p>Reports are being generated...</p>
                <p className="text-sm">This may take a few minutes.</p>
              </>
            ) : status === 'failed' ? (
              <>
                <AlertCircle className="h-12 w-12 mx-auto mb-3 text-destructive" />
                <p>Report generation failed</p>
                <p className="text-sm">Please try uploading the scan again.</p>
              </>
            ) : (
              <>
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No reports available</p>
                <p className="text-sm">Reports will appear here once analysis is complete.</p>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ReportViewer;
