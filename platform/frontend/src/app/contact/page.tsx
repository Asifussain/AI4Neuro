'use client';

import { useState } from 'react';
import { Navbar } from '@/components/shared/Navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Mail,
  Phone,
  MapPin,
  Clock,
  Send,
  MessageSquare,
  Building,
  Globe,
} from 'lucide-react';

const contactInfo = [
  {
    icon: Mail,
    title: 'Email',
    primary: 'support@neuroxiva.com',
    secondary: 'sales@neuroxiva.com',
  },
  {
    icon: Phone,
    title: 'Phone',
    primary: '+1 (555) 123-4567',
    secondary: 'Mon-Fri, 9am-6pm EST',
  },
  {
    icon: MapPin,
    title: 'Headquarters',
    primary: '123 Medical Center Drive',
    secondary: 'New York, NY 10001',
  },
  {
    icon: Clock,
    title: 'Support Hours',
    primary: '24/7 Emergency Support',
    secondary: 'Standard: Mon-Fri 9am-6pm',
  },
];

const offices = [
  { city: 'New York', country: 'USA', type: 'Headquarters' },
  { city: 'London', country: 'UK', type: 'European Office' },
  { city: 'Singapore', country: 'Singapore', type: 'Asia-Pacific' },
];

export default function ContactPage() {
  const [formState, setFormState] = useState({
    name: '',
    email: '',
    organization: '',
    subject: '',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate form submission
    await new Promise(resolve => setTimeout(resolve, 1500));

    setIsSubmitting(false);
    setSubmitted(true);
    setFormState({ name: '', email: '', organization: '', subject: '', message: '' });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero Section */}
      <section className="pt-32 pb-16 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <MessageSquare className="w-4 h-4" />
            Get in Touch
          </div>
          <h1 className="heading-xl text-foreground mb-6">
            Contact Us
          </h1>
          <p className="body-lg text-muted-foreground max-w-2xl mx-auto">
            Have questions about NeuroXiva? Our team is here to help. Reach out to us
            and we'll respond as soon as possible.
          </p>
        </div>
      </section>

      {/* Contact Info Cards */}
      <section className="py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {contactInfo.map((info, idx) => (
              <div
                key={idx}
                className="p-6 rounded-xl bg-card border border-border card-hover"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <info.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-1">{info.title}</h3>
                <p className="text-foreground">{info.primary}</p>
                <p className="text-sm text-muted-foreground">{info.secondary}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-5 gap-12">
            {/* Contact Form */}
            <div className="lg:col-span-3">
              <div className="bg-card border border-border rounded-2xl p-8">
                <h2 className="text-2xl font-semibold text-foreground mb-2">Send us a message</h2>
                <p className="text-muted-foreground mb-8">
                  Fill out the form below and we'll get back to you within 24 hours.
                </p>

                {submitted ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 rounded-full bg-green-500/10 mx-auto mb-4 flex items-center justify-center">
                      <Send className="w-8 h-8 text-green-500" />
                    </div>
                    <h3 className="text-xl font-semibold text-foreground mb-2">Message Sent!</h3>
                    <p className="text-muted-foreground mb-6">
                      Thank you for reaching out. We'll get back to you shortly.
                    </p>
                    <Button onClick={() => setSubmitted(false)} variant="outline">
                      Send Another Message
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid sm:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="name">Full Name</Label>
                        <Input
                          id="name"
                          placeholder="John Doe"
                          value={formState.name}
                          onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email Address</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="john@example.com"
                          value={formState.email}
                          onChange={(e) => setFormState({ ...formState, email: e.target.value })}
                          required
                        />
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="organization">Organization</Label>
                        <Input
                          id="organization"
                          placeholder="Hospital or Clinic Name"
                          value={formState.organization}
                          onChange={(e) => setFormState({ ...formState, organization: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="subject">Subject</Label>
                        <Input
                          id="subject"
                          placeholder="How can we help?"
                          value={formState.subject}
                          onChange={(e) => setFormState({ ...formState, subject: e.target.value })}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="message">Message</Label>
                      <textarea
                        id="message"
                        rows={5}
                        placeholder="Tell us more about your inquiry..."
                        value={formState.message}
                        onChange={(e) => setFormState({ ...formState, message: e.target.value })}
                        required
                        className="flex w-full rounded-lg border border-input bg-background px-4 py-3 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                      />
                    </div>

                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                      {isSubmitting ? (
                        <span className="flex items-center gap-2">
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Sending...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <Send className="w-4 h-4" />
                          Send Message
                        </span>
                      )}
                    </Button>
                  </form>
                )}
              </div>
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-2 space-y-8">
              {/* Quick Contact */}
              <div className="bg-card border border-border rounded-2xl p-8">
                <h3 className="text-lg font-semibold text-foreground mb-4">Quick Contact</h3>
                <div className="space-y-4">
                  <a
                    href="mailto:support@neuroxiva.com"
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <Mail className="w-5 h-5 text-primary" />
                    <span className="text-foreground">support@neuroxiva.com</span>
                  </a>
                  <a
                    href="tel:+15551234567"
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <Phone className="w-5 h-5 text-primary" />
                    <span className="text-foreground">+1 (555) 123-4567</span>
                  </a>
                </div>
              </div>

              {/* Global Offices */}
              <div className="bg-card border border-border rounded-2xl p-8">
                <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Globe className="w-5 h-5 text-primary" />
                  Global Offices
                </h3>
                <div className="space-y-4">
                  {offices.map((office, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <Building className="w-5 h-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="font-medium text-foreground">{office.city}, {office.country}</p>
                        <p className="text-sm text-muted-foreground">{office.type}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* FAQ Link */}
              <div className="bg-primary/5 border border-primary/20 rounded-2xl p-8 text-center">
                <h3 className="text-lg font-semibold text-foreground mb-2">Need Quick Answers?</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Check our frequently asked questions for immediate help.
                </p>
                <Button variant="outline" className="w-full">
                  View FAQ
                </Button>
              </div>
            </div>
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
