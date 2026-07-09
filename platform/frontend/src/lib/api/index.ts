/**
 * API Service Layer
 * Centralized API calls with error handling and typing
 */

import { createClient } from '@/lib/supabase/client';

// Types
export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  status: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface FilterOptions {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
  status?: string;
  role?: string;
  dateFrom?: string;
  dateTo?: string;
}

// Base API class with common functionality
class ApiService {
  protected supabase = createClient();

  protected async handleError(error: unknown): Promise<string> {
    if (error instanceof Error) {
      return error.message;
    }
    return 'An unexpected error occurred';
  }

  protected buildPaginatedResponse<T>(
    data: T[],
    total: number,
    page: number,
    pageSize: number
  ): PaginatedResponse<T> {
    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}

export { ApiService };

// Re-export all API modules
export * from './patients';
export * from './doctors';
export * from './sessions';
export * from './stats';
export * from './users';
