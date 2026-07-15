'use client';

import React, { useState, useEffect, useRef, useMemo, forwardRef } from 'react';
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
  ArrowUpRight,
  Radio,
  Linkedin,
  Github,
  BrainCircuit,
  LogIn,
  Menu,
  MoveUpRight,
  X,
  DatabaseZap,
  Clock3,
  ScanSearch,
  RadioTower,
  ShieldPlus,
  ScanHeart,
  FileSearch,
  MessageSquareText,
} from 'lucide-react';
import './landing.css';

// ============================================================================
// ANIMATION HELPERS
// ============================================================================

function useAnimationFrame(callback: () => void) {
  useEffect(() => {
    let frameId: number;
    const loop = () => {
      callback();
      frameId = requestAnimationFrame(loop);
    };
    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [callback]);
}

function useMousePositionRef(containerRef: React.RefObject<HTMLElement | null>) {
  const positionRef = useRef({ x: -9999, y: -9999 });

  useEffect(() => {
    const updatePosition = (x: number, y: number) => {
      if (!containerRef?.current) {
        positionRef.current = { x, y };
        return;
      }
      const rect = containerRef.current.getBoundingClientRect();
      positionRef.current = { x: x - rect.left, y: y - rect.top };
    };

    const handleMouseMove = (event: MouseEvent) => updatePosition(event.clientX, event.clientY);
    const handleTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (touch) updatePosition(touch.clientX, touch.clientY);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchmove', handleTouchMove, { passive: true });

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
    };
  }, [containerRef]);

  return positionRef;
}

interface VariableProximityProps extends React.HTMLAttributes<HTMLSpanElement> {
  label: string;
  fromFontVariationSettings: string;
  toFontVariationSettings: string;
  containerRef: React.RefObject<HTMLElement | null>;
  radius?: number;
  falloff?: 'linear' | 'exponential' | 'gaussian';
}

const VariableProximity = forwardRef<HTMLSpanElement, VariableProximityProps>(
  (
    {
      label,
      fromFontVariationSettings,
      toFontVariationSettings,
      containerRef,
      radius = 80,
      falloff = 'linear',
      className = '',
      style,
      ...restProps
    },
    ref
  ) => {
    const letterRefs = useRef<(HTMLSpanElement | null)[]>([]);
    const mousePositionRef = useMousePositionRef(containerRef);
    const lastPositionRef = useRef({ x: null as number | null, y: null as number | null });

    const parsedSettings = useMemo(() => {
      const parseSettings = (settingsString: string) =>
        new Map(
          settingsString
            .split(',')
            .map((setting) => setting.trim())
            .map((setting) => {
              const [name, value] = setting.split(' ');
              return [name.replace(/['"]/g, ''), Number.parseFloat(value)] as [string, number];
            })
        );

      const fromSettings = parseSettings(fromFontVariationSettings);
      const toSettings = parseSettings(toFontVariationSettings);

      return Array.from(fromSettings.entries()).map(([axis, fromValue]) => ({
        axis,
        fromValue,
        toValue: toSettings.get(axis) ?? fromValue,
      }));
    }, [fromFontVariationSettings, toFontVariationSettings]);

    useAnimationFrame(() => {
      if (!containerRef?.current) return;

      const { x, y } = mousePositionRef.current;
      if (lastPositionRef.current.x === x && lastPositionRef.current.y === y) return;
      lastPositionRef.current = { x, y };

      const containerRect = containerRef.current.getBoundingClientRect();

      letterRefs.current.forEach((letterRef) => {
        if (!letterRef) return;

        const rect = letterRef.getBoundingClientRect();
        const letterCenterX = rect.left + rect.width / 2 - containerRect.left;
        const letterCenterY = rect.top + rect.height / 2 - containerRect.top;
        const distance = Math.hypot(x - letterCenterX, y - letterCenterY);

        if (distance >= radius) {
          letterRef.style.fontVariationSettings = fromFontVariationSettings;
          return;
        }

        const normalizedDistance = Math.min(Math.max(1 - distance / radius, 0), 1);
        const falloffValue =
          falloff === 'exponential'
            ? normalizedDistance ** 2
            : falloff === 'gaussian'
              ? Math.exp(-((distance / (radius / 2)) ** 2) / 2)
              : normalizedDistance;

        letterRef.style.fontVariationSettings = parsedSettings
          .map(({ axis, fromValue, toValue }) => {
            const value = fromValue + (toValue - fromValue) * falloffValue;
            return `'${axis}' ${value}`;
          })
          .join(', ');
      });
    });

    let letterIndex = 0;
    const words = label.split(' ');

    return (
      <span
        ref={ref}
        aria-label={label}
        className={`${className} variable-proximity`}
        style={{ display: 'inline', ...style }}
        {...restProps}
      >
        {words.map((word, wordIndex) => (
          <span className="variable-word" key={`${word}-${wordIndex}`}>
            {word.split('').map((letter) => {
              const currentLetterIndex = letterIndex;
              letterIndex += 1;

              return (
                <span
                  aria-hidden="true"
                  className="variable-letter"
                  key={`${letter}-${currentLetterIndex}`}
                  ref={(element) => {
                    letterRefs.current[currentLetterIndex] = element;
                  }}
                  style={{ fontVariationSettings: fromFontVariationSettings }}
                >
                  {letter}
                </span>
              );
            })}
            {wordIndex < words.length - 1 && <span className="variable-space">&nbsp;</span>}
          </span>
        ))}
      </span>
    );
  }
);

VariableProximity.displayName = 'VariableProximity';

interface GradientTextProps {
  children: React.ReactNode;
  className?: string;
  colors?: string[];
  animationSpeed?: number;
  showBorder?: boolean;
  direction?: 'horizontal' | 'vertical' | 'diagonal';
  pauseOnHover?: boolean;
  yoyo?: boolean;
}

function GradientText({
  children,
  className = '',
  colors = ['#064f8f', '#0f8ea7', '#64f579'],
  animationSpeed = 8,
  showBorder = false,
  direction = 'horizontal',
  pauseOnHover = false,
  yoyo = true,
}: GradientTextProps) {
  const gradientAngle =
    direction === 'horizontal' ? 'to right' : direction === 'vertical' ? 'to bottom' : 'to bottom right';
  const gradientColors = [...colors, colors[0]].join(', ');

  const style = {
    '--gradient-text-colors': `linear-gradient(${gradientAngle}, ${gradientColors})`,
    '--gradient-text-speed': `${animationSpeed}s`,
    '--gradient-text-direction': yoyo ? 'alternate' : 'normal',
  } as React.CSSProperties;

  return (
    <span
      className={`animated-gradient-text ${showBorder ? 'with-border' : ''} ${pauseOnHover ? 'pause-on-hover' : ''} ${className}`}
      style={style}
    >
      {showBorder && <span className="gradient-overlay" aria-hidden="true" />}
      <span className="text-content">{children}</span>
    </span>
  );
}

interface RotatingTextProps {
  texts: string[];
  rotationInterval?: number;
  staggerDuration?: number;
  staggerFrom?: 'first' | 'last' | 'center';
  loop?: boolean;
  auto?: boolean;
  splitBy?: 'characters' | 'words' | 'lines';
  mainClassName?: string;
  splitLevelClassName?: string;
  elementLevelClassName?: string;
  onNext?: (index: number) => void;
}

const RotatingText = forwardRef<any, RotatingTextProps>(
  (
    {
      texts,
      rotationInterval = 2000,
      staggerDuration = 0.025,
      staggerFrom = 'first',
      loop = true,
      auto = true,
      splitBy = 'characters',
      mainClassName,
      splitLevelClassName,
      elementLevelClassName,
      onNext,
      ...rest
    },
    ref
  ) => {
    const [currentTextIndex, setCurrentTextIndex] = useState(0);
    const currentText = texts[currentTextIndex] || '';

    const parts = useMemo(() => {
      if (splitBy === 'words') return currentText.split(' ');
      if (splitBy === 'lines') return currentText.split('\n');
      return Array.from(currentText);
    }, [currentText, splitBy]);

    const next = () => {
      setCurrentTextIndex((currentIndex) => {
        const nextIndex = currentIndex === texts.length - 1 ? (loop ? 0 : currentIndex) : currentIndex + 1;
        if (nextIndex !== currentIndex && onNext) onNext(nextIndex);
        return nextIndex;
      });
    };

    const previous = () => {
      setCurrentTextIndex((currentIndex) => {
        const previousIndex = currentIndex === 0 ? (loop ? texts.length - 1 : currentIndex) : currentIndex - 1;
        if (previousIndex !== currentIndex && onNext) onNext(previousIndex);
        return previousIndex;
      });
    };

    const jumpTo = (index: number) => {
      const validIndex = Math.max(0, Math.min(index, texts.length - 1));
      setCurrentTextIndex(validIndex);
      if (onNext) onNext(validIndex);
    };

    const reset = () => jumpTo(0);

    React.useImperativeHandle(ref, () => ({ next, previous, jumpTo, reset }));

    useEffect(() => {
      if (!auto) return undefined;
      const intervalId = window.setInterval(next, rotationInterval);
      return () => window.clearInterval(intervalId);
    });

    const getDelay = (index: number) => {
      if (staggerFrom === 'last') return (parts.length - 1 - index) * staggerDuration;
      if (staggerFrom === 'center') return Math.abs(Math.floor(parts.length / 2) - index) * staggerDuration;
      return index * staggerDuration;
    };

    return (
      <span className={`text-rotate ${mainClassName || ''}`} {...rest}>
        <span className="text-rotate-sr-only">{currentText}</span>
        <span className={`${splitBy === 'lines' ? 'text-rotate-lines' : 'text-rotate-word'} ${splitLevelClassName || ''}`} aria-hidden="true">
          {parts.map((part, index) => (
            <span
              className={`text-rotate-element ${elementLevelClassName || ''}`}
              key={`${currentTextIndex}-${part}-${index}`}
              style={{ animationDelay: `${getDelay(index)}s` }}
            >
              {part === ' ' ? <span className="text-rotate-space"> </span> : part}
            </span>
          ))}
        </span>
      </span>
    );
  }
);

RotatingText.displayName = 'RotatingText';

// ============================================================================
// NAVBAR (INTEGRATED WITH AUTH)
// ============================================================================
function PublicNavbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, userProfile, loading } = useAuth();

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, []);

  const closeMenu = () => setIsMenuOpen(false);

  return (
    <header className="navbar-wrap section-shell">
      <nav className="navbar" aria-label="Main navigation">
        <Link className="brand" href="/landing">
          <img
            src="/landing_homepage/AI4NEuroLOGO copy.png"
            alt="AI4Neuro Logo"
            className="h-10 w-auto object-contain"
            style={{ height: '40px' }}
          />
          <img
            src="/landing_homepage/AI4NeuroText.png"
            alt="AI4Neuro"
            className="h-5 w-auto object-contain"
            style={{ height: '20px' }}
          />
        </Link>

        <div className="nav-links">
          <a href="#home">Home</a>
          <a href="#services">Services</a>
          <a href="#about">About</a>
          <a href="#process">Process</a>
          <a href="#contact">Contact</a>
        </div>

        <div className="nav-actions">
          {!loading && user && userProfile ? (
            <Link href={`/${userProfile.role}/dashboard`} className="nav-cta">
              Dashboard
              <span>
                <MoveUpRight size={16} />
              </span>
            </Link>
          ) : (
            <>
              <Link href="/login" className="login-button">
                Login
                <LogIn size={16} />
              </Link>

              <a className="nav-cta" href="#contact">
                Request Demo
                <span>
                  <MoveUpRight size={16} />
                </span>
              </a>
            </>
          )}
        </div>

        <button
          className="mobile-menu"
          type="button"
          aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={isMenuOpen}
          onClick={() => setIsMenuOpen((open) => !open)}
        >
          {isMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>

      <div className={`mobile-drawer-layer ${isMenuOpen ? 'open' : ''}`} aria-hidden={!isMenuOpen}>
        <button className="mobile-drawer-backdrop" type="button" aria-label="Close menu" onClick={closeMenu} />

        <aside className="mobile-drawer" aria-label="Mobile navigation">
          <div className="mobile-drawer-heading">
            <img
              src="/landing_homepage/AI4NEuroLOGO copy.png"
              alt="AI4Neuro Logo"
              style={{ height: '36px' }}
            />
            <strong>AI4NEURO</strong>
            <button type="button" aria-label="Close menu" onClick={closeMenu}>
              <X size={20} />
            </button>
          </div>

          <div className="mobile-drawer-links">
            <a href="#home" onClick={closeMenu}>Home</a>
            <a href="#services" onClick={closeMenu}>Services</a>
            <a href="#about" onClick={closeMenu}>About</a>
            <a href="#process" onClick={closeMenu}>Process</a>
            <a href="#contact" onClick={closeMenu}>Contact</a>
          </div>

          <div className="mobile-drawer-actions">
            {!loading && user && userProfile ? (
              <Link href={`/${userProfile.role}/dashboard`} className="nav-cta" onClick={closeMenu}>
                Dashboard
                <span>
                  <MoveUpRight size={16} />
                </span>
              </Link>
            ) : (
              <>
                <Link href="/login" className="login-button" onClick={closeMenu}>
                  Login
                  <LogIn size={16} />
                </Link>

                <a className="nav-cta" href="#contact" onClick={closeMenu}>
                  Request Demo
                  <span>
                    <MoveUpRight size={16} />
                  </span>
                </a>
              </>
            )}
          </div>
        </aside>
      </div>
    </header>
  );
}

// ============================================================================
// HERO SECTION
// ============================================================================
function Hero() {
  const headingRef = useRef<HTMLHeadingElement>(null);

  return (
    <section className="hero section-shell" id="home">
      <div className="hero-copy">
        <div className="eyebrow">
          <Activity size={16} />
          Early Alzheimer's Detection
        </div>

        <h1 ref={headingRef}>
          <VariableProximity
            label="AI-powered neuro diagnostics for earlier, clearer decisions."
            className="hero-variable-title"
            fromFontVariationSettings="'wght' 520, 'opsz' 12"
            toFontVariationSettings="'wght' 1000, 'opsz' 12"
            containerRef={headingRef}
            radius={145}
            falloff="gaussian"
          />
        </h1>

        <p>
          AI4NEURO unifies EEG, MRI, and PET intelligence into a seamless clinical experience, enabling early cognitive risk screening and generating specialist-ready reports.
        </p>

        <div className="hero-actions">
          <a className="primary-button" href="#services">
            Explore Services
            <span>
              <MoveUpRight size={17} />
            </span>
          </a>
          <a className="secondary-button" href="#process">View Process</a>
        </div>
      </div>

      <div className="hero-visual">
        <div className="image-card patient-card">
          <img src="/landing_homepage/patient.png" alt="Patient consultation" className="hero-image patient-img" />
        </div>

        <div className="helix-wrap" aria-hidden="true">
          <img
            src="/landing_homepage/double_helix_animation.gif"
            alt=""
            className="helix-img"
          />
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// STATS STRIP
// ============================================================================
const stats = [
  { icon: <DatabaseZap size={22} />, value: '3', label: 'Modalities unified' },
  { icon: <ClipboardCheck size={22} />, value: 'AI', label: 'Decision support' },
  { icon: <Clock3 size={22} />, value: 'Early', label: 'Risk indicators' },
  { icon: <ShieldCheck size={22} />, value: 'Secure', label: 'Data-first workflow' },
];

function StatsStrip() {
  return (
    <section className="stats-strip section-shell" aria-label="Ai4Neuro highlights">
      {stats.map((stat) => (
        <article className="stat-card" key={stat.label}>
          <span>{stat.icon}</span>
          <strong>{stat.value}</strong>
          <small>{stat.label}</small>
        </article>
      ))}
    </section>
  );
}

// ============================================================================
// SERVICES SECTION
// ============================================================================
const services = [
  {
    icon: <ScanSearch size={24} />,
    title: 'MRI Analysis',
    text: 'Structural brain scan review for volume, region change, and Alzheimer-linked imaging markers.',
    visual: 'mri',
    image: '/services/mripatient.png',
  },
  {
    icon: <RadioTower size={24} />,
    title: 'EEG Intelligence',
    text: 'Signal pattern analysis for rhythm, slowing, connectivity, and cognitive decline indicators.',
    visual: 'eeg',
    image: '/services/eegpatient.png',
  },
  {
    icon: <Brain size={24} />,
    title: 'PET Biomarkers',
    text: 'Metabolic and amyloid-sensitive PET support for earlier specialist-led interpretation.',
    visual: 'pet',
    image: '/services/petpatient.png',
  },
];

function ServicesSection() {
  return (
    <section className="services-section section-shell" id="services">
      <div className="section-heading">
        <div className="eyebrow">Neuro Imaging Services</div>
        <h2 className="text-3xl font-bold">
          AI-powered diagnostics for{' '}
          <RotatingText
            texts={['EEG', 'MRI', 'PET']}
            mainClassName="services-rotating-text"
            splitLevelClassName="services-rotating-word"
            elementLevelClassName="services-rotating-letter"
            staggerFrom="last"
            staggerDuration={0.035}
            rotationInterval={1800}
            splitBy="characters"
            auto
            loop
          />
        </h2>
      </div>

      <div className="service-grid">
        {services.map((service) => (
          <article className="service-card" key={service.title}>
            <div className={`service-visual service-visual-${service.visual}`}>
              <img className="service-image" src={service.image} alt={`${service.title} patient`} />
            </div>
            <a className="icon-button service-arrow" href="#contact" aria-label={`Open ${service.title}`}>
              <MoveUpRight size={19} />
            </a>
            <div className="service-icon">{service.icon}</div>
            <h3 className="text-3xl font-bold">{service.title}</h3>
            <p>{service.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

// ============================================================================
// ABOUT SECTION
// ============================================================================
function AboutSection() {
  return (
    <section className="about-section section-shell" id="about">
      <div className="about-visual">
        <div className="about-image">
          <img src="/landing_homepage/DoctorsGroup.png" alt="Doctors group" className="about-doctors-image" />
        </div>
        <div className="about-floating-card">
          <BrainCircuit size={28} />
          <strong>Multimodal AI</strong>
          <small>MRI + EEG + PET interpretation support</small>
        </div>
      </div>

      <div className="about-copy">
        <div className="eyebrow">About AI4NEURO</div>
        <h2 className="text-3xl font-bold">
          <GradientText
            colors={['#021f3d', '#064f8f', '#0b6fb3']}
            animationSpeed={8}
            showBorder={false}
            className="about-gradient-heading"
          >
            Built for clinicians working against the clock.
          </GradientText>
        </h2>
        <p>
          AI4NEURO supports early Alzheimer's detection by combining scan findings, signal
          behavior, and biomarker views into a clean diagnostic dashboard. The experience is
          designed for clarity, not clutter.
        </p>
        <div className="about-list">
          <span>
            <ShieldPlus size={20} />
            Privacy-aware patient handling
          </span>
          <span>
            <ShieldPlus size={20} />
            Specialist-ready visual summaries
          </span>
        </div>
        <a className="primary-button" href="#contact">
          Book Screening
          <span>
            <MoveUpRight size={17} />
          </span>
        </a>
      </div>
    </section>
  );
}

// ============================================================================
// PROCESS SECTION
// ============================================================================
const steps = [
  { icon: <ScanHeart size={23} />, title: 'Scan Intake', text: 'MRI, EEG, and PET records are organized into a single patient view.' },
  { icon: <Sparkles size={23} />, title: 'AI Analysis', text: 'Models highlight regions, rhythm shifts, and biomarker patterns linked to decline.' },
  { icon: <FileSearch size={23} />, title: 'Clinical Review', text: 'Findings are shaped into a concise report for specialist interpretation.' },
  { icon: <MessageSquareText size={23} />, title: 'Care Discussion', text: 'Patients and care teams receive next-step guidance with clearer context.' },
];

function ProcessSection() {
  return (
    <section className="process-section section-shell" id="process">
      <div className="process-heading">
        <div className="eyebrow">Workflow</div>
        <h2>
          <GradientText
            colors={['#073b65', '#0f8ea7', '#64f579']}
            animationSpeed={8}
            showBorder={false}
            className="process-gradient-heading text-4xl font-bold"
          >
            From scan to early insight.
          </GradientText>
        </h2>
      </div>
      <div className="process-grid">
        {steps.map((step, index) => (
          <article className="process-card" key={step.title}>
            <small>{String(index + 1).padStart(2, '0')}</small>
            <span>{step.icon}</span>
            <h3 className="text-3xl font-bold">{step.title}</h3>
            <p>{step.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

// ============================================================================
// CONTACT SECTION
// ============================================================================
function ContactSection() {
  return (
    <section className="contact-section section-shell" id="contact">
      <div className="contact-panel">
        <div>
          <div className="eyebrow">Contact</div>
          <h2 className="text-2xl font-bold">Start a neuro screening conversation.</h2>
          <p>
            Replace these details with your real clinic, lab, or research contact information
            when your content is ready.
          </p>
        </div>

        <div className="contact-cards">
          <article>
            <Mail size={21} />
            <span>info@praxiatech.ai</span>
          </article>
          <article>
            <Phone size={21} />
            <span>+91 94132 59268</span>
          </article>
          <article>
            <MapPin size={21} />
            <span>Indore, Madhya Pradesh</span>
          </article>
        </div>

        <a className="primary-button" href="mailto:info@praxiatech.ai">
          Contact Team
          <span>
            <MoveUpRight size={17} />
          </span>
        </a>
      </div>
    </section>
  );
}

// ============================================================================
// FOOTER
// ============================================================================
function Footer() {
  return (
    <footer className="footer section-shell">
      <Link className="footer-brand" href="/landing">
        <img
          src="/landing_homepage/AI4NEuroLOGO copy.png"
          alt="AI4Neuro Logo"
          style={{ height: '30px', marginRight: '6px' }}
        />
        <img
          src="/landing_homepage/AI4NeuroText.png"
          alt="AI4Neuro"
          style={{ height: '15px' }}
        />
      </Link>
      <p>Early Alzheimer's detection through MRI, EEG, and PET intelligence.</p>
    </footer>
  );
}

// ============================================================================
// MAIN PAGE EXPORT
// ============================================================================
export default function LandingPage() {
  return (
    <div className="landing-wrap app-shell">
      <PublicNavbar />
      <Hero />
      <StatsStrip />
      <ServicesSection />
      <AboutSection />
      <ProcessSection />
      <ContactSection />
      <Footer />
    </div>
  );
}
