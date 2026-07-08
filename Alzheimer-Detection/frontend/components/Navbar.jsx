import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from './AuthProvider';
import supabase from '../lib/supabaseClient';
import styles from '../styles/Navbar.module.css';

export default function Navbar() {
  const { user, userProfile: profile, signOut } = useAuth(); // Use AuthProvider data
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const dropdownRef = useRef(null);
  const router = useRouter();

  // Handle auth state changes for UI cleanup
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event) => {
        if (_event === 'SIGNED_OUT' || _event === 'SIGNED_IN') {
          setDropdownOpen(false);
          setMobileMenuOpen(false);
        }
      }
    );

    return () => {
      listener?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogin = () => {
    router.push('/login');
  };

  const handleLogout = async () => {
    await signOut();
    setDropdownOpen(false);
  };

  const toggleDropdown = () => setDropdownOpen((prev) => !prev);

  // --- FIX IS HERE ---
  // Restored the functions for handling the mobile menu state
  const toggleMobileMenu = () => setMobileMenuOpen((prev) => !prev);
  const closeMobileMenu = () => setMobileMenuOpen(false);
  // --------------------

  const profileImage = user?.user_metadata?.avatar_url || '/images/default-avatar.png';
  const displayName = profile?.full_name || user?.email || 'User';

  return (
    <nav className={styles.navbar}>
      <div className={styles.navbarBrand}>
        <Link href="/home">AI4NEURO</Link>
      </div>

      {/* Restored the mobile menu toggle button */}
      <button
        className={styles.mobileMenuToggle}
        onClick={toggleMobileMenu}
        aria-label="Toggle mobile menu"
      >
        ☰
      </button>

      {/* Navigation links based on user state */}
      <ul className={`${styles.navbarLinks} ${mobileMenuOpen ? styles.mobileOpen : ''}`}>
        {user ? (
          <>
            {/* Dashboard link - primary action for authenticated users */}
            {profile?.role && profile?.account_status === 'active' && (
              <li>
                <Link
                  href={`/${profile.role}/dashboard`}
                  onClick={closeMobileMenu}
                >
                  Dashboard
                </Link>
              </li>
            )}

            {/* About link */}
            <li><Link href="/about" onClick={closeMobileMenu}>About</Link></li>

            {/* Contact link */}
            <li><Link href="/contact" onClick={closeMobileMenu}>Contact</Link></li>
          </>
        ) : (
          <>
            {/* Public navigation for non-authenticated users */}
            <li><Link href="/landing" onClick={closeMobileMenu}>Home</Link></li>
            <li><Link href="/about" onClick={closeMobileMenu}>About</Link></li>
            <li><Link href="/contact" onClick={closeMobileMenu}>Contact</Link></li>
          </>
        )}
      </ul>

      <div className={styles.rightSection}>
        {user ? (
          <div className={styles.profileContainer} ref={dropdownRef}>
            <img
              src={profileImage}
              alt="Profile"
              className={styles.profilePicture}
              onClick={toggleDropdown}
            />
            <div className={`${styles.dropdown} ${dropdownOpen ? styles.open : ''}`}>
              <div className={styles.userInfo}>
                <span>{displayName}</span>
              </div>
              <Link href="/profile" className={styles.dropdownLink}>
                Profile
              </Link>
              <Link href="/appearance" className={styles.dropdownLink}>
                Appearance
              </Link>
              <Link href="/change-password" className={styles.dropdownLink}>
                Change Password
              </Link>
              <button onClick={handleLogout} className={styles.logoutBtn}>
                Logout
              </button>
            </div>
          </div>
        ) : (
          <button onClick={handleLogin} className={styles.loginBtn}>
            Login
          </button>
        )}
      </div>
    </nav>
  );
}