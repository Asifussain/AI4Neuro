'use client';

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { User, Session } from '@supabase/supabase-js';

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  role: 'patient' | 'doctor' | 'radiologist' | 'admin';
  phone?: string;
  account_status: 'active' | 'inactive' | 'suspended';
  roleProfile?: any;
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

  // Fetch full profile from DB (background, non-blocking)
  const fetchFullProfile = useCallback(async (currentUser: User): Promise<UserProfile | null> => {
    try {
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', currentUser.id)
        .abortSignal(controller.signal)
        .single();

      clearTimeout(timeoutId);

      if (error) {
        console.log('DB profile fetch failed:', error.message);
        return null;
      }

      if (profile) {
        console.log('DB profile loaded:', profile.role);
        return { ...profile, roleProfile: null };
      }

      return null;
    } catch (e: any) {
      if (e.name === 'AbortError') {
        console.log('Profile fetch timed out');
      } else {
        console.log('Profile fetch error:', e.message);
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
          } catch (_) {}
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
      if (mounted && loading) {
        console.log('Safety timeout - forcing load complete');
        setLoading(false);
      }
    }, 4000);

    initAuth();

    // Auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: any, currentSession: any) => {
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
    setUser(null);
    setUserProfile(null);
    setSession(null);
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.log('Signout error:', e);
    }
    // Signal to login page that we just logged out so it skips the session redirect
    window.location.href = '/login?logged_out=1';
  }, [supabase]);

  return (
    <AuthContext.Provider value={{ user, userProfile, session, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
