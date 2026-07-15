'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/providers/AuthProvider';
import {
  Activity,
  Brain,
  Waves,
  ShieldCheck,
  ScanLine,
  Sparkles,
  ClipboardCheck,
  Stethoscope,
  Mail,
  Phone,
  MapPin,
  ArrowRight,
  Linkedin,
  Github,
} from 'lucide-react';

// ============================================================================
// NAVBAR
// ============================================================================
function PublicNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const { user, userProfile, loading } = useAuth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-white/90 backdrop-blur-lg shadow-sm' : 'bg-white/60 backdrop-blur-md'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/landing" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center">
            <Brain className="h-5 w-5 text-white" />
          </div>
          <span className="font-bold text-slate-900 text-lg">Ai4Neuro</span>
        </Link>

        <div className="hidden md:flex items-center gap-1">
          <a href="#hero" className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Home</a>
          <a href="#services" className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Services</a>
          <a href="#about" className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">About</a>
          <a href="#process" className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Process</a>
          <a href="#contact" className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Contact</a>
        </div>

        <div className="flex items-center gap-3">
          {!loading && user && userProfile ? (
            <Link
              href={`/${userProfile.role.replace(/_/g, '-')}/dashboard`}
              className="px-5 py-2 rounded-full bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="px-4 py-2 text-sm font-semibold text-slate-700 hover:text-slate-900 transition-colors">
                Login
              </Link>
              <a
                href="#contact"
                className="px-5 py-2 rounded-full bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors"
              >
                Request Demo
              </a>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

// ============================================================================
// STAT CARD
// ============================================================================
function StatBlock({ icon: Icon, value, label }: { icon: React.ElementType; value: string; label: string }) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-6 text-center shadow-sm">
      <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center mx-auto mb-3">
        <Icon className="h-5 w-5 text-emerald-600" />
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-sm text-slate-500 mt-1">{label}</p>
    </div>
  );
}

// ============================================================================
// SERVICE CARD
// ============================================================================
function ServiceCard({
  icon: Icon,
  title,
  description,
  gradient,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  gradient: string;
}) {
  return (
    <div className="group relative rounded-2xl bg-white border border-slate-200 p-7 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 overflow-hidden">
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-[0.04] transition-opacity bg-gradient-to-br ${gradient}`} />
      <div className={`relative w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-5 shadow-sm`}>
        <Icon className="h-6 w-6 text-white" />
      </div>
      <h3 className="relative text-lg font-bold text-slate-900 mb-2">{title}</h3>
      <p className="relative text-sm text-slate-500 leading-relaxed mb-4">{description}</p>
      <a href="#contact" className="relative inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 hover:text-emerald-800">
        Learn More <ArrowRight className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}

// ============================================================================
// WORKFLOW STEP
// ============================================================================
function WorkflowStep({ number, title, description, isLast }: { number: number; title: string; description: string; isLast?: boolean }) {
  return (
    <div className="relative flex gap-5">
      {!isLast && <div className="absolute left-5 top-12 w-0.5 h-[calc(100%-1rem)] bg-emerald-100" />}
      <div className="relative z-10 w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold shrink-0">
        {number}
      </div>
      <div className="pb-10">
        <h3 className="text-lg font-bold text-slate-900 mb-1">{title}</h3>
        <p className="text-sm text-slate-500 leading-relaxed max-w-xl">{description}</p>
      </div>
    </div>
  );
}

// ============================================================================
// LANDING PAGE
// ============================================================================
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#f7fafc] text-slate-900">
      <PublicNavbar />

      {/* Hero */}
      <section id="hero" className="pt-36 pb-20 px-6">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-semibold text-emerald-700 mb-6">
              <Activity className="h-3.5 w-3.5" />
              Early Alzheimer&apos;s Detection
            </span>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight">
              Early Alzheimer&apos;s Detection
            </h1>
            <p className="mt-4 text-lg font-medium text-slate-700">
              AI-powered neuro diagnostics for earlier, clearer decisions.
            </p>
            <p className="mt-4 text-slate-500 leading-relaxed max-w-xl">
              AI4Neuro unifies EEG, MRI, and PET intelligence into a seamless clinical experience,
              enabling early cognitive risk screening and generating specialist-ready reports.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#services" className="px-6 py-3 rounded-full bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 transition-colors">
                Explore Services
              </a>
              <a href="#process" className="px-6 py-3 rounded-full bg-white border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50 transition-colors">
                View Process
              </a>
            </div>
          </div>

          <div className="relative">
            <div className="rounded-3xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 p-10 flex items-center justify-center aspect-square max-w-md mx-auto">
              <Brain className="h-40 w-40 text-emerald-600/70" strokeWidth={1} />
            </div>
            <div className="absolute -bottom-4 -left-4 bg-white rounded-2xl border border-slate-200 shadow-lg px-4 py-3 flex items-center gap-2">
              <Waves className="h-4 w-4 text-blue-600" />
              <span className="text-xs font-semibold text-slate-700">EEG Signal Analysis</span>
            </div>
            <div className="absolute -top-4 -right-4 bg-white rounded-2xl border border-slate-200 shadow-lg px-4 py-3 flex items-center gap-2">
              <ScanLine className="h-4 w-4 text-violet-600" />
              <span className="text-xs font-semibold text-slate-700">MRI + PET Imaging</span>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="px-6 pb-20">
        <div className="max-w-7xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatBlock icon={Brain} value="3" label="Modalities Unified" />
          <StatBlock icon={Sparkles} value="AI" label="Decision Support" />
          <StatBlock icon={Activity} value="Early" label="Risk Indicators" />
          <StatBlock icon={ShieldCheck} value="Secure" label="Data-first Workflow" />
        </div>
      </section>

      {/* Services */}
      <section id="services" className="px-6 py-20 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Services</span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mt-2">AI4Neuro Services</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <ServiceCard
              icon={ScanLine}
              title="MRI Analysis"
              description="Structural brain scan review for volume, regional changes, and Alzheimer-linked imaging markers."
              gradient="from-teal-500 to-cyan-600"
            />
            <ServiceCard
              icon={Waves}
              title="EEG Intelligence"
              description="Signal pattern analysis for rhythm, slowing, connectivity, and cognitive decline indicators."
              gradient="from-blue-500 to-indigo-600"
            />
            <ServiceCard
              icon={Brain}
              title="PET Biomarkers"
              description="Metabolic and amyloid-sensitive PET support for earlier specialist-led interpretation."
              gradient="from-violet-500 to-purple-600"
            />
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="px-6 py-20">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900">About AI4Neuro</h2>
          <p className="mt-3 text-lg font-medium text-slate-700">Built for clinicians working against the clock.</p>
          <p className="mt-4 text-slate-500 leading-relaxed max-w-2xl mx-auto">
            Ai4Neuro supports early Alzheimer detection by combining scan findings, signal behavior,
            and biomarker views into a clean diagnostic dashboard. The experience is designed for clarity
            rather than clutter.
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-10 text-left">
            {[
              { icon: ShieldCheck, text: 'Privacy-aware patient handling' },
              { icon: ClipboardCheck, text: 'Specialist-ready visual summaries' },
              { icon: Sparkles, text: 'AI-powered clinical assistance' },
              { icon: Stethoscope, text: 'Secure cloud infrastructure' },
            ].map((item, i) => (
              <div key={i} className="rounded-2xl bg-white border border-slate-200 p-5 flex items-start gap-3">
                <item.icon className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                <span className="text-sm font-medium text-slate-700">{item.text}</span>
              </div>
            ))}
          </div>

          <a href="#contact" className="inline-block mt-10 px-6 py-3 rounded-full bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 transition-colors">
            Book Screening
          </a>
        </div>
      </section>

      {/* Workflow / Process */}
      <section id="process" className="px-6 py-20 bg-white">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Process</span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mt-2">How It Works</h2>
          </div>
          <WorkflowStep number={1} title="Scan Intake" description="MRI, EEG, and PET records are organized into a single patient view." />
          <WorkflowStep number={2} title="AI Analysis" description="Models highlight regions, rhythm shifts, and biomarker patterns linked to cognitive decline." />
          <WorkflowStep number={3} title="Clinical Review" description="Findings are transformed into concise specialist-ready reports." />
          <WorkflowStep number={4} title="Care Discussion" description="Patients and clinicians receive clear recommendations and next-step guidance." isLast />
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="px-6 py-20">
        <div className="max-w-4xl mx-auto">
          <div className="rounded-3xl bg-gradient-to-br from-emerald-600 to-teal-700 p-10 md:p-12 text-white">
            <div className="grid md:grid-cols-2 gap-10 items-center">
              <div>
                <h2 className="text-2xl md:text-3xl font-extrabold">Get in touch</h2>
                <p className="mt-3 text-emerald-50 leading-relaxed">
                  Talk to our team about bringing AI4Neuro to your hospital or clinic.
                </p>
                <a
                  href="mailto:info@praxiatech.ai"
                  className="inline-block mt-6 px-6 py-3 rounded-full bg-white text-emerald-700 font-semibold text-sm hover:bg-emerald-50 transition-colors"
                >
                  Contact Team
                </a>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                    <Mail className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <p className="text-xs text-emerald-100">Email</p>
                    <p className="text-sm font-semibold">info@praxiatech.ai</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                    <Phone className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <p className="text-xs text-emerald-100">Phone</p>
                    <p className="text-sm font-semibold">+91 94132 59268</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                    <MapPin className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <p className="text-xs text-emerald-100">Location</p>
                    <p className="text-sm font-semibold">Indore, Madhya Pradesh</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-12 border-t border-slate-200">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
                <Brain className="h-4.5 w-4.5 text-white" />
              </div>
              <span className="font-bold text-slate-900">AI4Neuro</span>
            </div>
            <p className="text-sm text-slate-500 mt-2 max-w-sm">
              Early Alzheimer Detection through MRI, EEG, and PET Intelligence.
            </p>
          </div>

          <div className="flex items-center gap-6 text-sm text-slate-500">
            <a href="#" className="hover:text-slate-800 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-slate-800 transition-colors">Terms</a>
            <a href="#contact" className="hover:text-slate-800 transition-colors">Contact</a>
          </div>

          <div className="flex items-center gap-3">
            <a href="#" aria-label="LinkedIn" className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors">
              <Linkedin className="h-4 w-4" />
            </a>
            <a href="#" aria-label="GitHub" className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors">
              <Github className="h-4 w-4" />
            </a>
          </div>
        </div>
        <p className="text-center text-xs text-slate-400 mt-8">
          &copy; {new Date().getFullYear()} AI4Neuro. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
