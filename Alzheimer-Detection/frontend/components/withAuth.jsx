import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { useAuth } from './AuthProvider';
import LoadingSpinner from './LoadingSpinner';

const withAuth = (WrappedComponent, allowedRoles = [], requireVerification = true) => {
    const Wrapper = (props) => {
        const { user, userProfile, isLoading, session } = useAuth();
        const router = useRouter();
        const componentName = WrappedComponent.displayName || WrappedComponent.name || 'Component';

        useEffect(() => {
            if (isLoading) {
                return;
            }
            
            const currentPath = router.pathname;

            // Not authenticated
            if (!user || !session) {
                const publicPaths = ['/', '/home', '/login', '/landing', '/about', '/contact'];
                if (!publicPaths.includes(currentPath)) {
                    router.replace('/');
                }
                return;
            }

            // No profile exists - needs to complete setup
            if (!userProfile || userProfile.needsSetup) {
                if (currentPath !== '/complete-profile') {
                    router.replace('/complete-profile');
                }
                return;
            }

            // Account pending verification
            if (userProfile.account_status === 'pending') {
                if (currentPath !== '/account-pending') {
                    router.replace('/account-pending');
                }
                return;
            }

            // Account suspended or inactive
            if (['suspended', 'inactive'].includes(userProfile.account_status)) {
                if (currentPath !== '/account-pending') {
                    router.replace('/account-pending');
                }
                return;
            }

            // ENTERPRISE FIX: Skip phone verification for approved users
            // Admin approval automatically sets phone_verified to true

            // Role-based access control
            if (allowedRoles.length > 0 && !allowedRoles.includes(userProfile.role)) {
                // Redirect to appropriate dashboard
                router.replace(`/${userProfile.role}/dashboard`);
                return;
            }

            // ENTERPRISE FIX: Remove doctor profile verification check
            // Admin approval sets account_status to 'active' which should be sufficient

            // ENTERPRISE FIX: Remove patient profile verification check
            // Admin approval sets account_status to 'active' which should be sufficient
            // Patient profile verification is handled by admin approval process
        }, [isLoading, user, session, userProfile, router, allowedRoles, requireVerification, componentName]);

        // Show loading spinner
        if (isLoading) {
            return (
                <div style={{ 
                    display: 'flex', 
                    justifyContent: 'center', 
                    alignItems: 'center', 
                    height: '100vh', 
                    backgroundColor: 'var(--background-start)',
                    flexDirection: 'column',
                    gap: '1rem'
                }}>
                    <LoadingSpinner /> 
                    <p style={{ color: 'var(--text-secondary)' }}>Loading User Session...</p>
                </div>
            );
        }

        // Check if user meets all requirements (removed phone verification check)
        if (user && userProfile && 
            userProfile.account_status === 'active') {
            
            // Check role permissions
            if (allowedRoles.length === 0 || allowedRoles.includes(userProfile.role)) {
                // Skip additional verification checks - account_status 'active' is sufficient
                
                return <WrappedComponent {...props} />;
            }
        }

        // Fallback loading state
        return (
            <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                height: '100vh', 
                backgroundColor: 'var(--background-start)',
                flexDirection: 'column',
                gap: '1rem'
            }}>
                <LoadingSpinner /> 
                <p style={{ color: 'var(--text-secondary)' }}>Verifying access...</p>
            </div>
        );
    };

    Wrapper.displayName = `withAuth(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;
    return Wrapper;
};

export default withAuth;