/**
 * Doctors API Service
 * Handles all doctor-related API calls
 */

import { createClient } from '@/lib/supabase/client';
import type { ApiResponse, PaginatedResponse, FilterOptions } from './index';

export interface Doctor {
  id: string;
  user_id: string;
  doctor_code: string;
  specialization: string;
  qualification_id: string | null;
  license_number: string;
  hospital_id: string | null;
  experience_years: number | null;
  created_at: string;
  updated_at: string;
  // Joined data
  user_profile?: {
    full_name: string;
    email: string;
    phone: string | null;
    account_status: string;
  };
  qualification?: {
    qualification_name: string;
  };
  hospital?: {
    name: string;
    city: string;
  };
  // Computed
  full_name?: string;
  email?: string;
}

export interface DoctorWithPatients extends Doctor {
  patients_count: number;
  pending_reviews: number;
  assigned_patients?: {
    id: string;
    name: string;
    patient_code: string;
    latest_scan_status?: string;
  }[];
}

class DoctorsApi {
  private supabase = createClient();

  /**
   * Get all doctors with pagination and filtering
   */
  async getDoctors(options: FilterOptions = {}): Promise<ApiResponse<PaginatedResponse<Doctor>>> {
    try {
      const {
        page = 1,
        pageSize = 10,
        sortBy = 'created_at',
        sortOrder = 'desc',
        search = '',
      } = options;

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = this.supabase
        .from('doctor_profiles')
        .select(`
          *,
          user_profile:user_profiles!doctor_profiles_user_id_fkey(
            full_name,
            email,
            phone,
            account_status
          ),
          qualification:qualifications(qualification_name),
          hospital:hospitals(name, city)
        `, { count: 'exact' });

      if (search) {
        query = query.or(`doctor_code.ilike.%${search}%,specialization.ilike.%${search}%`);
      }

      query = query
        .order(sortBy, { ascending: sortOrder === 'asc' })
        .range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      const doctors = (data || []).map((d: any) => ({
        ...d,
        full_name: d.user_profile?.full_name,
        email: d.user_profile?.email,
      }));

      return {
        data: {
          data: doctors,
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
        error: error instanceof Error ? error.message : 'Failed to fetch doctors',
        status: 500,
      };
    }
  }

  /**
   * Get a single doctor by ID
   */
  async getDoctor(id: string): Promise<ApiResponse<DoctorWithPatients>> {
    try {
      const { data: doctor, error: doctorError } = await this.supabase
        .from('doctor_profiles')
        .select(`
          *,
          user_profile:user_profiles!doctor_profiles_user_id_fkey(
            full_name,
            email,
            phone,
            account_status
          ),
          qualification:qualifications(qualification_name),
          hospital:hospitals(name, city)
        `)
        .eq('id', id)
        .single();

      if (doctorError) throw doctorError;

      // Get assigned patients count
      const { count: patientsCount } = await this.supabase
        .from('doctor_assignments')
        .select('*', { count: 'exact', head: true })
        .eq('doctor_id', id)
        .eq('status', 'active');

      // Get pending reviews count
      const { count: pendingCount } = await this.supabase
        .from('mri_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('doctor_id', id)
        .eq('status', 'completed');

      // Get assigned patients list
      const { data: assignments } = await this.supabase
        .from('doctor_assignments')
        .select(`
          patient:patient_profiles(
            id,
            patient_code,
            user_profile:user_profiles(full_name)
          )
        `)
        .eq('doctor_id', id)
        .eq('status', 'active')
        .limit(10);

      const result: DoctorWithPatients = {
        ...doctor,
        full_name: doctor.user_profile?.full_name,
        email: doctor.user_profile?.email,
        patients_count: patientsCount || 0,
        pending_reviews: pendingCount || 0,
        assigned_patients: assignments?.map((a: any) => ({
          id: a.patient?.id,
          name: Array.isArray(a.patient?.user_profile)
            ? a.patient?.user_profile[0]?.full_name
            : a.patient?.user_profile?.full_name,
          patient_code: a.patient?.patient_code,
        })).filter(Boolean) as DoctorWithPatients['assigned_patients'],
      };

      return {
        data: result,
        error: null,
        status: 200,
      };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Failed to fetch doctor',
        status: 500,
      };
    }
  }

  /**
   * Get doctor's assigned patients
   */
  async getDoctorPatients(doctorId: string, options: FilterOptions = {}): Promise<ApiResponse<PaginatedResponse<any>>> {
    try {
      const { page = 1, pageSize = 10 } = options;
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await this.supabase
        .from('doctor_assignments')
        .select(`
          id,
          assigned_date,
          status,
          patient:patient_profiles(
            id,
            patient_code,
            age,
            gender,
            user_profile:user_profiles(full_name, email)
          )
        `, { count: 'exact' })
        .eq('doctor_id', doctorId)
        .eq('status', 'active')
        .range(from, to);

      if (error) throw error;

      const patients = (data || []).map((a: any) => {
        const userProfile = Array.isArray(a.patient?.user_profile)
          ? a.patient?.user_profile[0]
          : a.patient?.user_profile;
        return {
          assignment_id: a.id,
          assigned_date: a.assigned_date,
          ...a.patient,
          full_name: userProfile?.full_name,
          email: userProfile?.email,
        };
      });

      return {
        data: {
          data: patients,
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
        error: error instanceof Error ? error.message : 'Failed to fetch patients',
        status: 500,
      };
    }
  }

  /**
   * Assign a patient to a doctor
   */
  async assignPatient(doctorId: string, patientId: string): Promise<ApiResponse<any>> {
    try {
      const { data: { user } } = await this.supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Check if assignment already exists
      const { data: existing } = await this.supabase
        .from('doctor_assignments')
        .select('id')
        .eq('doctor_id', doctorId)
        .eq('patient_id', patientId)
        .eq('status', 'active')
        .single();

      if (existing) {
        return {
          data: null,
          error: 'Patient is already assigned to this doctor',
          status: 400,
        };
      }

      const { data, error } = await this.supabase
        .from('doctor_assignments')
        .insert({
          doctor_id: doctorId,
          patient_id: patientId,
          assigned_by: user.id,
          assigned_date: new Date().toISOString(),
          status: 'active',
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
        error: error instanceof Error ? error.message : 'Failed to assign patient',
        status: 500,
      };
    }
  }

  /**
   * Unassign a patient from a doctor
   */
  async unassignPatient(doctorId: string, patientId: string): Promise<ApiResponse<any>> {
    try {
      const { error } = await this.supabase
        .from('doctor_assignments')
        .update({ status: 'inactive' })
        .eq('doctor_id', doctorId)
        .eq('patient_id', patientId)
        .eq('status', 'active');

      if (error) throw error;

      return {
        data: { success: true },
        error: null,
        status: 200,
      };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Failed to unassign patient',
        status: 500,
      };
    }
  }

  /**
   * Get current doctor's profile (for logged-in doctor)
   */
  async getCurrentDoctorProfile(): Promise<ApiResponse<DoctorWithPatients>> {
    try {
      const { data: { user } } = await this.supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: doctor, error } = await this.supabase
        .from('doctor_profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;

      return this.getDoctor(doctor.id);
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Failed to fetch profile',
        status: 500,
      };
    }
  }

  /**
   * Get all doctor-patient assignments (for admin view)
   */
  async getAllAssignments(options: FilterOptions = {}): Promise<ApiResponse<PaginatedResponse<any>>> {
    try {
      const { page = 1, pageSize = 20 } = options;
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await this.supabase
        .from('doctor_assignments')
        .select(`
          id,
          assigned_date,
          status,
          doctor:doctor_profiles(
            id,
            doctor_code,
            specialization,
            user_profile:user_profiles(full_name)
          ),
          patient:patient_profiles(
            id,
            patient_code,
            user_profile:user_profiles(full_name)
          )
        `, { count: 'exact' })
        .eq('status', 'active')
        .order('assigned_date', { ascending: false })
        .range(from, to);

      if (error) throw error;

      const assignments = (data || []).map((a: any) => {
        const doctorProfile = Array.isArray(a.doctor?.user_profile)
          ? a.doctor?.user_profile[0]
          : a.doctor?.user_profile;
        const patientProfile = Array.isArray(a.patient?.user_profile)
          ? a.patient?.user_profile[0]
          : a.patient?.user_profile;
        return {
          id: a.id,
          assigned_date: a.assigned_date,
          status: a.status,
          doctor_id: a.doctor?.id,
          doctor_code: a.doctor?.doctor_code,
          doctor_name: doctorProfile?.full_name || 'Unknown Doctor',
          doctor_specialization: a.doctor?.specialization,
          patient_id: a.patient?.id,
          patient_code: a.patient?.patient_code,
          patient_name: patientProfile?.full_name || 'Unknown Patient',
        };
      });

      return {
        data: {
          data: assignments,
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
        error: error instanceof Error ? error.message : 'Failed to fetch assignments',
        status: 500,
      };
    }
  }
}

export const doctorsApi = new DoctorsApi();
