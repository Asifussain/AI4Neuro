'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
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
import { SpotlightCard } from '@/components/ui/animated';

// Dynamic imports — these use Three.js / framer-motion which need browser APIs
const PixelSnow = dynamic(
  () => import('@/components/ui/PixelSnow/PixelSnow'),
  { ssr: false }
);
const ShinyText = dynamic(
  () => import('@/components/ui/ShinyText/ShinyText'),
  { ssr: false }
);

// ============================================================================
// ROLE BADGE
// ============================================================================
const roleBadgeStyles: Record<string, string> = {
  patient: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  doctor: 'bg-green-500/15 text-green-400 border-green-500/20',
  radiologist: 'bg-teal-500/15 text-teal-400 border-teal-500/20',
  admin: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
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
      <SpotlightCard className="p-6 h-full">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
            <Icon className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">
              {title}
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {description}
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all mt-1 flex-shrink-0" />
        </div>
      </SpotlightCard>
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
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* PixelSnow Background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <PixelSnow
          color="#8b5cf6"
          flakeSize={0.01}
          minFlakeSize={1.25}
          pixelResolution={200}
          speed={0.6}
          density={0.15}
          direction={125}
          brightness={0.8}
          depthFade={8}
          farPlane={20}
          gamma={0.4545}
          variant="square"
        />
      </div>

      {/* Faint gradient orbs */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-teal-500/8 rounded-full blur-[120px]" />
      </div>

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
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-3 leading-tight">
                  {greeting},{' '}
                  <span className="bg-gradient-to-r from-purple-400 via-violet-400 to-teal-400 bg-clip-text text-transparent">
                    {firstName}
                  </span>
                </h1>

                {/* Date / Time */}
                <p className="text-sm text-muted-foreground mb-5">
                  {new Date().toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                  })}{' '}
                  <span className="mx-1.5 opacity-40">|</span> {currentTime}
                </p>

                {/* Tagline */}
                <p className="text-lg mb-8 max-w-lg mx-auto lg:mx-0">
                  <ShinyText
                    text={config.tagline}
                    speed={3}
                    color="#94a3b8"
                    shineColor="#a78bfa"
                    spread={120}
                    className="text-lg"
                  />
                </p>

                {/* CTA */}
                <Button asChild size="lg" className="shadow-lg shadow-primary/20">
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
                  <div className="absolute inset-0 rounded-full bg-gradient-to-br from-purple-500/10 to-teal-500/10 blur-3xl" />
                  <div className="absolute inset-8 rounded-full border border-purple-500/10 animate-pulse" />
                  <div className="absolute inset-16 rounded-full border border-teal-500/10 animate-pulse" style={{ animationDelay: '1s' }} />

                  {/* Brain icon */}
                  <div className="relative w-32 h-32 lg:w-40 lg:h-40 bg-gradient-to-br from-purple-500/20 via-violet-500/15 to-teal-400/20 rounded-3xl flex items-center justify-center backdrop-blur-sm border border-white/[0.06] animate-float">
                    <Brain className="w-16 h-16 lg:w-20 lg:h-20 text-purple-400/80" />
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div>
              <h2 className="text-lg font-medium text-foreground mb-4">Quick Actions</h2>
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
