'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useAuth } from '@/components/providers/AuthProvider';

const ShinyText = dynamic(
  () => import('@/components/ui/ShinyText/ShinyText'),
  { ssr: false }
);

// Floating Pill Navbar Component
function FloatingNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const { user, userProfile, loading } = useAuth();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-500 ${scrolled ? 'top-4' : 'top-6'}`}>
      <div className={`flex items-center gap-2 px-2 py-2 rounded-full backdrop-blur-xl border transition-all duration-500 ${
        scrolled
          ? 'bg-black/60 border-white/10 shadow-2xl shadow-purple-500/10'
          : 'bg-white/[0.03] border-white/[0.08]'
      }`}>
        {/* Logo */}
        <Link href="/landing" className="flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-white/5 transition-colors">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-500 via-violet-500 to-teal-400 rounded-lg flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2C9.243 2 7 4.243 7 7c0 .836.194 1.625.537 2.331C5.397 10.148 4 12.233 4 14.667c0 1.545.627 2.944 1.64 3.96C4.626 19.642 4 21.026 4 22.5c0 .828.672 1.5 1.5 1.5h13c.828 0 1.5-.672 1.5-1.5 0-1.474-.627-2.858-1.64-3.873 1.013-1.016 1.64-2.415 1.64-3.96 0-2.434-1.397-4.519-3.537-5.336A4.984 4.984 0 0017 7c0-2.757-2.243-5-5-5z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="text-white font-semibold hidden sm:block">NeuroXiva</span>
        </Link>

        {/* Nav Links */}
        <div className="hidden md:flex items-center">
          <a href="#features" className="px-4 py-2 text-sm text-slate-300 hover:text-white transition-colors">Features</a>
          <a href="#how-it-works" className="px-4 py-2 text-sm text-slate-300 hover:text-white transition-colors">How it Works</a>
          <a href="#conditions" className="px-4 py-2 text-sm text-slate-300 hover:text-white transition-colors">Conditions</a>
        </div>

        {/* CTA Button */}
        {!loading && (
          user && userProfile ? (
            <Link
              href={`/${userProfile.role}/dashboard`}
              className="ml-2 px-5 py-2 bg-gradient-to-r from-purple-600 to-teal-500 text-white text-sm font-medium rounded-full hover:from-purple-500 hover:to-teal-400 transition-all shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40"
            >
              Dashboard
            </Link>
          ) : (
            <Link
              href="/login"
              className="ml-2 px-5 py-2 bg-gradient-to-r from-purple-600 to-teal-500 text-white text-sm font-medium rounded-full hover:from-purple-500 hover:to-teal-400 transition-all shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40"
            >
              Sign In
            </Link>
          )
        )}
      </div>
    </nav>
  );
}

// Animated Wave Background
function WaveBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let time = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const drawWave = (
      yOffset: number,
      amplitude: number,
      frequency: number,
      speed: number,
      color: string,
      opacity: number
    ) => {
      ctx.beginPath();
      ctx.moveTo(0, canvas.height);

      for (let x = 0; x <= canvas.width; x += 5) {
        const y = yOffset + Math.sin((x * frequency) + (time * speed)) * amplitude;
        ctx.lineTo(x, y);
      }

      ctx.lineTo(canvas.width, canvas.height);
      ctx.lineTo(0, canvas.height);
      ctx.closePath();

      const gradient = ctx.createLinearGradient(0, yOffset - amplitude, 0, canvas.height);
      gradient.addColorStop(0, `rgba(${color}, ${opacity})`);
      gradient.addColorStop(1, `rgba(${color}, 0)`);
      ctx.fillStyle = gradient;
      ctx.fill();
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Multiple wave layers
      drawWave(canvas.height * 0.7, 60, 0.003, 0.5, '139, 92, 246', 0.15); // Purple
      drawWave(canvas.height * 0.75, 50, 0.004, 0.7, '124, 58, 237', 0.1); // Violet
      drawWave(canvas.height * 0.8, 40, 0.005, 0.9, '20, 184, 166', 0.08); // Teal
      drawWave(canvas.height * 0.85, 30, 0.006, 1.1, '59, 130, 246', 0.05); // Blue

      time += 0.02;
      animationId = requestAnimationFrame(animate);
    };

    resize();
    animate();

    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ opacity: 0.6 }}
    />
  );
}

// Feature Card Component
function FeatureCard({ icon, title, description, gradient }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  gradient: string;
}) {
  return (
    <div className="group relative p-6 rounded-2xl backdrop-blur-xl bg-white/[0.02] border border-white/[0.08] hover:border-white/20 transition-all duration-500 hover:transform hover:-translate-y-2">
      {/* Gradient Glow on Hover */}
      <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-500`} />

      {/* Icon */}
      <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-5 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
        {icon}
      </div>

      {/* Content */}
      <h3 className="text-xl font-semibold text-white mb-3">{title}</h3>
      <p className="text-slate-400 leading-relaxed">{description}</p>
    </div>
  );
}

// Condition Card Component
function ConditionCard({ code, name, description, color }: {
  code: string;
  name: string;
  description: string;
  color: string;
}) {
  return (
    <div className="group p-6 rounded-2xl backdrop-blur-xl bg-white/[0.02] border border-white/[0.08] hover:border-white/20 transition-all duration-300">
      <div className="flex items-start gap-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold ${color}`}>
          {code}
        </div>
        <div>
          <h4 className="text-lg font-semibold text-white mb-1">{name}</h4>
          <p className="text-sm text-slate-400">{description}</p>
        </div>
      </div>
    </div>
  );
}

// Timeline Step Component
function TimelineStep({ number, title, description, isLast = false }: {
  number: number;
  title: string;
  description: string;
  isLast?: boolean;
}) {
  return (
    <div className="relative flex gap-6">
      {/* Line */}
      {!isLast && (
        <div className="absolute left-6 top-14 w-0.5 h-[calc(100%-2rem)] bg-gradient-to-b from-purple-500/50 to-transparent" />
      )}

      {/* Number Circle */}
      <div className="relative z-10 w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-teal-400 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-purple-500/30">
        {number}
      </div>

      {/* Content */}
      <div className="flex-1 pb-12">
        <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
        <p className="text-slate-400 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({ value, label, icon }: { value: string; label: string; icon: React.ReactNode }) {
  return (
    <div className="text-center p-6 rounded-2xl backdrop-blur-xl bg-white/[0.02] border border-white/[0.08]">
      <div className="flex justify-center mb-3">{icon}</div>
      <div className="text-4xl font-bold bg-gradient-to-r from-purple-400 via-violet-400 to-teal-400 bg-clip-text text-transparent mb-2">
        {value}
      </div>
      <div className="text-slate-400 text-sm">{label}</div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white overflow-x-hidden">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none">
        {/* Gradient Orbs */}
        <div className="absolute top-0 left-1/4 w-[800px] h-[800px] bg-purple-600/20 rounded-full blur-[150px]"></div>
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-teal-500/15 rounded-full blur-[120px]"></div>
        <div className="absolute top-1/2 right-0 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[100px]"></div>

        {/* Wave Animation */}
        <WaveBackground />
      </div>

      {/* Floating Navbar */}
      <FloatingNavbar />

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center px-6 pt-24">
        <div className="max-w-5xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full backdrop-blur-xl bg-white/[0.03] border border-white/[0.08] mb-8">
            <span className="w-2 h-2 bg-teal-400 rounded-full animate-pulse"></span>
            <ShinyText
              text="AI-Powered Medical Imaging Platform"
              speed={3}
              color="#cbd5e1"
              shineColor="#ffffff"
              spread={120}
              className="text-sm"
            />
          </div>

          {/* Main Heading */}
          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
            Advanced
            <span className="block bg-gradient-to-r from-purple-400 via-violet-400 to-teal-400 bg-clip-text text-transparent">
              Neuroimaging Analysis
            </span>
          </h1>

          {/* Subheading */}
          <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Leveraging deep learning to detect neurodegenerative diseases from MRI scans
            with clinical-grade accuracy. Empowering healthcare professionals with AI-assisted diagnostics.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/login"
              className="px-8 py-4 bg-gradient-to-r from-purple-600 via-violet-600 to-teal-500 text-white font-semibold rounded-xl hover:from-purple-500 hover:via-violet-500 hover:to-teal-400 transition-all duration-300 shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 hover:scale-105"
            >
              Get Started
              <svg viewBox="0 0 24 24" className="w-5 h-5 inline-block ml-2" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
            <a
              href="#features"
              className="px-8 py-4 backdrop-blur-xl bg-white/[0.03] border border-white/[0.15] text-white font-semibold rounded-xl hover:bg-white/[0.08] transition-all duration-300"
            >
              Learn More
            </a>
          </div>

          {/* Stats Row */}
          <div className="flex flex-wrap justify-center gap-8 mt-16">
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-400">94.2%</div>
              <div className="text-sm text-slate-500">Accuracy</div>
            </div>
            <div className="w-px h-12 bg-white/10 hidden sm:block"></div>
            <div className="text-center">
              <div className="text-3xl font-bold text-violet-400">&lt;2min</div>
              <div className="text-sm text-slate-500">Analysis Time</div>
            </div>
            <div className="w-px h-12 bg-white/10 hidden sm:block"></div>
            <div className="text-center">
              <div className="text-3xl font-bold text-teal-400">4</div>
              <div className="text-sm text-slate-500">Conditions Detected</div>
            </div>
            <div className="w-px h-12 bg-white/10 hidden sm:block"></div>
            <div className="text-center">
              <div className="text-3xl font-bold text-cyan-400">HIPAA</div>
              <div className="text-sm text-slate-500">Compliant</div>
            </div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <svg viewBox="0 0 24 24" className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12l7 7 7-7" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="relative py-24 px-6">
        <div className="max-w-6xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-16">
            <span className="text-sm text-purple-400 font-medium uppercase tracking-wider">Features</span>
            <h2 className="text-4xl md:text-5xl font-bold mt-4 mb-6">
              Why Choose
              <span className="bg-gradient-to-r from-purple-400 to-teal-400 bg-clip-text text-transparent"> NeuroXiva</span>
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Our platform combines cutting-edge AI with clinical expertise to deliver
              accurate, fast, and reliable neuroimaging analysis.
            </p>
          </div>

          {/* Feature Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon={<svg viewBox="0 0 24 24" className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2C9.243 2 7 4.243 7 7c0 .836.194 1.625.537 2.331C5.397 10.148 4 12.233 4 14.667c0 1.545.627 2.944 1.64 3.96C4.626 19.642 4 21.026 4 22.5c0 .828.672 1.5 1.5 1.5h13c.828 0 1.5-.672 1.5-1.5 0-1.474-.627-2.858-1.64-3.873 1.013-1.016 1.64-2.415 1.64-3.96 0-2.434-1.397-4.519-3.537-5.336A4.984 4.984 0 0017 7c0-2.757-2.243-5-5-5z" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              title="Deep Learning Analysis"
              description="State-of-the-art neural networks trained on thousands of MRI scans for accurate disease detection."
              gradient="from-purple-500 to-violet-600"
            />
            <FeatureCard
              icon={<svg viewBox="0 0 24 24" className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>}
              title="Rapid Processing"
              description="Get comprehensive analysis results in under 2 minutes, enabling faster clinical decision-making."
              gradient="from-violet-500 to-purple-600"
            />
            <FeatureCard
              icon={<svg viewBox="0 0 24 24" className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12l2 2 4-4"/><path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9c2.12 0 4.07.74 5.61 1.97"/></svg>}
              title="Clinical Accuracy"
              description="94.2% detection accuracy validated against expert neurologist diagnoses in clinical trials."
              gradient="from-teal-500 to-cyan-600"
            />
            <FeatureCard
              icon={<svg viewBox="0 0 24 24" className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>}
              title="HIPAA Compliant"
              description="Enterprise-grade security with full HIPAA compliance for patient data protection."
              gradient="from-blue-500 to-indigo-600"
            />
            <FeatureCard
              icon={<svg viewBox="0 0 24 24" className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>}
              title="Multi-Role Platform"
              description="Designed for patients, doctors, radiologists, and administrators with role-specific dashboards."
              gradient="from-pink-500 to-rose-600"
            />
            <FeatureCard
              icon={<svg viewBox="0 0 24 24" className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>}
              title="Detailed Reports"
              description="Generate comprehensive technical, clinical, and patient-friendly reports automatically."
              gradient="from-orange-500 to-amber-600"
            />
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="relative py-24 px-6">
        <div className="max-w-4xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-16">
            <span className="text-sm text-teal-400 font-medium uppercase tracking-wider">Process</span>
            <h2 className="text-4xl md:text-5xl font-bold mt-4 mb-6">
              How It
              <span className="bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent"> Works</span>
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              From MRI upload to detailed diagnosis report in just a few simple steps.
            </p>
          </div>

          {/* Timeline */}
          <div className="mt-12">
            <TimelineStep
              number={1}
              title="Upload MRI Scan"
              description="Securely upload DICOM or NIfTI format MRI scans through our encrypted platform. Our system accepts standard neuroimaging formats from any MRI scanner."
            />
            <TimelineStep
              number={2}
              title="AI Processing"
              description="Our Siddhi 4.0 deep learning model analyzes the scan, extracting over 100 biomarkers and comparing against our database of validated cases."
            />
            <TimelineStep
              number={3}
              title="Quality Assurance"
              description="Results are reviewed by our automated quality control system to ensure accuracy and flag any scans that may need manual review."
            />
            <TimelineStep
              number={4}
              title="Report Generation"
              description="Comprehensive reports are generated for technical review, clinical decision-making, and patient communication, all within minutes."
              isLast
            />
          </div>
        </div>
      </section>

      {/* Conditions Section */}
      <section id="conditions" className="relative py-24 px-6">
        <div className="max-w-6xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-16">
            <span className="text-sm text-violet-400 font-medium uppercase tracking-wider">Detection</span>
            <h2 className="text-4xl md:text-5xl font-bold mt-4 mb-6">
              Conditions We
              <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent"> Detect</span>
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Our AI model is trained to identify four major neurodegenerative conditions
              with high accuracy and confidence scoring.
            </p>
          </div>

          {/* Condition Cards Grid */}
          <div className="grid md:grid-cols-2 gap-6">
            <ConditionCard
              code="CN"
              name="Cognitively Normal"
              description="Healthy brain patterns with no signs of neurodegeneration. Provides baseline comparison data."
              color="bg-green-500/20 text-green-400"
            />
            <ConditionCard
              code="AD"
              name="Alzheimer's Disease"
              description="Detects patterns associated with Alzheimer's including hippocampal atrophy and cortical thinning."
              color="bg-red-500/20 text-red-400"
            />
            <ConditionCard
              code="PD"
              name="Parkinson's Disease"
              description="Identifies substantia nigra changes and other structural markers associated with Parkinson's."
              color="bg-orange-500/20 text-orange-400"
            />
            <ConditionCard
              code="FTD"
              name="Frontotemporal Dementia"
              description="Recognizes frontal and temporal lobe atrophy patterns characteristic of FTD variants."
              color="bg-purple-500/20 text-purple-400"
            />
          </div>

          {/* Disclaimer */}
          <div className="mt-12 p-6 rounded-2xl backdrop-blur-xl bg-amber-500/5 border border-amber-500/20">
            <div className="flex items-start gap-4">
              <svg viewBox="0 0 24 24" className="w-6 h-6 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <div>
                <h4 className="text-amber-400 font-semibold mb-1">Medical Disclaimer</h4>
                <p className="text-amber-300/70 text-sm">
                  NeuroXiva is designed to assist healthcare professionals and should not replace professional medical diagnosis.
                  All results should be reviewed by qualified medical personnel before clinical decisions are made.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="relative py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-6">
            <StatCard
              value="94.2%"
              label="Detection Accuracy"
              icon={<svg viewBox="0 0 24 24" className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22,4 12,14.01 9,11.01"/></svg>}
            />
            <StatCard
              value="<2m"
              label="Processing Time"
              icon={<svg viewBox="0 0 24 24" className="w-8 h-8 text-violet-400" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>}
            />
            <StatCard
              value="50K+"
              label="Scans Analyzed"
              icon={<svg viewBox="0 0 24 24" className="w-8 h-8 text-teal-400" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2C9.243 2 7 4.243 7 7c0 .836.194 1.625.537 2.331C5.397 10.148 4 12.233 4 14.667c0 1.545.627 2.944 1.64 3.96C4.626 19.642 4 21.026 4 22.5c0 .828.672 1.5 1.5 1.5h13c.828 0 1.5-.672 1.5-1.5 0-1.474-.627-2.858-1.64-3.873 1.013-1.016 1.64-2.415 1.64-3.96 0-2.434-1.397-4.519-3.537-5.336A4.984 4.984 0 0017 7c0-2.757-2.243-5-5-5z" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            />
            <StatCard
              value="100%"
              label="HIPAA Compliant"
              icon={<svg viewBox="0 0 24 24" className="w-8 h-8 text-cyan-400" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>}
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="relative p-12 rounded-3xl backdrop-blur-xl bg-gradient-to-br from-purple-500/10 to-teal-500/10 border border-white/10 text-center overflow-hidden">
            {/* Background Decoration */}
            <div className="absolute inset-0 opacity-30">
              <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/30 rounded-full blur-3xl"></div>
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-teal-500/30 rounded-full blur-3xl"></div>
            </div>

            <div className="relative z-10">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Ready to Transform Your
                <span className="block bg-gradient-to-r from-purple-400 to-teal-400 bg-clip-text text-transparent">
                  Diagnostic Workflow?
                </span>
              </h2>
              <p className="text-slate-400 mb-8 max-w-xl mx-auto">
                Join healthcare institutions worldwide using NeuroXiva for faster,
                more accurate neuroimaging analysis.
              </p>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-purple-600 via-violet-600 to-teal-500 text-white font-semibold rounded-xl hover:from-purple-500 hover:via-violet-500 hover:to-teal-400 transition-all duration-300 shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 hover:scale-105"
              >
                <span>Get Started Now</span>
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative py-12 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 via-violet-500 to-teal-400 rounded-xl flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2C9.243 2 7 4.243 7 7c0 .836.194 1.625.537 2.331C5.397 10.148 4 12.233 4 14.667c0 1.545.627 2.944 1.64 3.96C4.626 19.642 4 21.026 4 22.5c0 .828.672 1.5 1.5 1.5h13c.828 0 1.5-.672 1.5-1.5 0-1.474-.627-2.858-1.64-3.873 1.013-1.016 1.64-2.415 1.64-3.96 0-2.434-1.397-4.519-3.537-5.336A4.984 4.984 0 0017 7c0-2.757-2.243-5-5-5z" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <span className="text-xl font-semibold text-white">NeuroXiva</span>
            </div>

            {/* Copyright */}
            <p className="text-sm text-slate-500">
              &copy; 2026 NeuroXiva. HIPAA Compliant. All rights reserved.
            </p>

            {/* Links */}
            <div className="flex items-center gap-6">
              <a href="#" className="text-sm text-slate-400 hover:text-white transition-colors">Privacy Policy</a>
              <a href="#" className="text-sm text-slate-400 hover:text-white transition-colors">Terms of Service</a>
              <a href="#" className="text-sm text-slate-400 hover:text-white transition-colors">Contact</a>
            </div>
          </div>

          {/* Powered By */}
          <div className="mt-8 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.02] border border-white/5">
              <span className="w-2 h-2 bg-teal-400 rounded-full animate-pulse"></span>
              <ShinyText
                text="Powered by Siddhi 4.0 Deep Learning Engine"
                speed={4}
                color="#64748b"
                shineColor="#14b8a6"
                spread={120}
                className="text-sm"
              />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
