'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/providers/AuthProvider';
import { withAuth } from '@/lib/withAuth';
import { Navbar } from '@/components/shared/Navbar';
import { Button } from '@/components/ui/button';
import {
  Brain,
  FileText,
  Calendar,
  Users,
  Upload,
  Eye,
  BarChart3,
  Settings,
  ClipboardList,
  ChevronRight,
} from 'lucide-react';

// ============================================================================
// ROLE BADGE
// ============================================================================
const roleBadgeStyles: Record<string, string> = {
  patient: 'bg-blue-50 text-blue-700 border-blue-200',
  doctor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  radiologist: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  admin: 'bg-teal-50 text-teal-700 border-teal-200',
};

// ============================================================================
// ACTION CARD
// ============================================================================
function ActionCard({
  icon: Icon,
  title,
  description,
  href,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link href={href} className="block group">
      <div className="p-6 h-full rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-emerald-50 group-hover:bg-emerald-100 transition-colors">
            <Icon className="w-6 h-6 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-900 mb-1 group-hover:text-emerald-700 transition-colors">
              {title}
            </h3>
            <p className="text-sm text-slate-500 leading-relaxed">
              {description}
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all mt-1 flex-shrink-0" />
        </div>
      </div>
    </Link>
  );
}

// ============================================================================
// ROLE CONFIGS
// ============================================================================
const roleConfigs = {
  patient: {
    tagline: 'Track your brain health journey with AI-powered insights.',
    actions: [
      {
        icon: FileText,
        title: 'My Scan Results',
        description: 'View your MRI analysis history and reports',
        href: '/patient/dashboard',
      },
      {
        icon: Calendar,
        title: 'Appointments',
        description: 'Schedule and manage your scan appointments',
        href: '/patient/dashboard',
      },
      {
        icon: Users,
        title: 'Care Team',
        description: 'Connect with your assigned doctors',
        href: '/patient/dashboard',
      },
    ],
  },
  doctor: {
    tagline: 'AI-assisted diagnostics for your patients, at your fingertips.',
    actions: [
      {
        icon: Users,
        title: 'Patient List',
        description: 'Manage and review your assigned patients',
        href: '/doctor/dashboard',
      },
      {
        icon: ClipboardList,
        title: 'Pending Reviews',
        description: 'MRI results awaiting your assessment',
        href: '/doctor/dashboard',
      },
      {
        icon: BarChart3,
        title: 'Analytics',
        description: 'View patient outcomes and trends',
        href: '/doctor/dashboard',
      },
    ],
  },
  radiologist: {
    tagline: 'Upload, analyze, and review MRI scans with precision AI.',
    actions: [
      {
        icon: Upload,
        title: 'Upload New Scan',
        description: 'Submit MRI scans for AI analysis',
        href: '/radiologist/upload',
      },
      {
        icon: Eye,
        title: 'View Analyses',
        description: 'Review completed scans and predictions',
        href: '/radiologist/dashboard',
      },
      {
        icon: FileText,
        title: 'Reports Queue',
        description: 'Pending reports requiring review',
        href: '/radiologist/dashboard',
      },
    ],
  },
  admin: {
    tagline: 'Oversee the platform, manage users, and monitor system health.',
    actions: [
      {
        icon: Users,
        title: 'User Management',
        description: 'Manage doctors, radiologists, and patients',
        href: '/admin/dashboard',
      },
      {
        icon: Settings,
        title: 'System Settings',
        description: 'Configure platform and access controls',
        href: '/admin/dashboard',
      },
      {
        icon: BarChart3,
        title: 'System Analytics',
        description: 'Platform metrics and usage reports',
        href: '/admin/dashboard',
      },
    ],
  },
};

// ============================================================================
// MAIN HOME PAGE
// ============================================================================
function HomePage() {
  const { userProfile } = useAuth();
  const [greeting, setGreeting] = useState('');
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hour = now.getHours();

      if (hour < 12) setGreeting('Good morning');
      else if (hour < 17) setGreeting('Good afternoon');
      else setGreeting('Good evening');

      setCurrentTime(
        now.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        })
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  const firstName = userProfile?.full_name?.split(' ')[0] || 'User';
  const role = (userProfile?.role || 'patient') as keyof typeof roleConfigs;
  const config = roleConfigs[role] || roleConfigs.patient;
  const badgeStyle = roleBadgeStyles[role] || roleBadgeStyles.patient;

  return (
    <div className="min-h-screen bg-[#f7fafc] relative overflow-hidden">
      {/* Content */}
      <div className="relative z-10">
        <Navbar />

        <main className="pt-24 pb-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            {/* Hero Section */}
            <div className="flex flex-col-reverse lg:flex-row items-center gap-8 lg:gap-16 mb-16">
              {/* Left — Text */}
              <div className="flex-1 text-center lg:text-left">
                {/* Role Badge */}
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider border mb-4 ${badgeStyle}`}
                >
                  {role}
                </span>

                {/* Greeting */}
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 mb-3 leading-tight">
                  {greeting},{' '}
                  <span className="text-emerald-600">
                    {firstName}
                  </span>
                </h1>

                {/* Date / Time */}
                <p className="text-sm text-slate-500 mb-5">
                  {new Date().toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                  })}{' '}
                  <span className="mx-1.5 opacity-40">|</span> {currentTime}
                </p>

                {/* Tagline */}
                <p className="text-lg text-slate-600 mb-8 max-w-lg mx-auto lg:mx-0">
                  {config.tagline}
                </p>

                {/* CTA */}
                <Button asChild size="lg" className="bg-emerald-600 hover:bg-emerald-700">
                  <Link href={`/${role}/dashboard`}>
                    Open Dashboard
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
              </div>

              {/* Right — Brain Visual */}
              <div className="flex-shrink-0 w-full max-w-xs lg:max-w-sm">
                <div className="relative aspect-square flex items-center justify-center">
                  {/* Glow rings */}
                  <div className="absolute inset-0 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 blur-3xl" />
                  <div className="absolute inset-8 rounded-full border border-emerald-200 animate-pulse" />
                  <div className="absolute inset-16 rounded-full border border-teal-200 animate-pulse" style={{ animationDelay: '1s' }} />

                  {/* Brain icon */}
                  <div className="relative w-32 h-32 lg:w-40 lg:h-40 bg-white rounded-3xl flex items-center justify-center shadow-lg border border-emerald-100 animate-float">
                    <Brain className="w-16 h-16 lg:w-20 lg:h-20 text-emerald-600/80" />
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div>
              <h2 className="text-lg font-medium text-slate-900 mb-4">Quick Actions</h2>
              <div className="grid md:grid-cols-3 gap-4">
                {config.actions.map((action) => (
                  <ActionCard
                    key={action.title}
                    icon={action.icon}
                    title={action.title}
                    description={action.description}
                    href={action.href}
                  />
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default withAuth(HomePage);
