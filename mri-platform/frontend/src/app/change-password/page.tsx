'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

export default function ChangePasswordPage() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newPassword || !confirmPassword) {
      toast.error('Please fill in all fields');
      return;
    }

    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
        data: { first_login: false },
      });

      if (updateError) {
        toast.error(updateError.message);
        setLoading(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        toast.error('User not found');
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      toast.success('Password changed successfully!');

      // Use window.location for reliable redirect
      if (profile?.role) {
        window.location.href = `/${profile.role}/dashboard`;
      } else {
        window.location.href = '/login';
      }
    } catch (error: any) {
      console.error('Change password error:', error);
      toast.error('An error occurred');
      setLoading(false);
    }
  };

  const meetsLength = newPassword.length >= 8;
  const passwordsMatch = newPassword === confirmPassword && newPassword.length > 0;

  return (
    <div className="min-h-screen bg-[#0a0f1a] flex">
      {/* Left Panel - Form */}
      <div className="w-full lg:w-[45%] flex flex-col bg-[#0d1424]">
        {/* Logo Header */}
        <div className="p-8">
          <Link href="/landing" className="flex items-center gap-3 group">
            <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2C9.243 2 7 4.243 7 7c0 .836.194 1.625.537 2.331C5.397 10.148 4 12.233 4 14.667c0 1.545.627 2.944 1.64 3.96C4.626 19.642 4 21.026 4 22.5c0 .828.672 1.5 1.5 1.5h13c.828 0 1.5-.672 1.5-1.5 0-1.474-.627-2.858-1.64-3.873 1.013-1.016 1.64-2.415 1.64-3.96 0-2.434-1.397-4.519-3.537-5.336A4.984 4.984 0 0017 7c0-2.757-2.243-5-5-5z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="text-xl font-semibold text-white group-hover:text-cyan-400 transition-colors">NeuroXiva</span>
          </Link>
        </div>

        {/* Form Container */}
        <div className="flex-1 flex items-center justify-center px-8 lg:px-16">
          <div className="w-full max-w-md">
            {/* Header Icon */}
            <div className="mb-6">
              <div className="w-14 h-14 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>

            {/* Welcome Text */}
            <div className="mb-10">
              <h1 className="text-3xl font-bold text-white mb-3">Set new password</h1>
              <p className="text-slate-400">Create a secure password for your account. This is required for first-time login.</p>
            </div>

            {/* Form */}
            <form onSubmit={handleChangePassword} className="space-y-6">
              {/* New Password */}
              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-slate-300 mb-2">
                  New password
                </label>
                <div className="relative">
                  <input
                    id="newPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={loading}
                    required
                    minLength={8}
                    className="w-full px-4 py-3 pr-12 bg-[#1a2235] border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all disabled:opacity-50"
                    placeholder="Minimum 8 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? (
                      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" strokeLinecap="round" strokeLinejoin="round"/>
                        <line x1="1" y1="1" x2="23" y2="23" strokeLinecap="round"/>
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" strokeLinecap="round" strokeLinejoin="round"/>
                        <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-300 mb-2">
                  Confirm password
                </label>
                <input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  required
                  minLength={8}
                  className="w-full px-4 py-3 bg-[#1a2235] border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all disabled:opacity-50"
                  placeholder="Re-enter password"
                />
              </div>

              {/* Password Requirements */}
              <div className="p-4 bg-[#1a2235]/50 rounded-xl border border-slate-800">
                <p className="text-sm font-medium text-slate-300 mb-3">Password requirements</p>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-sm">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${meetsLength ? 'bg-green-500/20' : 'bg-slate-700/50'}`}>
                      <svg viewBox="0 0 20 20" className={`w-3.5 h-3.5 ${meetsLength ? 'text-green-400' : 'text-slate-500'}`} fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                      </svg>
                    </div>
                    <span className={meetsLength ? 'text-green-400' : 'text-slate-400'}>At least 8 characters</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${passwordsMatch ? 'bg-green-500/20' : 'bg-slate-700/50'}`}>
                      <svg viewBox="0 0 20 20" className={`w-3.5 h-3.5 ${passwordsMatch ? 'text-green-400' : 'text-slate-500'}`} fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                      </svg>
                    </div>
                    <span className={passwordsMatch ? 'text-green-400' : 'text-slate-400'}>Passwords match</span>
                  </li>
                </ul>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || !meetsLength || !passwordsMatch}
                className="w-full py-3.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-[#0d1424] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                    </svg>
                    <span>Updating...</span>
                  </>
                ) : (
                  <span>Set password</span>
                )}
              </button>
            </form>

            {/* Footer */}
            <div className="mt-8 text-center">
              <p className="text-xs text-slate-600">
                Your password is encrypted with 256-bit encryption
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-8 text-center">
          <p className="text-xs text-slate-600">
            &copy; 2026 NeuroXiva. HIPAA Compliant. All rights reserved.
          </p>
        </div>
      </div>

      {/* Right Panel - Visual */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden bg-gradient-to-br from-[#0a0f1a] via-[#0f172a] to-[#0a1628]">
        {/* Animated Background Grid */}
        <div className="absolute inset-0">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
                <path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(6, 182, 212, 0.07)" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        {/* Glowing Orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl"></div>

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center justify-center w-full p-16">
          {/* Shield Visualization */}
          <div className="relative mb-12">
            <svg viewBox="0 0 200 240" className="w-56 h-64">
              {/* Background Glow */}
              <defs>
                <radialGradient id="shieldGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.3"/>
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity="0"/>
                </radialGradient>
                <linearGradient id="shieldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#06b6d4"/>
                  <stop offset="100%" stopColor="#3b82f6"/>
                </linearGradient>
              </defs>

              <ellipse cx="100" cy="120" rx="90" ry="100" fill="url(#shieldGlow)"/>

              {/* Shield Shape */}
              <path
                d="M100 20 L170 50 L170 110 C170 160 140 200 100 220 C60 200 30 160 30 110 L30 50 Z"
                fill="none"
                stroke="url(#shieldGradient)"
                strokeWidth="2"
                className="animate-pulse"
              />

              {/* Inner Shield */}
              <path
                d="M100 40 L150 62 L150 105 C150 145 125 175 100 190 C75 175 50 145 50 105 L50 62 Z"
                fill="none"
                stroke="rgba(6, 182, 212, 0.3)"
                strokeWidth="1"
              />

              {/* Lock Icon */}
              <rect x="75" y="100" width="50" height="40" rx="6" fill="none" stroke="#06b6d4" strokeWidth="2"/>
              <path d="M85 100 L85 85 C85 72 92 65 100 65 C108 65 115 72 115 85 L115 100" fill="none" stroke="#06b6d4" strokeWidth="2" className="animate-pulse"/>
              <circle cx="100" cy="120" r="6" fill="#06b6d4"/>
              <line x1="100" y1="126" x2="100" y2="132" stroke="#06b6d4" strokeWidth="2"/>

              {/* Checkmark */}
              <circle cx="145" cy="55" r="15" fill="#0f172a" stroke="#22c55e" strokeWidth="2"/>
              <path d="M138 55 L143 60 L153 50" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>

            {/* Scanning Animation */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-40 h-40 border-2 border-cyan-500/20 rounded-full animate-ping"></div>
            </div>
          </div>

          {/* Text Content */}
          <div className="text-center max-w-lg">
            <h2 className="text-4xl font-bold text-white mb-4">
              Secure Your
              <span className="block bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                Account
              </span>
            </h2>
            <p className="text-slate-400 text-lg mb-8">
              Your security is our priority. Strong passwords protect patient data and maintain HIPAA compliance.
            </p>

            {/* Security Features */}
            <div className="flex justify-center gap-8">
              <div className="text-center">
                <div className="w-12 h-12 mx-auto mb-2 bg-cyan-500/10 rounded-xl flex items-center justify-center">
                  <svg viewBox="0 0 24 24" className="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div className="text-xs text-slate-500">Encrypted</div>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 mx-auto mb-2 bg-cyan-500/10 rounded-xl flex items-center justify-center">
                  <svg viewBox="0 0 24 24" className="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div className="text-xs text-slate-500">HIPAA</div>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 mx-auto mb-2 bg-cyan-500/10 rounded-xl flex items-center justify-center">
                  <svg viewBox="0 0 24 24" className="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div className="text-xs text-slate-500">Verified</div>
              </div>
            </div>
          </div>

          {/* Bottom Badge */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 rounded-full border border-slate-700">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-slate-400">256-bit Encryption</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
