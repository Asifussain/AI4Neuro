'use client';

import { useEffect, useState, ComponentType } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { LoadingScreen } from '@/components/ui/LoadingScreen';

type UserRole = 'patient' | 'doctor' | 'radiologist' | 'hospital_admin' | 'super_admin';

interface WithAuthOptions {
  allowedRoles?: UserRole[];
  redirectTo?: string;
}

const AUTH_TIMEOUT = 3000; // 3 seconds - faster timeout

/**
 * Higher-order component for protecting routes based on authentication and role.
 */
export function withAuth<P extends object>(
  WrappedComponent: ComponentType<P>,
  options: WithAuthOptions = {}
) {
  const { allowedRoles, redirectTo } = options;

  function AuthenticatedComponent(props: P) {
    const { user, userProfile, loading } = useAuth();
    const router = useRouter();
    const [timedOut, setTimedOut] = useState(false);

    // Add timeout for loading state - if auth takes too long, redirect to login
    useEffect(() => {
      if (loading) {
        const timeout = setTimeout(() => {
          console.log('withAuth: Auth loading timed out after 3s');
          setTimedOut(true);
        }, AUTH_TIMEOUT);
        return () => clearTimeout(timeout);
      }
    }, [loading]);

    useEffect(() => {
      // Still loading and not timed out - wait
      if (loading && !timedOut) return;

      // Timed out or no user - redirect to login
      if (timedOut || !user) {
        console.log('withAuth: No user or timed out, redirecting to login');
        router.replace(redirectTo || '/login');
        return;
      }

      // User exists but no profile
      if (!userProfile) {
        console.log('withAuth: User exists but no profile, redirecting to login');
        router.replace('/login');
        return;
      }

      // Check account status
      if (userProfile.account_status !== 'active') {
        console.log('withAuth: Account not active, redirecting to suspended');
        router.replace('/account-suspended');
        return;
      }

      // Check role if specified
      if (allowedRoles && allowedRoles.length > 0) {
        if (!allowedRoles.includes(userProfile.role)) {
          console.log('withAuth: Role not allowed, redirecting to correct dashboard');
          router.replace(`/${userProfile.role.replace(/_/g, '-')}/dashboard`);
          return;
        }
      }
    }, [router, user, userProfile, loading, timedOut]);

    // Show loading while auth is initializing
    if (loading && !timedOut) {
      return <LoadingScreen message="Authenticating" submessage="Please wait..." />;
    }

    // Show redirecting state
    if (!user || !userProfile) {
      return <LoadingScreen message="Redirecting" submessage="Taking you to the right place..." />;
    }

    // Check account status
    if (userProfile.account_status !== 'active') {
      return <LoadingScreen message="Redirecting" />;
    }

    // Check role access
    if (allowedRoles && allowedRoles.length > 0) {
      if (!allowedRoles.includes(userProfile.role)) {
        return <LoadingScreen message="Redirecting" />;
      }
    }

    // Authenticated and authorized - render component
    return <WrappedComponent {...props} />;
  }

  AuthenticatedComponent.displayName = `withAuth(${
    WrappedComponent.displayName || WrappedComponent.name || 'Component'
  })`;

  return AuthenticatedComponent;
}

export function useRequireAuth(options: WithAuthOptions = {}) {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();
  const { allowedRoles, redirectTo } = options;

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace(redirectTo || '/login');
      return;
    }

    if (allowedRoles && allowedRoles.length > 0) {
      if (!userProfile?.role || !allowedRoles.includes(userProfile.role)) {
        if (userProfile?.role) {
          router.replace(`/${userProfile.role.replace(/_/g, '-')}/dashboard`);
        } else {
          router.replace('/login');
        }
      }
    }
  }, [user, userProfile, loading, router, allowedRoles, redirectTo]);

  return {
    isAuthenticated: !!user,
    isAuthorized:
      !allowedRoles ||
      allowedRoles.length === 0 ||
      (userProfile?.role && allowedRoles.includes(userProfile.role)),
    isLoading: loading,
    user,
    userProfile,
  };
}

export default withAuth;
