'use client';

import { Navbar } from '@/components/shared/Navbar';
import { Brain, Target, Shield, Users, Award, Zap } from 'lucide-react';

const features = [
  {
    icon: Brain,
    title: 'Advanced AI Analysis',
    description: 'State-of-the-art deep learning models trained on thousands of MRI scans for accurate diagnosis.',
  },
  {
    icon: Target,
    title: 'Early Detection',
    description: 'Identify neurodegenerative conditions in their earliest stages when intervention is most effective.',
  },
  {
    icon: Shield,
    title: 'Clinical Grade Security',
    description: 'HIPAA compliant platform with end-to-end encryption protecting all patient data.',
  },
  {
    icon: Zap,
    title: 'Rapid Results',
    description: 'Get comprehensive analysis results in minutes, not days, accelerating the diagnostic process.',
  },
];

const stats = [
  { value: '98.5%', label: 'Accuracy Rate' },
  { value: '50K+', label: 'Scans Analyzed' },
  { value: '200+', label: 'Partner Hospitals' },
  { value: '<3min', label: 'Average Analysis Time' },
];

const team = [
  {
    name: 'Dr. Sarah Chen',
    role: 'Chief Medical Officer',
    description: 'Neurologist with 20+ years of experience in neurodegenerative diseases.',
  },
  {
    name: 'Dr. Michael Roberts',
    role: 'Head of AI Research',
    description: 'Former Google Brain researcher specializing in medical imaging AI.',
  },
  {
    name: 'Dr. Emily Watson',
    role: 'Clinical Director',
    description: 'Board-certified radiologist leading our clinical validation programs.',
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <Brain className="w-4 h-4" />
            About NeuroXiva
          </div>
          <h1 className="heading-xl text-foreground mb-6">
            Pioneering the Future of
            <span className="block text-primary">Neurological Diagnostics</span>
          </h1>
          <p className="body-lg text-muted-foreground max-w-3xl mx-auto">
            NeuroXiva combines cutting-edge artificial intelligence with decades of neurological expertise
            to deliver accurate, early detection of neurodegenerative diseases through MRI brain scan analysis.
          </p>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 border-y border-border bg-muted/30">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, idx) => (
              <div key={idx} className="text-center">
                <div className="text-4xl font-bold text-primary mb-2">{stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="heading-lg text-foreground mb-6">Our Mission</h2>
              <p className="body-md text-muted-foreground mb-6">
                We believe that early detection is the key to better outcomes in neurodegenerative diseases.
                Our mission is to make advanced diagnostic capabilities accessible to healthcare providers
                worldwide, enabling earlier intervention and improved patient care.
              </p>
              <p className="body-md text-muted-foreground">
                By combining the precision of artificial intelligence with the expertise of neurological
                specialists, we're transforming how Alzheimer's Disease, Parkinson's Disease, and
                Frontotemporal Dementia are diagnosed.
              </p>
            </div>
            <div className="relative">
              <div className="aspect-square rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                <Brain className="w-32 h-32 text-primary/60" />
              </div>
              <div className="absolute -bottom-4 -right-4 w-32 h-32 rounded-xl bg-card border border-border shadow-lg flex items-center justify-center">
                <Award className="w-12 h-12 text-primary" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="heading-lg text-foreground mb-4">Why Choose NeuroXiva</h2>
            <p className="body-md text-muted-foreground max-w-2xl mx-auto">
              Our platform is designed with healthcare providers in mind, offering powerful tools
              that integrate seamlessly into clinical workflows.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {features.map((feature, idx) => (
              <div
                key={idx}
                className="p-8 rounded-xl bg-card border border-border card-hover"
              >
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="heading-lg text-foreground mb-4">Leadership Team</h2>
            <p className="body-md text-muted-foreground max-w-2xl mx-auto">
              Our team brings together world-class expertise in neurology, radiology, and artificial intelligence.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {team.map((member, idx) => (
              <div key={idx} className="text-center">
                <div className="w-24 h-24 rounded-full bg-primary/10 mx-auto mb-4 flex items-center justify-center">
                  <Users className="w-10 h-10 text-primary/60" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-1">{member.name}</h3>
                <p className="text-sm text-primary font-medium mb-2">{member.role}</p>
                <p className="text-sm text-muted-foreground">{member.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-primary/5">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="heading-md text-foreground mb-4">Ready to Get Started?</h2>
          <p className="body-md text-muted-foreground mb-8">
            Join hundreds of healthcare providers already using NeuroXiva for advanced neurological diagnostics.
          </p>
          <div className="flex justify-center gap-4">
            <a
              href="/contact"
              className="btn-primary inline-flex items-center gap-2"
            >
              Contact Sales
            </a>
            <a
              href="/login"
              className="btn-secondary inline-flex items-center gap-2"
            >
              Sign In
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-border">
        <div className="max-w-6xl mx-auto text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} NeuroXiva. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
