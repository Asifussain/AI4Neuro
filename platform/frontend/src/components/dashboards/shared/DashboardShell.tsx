'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Search,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Brain,
  Waves,
  Scan,
} from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import { cn } from '@/lib/utils';
import { BrandLogo } from '@/components/shared/BrandLogo';
import { ACCENT_STYLES, type Accent } from './primitives';
import { NotificationBell, ProfileMenu } from './TopbarWidgets';

/**
 * Matches a nav href (which may carry a query string, e.g.
 * `/super-admin/users?role=doctor`) against the active path *and* search
 * params. Several nav items can share the same base path and differ only by
 * query string (Hospital Admins/Doctors/Radiologists/Patients all route to
 * `/super-admin/users`), so matching on path alone would light up all of
 * them at once — every query param the href declares must also match the
 * current URL's search params.
 */
function isNavActive(href: string, pathname: string, search: string): boolean {
  const [base, query] = href.split('?');
  const pathMatches = base === pathname || (base !== '/' && pathname.startsWith(`${base}/`));
  if (!pathMatches) return false;
  if (!query) return true;

  const hrefParams = new URLSearchParams(query);
  const currentParams = new URLSearchParams(search);
  for (const [key, value] of hrefParams) {
    if (currentParams.get(key) !== value) return false;
  }
  return true;
}

function NavLinks({
  navItems,
  pathname,
  collapsed,
  styles,
  onNavigate,
}: {
  navItems: NavItem[];
  pathname: string;
  collapsed: boolean;
  styles: (typeof ACCENT_STYLES)[Accent];
  onNavigate: () => void;
}) {
  const search = useSearchParams().toString();
  return (
    <>
      {navItems.map((item) => {
        const active = isNavActive(item.href, pathname, search);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
              active ? cn(styles.soft, styles.text) : 'text-slate-600 hover:bg-slate-50'
            )}
            title={collapsed ? item.label : undefined}
          >
            <Icon className="h-4.5 w-4.5 shrink-0" />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </Link>
        );
      })}
    </>
  );
}

export interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

interface DashboardShellProps {
  roleLabel: string;
  accent: Accent;
  navItems: NavItem[];
  children: React.ReactNode;
}

export function DashboardShell({ roleLabel, accent, navItems, children }: DashboardShellProps) {
  const { userProfile, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const pathname = usePathname();
  const router = useRouter();
  const styles = ACCENT_STYLES[accent];

  // Patients cannot create analyses, so the modality shortcuts are read-only for them.
  const canCreate = userProfile?.role !== 'patient';
  // Super Admins operate platform-wide and never run analyses themselves — the
  // clinical modality shortcuts below are noise in their sidebar.
  const showServices = userProfile?.role !== 'super_admin';

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchTerm.trim();
    if (q) router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  const sidebarContent = (
    <>
      {/* Logo — matches the landing page navbar's logo + wordmark treatment */}
      <div className="flex items-center gap-2 px-5 py-6">
        {collapsed ? (
          // eslint-disable-next-line @next/next/no-img-element -- matches BrandLogo's own <img> usage for this asset
          <img
            src="/landing_homepage/AI4NEuroLOGO copy.png"
            alt="AI4Neuro Logo"
            className="h-8 w-auto object-contain"
          />
        ) : (
          <BrandLogo markHeight={32} textHeight={16} />
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        <Suspense fallback={null}>
          <NavLinks
            navItems={navItems}
            pathname={pathname}
            collapsed={collapsed}
            styles={styles}
            onNavigate={() => setMobileOpen(false)}
          />
        </Suspense>
      </nav>

      {/* Services block */}
      {!collapsed && showServices && (
        <div className="px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400 px-1 mb-2">
            AI4Neuro Services
          </p>
          <div className="space-y-1.5">
            {canCreate ? (
              <Link
                href="/analysis/new?modality=mri"
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                <Scan className="h-4 w-4 text-slate-500" />
                <div>
                  <p className="text-xs font-semibold text-slate-700">MRI Analysis</p>
                  <p className={cn('text-[11px] font-medium', styles.text)}>Active</p>
                </div>
              </Link>
            ) : (
              <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-slate-50">
                <Scan className="h-4 w-4 text-slate-500" />
                <div>
                  <p className="text-xs font-semibold text-slate-700">MRI Analysis</p>
                  <p className={cn('text-[11px] font-medium', styles.text)}>Active</p>
                </div>
              </div>
            )}
            {canCreate ? (
              <Link
                href="/analysis/new?modality=eeg"
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                <Waves className="h-4 w-4 text-slate-500" />
                <div>
                  <p className="text-xs font-semibold text-slate-700">EEG Analysis</p>
                  <p className={cn('text-[11px] font-medium', styles.text)}>Active</p>
                </div>
              </Link>
            ) : (
              <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-slate-50">
                <Waves className="h-4 w-4 text-slate-500" />
                <div>
                  <p className="text-xs font-semibold text-slate-700">EEG Analysis</p>
                  <p className={cn('text-[11px] font-medium', styles.text)}>Active</p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-slate-50 opacity-60">
              <Brain className="h-4 w-4 text-slate-400" />
              <div>
                <p className="text-xs font-semibold text-slate-500">PET Analysis</p>
                <p className="text-[11px] font-medium text-slate-400">Locked / Coming Soon</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Logout */}
      <div className="p-3">
        <button
          onClick={() => signOut()}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && 'Logout'}
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden md:flex flex-col border-r border-slate-200 bg-white sticky top-0 h-screen transition-all duration-200',
          collapsed ? 'w-[76px]' : 'w-64'
        )}
      >
        {sidebarContent}
        <button
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="absolute -right-3 top-8 w-6 h-6 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 shadow-sm"
        >
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 bg-white flex flex-col overflow-y-auto">
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation menu"
              className="absolute right-3 top-4 text-slate-400"
            >
              <X className="h-5 w-5" />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-30 bg-slate-50/90 backdrop-blur px-4 md:px-6 py-4 flex items-center gap-3">
          <button
            className="md:hidden text-slate-500"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <form onSubmit={submitSearch} className="relative flex-1 max-w-xl">
            <label htmlFor="dashboard-global-search" className="sr-only">
              Search analyses
            </label>
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              id="dashboard-global-search"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search analyses by session ID, modality or status"
              className="w-full pl-11 pr-4 py-2.5 rounded-full bg-white border border-slate-200 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            />
          </form>

          <div className="ml-auto flex items-center gap-3">
            <span className={cn('hidden lg:inline text-xs font-semibold px-3 py-1.5 rounded-full', styles.soft, styles.text)}>
              {roleLabel}
            </span>
            <NotificationBell accent={accent} />
            <ProfileMenu accent={accent} />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 px-4 md:px-6 pb-8 space-y-6">{children}</main>
      </div>
    </div>
  );
}
