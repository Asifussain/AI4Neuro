/**
 * MRI Sessions API Service
 * Handles all MRI session-related API calls
 */

import { createClient } from '@/lib/supabase/client';
import type { ApiResponse, PaginatedResponse, FilterOptions } from './index';

export interface MRISession {
  id: string;
  session_code: string;
  patient_id: string;
  doctor_id: string | null;
  radiologist_id: string | null;
  scan_date: string;
  status: 'uploaded' | 'processing' | 'completed' | 'failed' | 'reviewed';
  analysis_type: string;
  dicom_file_path: string | null;
  scanner_manufacturer: string | null;
  scanner_model: string | null;
  scanner_field_strength: string | null;
  sequence_type: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  patient?: {
    id: string;
    patient_code: string;
    user_profile?: {
      full_name: string;
    };
  };
  doctor?: {
    id: string;
    user_profile?: {
      full_name: string;
    };
  };
  radiologist?: {
    id: string;
    user_profile?: {
      full_name: string;
    };
  };
  prediction?: MRIPrediction;
}

export interface MRIPrediction {
  id: string;
  session_id: string;
  prediction: 'CN' | 'MCI' | 'AD';
  confidence_score: number;
  probabilities: {
    CN: number;
    MCI: number;
    AD: number;
  };
  brain_volume: number | null;
  gm_volume: number | null;
  wm_volume: number | null;
  csf_volume: number | null;
  hippocampal_volume: number | null;
  ventricular_volume: number | null;
  model_version: string | null;
  processing_time: number | null;
  technical_pdf_url: string | null;
  clinician_pdf_url: string | null;
  patient_pdf_url: string | null;
  similarity_plot_url: string | null;
  volume_chart_url: string | null;
  confidence_chart_url: string | null;
  report_generated_at: string | null;
  created_at: string;
  // Slice URLs for the real MRI viewer
  slice_urls?: {
    axial: string[];
    sagittal: string[];
    coronal: string[];
  } | null;
}

export interface CreateSessionInput {
  patient_id: string;
  doctor_id?: string;
  analysis_type?: string;
  scanner_manufacturer?: string;
  scanner_model?: string;
  scanner_field_strength?: string;
  sequence_type?: string;
  notes?: string;
}

class SessionsApi {
  private supabase = createClient();

  /**
   * Get all MRI sessions with pagination and filtering
   */
  async getSessions(options: FilterOptions = {}): Promise<ApiResponse<PaginatedResponse<MRISession>>> {
    try {
      const {
        page = 1,
        pageSize = 10,
        sortBy = 'scan_date',
        sortOrder = 'desc',
        search = '',
        status,
      } = options;

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = this.supabase
        .from('mri_sessions')
        .select(`
          *,
          patient:patient_profiles(
            id,
            patient_code,
            user_profile:user_profiles(full_name)
          ),
          doctor:doctor_profiles(
            id,
            user_profile:user_profiles(full_name)
          ),
          radiologist:radiologist_profiles(
            id,
            user_profile:user_profiles(full_name)
          ),
          prediction:mri_predictions(*)
        `, { count: 'exact' });

      if (search) {
        query = query.ilike('session_code', `%${search}%`);
      }

      if (status) {
        query = query.eq('status', status);
      }

      query = query
        .order(sortBy, { ascending: sortOrder === 'asc' })
        .range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      // Transform to get first prediction
      const sessions = (data || []).map((s: any) => ({
        ...s,
        prediction: Array.isArray(s.prediction) ? s.prediction[0] : s.prediction,
      }));

      return {
        data: {
          data: sessions,
          total: count || 0,
          page,
          pageSize,
          totalPages: Math.ceil((count || 0) / pageSize),
        },
        error: null,
        status: 200,
      };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Failed to fetch sessions',
        status: 500,
      };
    }
  }

  /**
   * Get a single session by ID
   */
  async getSession(id: string): Promise<ApiResponse<MRISession>> {
    try {
      const { data, error } = await this.supabase
        .from('mri_sessions')
        .select(`
          *,
          patient:patient_profiles(
            id,
            patient_code,
            age,
            gender,
            user_profile:user_profiles(full_name, email)
          ),
          doctor:doctor_profiles(
            id,
            doctor_code,
            specialization,
            user_profile:user_profiles(full_name)
          ),
          radiologist:radiologist_profiles(
            id,
            radiologist_code,
            user_profile:user_profiles(full_name)
          ),
          prediction:mri_predictions(*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      // Transform to get first prediction
      const session = {
        ...data,
        prediction: Array.isArray(data.prediction) ? data.prediction[0] : data.prediction,
      };

      return {
        data: session,
        error: null,
        status: 200,
      };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Failed to fetch session',
        status: 500,
      };
    }
  }

  /**
   * Get session by session code
   */
  async getSessionByCode(sessionCode: string): Promise<ApiResponse<MRISession>> {
    try {
      const { data, error } = await this.supabase
        .from('mri_sessions')
        .select(`
          *,
          patient:patient_profiles(
            id,
            patient_code,
            age,
            gender,
            user_profile:user_profiles(full_name, email)
          ),
          doctor:doctor_profiles(
            id,
            specialization,
            user_profile:user_profiles(full_name)
          ),
          radiologist:radiologist_profiles(
            id,
            user_profile:user_profiles(full_name)
          ),
          prediction:mri_predictions(*)
        `)
        .eq('session_code', sessionCode)
        .single();

      if (error) throw error;

      const session = {
        ...data,
        prediction: Array.isArray(data.prediction) ? data.prediction[0] : data.prediction,
      };

      return {
        data: session,
        error: null,
        status: 200,
      };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Failed to fetch session',
        status: 500,
      };
    }
  }

  /**
   * Create a new MRI session
   */
  async createSession(input: CreateSessionInput): Promise<ApiResponse<MRISession>> {
    try {
      const { data: { user } } = await this.supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get radiologist profile
      const { data: radiologist } = await this.supabase
        .from('radiologist_profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      // Generate session code
      const timestamp = Date.now();
      const sessionCode = `MRI-${new Date().getFullYear()}-${timestamp.toString().slice(-6)}`;

      const { data, error } = await this.supabase
        .from('mri_sessions')
        .insert({
          session_code: sessionCode,
          patient_id: input.patient_id,
          doctor_id: input.doctor_id || null,
          radiologist_id: radiologist?.id || null,
          scan_date: new Date().toISOString(),
          status: 'uploaded',
          analysis_type: input.analysis_type || 'multi-disease',
          scanner_manufacturer: input.scanner_manufacturer,
          scanner_model: input.scanner_model,
          scanner_field_strength: input.scanner_field_strength,
          sequence_type: input.sequence_type,
          notes: input.notes,
        })
        .select()
        .single();

      if (error) throw error;

      return {
        data,
        error: null,
        status: 201,
      };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Failed to create session',
        status: 500,
      };
    }
  }

  /**
   * Update session status
   */
  async updateSessionStatus(id: string, status: MRISession['status']): Promise<ApiResponse<MRISession>> {
    try {
      const { data, error } = await this.supabase
        .from('mri_sessions')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return {
        data,
        error: null,
        status: 200,
      };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Failed to update session',
        status: 500,
      };
    }
  }

  /**
   * Mark session as reviewed (doctor action)
   */
  async markAsReviewed(id: string, notes?: string): Promise<ApiResponse<MRISession>> {
    try {
      const updateData: any = {
        status: 'reviewed',
        updated_at: new Date().toISOString(),
      };

      if (notes) {
        updateData.notes = notes;
      }

      const { data, error } = await this.supabase
        .from('mri_sessions')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return {
        data,
        error: null,
        status: 200,
      };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Failed to mark as reviewed',
        status: 500,
      };
    }
  }

  /**
   * Delete a session (admin only)
   */
  async deleteSession(id: string): Promise<ApiResponse<{ success: boolean }>> {
    try {
      // First delete related predictions
      await this.supabase
        .from('mri_predictions')
        .delete()
        .eq('session_id', id);

      // Then delete the session
      const { error } = await this.supabase
        .from('mri_sessions')
        .delete()
        .eq('id', id);

      if (error) throw error;

      return {
        data: { success: true },
        error: null,
        status: 200,
      };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Failed to delete session',
        status: 500,
      };
    }
  }

  /**
   * Get sessions for current user based on role
   */
  async getMySession(): Promise<ApiResponse<PaginatedResponse<MRISession>>> {
    try {
      const { data: { user } } = await this.supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get user role
      const { data: profile } = await this.supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (!profile) throw new Error('Profile not found');

      // Fetch sessions based on role
      let query = this.supabase
        .from('mri_sessions')
        .select(`
          *,
          patient:patient_profiles(
            id,
            patient_code,
            user_profile:user_profiles(full_name)
          ),
          prediction:mri_predictions(*)
        `, { count: 'exact' });

      switch (profile.role) {
        case 'patient': {
          const { data: patientProfile } = await this.supabase
            .from('patient_profiles')
            .select('id')
            .eq('user_id', user.id)
            .single();
          if (patientProfile) {
            query = query.eq('patient_id', patientProfile.id);
          }
          break;
        }
        case 'doctor': {
          const { data: doctorProfile } = await this.supabase
            .from('doctor_profiles')
            .select('id')
            .eq('user_id', user.id)
            .single();
          if (doctorProfile) {
            // Get sessions for assigned patients
            const { data: assignments } = await this.supabase
              .from('doctor_assignments')
              .select('patient_id')
              .eq('doctor_id', doctorProfile.id)
              .eq('status', 'active');

            const patientIds = assignments?.map((a: any) => a.patient_id) || [];
            if (patientIds.length > 0) {
              query = query.in('patient_id', patientIds);
            }
          }
          break;
        }
        case 'radiologist': {
          const { data: radProfile } = await this.supabase
            .from('radiologist_profiles')
            .select('id')
            .eq('user_id', user.id)
            .single();
          if (radProfile) {
            query = query.eq('radiologist_id', radProfile.id);
          }
          break;
        }
        // Admin gets all sessions - no filter needed
      }

      const { data, error, count } = await query
        .order('scan_date', { ascending: false })
        .limit(50);

      if (error) throw error;

      const sessions = (data || []).map((s: any) => ({
        ...s,
        prediction: Array.isArray(s.prediction) ? s.prediction[0] : s.prediction,
      }));

      return {
        data: {
          data: sessions,
          total: count || 0,
          page: 1,
          pageSize: 50,
          totalPages: 1,
        },
        error: null,
        status: 200,
      };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Failed to fetch sessions',
        status: 500,
      };
    }
  }
}

export const sessionsApi = new SessionsApi();
