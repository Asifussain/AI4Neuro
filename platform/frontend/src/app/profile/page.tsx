'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/providers/AuthProvider';
import { withAuth } from '@/lib/withAuth';
import { Navbar } from '@/components/shared/Navbar';
import { toast } from 'sonner';

// Info card component
function InfoCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-white/10 transition-colors">
      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500/20 to-teal-500/20 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-500 mb-0.5">{label}</p>
        <p className="text-sm text-white truncate">{value || 'Not provided'}</p>
      </div>
    </div>
  );
}

// Settings link component
function SettingsLink({ icon, title, description, href, badge }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-purple-500/30 hover:bg-white/[0.04] transition-all"
    >
      <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white group-hover:text-purple-300 transition-colors">{title}</p>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
      {badge && (
        <span className="px-2 py-1 text-xs bg-purple-500/20 text-purple-300 rounded-full">{badge}</span>
      )}
      <svg viewBox="0 0 24 24" className="w-5 h-5 text-slate-600 group-hover:text-purple-400 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </Link>
  );
}

// Activity badge component
function ActivityBadge({ count, label, color }: { count: number; label: string; color: string }) {
  return (
    <div className="text-center p-4">
      <div className={`text-2xl font-bold ${color}`}>{count}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}

function ProfilePage() {
  const { user, userProfile, signOut } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
    } catch (error) {
      toast.error('Failed to log out');
      setIsLoggingOut(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const displayName = userProfile?.full_name || 'User';
  const initials = getInitials(displayName);
  const role = userProfile?.role || 'user';
  const email = userProfile?.email || user?.email || '';
  const phone = userProfile?.phone || '';
  const accountStatus = userProfile?.account_status || 'active';
  const joinDate = user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) : 'Unknown';

  // Role-specific info
  const getRoleSpecificInfo = () => {
    const roleProfile = userProfile?.roleProfile;
    if (!roleProfile) return [];

    switch (role) {
      case 'patient':
        return [
          { label: 'Date of Birth', value: roleProfile.date_of_birth ? new Date(roleProfile.date_of_birth).toLocaleDateString() : '', icon: <svg viewBox="0 0 24 24" className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg> },
          { label: 'Blood Group', value: roleProfile.blood_groups?.blood_group || '', icon: <svg viewBox="0 0 24 24" className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"/></svg> },
          { label: 'Emergency Contact', value: roleProfile.emergency_contact || '', icon: <svg viewBox="0 0 24 24" className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg> },
        ];
      case 'doctor':
      case 'radiologist':
        return [
          { label: 'License Number', value: roleProfile.license_number || '', icon: <svg viewBox="0 0 24 24" className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/></svg> },
          { label: 'Specialization', value: roleProfile.specialization || '', icon: <svg viewBox="0 0 24 24" className="w-5 h-5 text-teal-400" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"/></svg> },
          { label: 'Hospital', value: roleProfile.hospitals?.name || '', icon: <svg viewBox="0 0 24 24" className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg> },
          { label: 'Experience', value: roleProfile.years_of_experience ? `${roleProfile.years_of_experience} years` : '', icon: <svg viewBox="0 0 24 24" className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> },
        ];
      case 'admin':
        return [
          { label: 'Admin Level', value: roleProfile.admin_level || 'Standard', icon: <svg viewBox="0 0 24 24" className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg> },
          { label: 'Hospital', value: roleProfile.hospitals?.name || '', icon: <svg viewBox="0 0 24 24" className="w-5 h-5 text-teal-400" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg> },
        ];
      default:
        return [];
    }
  };

  const roleSpecificInfo = getRoleSpecificInfo();

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-[#0a0a0f] pt-24 pb-12 px-4 sm:px-6 lg:px-8">
        {/* Background Effects */}
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-0 right-1/4 w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[120px]"></div>
          <div className="absolute bottom-1/4 left-1/4 w-[500px] h-[500px] bg-teal-500/10 rounded-full blur-[100px]"></div>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto">
          {/* Profile Header */}
          <div className="relative mb-8">
            {/* Cover Background */}
            <div className="h-32 sm:h-40 rounded-t-3xl bg-gradient-to-r from-purple-600/20 via-violet-600/20 to-teal-500/20 border border-white/[0.05] border-b-0 overflow-hidden">
              <div className="absolute inset-0">
                <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <pattern id="profileGrid" width="30" height="30" patternUnits="userSpaceOnUse">
                      <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(139, 92, 246, 0.1)" strokeWidth="1"/>
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#profileGrid)" />
                </svg>
              </div>
            </div>

            {/* Profile Card */}
            <div className="relative -mt-16 mx-4 sm:mx-8 p-6 rounded-2xl backdrop-blur-xl bg-[#0f0f15]/80 border border-white/[0.08]">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                {/* Avatar */}
                <div className="relative">
                  <div className="w-28 h-28 rounded-2xl bg-gradient-to-br from-purple-500 via-violet-500 to-teal-400 flex items-center justify-center text-3xl font-bold text-white shadow-xl shadow-purple-500/30">
                    {initials}
                  </div>
                  {/* Status indicator */}
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-[#0f0f15] rounded-lg flex items-center justify-center">
                    <div className={`w-3 h-3 rounded-full ${accountStatus === 'active' ? 'bg-teal-400' : 'bg-red-400'} animate-pulse`}></div>
                  </div>
                </div>

                {/* User Info */}
                <div className="flex-1 text-center sm:text-left">
                  <h1 className="text-2xl font-bold text-white mb-1">{displayName}</h1>
                  <p className="text-slate-400 mb-3">{email}</p>
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      <span className="w-1.5 h-1.5 bg-purple-400 rounded-full"></span>
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </span>
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                      accountStatus === 'active'
                        ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                        : 'bg-red-500/20 text-red-300 border border-red-500/30'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${accountStatus === 'active' ? 'bg-teal-400' : 'bg-red-400'}`}></span>
                      {accountStatus.charAt(0).toUpperCase() + accountStatus.slice(1)}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <Link
                    href="/change-password"
                    className="px-4 py-2 rounded-xl text-sm font-medium text-slate-300 bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.08] hover:border-white/20 transition-all"
                  >
                    Edit Profile
                  </Link>
                </div>
              </div>

              {/* Activity Stats */}
              <div className="mt-6 pt-6 border-t border-white/[0.05] grid grid-cols-3 divide-x divide-white/[0.05]">
                <ActivityBadge count={12} label="Total Scans" color="text-purple-400" />
                <ActivityBadge count={8} label="Reports" color="text-teal-400" />
                <ActivityBadge count={30} label="Days Active" color="text-blue-400" />
              </div>
            </div>
          </div>

          {/* Content Grid */}
          <div className="grid md:grid-cols-2 gap-6 mx-4 sm:mx-0">
            {/* Contact Information */}
            <div className="rounded-2xl backdrop-blur-xl bg-white/[0.02] border border-white/[0.08] p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <svg viewBox="0 0 24 24" className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                </svg>
                Contact Information
              </h2>
              <div className="space-y-3">
                <InfoCard
                  label="Email Address"
                  value={email}
                  icon={<svg viewBox="0 0 24 24" className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>}
                />
                <InfoCard
                  label="Phone Number"
                  value={phone}
                  icon={<svg viewBox="0 0 24 24" className="w-5 h-5 text-teal-400" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>}
                />
                <InfoCard
                  label="Member Since"
                  value={joinDate}
                  icon={<svg viewBox="0 0 24 24" className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>}
                />
              </div>
            </div>

            {/* Role Specific Information */}
            <div className="rounded-2xl backdrop-blur-xl bg-white/[0.02] border border-white/[0.08] p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <svg viewBox="0 0 24 24" className="w-5 h-5 text-teal-400" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/>
                </svg>
                {role.charAt(0).toUpperCase() + role.slice(1)} Details
              </h2>
              <div className="space-y-3">
                {roleSpecificInfo.length > 0 ? (
                  roleSpecificInfo.map((info, index) => (
                    <InfoCard key={index} {...info} />
                  ))
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <p>No additional details available</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Settings Section */}
          <div className="mt-6 mx-4 sm:mx-0 rounded-2xl backdrop-blur-xl bg-white/[0.02] border border-white/[0.08] p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              Account Settings
            </h2>
            <div className="space-y-3">
              <SettingsLink
                href="/change-password"
                icon={<svg viewBox="0 0 24 24" className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>}
                title="Change Password"
                description="Update your account password"
              />
              <SettingsLink
                href={`/${role}/dashboard`}
                icon={<svg viewBox="0 0 24 24" className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>}
                title="Go to Dashboard"
                description="Access your role-specific dashboard"
              />
              <SettingsLink
                href="/home"
                icon={<svg viewBox="0 0 24 24" className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"/></svg>}
                title="Home Overview"
                description="Quick access to all features"
              />
            </div>
          </div>

          {/* Logout Section */}
          <div className="mt-6 mx-4 sm:mx-0">
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="w-full p-4 rounded-2xl flex items-center justify-center gap-3 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 hover:border-red-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoggingOut ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  <span>Logging out...</span>
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
                  </svg>
                  <span className="font-medium">Sign Out</span>
                </>
              )}
            </button>
          </div>

          {/* Footer Note */}
          <div className="mt-8 text-center">
            <p className="text-xs text-slate-600">
              Your data is protected with end-to-end encryption and is HIPAA compliant.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

export default withAuth(ProfilePage);
