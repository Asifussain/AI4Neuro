'use client';

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient, resetClient } from '@/lib/supabase/client';
import { AuthChangeEvent, User, Session } from '@supabase/supabase-js';
import type { Role } from '@/lib/roles';
import { apiClient } from '@/lib/api/client';

interface RoleProfile {
  date_of_birth?: string;
  blood_groups?: { blood_group?: string };
  emergency_contact?: string;
  license_number?: string;
  specialization?: string;
  hospitals?: { name?: string };
  years_of_experience?: number;
  admin_level?: string;
  patient_code?: string;
}

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  phone?: string;
  avatar_url?: string;
  account_status: 'active' | 'inactive' | 'suspended';
  roleProfile?: RoleProfile | null;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  session: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const supabase = useMemo(() => createClient(), []);

  // Get profile from user metadata (fast, no DB call)
  const getProfileFromMetadata = useCallback((currentUser: User): UserProfile | null => {
    const metadata = currentUser.user_metadata;
    if (metadata?.role) {
      return {
        id: currentUser.id,
        full_name: metadata.full_name || currentUser.email?.split('@')[0] || 'User',
        email: currentUser.email || '',
        role: metadata.role as UserProfile['role'],
        account_status: 'active',
      };
    }
    return null;
  }, []);

  // Fetch full profile from DB / backend
  const fetchFullProfile = useCallback(async (currentUser: User): Promise<UserProfile | null> => {
    try {
      // 1. Try FastAPI backend /users/me first (bypasses RLS restrictions)
      try {
        const backendUser = await apiClient.get<any>('/api/v1/users/me');
        if (backendUser && backendUser.id) {
          const profileBag = backendUser.profile || {};
          return {
            id: backendUser.id,
            full_name: backendUser.full_name || profileBag.full_name || 'User',
            email: backendUser.email || currentUser.email || '',
            role: (backendUser.role || profileBag.role || 'patient') as Role,
            phone: backendUser.phone || profileBag.phone || '',
            avatar_url: backendUser.avatar_url || profileBag.avatar_url || '',
            account_status: backendUser.account_status || 'active',
            roleProfile: profileBag.roleProfile || null,
          };
        }
      } catch (err) {
        console.log('FastAPI /users/me fetch error, falling back to Supabase:', err);
      }

      // 2. Fallback to Supabase direct query
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();

      if (profile) {
        let roleProfile = null;
        try {
          const role = profile.role;
          if (role === 'doctor') {
            const { data } = await supabase.from('doctor_profiles').select('*, hospitals(name)').eq('user_id', currentUser.id).single();
            roleProfile = data;
          } else if (role === 'radiologist') {
            const { data } = await supabase.from('radiologist_profiles').select('*, hospitals(name)').eq('user_id', currentUser.id).single();
            roleProfile = data;
          } else if (role === 'patient') {
            const { data } = await supabase.from('patient_profiles').select('*, blood_groups(blood_group)').eq('user_id', currentUser.id).single();
            roleProfile = data;
          } else if (role === 'admin') {
            const { data } = await supabase.from('hospital_admins').select('*, hospitals(name)').eq('user_id', currentUser.id).single();
            roleProfile = data;
          }
        } catch {
          // Keep null if role-specific table fetch fails
        }
        return { ...profile, roleProfile };
      }

      return null;
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') {
        console.log('Profile fetch timed out');
      } else {
        console.log('Profile fetch error:', e instanceof Error ? e.message : e);
      }
      return null;
    }
  }, [supabase]);

  // Refresh profile
  const refreshProfile = useCallback(async () => {
    if (user) {
      const profile = await fetchFullProfile(user);
      if (profile) {
        setUserProfile(profile);
      }
    }
  }, [user, fetchFullProfile]);

  // Initialize auth
  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        console.log('Auth init...');

        const { data: { session: currentSession }, error } = await supabase.auth.getSession();

        if (!mounted) return;

        if (error) {
          console.error('Session error:', error.message);
          // Clear stale/invalid session from storage to prevent repeated errors
          try {
            await supabase.auth.signOut();
          } catch {}
          setLoading(false);
          return;
        }

        if (currentSession?.user) {
          console.log('Session found for:', currentSession.user.email);
          setSession(currentSession);
          setUser(currentSession.user);

          // FAST: Get profile from metadata immediately
          const metadataProfile = getProfileFromMetadata(currentSession.user);
          if (metadataProfile) {
            console.log('Using metadata profile:', metadataProfile.role);
            setUserProfile(metadataProfile);
            setLoading(false);

            // BACKGROUND: Try to get full profile from DB
            fetchFullProfile(currentSession.user).then(dbProfile => {
              if (mounted && dbProfile) {
                setUserProfile(dbProfile);
              }
            });
          } else {
            // Fallback: Try DB query if no metadata
            console.log('No metadata, trying DB...');
            const dbProfile = await fetchFullProfile(currentSession.user);
            if (mounted) {
              setUserProfile(dbProfile);
              setLoading(false);
            }
          }
        } else {
          console.log('No session');
          setLoading(false);
        }
      } catch (error) {
        console.error('Auth error:', error);
        if (mounted) setLoading(false);
      }
    };

    // Safety timeout
    const safetyTimeout = setTimeout(() => {
      if (mounted) {
        console.log('Safety timeout - forcing load complete');
        setLoading(false);
      }
    }, 4000);

    initAuth();

    // Auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (
      event: AuthChangeEvent,
      currentSession: Session | null
    ) => {
      if (!mounted) return;
      console.log('Auth event:', event);

      if (event === 'SIGNED_IN' && currentSession?.user) {
        setSession(currentSession);
        setUser(currentSession.user);

        const metadataProfile = getProfileFromMetadata(currentSession.user);
        if (metadataProfile) {
          setUserProfile(metadataProfile);
        }
        setLoading(false);
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        setUserProfile(null);
        setLoading(false);
      } else if (event === 'TOKEN_REFRESHED' && currentSession) {
        setSession(currentSession);
      } else if (event === 'TOKEN_REFRESHED' && !currentSession) {
        // Refresh token was invalid - clear stale auth state
        console.log('Token refresh failed - clearing session');
        setSession(null);
        setUser(null);
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, [supabase, getProfileFromMetadata, fetchFullProfile]);

  // Sign out
  const signOut = useCallback(async () => {
    setLoading(false);
    setUser(null);
    setUserProfile(null);
    setSession(null);
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.log('Signout error:', e);
    }
    resetClient();
    router.replace('/login?logged_out=1');
    router.refresh();
  }, [router, supabase]);

  return (
    <AuthContext.Provider value={{ user, userProfile, session, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
