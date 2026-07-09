/**
 * Users API Service
 * Handles all user management API calls (primarily for admin)
 */

import { createClient } from '@/lib/supabase/client';
import type { ApiResponse, PaginatedResponse, FilterOptions } from './index';

export interface User {
  id: string;
  full_name: string;
  email: string;
  role: 'patient' | 'doctor' | 'radiologist' | 'admin';
  phone: string | null;
  account_status: 'active' | 'suspended' | 'pending';
  created_at: string;
  updated_at: string;
  // Role-specific profile
  roleProfile?: any;
}

export interface CreateUserInput {
  full_name: string;
  email: string;
  password: string;
  role: User['role'];
  phone?: string;
  // Role-specific fields
  patient?: {
    date_of_birth?: string;
    gender?: string;
    blood_group_id?: string;
    address?: string;
    city?: string;
    state?: string;
    emergency_contact_name?: string;
    emergency_contact_phone?: string;
    emergency_contact_relation?: string;
  };
  doctor?: {
    specialization: string;
    license_number: string;
    qualification_id?: string;
    hospital_id?: string;
    experience_years?: number;
  };
  radiologist?: {
    specialization?: string;
    license_number: string;
    qualification_id?: string;
    hospital_id?: string;
    certification?: string;
  };
  admin?: {
    hospital_id?: string;
    permissions?: Record<string, boolean>;
  };
}

export interface UpdateUserInput {
  full_name?: string;
  phone?: string;
  account_status?: User['account_status'];
}

class UsersApi {
  private supabase = createClient();

  /**
   * Get all users with pagination and filtering
   */
  async getUsers(options: FilterOptions = {}): Promise<ApiResponse<PaginatedResponse<User>>> {
    try {
      const {
        page = 1,
        pageSize = 10,
        sortBy = 'created_at',
        sortOrder = 'desc',
        search = '',
        role,
        status,
      } = options;

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = this.supabase
        .from('user_profiles')
        .select('*', { count: 'exact' });

      // Apply filters
      if (search) {
        query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
      }

      if (role) {
        query = query.eq('role', role);
      }

      if (status) {
        query = query.eq('account_status', status);
      }

      // Apply sorting and pagination
      query = query
        .order(sortBy, { ascending: sortOrder === 'asc' })
        .range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        data: {
          data: data || [],
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
        error: error instanceof Error ? error.message : 'Failed to fetch users',
        status: 500,
      };
    }
  }

  /**
   * Get a single user by ID
   */
  async getUser(id: string): Promise<ApiResponse<User>> {
    try {
      const { data: user, error: userError } = await this.supabase
        .from('user_profiles')
        .select('*')
        .eq('id', id)
        .single();

      if (userError) throw userError;

      // Fetch role-specific profile
      let roleProfile = null;
      switch (user.role) {
        case 'patient': {
          const { data } = await this.supabase
            .from('patient_profiles')
            .select('*, blood_group:blood_groups(blood_group)')
            .eq('user_id', id)
            .single();
          roleProfile = data;
          break;
        }
        case 'doctor': {
          const { data } = await this.supabase
            .from('doctor_profiles')
            .select('*, qualification:qualifications(qualification_name), hospital:hospitals(name, city)')
            .eq('user_id', id)
            .single();
          roleProfile = data;
          break;
        }
        case 'radiologist': {
          const { data } = await this.supabase
            .from('radiologist_profiles')
            .select('*, qualification:qualifications(qualification_name), hospital:hospitals(name, city)')
            .eq('user_id', id)
            .single();
          roleProfile = data;
          break;
        }
        case 'admin': {
          const { data } = await this.supabase
            .from('admin_profiles')
            .select('*, hospital:hospitals(name, city)')
            .eq('user_id', id)
            .single();
          roleProfile = data;
          break;
        }
      }

      return {
        data: { ...user, roleProfile },
        error: null,
        status: 200,
      };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Failed to fetch user',
        status: 500,
      };
    }
  }

  /**
   * Create a new user (calls Next.js API route which uses service role)
   */
  async createUser(input: CreateUserInput): Promise<ApiResponse<User>> {
    try {
      const response = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      });

      const result = await response.json();

      if (!response.ok) {
        return {
          data: null,
          error: result.error || 'Failed to create user',
          status: response.status,
        };
      }

      return {
        data: result.user,
        error: null,
        status: 201,
      };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Failed to create user',
        status: 500,
      };
    }
  }

  /**
   * Update a user
   */
  async updateUser(id: string, input: UpdateUserInput): Promise<ApiResponse<User>> {
    try {
      const { data, error } = await this.supabase
        .from('user_profiles')
        .update({
          ...input,
          updated_at: new Date().toISOString(),
        })
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
        error: error instanceof Error ? error.message : 'Failed to update user',
        status: 500,
      };
    }
  }

  /**
   * Suspend a user
   */
  async suspendUser(id: string): Promise<ApiResponse<User>> {
    return this.updateUser(id, { account_status: 'suspended' });
  }

  /**
   * Activate a user
   */
  async activateUser(id: string): Promise<ApiResponse<User>> {
    return this.updateUser(id, { account_status: 'active' });
  }

  /**
   * Delete a user (soft delete by setting status)
   */
  async deleteUser(id: string): Promise<ApiResponse<{ success: boolean }>> {
    try {
      // Soft delete - just suspend the account
      const { error } = await this.supabase
        .from('user_profiles')
        .update({
          account_status: 'suspended',
          updated_at: new Date().toISOString(),
        })
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
        error: error instanceof Error ? error.message : 'Failed to delete user',
        status: 500,
      };
    }
  }

  /**
   * Get users by role
   */
  async getUsersByRole(role: User['role'], options: FilterOptions = {}): Promise<ApiResponse<PaginatedResponse<User>>> {
    return this.getUsers({ ...options, role });
  }

  /**
   * Search users
   */
  async searchUsers(query: string, options: FilterOptions = {}): Promise<ApiResponse<PaginatedResponse<User>>> {
    return this.getUsers({ ...options, search: query });
  }

  /**
   * Get lookup data (hospitals, qualifications, blood groups)
   */
  async getLookupData(): Promise<ApiResponse<{
    hospitals: { id: string; name: string; city: string }[];
    qualifications: { id: string; qualification_name: string }[];
    bloodGroups: { id: string; blood_group: string }[];
  }>> {
    try {
      const [hospitalsRes, qualificationsRes, bloodGroupsRes] = await Promise.all([
        this.supabase.from('hospitals').select('id, name, city'),
        this.supabase.from('qualifications').select('id, qualification_name'),
        this.supabase.from('blood_groups').select('id, blood_group'),
      ]);

      if (hospitalsRes.error) throw hospitalsRes.error;
      if (qualificationsRes.error) throw qualificationsRes.error;
      if (bloodGroupsRes.error) throw bloodGroupsRes.error;

      return {
        data: {
          hospitals: hospitalsRes.data || [],
          qualifications: qualificationsRes.data || [],
          bloodGroups: bloodGroupsRes.data || [],
        },
        error: null,
        status: 200,
      };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Failed to fetch lookup data',
        status: 500,
      };
    }
  }
}

export const usersApi = new UsersApi();
