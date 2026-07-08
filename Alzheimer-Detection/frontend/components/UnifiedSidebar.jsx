import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import styles from '../styles/UnifiedSidebar.module.css';

// Modern Icon Components
const Icons = {
  Dashboard: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>
    </svg>
  ),
  Users: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  UserPlus: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="8.5" cy="7" r="4"/>
      <line x1="20" y1="8" x2="20" y2="14"/>
      <line x1="23" y1="11" x2="17" y2="11"/>
    </svg>
  ),
  CheckCircle: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
      <polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  ),
  Heart: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  ),
  Stethoscope: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/>
      <path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4"/>
      <circle cx="20" cy="10" r="2"/>
    </svg>
  ),
  Activity: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  ),
  FileText: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  ),
  Upload: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  ),
  BarChart: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="20" x2="12" y2="10"/>
      <line x1="18" y1="20" x2="18" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="16"/>
    </svg>
  ),
  Calendar: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  ClipboardList: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
      <path d="M9 14l2 2 4-4"/>
    </svg>
  ),
  Menu: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="12" x2="21" y2="12"/>
      <line x1="3" y1="6" x2="21" y2="6"/>
      <line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  ),
  X: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  ChevronLeft: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  ),
  Sparkles: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.545 4.635L18.18 9.18l-4.635 1.545L12 15.36l-1.545-4.635L5.82 9.18l4.635-1.545z"/>
      <path d="M12 15.36l-1.545 4.635L5.82 21.54l4.635-1.545L12 24.72l1.545-4.635L18.18 21.54l-4.635-1.545z"/>
    </svg>
  ),
};

export default function UnifiedSidebar({
  user,
  userProfile,
  hospitalData,
  activeTab,
  onTabChange,
  navigationItems = [],
  stats = {}
}) {
  const router = useRouter();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) {
        setIsMobileMenuOpen(false);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const toggleSidebar = () => {
    if (isMobile) {
      setIsMobileMenuOpen(!isMobileMenuOpen);
    } else {
      setIsCollapsed(!isCollapsed);
    }
  };

  // Update body class and CSS variable when sidebar collapses/expands
  useEffect(() => {
    const root = document.documentElement;
    if (isCollapsed) {
      root.style.setProperty('--sidebar-width', '80px');
      document.body.classList.add('sidebar-collapsed');
    } else {
      root.style.setProperty('--sidebar-width', '280px');
      document.body.classList.remove('sidebar-collapsed');
    }
  }, [isCollapsed]);

  const handleTabClick = (tabId) => {
    onTabChange(tabId);
    if (isMobile) {
      setIsMobileMenuOpen(false);
    }
  };

  const getRoleDisplayName = () => {
    const role = userProfile?.role;
    if (!role) return 'Dashboard';

    const roleNames = {
      admin: 'Admin Portal',
      doctor: 'Doctor Portal',
      radiologist: 'Radiologist Portal',
      patient: 'Patient Portal'
    };

    return roleNames[role] || 'Dashboard';
  };

  const getRoleColor = () => {
    const role = userProfile?.role;
    const colors = {
      admin: '#8b5cf6',
      doctor: '#3b82f6',
      radiologist: '#10b981',
      patient: '#f59e0b'
    };
    return colors[role] || '#6366f1';
  };

  return (
    <>
      {/* Mobile Menu Button */}
      {isMobile && (
        <button
          className={styles.mobileMenuBtn}
          onClick={toggleSidebar}
          aria-label="Toggle menu"
        >
          {isMobileMenuOpen ? <Icons.X /> : <Icons.Menu />}
        </button>
      )}

      {/* Backdrop for mobile */}
      {isMobile && isMobileMenuOpen && (
        <div
          className={styles.backdrop}
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`${styles.sidebar} ${isCollapsed ? styles.collapsed : ''} ${isMobileMenuOpen ? styles.mobileOpen : ''}`}
        style={{ '--role-color': getRoleColor() }}
      >
        {/* Sidebar Header */}
        <div className={styles.sidebarHeader}>
          <div className={styles.headerContent}>
            {!isCollapsed && (
              <div className={styles.hospitalInfo}>
                <div className={styles.logoContainer}>
                  <div className={styles.logoIcon}>
                    <Icons.Activity />
                  </div>
                  <div className={styles.logoText}>
                    <h3>{hospitalData?.name || 'Medical Center'}</h3>
                    <span className={styles.roleTag}>{getRoleDisplayName()}</span>
                  </div>
                </div>

                <div className={styles.userInfo}>
                  <div className={styles.avatar}>
                    <span>{userProfile?.full_name?.charAt(0)?.toUpperCase() || 'U'}</span>
                    <div className={styles.statusDot} />
                  </div>
                  <div className={styles.userDetails}>
                    <p className={styles.userName}>{userProfile?.full_name || 'User'}</p>
                    <p className={styles.userRole}>{userProfile?.role}</p>
                  </div>
                </div>
              </div>
            )}

            {isCollapsed && (
              <div className={styles.collapsedLogo}>
                <Icons.Activity />
              </div>
            )}
          </div>

          {/* Toggle Button - Desktop Only */}
          {!isMobile && (
            <button
              className={styles.toggleBtn}
              onClick={toggleSidebar}
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <Icons.ChevronLeft />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className={styles.navigation}>
          <div className={styles.navSection}>
            {!isCollapsed && navigationItems.length > 0 && (
              <p className={styles.navLabel}>Navigation</p>
            )}

            {navigationItems.map((item) => {
              const IconComponent = Icons[item.icon] || Icons.Dashboard;
              const isActive = activeTab === item.id;
              const badge = item.badge || stats[item.badgeKey];

              return (
                <button
                  key={item.id}
                  onClick={() => handleTabClick(item.id)}
                  className={`${styles.navItem} ${isActive ? styles.active : ''} ${item.disabled ? styles.disabled : ''}`}
                  disabled={item.disabled}
                  title={isCollapsed ? item.label : ''}
                >
                  <div className={styles.navItemIcon}>
                    <IconComponent />
                    {isActive && <div className={styles.activeIndicator} />}
                  </div>

                  {!isCollapsed && (
                    <>
                      <span className={styles.navItemLabel}>{item.label}</span>
                      {badge > 0 && (
                        <span className={styles.badge}>{badge > 99 ? '99+' : badge}</span>
                      )}
                    </>
                  )}

                  {isCollapsed && badge > 0 && (
                    <span className={styles.collapsedBadge}>{badge > 9 ? '9+' : badge}</span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Gradient Overlay */}
        <div className={styles.gradientOverlay} />
      </aside>
    </>
  );
}
