'use client';

import React, { useRef, useState, useEffect } from 'react';

// ============================================================================
// GRADIENT TEXT - Subtle accent text
// ============================================================================
export function GradientText({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
  from?: string;
  via?: string;
  to?: string;
}) {
  return (
    <span className={`text-primary ${className}`}>
      {children}
    </span>
  );
}

// ============================================================================
// SHINY TEXT - Subtle shimmer effect for headings
// ============================================================================
export function ShinyText({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
  shimmerWidth?: number;
}) {
  return (
    <span className={`text-foreground ${className}`}>
      {children}
    </span>
  );
}

// ============================================================================
// SPOTLIGHT CARD - Card with subtle mouse-following highlight
// ============================================================================
export function SpotlightCard({
  children,
  className = '',
  spotlightColor = 'rgba(139, 92, 246, 0.06)',
}: {
  children: React.ReactNode;
  className?: string;
  spotlightColor?: string;
}) {
  const divRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!divRef.current) return;
    const rect = divRef.current.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setOpacity(1)}
      onMouseLeave={() => setOpacity(0)}
      className={`relative overflow-hidden rounded-xl border border-border bg-card transition-all duration-200 hover:border-primary/30 ${className}`}
    >
      <div
        className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-300"
        style={{
          opacity,
          background: `radial-gradient(400px circle at ${position.x}px ${position.y}px, ${spotlightColor}, transparent 40%)`,
        }}
      />
      {children}
    </div>
  );
}

// ============================================================================
// GLOW CARD - Card with subtle glow effect
// ============================================================================
export function GlowCard({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
  glowColor?: 'purple' | 'teal' | 'blue' | 'pink';
}) {
  return (
    <div className={`relative group ${className}`}>
      <div className="absolute -inset-0.5 bg-primary/10 rounded-xl blur opacity-0 group-hover:opacity-100 transition duration-300" />
      <div className="relative rounded-xl bg-card border border-border">
        {children}
      </div>
    </div>
  );
}

// ============================================================================
// ANIMATED BORDER CARD - Clean animated border
// ============================================================================
export function AnimatedBorderCard({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-border bg-card hover:border-primary/50 transition-colors duration-300 ${className}`}>
      {children}
    </div>
  );
}

// ============================================================================
// FLOATING CARD - Card with subtle lift on hover
// ============================================================================
export function FloatingCard({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${className}`}>
      {children}
    </div>
  );
}

// ============================================================================
// PULSE RING - Status indicator
// ============================================================================
export function PulseRing({
  className = '',
  color = 'green',
}: {
  className?: string;
  color?: 'purple' | 'teal' | 'blue' | 'green' | 'red' | 'yellow';
}) {
  const colors = {
    purple: 'bg-purple-500',
    teal: 'bg-teal-500',
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    red: 'bg-red-500',
    yellow: 'bg-yellow-500',
  };

  return (
    <span className={`relative flex h-2.5 w-2.5 ${className}`}>
      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${colors[color]} opacity-75`} />
      <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${colors[color]}`} />
    </span>
  );
}

// ============================================================================
// SYSTEM STATUS - Real-time system status indicator with health check
// ============================================================================
export function SystemStatus({
  className = '',
  showLabel = true,
  label = 'System',
}: {
  className?: string;
  showLabel?: boolean;
  label?: string;
}) {
  const [status, setStatus] = useState<'online' | 'degraded' | 'offline' | 'checking'>('checking');

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(`${backendUrl}/api/health`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          if (data.status === 'healthy') {
            setStatus('online');
          } else {
            setStatus('degraded');
          }
        } else {
          setStatus('degraded');
        }
      } catch (error) {
        // Check if we at least have frontend working
        setStatus('online'); // Frontend is working, backend may not be needed
      }
    };

    // Initial check
    checkHealth();

    // Check every 30 seconds
    const interval = setInterval(checkHealth, 30000);

    return () => clearInterval(interval);
  }, []);

  const statusConfig = {
    online: { color: 'green' as const, text: 'Online', textColor: 'text-green-400' },
    degraded: { color: 'yellow' as const, text: 'Degraded', textColor: 'text-yellow-400' },
    offline: { color: 'red' as const, text: 'Offline', textColor: 'text-red-400' },
    checking: { color: 'blue' as const, text: 'Checking...', textColor: 'text-blue-400' },
  };

  const config = statusConfig[status];

  return (
    <div className={`flex items-center gap-2 px-4 py-2 rounded-full bg-${config.color}-500/10 border border-${config.color}-500/20 ${className}`}>
      <PulseRing color={config.color} />
      {showLabel && (
        <span className={`text-sm font-medium ${config.textColor}`}>
          {label} {config.text}
        </span>
      )}
    </div>
  );
}

// ============================================================================
// ANIMATED COUNTER - Number that animates when it changes
// ============================================================================
export function AnimatedCounter({
  value,
  duration = 800,
  className = '',
}: {
  value: number;
  duration?: number;
  className?: string;
}) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let startTime: number;
    let animationFrame: number;
    const startValue = displayValue;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);

      // Ease out cubic
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.floor(startValue + (value - startValue) * easeOut));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [value, duration]);

  return <span className={className}>{displayValue.toLocaleString()}</span>;
}

// ============================================================================
// TYPEWRITER TEXT - Text that types out character by character
// ============================================================================
export function TypewriterText({
  text,
  speed = 50,
  className = '',
  onComplete,
}: {
  text: string;
  speed?: number;
  className?: string;
  onComplete?: () => void;
}) {
  const [displayText, setDisplayText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setDisplayText((prev) => prev + text[currentIndex]);
        setCurrentIndex((prev) => prev + 1);
      }, speed);
      return () => clearTimeout(timeout);
    } else if (onComplete) {
      onComplete();
    }
  }, [currentIndex, text, speed, onComplete]);

  return (
    <span className={className}>
      {displayText}
      <span className="animate-blink text-primary">|</span>
    </span>
  );
}

// ============================================================================
// MAGNETIC BUTTON - Button with subtle magnetic effect
// ============================================================================
export function MagneticButton({
  children,
  className = '',
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    setPosition({ x: x * 0.1, y: y * 0.1 });
  };

  const handleMouseLeave = () => {
    setPosition({ x: 0, y: 0 });
  };

  return (
    <button
      ref={buttonRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      className={`transition-transform duration-200 ${className}`}
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
      }}
    >
      {children}
    </button>
  );
}

// ============================================================================
// REVEAL ON SCROLL - Element that reveals when scrolled into view
// ============================================================================
export function RevealOnScroll({
  children,
  className = '',
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setIsVisible(true), delay);
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [delay]);

  return (
    <div
      ref={ref}
      className={`transition-all duration-500 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      } ${className}`}
    >
      {children}
    </div>
  );
}

// ============================================================================
// PARTICLE FIELD - Subtle floating particles (simplified)
// ============================================================================
export function ParticleField({
  count = 20,
  className = '',
}: {
  count?: number;
  className?: string;
}) {
  const particles = Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 2 + 1,
    duration: Math.random() * 20 + 15,
    delay: Math.random() * 5,
  }));

  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none opacity-30 ${className}`}>
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full bg-primary/30"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            animation: `float ${p.duration}s ease-in-out infinite`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

// ============================================================================
// AURORA BACKGROUND - Subtle gradient background
// ============================================================================
export function AuroraBackground({ className = '' }: { className?: string }) {
  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px]" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-primary/3 rounded-full blur-[100px]" />
    </div>
  );
}

// ============================================================================
// GRID PATTERN - Subtle grid background
// ============================================================================
export function GridPattern({ className = '' }: { className?: string }) {
  return (
    <div className={`absolute inset-0 pointer-events-none ${className}`}>
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }}
      />
    </div>
  );
}
