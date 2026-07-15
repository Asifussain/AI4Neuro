/**
 * Statistics API Service
 * Handles all dashboard statistics API calls
 */

import { createClient } from '@/lib/supabase/client';
import type { ApiResponse } from './index';

export interface PatientStats {
  totalScans: number;
  completedScans: number;
  pendingScans: number;
  latestScanDate: string | null;
  resultDistribution: {
    CN: number;
    MCI: number;
    AD: number;
  };
  recentScans: {
    id: string;
    sessionCode: string;
    scanDate: string;
    status: string;
    prediction: string | null;
  }[];
}

export interface DoctorStats {
  totalPatients: number;
  activePatients: number;
  pendingReviews: number;
  completedReviews: number;
  thisMonthScans: number;
  resultDistribution: {
    CN: number;
    MCI: number;
    AD: number;
  };
  recentPatients: {
    id: string;
    name: string;
    patientCode: string;
    latestScanStatus: string | null;
    latestPrediction: string | null;
  }[];
}

export interface RadiologistStats {
  totalScans: number;
  processingScans: number;
  completedToday: number;
  completedThisWeek: number;
  averageProcessingTime: number;
  qualityScore: number;
  recentScans: {
    id: string;
    sessionCode: string;
    patientName: string;
    status: string;
    scanDate: string;
  }[];
}

export interface AdminStats {
  totalUsers: number;
  totalPatients: number;
  totalDoctors: number;
  totalRadiologists: number;
  totalAdmins: number;
  activeUsers: number;
  suspendedUsers: number;
  totalScans: number;
  scansThisMonth: number;
  pendingVerifications: number;
  systemHealth: {
    database: 'healthy' | 'degraded' | 'down';
    storage: 'healthy' | 'degraded' | 'down';
    mlService: 'healthy' | 'degraded' | 'down';
  };
  recentActivity: {
    id: string;
    type: string;
    description: string;
    timestamp: string;
    userId: string;
  }[];
}

class StatsApi {
  private supabase = createClient();

  /**
   * Get patient dashboard statistics
   */
  async getPatientStats(patientId?: string): Promise<ApiResponse<PatientStats>> {
    try {
      let pid = patientId;

      // If no patientId provided, get current user's patient profile
      if (!pid) {
        const { data: { user } } = await this.supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const { data: profile } = await this.supabase
          .from('patient_profiles')
          .select('id')
          .eq('user_id', user.id)
          .single();

        if (!profile) throw new Error('Patient profile not found');
        pid = profile.id;
      }

      // Get all sessions for patient
      const { data: sessions } = await this.supabase
        .from('mri_sessions')
        .select(`
          id,
          session_code,
          scan_date,
          status,
          prediction:mri_predictions(prediction)
        `)
        .eq('patient_id', pid)
        .order('scan_date', { ascending: false });

      const allSessions = (sessions || []) as any[];

      // Calculate statistics
      const totalScans = allSessions.length;
      const completedScans = allSessions.filter(s => s.status === 'completed' || s.status === 'reviewed').length;
      const pendingScans = allSessions.filter(s => s.status === 'processing' || s.status === 'uploaded').length;
      const latestScanDate = allSessions[0]?.scan_date || null;

      // Calculate result distribution
      const resultDistribution = { CN: 0, MCI: 0, AD: 0 };
      allSessions.forEach(s => {
        const pred = Array.isArray(s.prediction) ? s.prediction[0]?.prediction : s.prediction?.prediction;
        if (pred && pred in resultDistribution) {
          resultDistribution[pred as keyof typeof resultDistribution]++;
        }
      });

      // Get recent scans (last 5)
      const recentScans = allSessions.slice(0, 5).map(s => ({
        id: s.id,
        sessionCode: s.session_code,
        scanDate: s.scan_date,
        status: s.status,
        prediction: Array.isArray(s.prediction) ? s.prediction[0]?.prediction : s.prediction?.prediction || null,
      }));

      return {
        data: {
          totalScans,
          completedScans,
          pendingScans,
          latestScanDate,
          resultDistribution,
          recentScans,
        },
        error: null,
        status: 200,
      };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Failed to fetch patient stats',
        status: 500,
      };
    }
  }

  /**
   * Get doctor dashboard statistics
   */
  async getDoctorStats(doctorId?: string): Promise<ApiResponse<DoctorStats>> {
    try {
      let did = doctorId;

      if (!did) {
        const { data: { user } } = await this.supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const { data: profile } = await this.supabase
          .from('doctor_profiles')
          .select('id')
          .eq('user_id', user.id)
          .single();

        if (!profile) throw new Error('Doctor profile not found');
        did = profile.id;
      }

      // Get assigned patients
      const { data: assignments } = await this.supabase
        .from('doctor_assignments')
        .select(`
          id,
          status,
          patient:patient_profiles(
            id,
            patient_code,
            user_profile:user_profiles(full_name)
          )
        `)
        .eq('doctor_id', did);

      const allAssignments = (assignments || []) as any[];
      const activeAssignments = allAssignments.filter(a => a.status === 'active');

      // Get patient IDs for session queries
      const patientIds = activeAssignments.map(a => a.patient?.id).filter(Boolean);

      // Get sessions for assigned patients
      let sessionsData: any[] = [];
      if (patientIds.length > 0) {
        const { data: sessions } = await this.supabase
          .from('mri_sessions')
          .select(`
            id,
            session_code,
            patient_id,
            scan_date,
            status,
            prediction:mri_predictions(prediction)
          `)
          .in('patient_id', patientIds)
          .order('scan_date', { ascending: false });

        sessionsData = sessions || [];
      }

      // Calculate statistics
      const totalPatients = allAssignments.length;
      const activePatients = activeAssignments.length;
      const pendingReviews = sessionsData.filter(s => s.status === 'completed').length;
      const completedReviews = sessionsData.filter(s => s.status === 'reviewed').length;

      // This month's scans
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const thisMonthScans = sessionsData.filter(s => new Date(s.scan_date) >= startOfMonth).length;

      // Result distribution
      const resultDistribution = { CN: 0, MCI: 0, AD: 0 };
      sessionsData.forEach(s => {
        const pred = Array.isArray(s.prediction) ? s.prediction[0]?.prediction : s.prediction?.prediction;
        if (pred && pred in resultDistribution) {
          resultDistribution[pred as keyof typeof resultDistribution]++;
        }
      });

      // Recent patients with latest scan info
      const recentPatients = activeAssignments.slice(0, 5).map(a => {
        const patientSessions = sessionsData.filter(s => s.patient_id === a.patient?.id);
        const latestSession = patientSessions[0];
        return {
          id: a.patient?.id || '',
          name: a.patient?.user_profile?.full_name || '',
          patientCode: a.patient?.patient_code || '',
          latestScanStatus: latestSession?.status || null,
          latestPrediction: latestSession?.prediction?.[0]?.prediction || null,
        };
      });

      return {
        data: {
          totalPatients,
          activePatients,
          pendingReviews,
          completedReviews,
          thisMonthScans,
          resultDistribution,
          recentPatients,
        },
        error: null,
        status: 200,
      };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Failed to fetch doctor stats',
        status: 500,
      };
    }
  }

  /**
   * Get radiologist dashboard statistics
   */
  async getRadiologistStats(radiologistId?: string): Promise<ApiResponse<RadiologistStats>> {
    try {
      let rid = radiologistId;

      if (!rid) {
        const { data: { user } } = await this.supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const { data: profile } = await this.supabase
          .from('radiologist_profiles')
          .select('id')
          .eq('user_id', user.id)
          .single();

        if (!profile) throw new Error('Radiologist profile not found');
        rid = profile.id;
      }

      // Get all sessions for radiologist
      const { data: sessions } = await this.supabase
        .from('mri_sessions')
        .select(`
          id,
          session_code,
          scan_date,
          status,
          patient:patient_profiles(
            user_profile:user_profiles(full_name)
          ),
          prediction:mri_predictions(processing_time)
        `)
        .eq('radiologist_id', rid)
        .order('scan_date', { ascending: false });

      const allSessions = (sessions || []) as any[];

      // Calculate statistics
      const totalScans = allSessions.length;
      const processingScans = allSessions.filter(s => s.status === 'processing').length;

      // Today's completed scans
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const completedToday = allSessions.filter(s => {
        const scanDate = new Date(s.scan_date);
        return scanDate >= today && (s.status === 'completed' || s.status === 'reviewed');
      }).length;

      // This week's completed scans
      const startOfWeek = new Date();
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      const completedThisWeek = allSessions.filter(s => {
        const scanDate = new Date(s.scan_date);
        return scanDate >= startOfWeek && (s.status === 'completed' || s.status === 'reviewed');
      }).length;

      // Average processing time
      const processingTimes = allSessions
        .map(s => Array.isArray(s.prediction) ? s.prediction[0]?.processing_time : s.prediction?.processing_time)
        .filter(Boolean) as number[];
      const averageProcessingTime = processingTimes.length > 0
        ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length
        : 0;

      // Quality score (mock for now - would come from real QA system)
      const qualityScore = 98.5;

      // Recent scans
      const recentScans = allSessions.slice(0, 5).map(s => {
        const patientProfile = Array.isArray(s.patient?.user_profile)
          ? s.patient?.user_profile[0]
          : s.patient?.user_profile;
        return {
          id: s.id,
          sessionCode: s.session_code,
          patientName: patientProfile?.full_name || 'Unknown',
          status: s.status,
          scanDate: s.scan_date,
        };
      });

      return {
        data: {
          totalScans,
          processingScans,
          completedToday,
          completedThisWeek,
          averageProcessingTime,
          qualityScore,
          recentScans,
        },
        error: null,
        status: 200,
      };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Failed to fetch radiologist stats',
        status: 500,
      };
    }
  }

  /**
   * Get admin dashboard statistics
   */
  async getAdminStats(): Promise<ApiResponse<AdminStats>> {
    try {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      // Run all queries in parallel for better performance
      const [
        usersResult,
        totalScansResult,
        scansThisMonthResult,
        pendingVerificationsResult
      ] = await Promise.all([
        this.supabase.from('user_profiles').select('role, account_status'),
        this.supabase.from('mri_sessions').select('*', { count: 'exact', head: true }),
        this.supabase.from('mri_sessions').select('*', { count: 'exact', head: true }).gte('created_at', startOfMonth.toISOString()),
        this.supabase.from('doctor_profiles').select('*', { count: 'exact', head: true }).is('license_number', null)
      ]);

      const allUsers = usersResult.data || [];

      const totalUsers = allUsers.length;
      const totalPatients = allUsers.filter((u: any) => u.role === 'patient').length;
      const totalDoctors = allUsers.filter((u: any) => u.role === 'doctor').length;
      const totalRadiologists = allUsers.filter((u: any) => u.role === 'radiologist').length;
      const totalAdmins = allUsers.filter((u: any) => u.role === 'admin').length;
      const activeUsers = allUsers.filter((u: any) => u.account_status === 'active').length;
      const suspendedUsers = allUsers.filter((u: any) => u.account_status === 'suspended').length;

      // System health (mock - would come from real monitoring)
      const systemHealth = {
        database: 'healthy' as const,
        storage: 'healthy' as const,
        mlService: 'healthy' as const,
      };

      // Recent activity (mock - would come from audit log)
      const recentActivity: AdminStats['recentActivity'] = [];

      return {
        data: {
          totalUsers,
          totalPatients,
          totalDoctors,
          totalRadiologists,
          totalAdmins,
          activeUsers,
          suspendedUsers,
          totalScans: totalScansResult.count || 0,
          scansThisMonth: scansThisMonthResult.count || 0,
          pendingVerifications: pendingVerificationsResult.count || 0,
          systemHealth,
          recentActivity,
        },
        error: null,
        status: 200,
      };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Failed to fetch admin stats',
        status: 500,
      };
    }
  }
}

export const statsApi = new StatsApi();
