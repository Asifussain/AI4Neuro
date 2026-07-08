import { createBrowserClient } from '@supabase/ssr';

// Singleton instance for API calls to prevent multiple client creation
let supabaseInstance: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (!supabaseInstance) {
    supabaseInstance = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return supabaseInstance;
}

// Reset client (for testing or logout scenarios)
export function resetClient() {
  supabaseInstance = null;
}
