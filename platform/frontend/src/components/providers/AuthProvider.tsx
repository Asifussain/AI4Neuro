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
  blood_group_id?: number | null;
  blood_type?: string | null;
  emergency_contact?: string;
  license_number?: string;
  specialization?: string;
  hospitals?: { name?: string };
  hospital_id?: string | null;
  hospital_name?: string | null;
  years_of_experience?: number;
  admin_level?: string;
  patient_code?: string;
  // Role-detail tables carry many more columns (employee_id, department,
  // medical_license, imaging_expertise, certifications, qualification_id,
  // experience_years, …); they're read dynamically by the profile page.
  [key: string]: unknown;
}

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  phone?: string;
  avatar_url?: string;
  hospital_id?: string | null;
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
            // hospital_id is on user_profiles, not the role-detail tables — carry
            // it through so profile/dashboard views can resolve the hospital name
            // instead of showing "Not provided".
            hospital_id: backendUser.hospital_id ?? profileBag.hospital_id ?? null,
            account_status: backendUser.account_status || 'active',
            roleProfile: profileBag.roleProfile || null,
          };
        }
      } catch (err) {
        console.log('FastAPI /users/me fetch error, falling back to Supabase:', err);
      }

      // 2. Fallback to Supabase direct query (used when the backend /users/me
      //    is unreachable). maybeSingle() so a transient 0-row/RLS hiccup
      //    doesn't throw and blank the whole profile.
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', currentUser.id)
        .maybeSingle();

      if (profile) {
        // Role-detail table per role. NOTE: these tables are keyed by user_id
        // and have NO hospital FK — the hospital lives on user_profiles — so we
        // must NOT try to join hospitals() here (that join errors and nulls the
        // whole roleProfile). The hospital name is resolved separately below.
        const ROLE_TABLE: Record<string, string> = {
          doctor: 'doctor_profiles',
          radiologist: 'radiologist_profiles',
          patient: 'patient_profiles',
          admin: 'hospital_admin_profiles',
          super_admin: 'super_admin_profiles',
        };
        let roleProfile: RoleProfile = {};
        const table = ROLE_TABLE[profile.role as string];
        if (table) {
          try {
            const { data } = await supabase.from(table).select('*').eq('user_id', currentUser.id).maybeSingle();
            if (data) roleProfile = { ...(data as RoleProfile) };
          } catch {
            // Keep the empty roleProfile if the role table read fails.
          }
        }
        // Resolve blood type for patients (patient_profiles.blood_group_id -> blood_groups.blood_type).
        const bloodGroupId = roleProfile.blood_group_id;
        if (profile.role === 'patient' && bloodGroupId) {
          try {
            const { data: bg } = await supabase
              .from('blood_groups').select('blood_type').eq('id', bloodGroupId).maybeSingle();
            if (bg?.blood_type) roleProfile = { ...roleProfile, blood_type: bg.blood_type };
          } catch {}
        }
        // Resolve the hospital NAME from user_profiles.hospital_id so every
        // role's profile page shows its hospital (not "Not provided").
        if (profile.hospital_id) {
          try {
            const { data: h } = await supabase
              .from('hospitals').select('name').eq('id', profile.hospital_id).maybeSingle();
            if (h?.name) {
              roleProfile = { ...roleProfile, hospital_id: profile.hospital_id, hospital_name: h.name };
            }
          } catch {}
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

        // FAST: show the bare JWT-metadata profile immediately (no
        // avatar_url/phone/roleProfile — those only live in the DB).
        const metadataProfile = getProfileFromMetadata(currentSession.user);
        if (metadataProfile) {
          setUserProfile(metadataProfile);
        }
        setLoading(false);

        // BACKGROUND: replace it with the real saved profile. Without this,
        // every fresh login (as opposed to a page reload, which goes
        // through initAuth below) would show stale/default field values
        // even though the previous edit was persisted correctly — looking
        // exactly like "my changes got lost after logout/login".
        fetchFullProfile(currentSession.user).then((dbProfile) => {
          if (mounted && dbProfile) {
            setUserProfile(dbProfile);
          }
        });
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
