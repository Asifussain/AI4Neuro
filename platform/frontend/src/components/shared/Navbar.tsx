'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/providers/AuthProvider';
import styles from './Navbar.module.css';

export const Navbar = () => {
  const { user, userProfile, signOut } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = async () => {
    await signOut();
    setDropdownOpen(false);
  };

  const toggleDropdown = () => setDropdownOpen((prev) => !prev);
  const toggleMobileMenu = () => setMobileMenuOpen((prev) => !prev);
  const closeMobileMenu = () => setMobileMenuOpen(false);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const displayName = userProfile?.full_name || user?.email || 'User';
  const initials = getInitials(displayName);

  return (
    <nav className={styles.navbar}>
      <div className={styles.navbarBrand}>
        <Link href={user && userProfile ? "/home" : "/landing"}>NeuroXiva</Link>
      </div>

      <button
        className={styles.mobileMenuToggle}
        onClick={toggleMobileMenu}
        aria-label="Toggle mobile menu"
      >
        ☰
      </button>

      <ul className={`${styles.navbarLinks} ${mobileMenuOpen ? styles.mobileOpen : ''}`}>
        {user && userProfile ? (
          <>
            <li>
              <Link href="/home" onClick={closeMobileMenu}>
                Home
              </Link>
            </li>
            {userProfile.role && userProfile.account_status === 'active' && (
              <li>
                <Link href={`/${userProfile.role}/dashboard`} onClick={closeMobileMenu}>
                  Dashboard
                </Link>
              </li>
            )}
            <li>
              <Link href="/about" onClick={closeMobileMenu}>
                About
              </Link>
            </li>
            <li>
              <Link href="/contact" onClick={closeMobileMenu}>
                Contact
              </Link>
            </li>
          </>
        ) : (
          <>
            <li>
              <Link href="/landing" onClick={closeMobileMenu}>
                Home
              </Link>
            </li>
            <li>
              <Link href="/about" onClick={closeMobileMenu}>
                About
              </Link>
            </li>
            <li>
              <Link href="/contact" onClick={closeMobileMenu}>
                Contact
              </Link>
            </li>
          </>
        )}
      </ul>

      <div className={styles.rightSection}>
        {user && userProfile ? (
          <div className={styles.profileContainer} ref={dropdownRef}>
            <div className={styles.profilePicture} onClick={toggleDropdown}>
              {initials}
            </div>
            <div className={`${styles.dropdown} ${dropdownOpen ? styles.open : ''}`}>
              <div className={styles.userInfo}>
                <span className={styles.userName}>{displayName}</span>
                <span className={styles.userRole}>{userProfile.role}</span>
              </div>
              <Link href="/profile" className={styles.dropdownLink}>
                Profile
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
          <Link href="/login" className={styles.loginBtn}>
            Login
          </Link>
        )}
      </div>
    </nav>
  );
};
