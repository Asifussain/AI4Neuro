'use client';

import { Navbar } from '@/components/shared/Navbar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { usePatient, usePatientSessions } from '@/lib/hooks/useApi';
import {
  ArrowLeft,
  Eye,
  Calendar,
  User,
  Heart,
  Loader2,
  AlertCircle,
  Brain,
  Activity,
  Stethoscope,
  Mail,
  Phone,
  Droplets,
  ScanLine,
} from 'lucide-react';
import Link from 'next/link';
import { use } from 'react';
import {
  SpotlightCard,
  GradientText,
  AuroraBackground,
  GridPattern,
  PulseRing,
  AnimatedCounter,
} from '@/components/ui/animated';

// Prediction display config
const predictionConfig: Record<string, {
  label: string;
  shortLabel: string;
  color: string;
  bgColor: string;
  borderColor: string;
  ringColor: 'green' | 'yellow' | 'red';
  barColor: string;
}> = {
  CN: {
    label: 'Cognitively Normal',
    shortLabel: 'CN',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
    ringColor: 'green',
    barColor: 'bg-emerald-500',
  },
  MCI: {
    label: 'Mild Cognitive Impairment',
    shortLabel: 'MCI',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    ringColor: 'yellow',
    barColor: 'bg-amber-500',
  },
  AD: {
    label: "Alzheimer's Disease",
    shortLabel: 'AD',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    ringColor: 'red',
    barColor: 'bg-red-500',
  },
};

// Status badge styles
const statusStyles: Record<string, string> = {
  completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  processing: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  uploaded: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
  failed: 'bg-red-500/10 text-red-400 border-red-500/30',
  reviewed: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
};

function calculateAge(dateOfBirth: string | null): string {
  if (!dateOfBirth) return 'N/A';
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return `${age}`;
}

export default function DoctorPatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: patient, isLoading: patientLoading, error: patientError } = usePatient(id);
  const { data: sessionsData, isLoading: sessionsLoading } = usePatientSessions(id);

  const sessions = sessionsData?.data || [];

  if (patientLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center h-[80vh]">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-purple-500 mx-auto mb-4" />
            <p className="text-muted-foreground">Loading patient data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (patientError || !patient) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center h-[80vh]">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-foreground text-lg mb-2">Patient not found</p>
            <p className="text-muted-foreground mb-4">{patientError || 'Unable to load patient data'}</p>
            <Button variant="outline" asChild>
              <Link href="/doctor/dashboard">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const patientName = patient.user_profile?.full_name || 'Unknown Patient';
  const patientEmail = patient.user_profile?.email || null;
  const patientPhone = patient.user_profile?.phone || null;
  const bloodGroup = patient.blood_group?.blood_group || 'N/A';
  const age = calculateAge(patient.date_of_birth);
  const gender = patient.gender || 'N/A';
  const latestSession = patient.latest_session;
  const latestPrediction = latestSession?.prediction;
  const latestPredConfig = latestPrediction ? predictionConfig[latestPrediction] : null;

  return (
    <div className="min-h-screen bg-background relative">
      <AuroraBackground />
      <GridPattern />

      <Navbar />

      <div className="relative z-10 p-4 pt-20 lg:p-6 lg:pt-22 max-w-[1920px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground">
              <Link href="/doctor/dashboard">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Dashboard
              </Link>
            </Button>
            <div className="h-6 w-px bg-border" />
            <div>
              <h1 className="text-xl lg:text-2xl font-bold text-foreground flex items-center gap-2">
                <User className="h-5 w-5 lg:h-6 lg:w-6 text-purple-500" />
                <GradientText>{patientName}</GradientText>
              </h1>
              <p className="text-xs lg:text-sm text-muted-foreground mt-0.5 font-mono">
                {patient.patient_code}
              </p>
            </div>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <SpotlightCard spotlightColor="rgba(147, 51, 234, 0.08)" className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Age</p>
                <span className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-violet-400 bg-clip-text text-transparent">
                  {age}
                </span>
                <p className="text-xs text-muted-foreground">
                  {patient.date_of_birth
                    ? new Date(patient.date_of_birth).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    : 'DOB not set'}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-purple-500/10">
                <Calendar className="h-5 w-5 text-purple-500" />
              </div>
            </div>
          </SpotlightCard>

          <SpotlightCard spotlightColor="rgba(147, 51, 234, 0.08)" className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Gender</p>
                <span className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent capitalize">
                  {gender}
                </span>
                <p className="text-xs text-muted-foreground">Biological sex</p>
              </div>
              <div className="p-3 rounded-xl bg-blue-500/10">
                <User className="h-5 w-5 text-blue-500" />
              </div>
            </div>
          </SpotlightCard>

          <SpotlightCard spotlightColor="rgba(147, 51, 234, 0.08)" className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Blood Group</p>
                <span className="text-2xl font-bold bg-gradient-to-r from-red-400 to-rose-400 bg-clip-text text-transparent">
                  {bloodGroup}
                </span>
                <p className="text-xs text-muted-foreground">Blood type</p>
              </div>
              <div className="p-3 rounded-xl bg-red-500/10">
                <Droplets className="h-5 w-5 text-red-500" />
              </div>
            </div>
          </SpotlightCard>

          <SpotlightCard spotlightColor="rgba(147, 51, 234, 0.08)" className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Total Scans</p>
                <span className="text-2xl font-bold bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
                  <AnimatedCounter value={patient.sessions_count || 0} />
                </span>
                <p className="text-xs text-muted-foreground">MRI sessions</p>
              </div>
              <div className="p-3 rounded-xl bg-teal-500/10">
                <ScanLine className="h-5 w-5 text-teal-500" />
              </div>
            </div>
          </SpotlightCard>
        </div>

        {/* Main Content + Sidebar */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Main Content (2/3) */}
          <div className="xl:col-span-2 space-y-4">
            <SpotlightCard spotlightColor="rgba(147, 51, 234, 0.08)">
              <div className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Brain className="h-5 w-5 text-purple-500" />
                  <h2 className="text-lg font-semibold text-foreground">MRI Scan History</h2>
                  {sessionsLoading && (
                    <Loader2 className="h-4 w-4 animate-spin text-purple-400 ml-2" />
                  )}
                </div>

                {sessions.length === 0 && !sessionsLoading ? (
                  <div className="text-center py-12">
                    <div className="p-4 rounded-full bg-purple-500/10 w-fit mx-auto mb-4">
                      <Brain className="h-8 w-8 text-purple-400" />
                    </div>
                    <p className="text-foreground font-medium mb-1">No scan history</p>
                    <p className="text-sm text-muted-foreground">
                      No MRI sessions have been recorded for this patient yet.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-white/[0.05] hover:bg-transparent">
                          <TableHead className="text-muted-foreground">Date</TableHead>
                          <TableHead className="text-muted-foreground">Session Code</TableHead>
                          <TableHead className="text-muted-foreground">Result</TableHead>
                          <TableHead className="text-muted-foreground">Confidence</TableHead>
                          <TableHead className="text-muted-foreground">Status</TableHead>
                          <TableHead className="text-muted-foreground">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sessions.map((session: any) => {
                          const prediction = session.predictions?.[0];
                          const predLabel = prediction?.prediction;
                          const predConf = prediction?.confidence_score;
                          const predConfig = predLabel ? predictionConfig[predLabel] : null;

                          return (
                            <TableRow
                              key={session.id}
                              className="border-white/[0.05] hover:bg-white/[0.02] transition-colors"
                            >
                              <TableCell className="text-foreground">
                                {new Date(session.scan_date).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })}
                              </TableCell>
                              <TableCell className="font-mono text-sm text-foreground">
                                {session.session_code}
                              </TableCell>
                              <TableCell>
                                {predLabel && predConfig ? (
                                  <span
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${predConfig.bgColor} ${predConfig.color} border ${predConfig.borderColor}`}
                                  >
                                    {predConfig.shortLabel}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground text-sm">--</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {predConf != null ? (
                                  <div className="flex items-center gap-2">
                                    <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden">
                                      <div
                                        className={`h-full rounded-full ${predConfig?.barColor || 'bg-gray-500'}`}
                                        style={{ width: `${predConf * 100}%` }}
                                      />
                                    </div>
                                    <span className="text-xs text-muted-foreground tabular-nums">
                                      {(predConf * 100).toFixed(1)}%
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground text-sm">--</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] px-2 py-0.5 capitalize ${statusStyles[session.status] || ''}`}
                                >
                                  {session.status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {(session.status === 'completed' || session.status === 'reviewed') && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    asChild
                                    className="h-8 gap-1.5 border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                                  >
                                    <Link href={`/doctor/viewer/${session.id}`}>
                                      <Eye className="h-3.5 w-3.5" />
                                      View
                                    </Link>
                                  </Button>
                                )}
                                {session.status === 'processing' && (
                                  <span className="flex items-center gap-1.5 text-xs text-blue-400">
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    Analyzing
                                  </span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </SpotlightCard>
          </div>

          {/* Sidebar (1/3) */}
          <div className="space-y-4">
            {/* Latest Assessment */}
            <SpotlightCard spotlightColor="rgba(147, 51, 234, 0.08)">
              <div className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Activity className="h-4 w-4 text-purple-500" />
                  <h3 className="text-sm font-semibold text-foreground">Latest Assessment</h3>
                  {latestPredConfig && (
                    <PulseRing color={latestPredConfig.ringColor} className="ml-auto" />
                  )}
                </div>

                {latestPrediction && latestPredConfig ? (
                  <div className="space-y-3">
                    <div className={`rounded-lg p-3 border ${latestPredConfig.bgColor} ${latestPredConfig.borderColor}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-lg font-bold ${latestPredConfig.color}`}>
                          {latestPredConfig.shortLabel}
                        </span>
                      </div>
                      <p className={`text-xs font-medium ${latestPredConfig.color}`}>
                        {latestPredConfig.label}
                      </p>
                    </div>

                    <div className="space-y-2">
                      {latestSession?.scan_date && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground flex items-center gap-1.5">
                            <Calendar className="h-3 w-3" /> Scan Date
                          </span>
                          <span className="text-foreground font-medium">
                            {new Date(latestSession.scan_date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                      )}
                      {latestSession?.session_code && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground flex items-center gap-1.5">
                            <ScanLine className="h-3 w-3" /> Session
                          </span>
                          <span className="text-foreground font-mono text-[11px]">
                            {latestSession.session_code}
                          </span>
                        </div>
                      )}
                      {latestSession?.status && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground flex items-center gap-1.5">
                            <Activity className="h-3 w-3" /> Status
                          </span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 capitalize ${statusStyles[latestSession.status] || ''}`}
                          >
                            {latestSession.status}
                          </Badge>
                        </div>
                      )}
                    </div>

                    {latestSession?.id && (
                      <Button
                        className="w-full mt-2 gap-1.5 bg-purple-500/10 text-purple-400 border border-purple-500/30 hover:bg-purple-500/20"
                        variant="outline"
                        size="sm"
                        asChild
                      >
                        <Link href={`/doctor/viewer/${latestSession.id}`}>
                          <Eye className="h-3.5 w-3.5" />
                          Review Full Report
                        </Link>
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <Brain className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No assessments yet</p>
                  </div>
                )}
              </div>
            </SpotlightCard>

            {/* Assigned Doctors */}
            <SpotlightCard spotlightColor="rgba(147, 51, 234, 0.06)">
              <div className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Stethoscope className="h-4 w-4 text-purple-500" />
                  <h3 className="text-sm font-semibold text-foreground">Assigned Doctors</h3>
                </div>

                {patient.assigned_doctors && patient.assigned_doctors.length > 0 ? (
                  <div className="space-y-2">
                    {patient.assigned_doctors.map((doctor) => (
                      <div
                        key={doctor.id}
                        className="flex items-center gap-3 p-2 rounded-lg bg-white/[0.02] border border-white/[0.05]"
                      >
                        <div className="p-1.5 rounded-lg bg-purple-500/10 shrink-0">
                          <Stethoscope className="h-3.5 w-3.5 text-purple-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-foreground font-medium truncate">
                            {doctor.name}
                          </p>
                          {doctor.specialization && (
                            <p className="text-[10px] text-muted-foreground">
                              {doctor.specialization}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground py-2">No doctors assigned</p>
                )}
              </div>
            </SpotlightCard>

            {/* Patient Info */}
            <SpotlightCard spotlightColor="rgba(147, 51, 234, 0.06)">
              <div className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <User className="h-4 w-4 text-purple-500" />
                  <h3 className="text-sm font-semibold text-foreground">Patient Information</h3>
                </div>
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Calendar className="h-3 w-3" /> Date of Birth
                    </span>
                    <span className="text-foreground font-medium">
                      {patient.date_of_birth
                        ? new Date(patient.date_of_birth).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : 'Not provided'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <User className="h-3 w-3" /> Gender
                    </span>
                    <span className="text-foreground font-medium capitalize">{gender}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Heart className="h-3 w-3" /> Blood Group
                    </span>
                    <span className="text-foreground font-medium">{bloodGroup}</span>
                  </div>

                  {patientEmail && (
                    <div className="pt-2 mt-2 border-t border-border/50">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          <Mail className="h-3 w-3" /> Email
                        </span>
                        <span className="text-foreground font-medium truncate ml-2 max-w-[160px]">
                          {patientEmail}
                        </span>
                      </div>
                    </div>
                  )}

                  {patientPhone && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <Phone className="h-3 w-3" /> Phone
                      </span>
                      <span className="text-foreground font-medium">{patientPhone}</span>
                    </div>
                  )}
                </div>
              </div>
            </SpotlightCard>
          </div>
        </div>
      </div>
    </div>
  );
}
