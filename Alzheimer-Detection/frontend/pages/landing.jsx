// SWAPPED: This page now shows the RICH INFO content (was in home.jsx)
// FOR: Logged-OUT users who visit /landing
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { motion } from 'motion/react';
import Navbar from '../components/Navbar';
import { useAuth, PENDING_ROLE_SELECTION } from '../components/AuthProvider';
import styles from '../styles/Home.module.css';

// Material UI Timeline Components
import Timeline from '@mui/lab/Timeline';
import TimelineItem from '@mui/lab/TimelineItem';
import TimelineSeparator from '@mui/lab/TimelineSeparator';
import TimelineConnector from '@mui/lab/TimelineConnector';
import TimelineContent from '@mui/lab/TimelineContent';
import TimelineOppositeContent from '@mui/lab/TimelineOppositeContent';
import TimelineDot from '@mui/lab/TimelineDot';

// Professional SVG Icons
const BrainHealthIcon = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12,2C13.1,2 14,2.9 14,4C14,5.1 13.1,6 12,6C10.9,6 10,5.1 10,4C10,2.9 10.9,2 12,2M21,9V7L19,5.5C18.8,5.7 18.6,5.9 18.4,6.1C18.1,6.3 17.8,6.5 17.6,6.7L19,8.2V10.6L17.6,12.1C17.8,12.3 18.1,12.5 18.4,12.7C18.6,12.9 18.8,13.1 19,13.3L21,11.8V9.8L21,9M15,12C16.1,12 17,12.9 17,14V22H15V14H9V22H7V14C7,12.9 7.9,12 9,12H15Z"/>
    </svg>
  </div>
);

const CognitiveConcernIcon = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
      <path d="M11,15H13V17H11V15M11,7H13V13H11V7M12,2C6.47,2 2,6.5 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20Z"/>
    </svg>
  </div>
);

const DementiaCareIcon = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12,2A3,3 0 0,1 15,5V11A3,3 0 0,1 12,14A3,3 0 0,1 9,11V5A3,3 0 0,1 12,2M19,18V20H5V18L7,16V14H9V15.5H15V14H17V16L19,18Z"/>
    </svg>
  </div>
);

// ShinyText Component
const ShinyText = ({ text, disabled = false, speed = 5, className = '' }) => {
  const animationDuration = `${speed}s`;

  return (
    <div
      className={`${className}`}
      style={{
        animationDuration,
        color: '#b5b5b5a4',
        background: 'linear-gradient(120deg, rgba(255, 255, 255, 0) 40%, rgba(255, 255, 255, 0.8) 50%, rgba(255, 255, 255, 0) 60%)',
        backgroundSize: '200% 100%',
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        display: 'inline-block',
        animation: disabled ? 'none' : `shine ${speed}s linear infinite`
      }}
    >
      {text}
      <style jsx>{`
        @keyframes shine {
          0% {
            background-position: 100%;
          }
          100% {
            background-position: -100%;
          }
        }
      `}</style>
    </div>
  );
};

// Perlin Noise Classes
class Grad {
  constructor(x, y, z) {
    this.x = x; this.y = y; this.z = z;
  }
  dot2(x, y) { return this.x * x + this.y * y; }
}

class Noise {
  constructor(seed = 0) {
    this.grad3 = [
      new Grad(1, 1, 0), new Grad(-1, 1, 0), new Grad(1, -1, 0), new Grad(-1, -1, 0),
      new Grad(1, 0, 1), new Grad(-1, 0, 1), new Grad(1, 0, -1), new Grad(-1, 0, -1),
      new Grad(0, 1, 1), new Grad(0, -1, 1), new Grad(0, 1, -1), new Grad(0, -1, -1)
    ];
    this.p = [151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225, 140, 36, 103, 30,
      69, 142, 8, 99, 37, 240, 21, 10, 23, 190, 6, 148, 247, 120, 234, 75, 0, 26, 197, 62, 94, 252, 219,
      203, 117, 35, 11, 32, 57, 177, 33, 88, 237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175, 74,
      165, 71, 134, 139, 48, 27, 166, 77, 146, 158, 231, 83, 111, 229, 122, 60, 211, 133, 230, 220, 105,
      92, 41, 55, 46, 245, 40, 244, 102, 143, 54, 65, 25, 63, 161, 1, 216, 80, 73, 209, 76, 132, 187, 208,
      89, 18, 169, 200, 196, 135, 130, 116, 188, 159, 86, 164, 100, 109, 198, 173, 186, 3, 64, 52, 217,
      226, 250, 124, 123, 5, 202, 38, 147, 118, 126, 255, 82, 85, 212, 207, 206, 59, 227, 47, 16, 58, 17,
      182, 189, 28, 42, 223, 183, 170, 213, 119, 248, 152, 2, 44, 154, 163, 70, 221, 153, 101, 155, 167,
      43, 172, 9, 129, 22, 39, 253, 19, 98, 108, 110, 79, 113, 224, 232, 178, 185, 112, 104, 218, 246,
      97, 228, 251, 34, 242, 193, 238, 210, 144, 12, 191, 179, 162, 241, 81, 51, 145, 235, 249, 14, 239,
      107, 49, 192, 214, 31, 181, 199, 106, 157, 184, 84, 204, 176, 115, 121, 50, 45, 127, 4, 150, 254,
      138, 236, 205, 93, 222, 114, 67, 29, 24, 72, 243, 141, 128, 195, 78, 66, 215, 61, 156, 180
    ];
    this.perm = new Array(512);
    this.gradP = new Array(512);
    this.seed(seed);
  }
  seed(seed) {
    if (seed > 0 && seed < 1) seed *= 65536;
    seed = Math.floor(seed);
    if (seed < 256) seed |= seed << 8;
    for (let i = 0; i < 256; i++) {
      let v = (i & 1) ? (this.p[i] ^ (seed & 255)) : (this.p[i] ^ ((seed >> 8) & 255));
      this.perm[i] = this.perm[i + 256] = v;
      this.gradP[i] = this.gradP[i + 256] = this.grad3[v % 12];
    }
  }
  fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  lerp(a, b, t) { return (1 - t) * a + t * b; }
  perlin2(x, y) {
    let X = Math.floor(x), Y = Math.floor(y);
    x -= X; y -= Y; X &= 255; Y &= 255;
    const n00 = this.gradP[X + this.perm[Y]].dot2(x, y);
    const n01 = this.gradP[X + this.perm[Y + 1]].dot2(x, y - 1);
    const n10 = this.gradP[X + 1 + this.perm[Y]].dot2(x - 1, y);
    const n11 = this.gradP[X + 1 + this.perm[Y + 1]].dot2(x - 1, y - 1);
    const u = this.fade(x);
    return this.lerp(
      this.lerp(n00, n10, u),
      this.lerp(n01, n11, u),
      this.fade(y)
    );
  }
}

// WavesComponent
const WavesComponent = ({
  lineColor = "rgba(139, 69, 255, 0.3)",
  backgroundColor = "transparent",
  waveSpeedX = 0.0125,
  waveSpeedY = 0.005,
  waveAmpX = 32,
  waveAmpY = 16,
  xGap = 10,
  yGap = 32,
  friction = 0.925,
  tension = 0.005,
  maxCursorMove = 100,
  style = {},
  className = ""
}) => {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const boundingRef = useRef({ width: 0, height: 0, left: 0, top: 0 });
  const noiseRef = useRef(new Noise(Math.random()));
  const linesRef = useRef([]);
  const mouseRef = useRef({
    x: -10, y: 0, lx: 0, ly: 0, sx: 0, sy: 0, v: 0, vs: 0, a: 0, set: false
  });
  const configRef = useRef({
    lineColor, waveSpeedX, waveSpeedY, waveAmpX, waveAmpY,
    friction, tension, maxCursorMove, xGap, yGap
  });
  const frameIdRef = useRef(null);

  useEffect(() => {
    configRef.current = { lineColor, waveSpeedX, waveSpeedY, waveAmpX, waveAmpY, friction, tension, maxCursorMove, xGap, yGap };
  }, [lineColor, waveSpeedX, waveSpeedY, waveAmpX, waveAmpY, friction, tension, maxCursorMove, xGap, yGap]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    ctxRef.current = canvas.getContext("2d");

    function setSize() {
      boundingRef.current = container.getBoundingClientRect();
      canvas.width = boundingRef.current.width;
      canvas.height = boundingRef.current.height;
    }

    function setLines() {
      const { width, height } = boundingRef.current;
      linesRef.current = [];
      const oWidth = width + 200, oHeight = height + 30;
      const { xGap, yGap } = configRef.current;
      const totalLines = Math.ceil(oWidth / xGap);
      const totalPoints = Math.ceil(oHeight / yGap);
      const xStart = (width - xGap * totalLines) / 2;
      const yStart = (height - yGap * totalPoints) / 2;
      for (let i = 0; i <= totalLines; i++) {
        const pts = [];
        for (let j = 0; j <= totalPoints; j++) {
          pts.push({
            x: xStart + xGap * i,
            y: yStart + yGap * j,
            wave: { x: 0, y: 0 },
            cursor: { x: 0, y: 0, vx: 0, vy: 0 }
          });
        }
        linesRef.current.push(pts);
      }
    }

    function movePoints(time) {
      const lines = linesRef.current, mouse = mouseRef.current, noise = noiseRef.current;
      const { waveSpeedX, waveSpeedY, waveAmpX, waveAmpY, friction, tension, maxCursorMove } = configRef.current;
      lines.forEach((pts) => {
        pts.forEach((p) => {
          const move = noise.perlin2(
            (p.x + time * waveSpeedX) * 0.002,
            (p.y + time * waveSpeedY) * 0.0015
          ) * 12;
          p.wave.x = Math.cos(move) * waveAmpX;
          p.wave.y = Math.sin(move) * waveAmpY;

          const dx = p.x - mouse.sx, dy = p.y - mouse.sy;
          const dist = Math.hypot(dx, dy), l = Math.max(175, mouse.vs);
          if (dist < l) {
            const s = 1 - dist / l;
            const f = Math.cos(dist * 0.001) * s;
            p.cursor.vx += Math.cos(mouse.a) * f * l * mouse.vs * 0.00065;
            p.cursor.vy += Math.sin(mouse.a) * f * l * mouse.vs * 0.00065;
          }

          p.cursor.vx += (0 - p.cursor.x) * tension;
          p.cursor.vy += (0 - p.cursor.y) * tension;
          p.cursor.vx *= friction;
          p.cursor.vy *= friction;
          p.cursor.x += p.cursor.vx * 2;
          p.cursor.y += p.cursor.vy * 2;
          p.cursor.x = Math.min(maxCursorMove, Math.max(-maxCursorMove, p.cursor.x));
          p.cursor.y = Math.min(maxCursorMove, Math.max(-maxCursorMove, p.cursor.y));
        });
      });
    }

    function moved(point, withCursor = true) {
      const x = point.x + point.wave.x + (withCursor ? point.cursor.x : 0);
      const y = point.y + point.wave.y + (withCursor ? point.cursor.y : 0);
      return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
    }

    function drawLines() {
      const { width, height } = boundingRef.current;
      const ctx = ctxRef.current;
      ctx.clearRect(0, 0, width, height);
      ctx.beginPath();
      ctx.strokeStyle = configRef.current.lineColor;
      linesRef.current.forEach((points) => {
        let p1 = moved(points[0], false);
        ctx.moveTo(p1.x, p1.y);
        points.forEach((p, idx) => {
          const isLast = idx === points.length - 1;
          p1 = moved(p, !isLast);
          const p2 = moved(points[idx + 1] || points[points.length - 1], !isLast);
          ctx.lineTo(p1.x, p1.y);
          if (isLast) ctx.moveTo(p2.x, p2.y);
        });
      });
      ctx.stroke();
    }

    function tick(t) {
      const mouse = mouseRef.current;
      mouse.sx += (mouse.x - mouse.sx) * 0.1;
      mouse.sy += (mouse.y - mouse.sy) * 0.1;
      const dx = mouse.x - mouse.lx, dy = mouse.y - mouse.ly;
      const d = Math.hypot(dx, dy);
      mouse.v = d;
      mouse.vs += (d - mouse.vs) * 0.1;
      mouse.vs = Math.min(100, mouse.vs);
      mouse.lx = mouse.x; mouse.ly = mouse.y;
      mouse.a = Math.atan2(dy, dx);

      movePoints(t);
      drawLines();
      frameIdRef.current = requestAnimationFrame(tick);
    }

    function onResize() {
      setSize();
      setLines();
    }
    function onMouseMove(e) { updateMouse(e.clientX, e.clientY); }
    function onTouchMove(e) {
      const touch = e.touches[0];
      updateMouse(touch.clientX, touch.clientY);
    }
    function updateMouse(x, y) {
      const mouse = mouseRef.current, b = boundingRef.current;
      mouse.x = x - b.left;
      mouse.y = y - b.top;
      if (!mouse.set) {
        mouse.sx = mouse.x; mouse.sy = mouse.y;
        mouse.lx = mouse.x; mouse.ly = mouse.y;
        mouse.set = true;
      }
    }

    setSize();
    setLines();
    frameIdRef.current = requestAnimationFrame(tick);
    window.addEventListener("resize", onResize);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("touchmove", onTouchMove, { passive: false });

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("touchmove", onTouchMove);
      if(frameIdRef.current) cancelAnimationFrame(frameIdRef.current);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`${styles.waves} ${className}`}
      style={{
        position: "absolute",
        top: 0, left: 0, margin: 0, padding: 0,
        width: "100%", height: "100%", overflow: "hidden",
        backgroundColor,
        ...style
      }}
    >
      <canvas ref={canvasRef} className={styles.wavesCanvas} />
    </div>
  );
};

// Enhanced Horizontal Interactive Timeline Component
const InteractiveTimeline = () => {
  const [activeStage, setActiveStage] = useState(0);

  const stages = [
    {
      id: 'CN',
      title: 'Cognitively Normal',
      subtitle: 'Baseline Cognitive Health',
      description: 'Individuals in this stage demonstrate optimal cognitive function with memory, thinking, and reasoning skills that align perfectly with their age and educational background.',
      detailedInfo: 'Regular cognitive assessments show consistent performance across all domains including executive function, memory consolidation, and information processing speed. This represents the gold standard of healthy brain aging.',
      icon: <BrainHealthIcon />,
      color: '#06d6a0',
      time: 'Optimal Function',
      prevalence: '70-80% of population'
    },
    {
      id: 'MCI',
      title: 'Mild Cognitive Impairment',
      subtitle: 'Critical Intervention Window',
      description: 'MCI represents a crucial intermediate stage where subtle but measurable changes in cognitive function become apparent, presenting the most valuable opportunity for early intervention.',
      detailedInfo: 'Characterized by mild memory problems, occasional word-finding difficulties, and slight changes in executive function that are noticeable to the individual and family members.',
      icon: <CognitiveConcernIcon />,
      color: '#f59e0b',
      time: 'Early Detection Phase',
      prevalence: '15-20% progress annually'
    },
    {
      id: 'AD',
      title: "Alzheimer's Dementia",
      subtitle: 'Advanced Neurodegeneration',
      description: 'The most severe stage characterized by significant cognitive decline that substantially impacts daily functioning, requiring comprehensive care and support systems.',
      detailedInfo: 'Advanced symptoms include severe memory impairment, disorientation, language difficulties, and changes in personality and behavior requiring specialized medical care and family support.',
      icon: <DementiaCareIcon />,
      color: '#ef4444',
      time: 'Advanced Care Required',
      prevalence: '6.5M+ affected in US'
    }
  ];

  return (
    <div className={styles.timelineSection}>
      <div className={styles.timelineHeader}>
        <h2 className={styles.timelineTitle}>
          Understanding the Cognitive Health Journey
        </h2>

        <ShinyText
          text="Navigate through the three critical stages of neurological health with our interactive timeline featuring professional medical insights and cutting-edge analysis"
          speed={6}
          className={styles.timelineSubtitle}
        />
      </div>

      <Timeline position="alternate" className={styles.customTimeline}>
        {stages.map((stage, index) => (
          <TimelineItem key={stage.id} className={styles.timelineItem}>
            <TimelineOppositeContent
              sx={{ m: 'auto 0' }}
              align={index % 2 === 0 ? "right" : "left"}
              variant="body2"
              className={styles.timelineOppositeContent}
            >
              <motion.div
                initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
                animate={{
                  opacity: activeStage === index ? 1 : 0.7,
                  x: 0
                }}
                transition={{ duration: 0.5 }}
                className={styles.stageInfo}
              >
                <div
                  className={styles.stageTime}
                  style={{ color: stage.color }}
                >
                  {stage.time}
                </div>
                <div className={styles.stagePrevalence}>
                  {stage.prevalence}
                </div>
              </motion.div>
            </TimelineOppositeContent>

            <TimelineSeparator>
              <TimelineConnector className={styles.timelineConnector} />
              <motion.div
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setActiveStage(index)}
              >
                <TimelineDot
                  color={activeStage === index ? "primary" : "grey"}
                  variant={activeStage === index ? "filled" : "outlined"}
                  className={styles.timelineDot}
                  sx={{
                    backgroundColor: activeStage === index ? stage.color : 'transparent',
                    borderColor: stage.color,
                    width: 80,
                    height: 80,
                    cursor: 'pointer',
                    boxShadow: activeStage === index ? `0 0 20px ${stage.color}50` : 'none',
                    '&:hover': {
                      transform: 'scale(1.05)',
                      boxShadow: `0 0 25px ${stage.color}70`
                    }
                  }}
                >
                  {stage.icon}
                </TimelineDot>
              </motion.div>
              <TimelineConnector className={styles.timelineConnector} />
            </TimelineSeparator>

            <TimelineContent sx={{ py: '12px', px: 2 }} className={styles.timelineContent}>
              <motion.div
                initial={{ opacity: 0, x: index % 2 === 0 ? 20 : -20 }}
                animate={{
                  opacity: activeStage === index ? 1 : 0.8,
                  x: 0,
                  scale: activeStage === index ? 1.02 : 1
                }}
                transition={{ duration: 0.5 }}
                className={`${styles.stageContent} ${activeStage === index ? styles.activeStageContent : ''}`}
                onClick={() => setActiveStage(index)}
                style={{
                  borderColor: activeStage === index ? `${stage.color}60` : 'rgba(255, 255, 255, 0.1)',
                  background: activeStage === index
                    ? `linear-gradient(135deg, ${stage.color}10, rgba(255, 255, 255, 0.05))`
                    : 'rgba(255, 255, 255, 0.03)'
                }}
              >
                <div
                  className={styles.stageGradientBorder}
                  style={{
                    background: `linear-gradient(90deg, ${stage.color}, ${stage.color}80)`,
                    opacity: activeStage === index ? 1 : 0.3
                  }}
                />

                <h3 className={styles.stageTitle}>{stage.title}</h3>

                <h4
                  className={styles.stageSubtitle}
                  style={{ color: stage.color }}
                >
                  {stage.subtitle}
                </h4>

                <p className={styles.stageDescription}>
                  {activeStage === index ? stage.detailedInfo : stage.description}
                </p>

                <div
                  className={styles.stageBadge}
                  style={{
                    background: `linear-gradient(135deg, ${stage.color}, ${stage.color}CC)`
                  }}
                >
                  {stage.id}
                </div>
              </motion.div>
            </TimelineContent>
          </TimelineItem>
        ))}
      </Timeline>

      {/* Interactive Stage Selector */}
      <div className={styles.stageSelector}>
        {stages.map((stage, index) => (
          <motion.button
            key={stage.id}
            onClick={() => setActiveStage(index)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`${styles.stageSelectorBtn} ${activeStage === index ? styles.activeStageSelectorBtn : ''}`}
            style={{
              borderColor: activeStage === index ? stage.color : 'rgba(255, 255, 255, 0.2)',
              background: activeStage === index
                ? `linear-gradient(135deg, ${stage.color}, ${stage.color}CC)`
                : 'rgba(255, 255, 255, 0.05)',
              color: activeStage === index ? 'white' : 'rgba(255, 255, 255, 0.7)'
            }}
          >
            {stage.id}
          </motion.button>
        ))}
      </div>
    </div>
  );
};

export default function LandingPage() {
  const { user, userProfile, isLoading: authLoading, session } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // NO auth redirects - let users see the page
  // If they're logged in, they can still see it, button will take them to dashboard

  if (authLoading || !mounted) {
    return (
      <>
        <Navbar />
        <div className={styles.loadingScreen}>
          <p>Loading...</p>
        </div>
      </>
    );
  }

  const handleAnalyse = () => {
    // UPDATED FOR LANDING PAGE: Direct to login/register if not logged in
    if (user && userProfile?.role) {
      router.push(`/${userProfile.role}/dashboard`);
    } else if (user) {
      router.push('/complete-profile');
    } else {
      router.push('/login'); // Not logged in → go to login
    }
  };

  return (
    <>
      <Navbar />
      <main className={styles.main}>
        <WavesComponent
          lineColor="rgba(139, 69, 255, 0.2)"
          backgroundColor="transparent"
          waveSpeedX={0.015}
          waveSpeedY={0.008}
          waveAmpX={25}
          waveAmpY={15}
          xGap={15}
          yGap={40}
        />

        <div className={styles.content}>
          <div className={styles.hero}>
            <div className={styles.heroText}>
              <div className={styles.heroTitle}>
                Welcome to <span className={styles.brand}>AI4NEURO</span>
              </div>

              <ShinyText
                text="Advanced AI-Powered Neurological Analysis for Early Alzheimer's Detection"
                speed={4}
                className={styles.heroSubtitle}
              />

              <motion.div
                className={styles.missionSection}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, delay: 0.3 }}
              >
                <div className={styles.missionIconWrapper}>
                  <motion.div
                    className={styles.missionIcon}
                    animate={{
                      rotate: [0, 5, -5, 0],
                      scale: [1, 1.05, 1]
                    }}
                    transition={{
                      duration: 4,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  >
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M9.5 2A2.5 2.5 0 0 0 7 4.5v15A2.5 2.5 0 0 0 9.5 22a2.5 2.5 0 0 0 2.5-2.5v-15A2.5 2.5 0 0 0 9.5 2z"/>
                      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 2.5 2.5 2.5 2.5 0 0 0 2.5-2.5v-15A2.5 2.5 0 0 0 14.5 2z"/>
                      <path d="M4.5 7A2.5 2.5 0 0 0 2 9.5v5A2.5 2.5 0 0 0 4.5 17 2.5 2.5 0 0 0 7 14.5v-5A2.5 2.5 0 0 0 4.5 7z"/>
                      <path d="M19.5 7A2.5 2.5 0 0 0 17 9.5v5a2.5 2.5 0 0 0 2.5 2.5 2.5 2.5 0 0 0 2.5-2.5v-5A2.5 2.5 0 0 0 19.5 7z"/>
                    </svg>
                  </motion.div>
                </div>

                <h2 className={styles.sectionTitle}>
                  <span className={styles.sectionTitleMain}>Transforming Brain Health Through AI Innovation</span>
                </h2>

                <div className={styles.missionContent}>
                  <p className={styles.missionText}>
                    We empower healthcare professionals and patients with cutting-edge artificial intelligence to detect early signs of Alzheimer's disease through advanced EEG signal analysis.
                  </p>

                  <div className={styles.missionHighlights}>
                    <motion.div
                      className={styles.highlight}
                      whileHover={{ scale: 1.03 }}
                    >
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                      </svg>
                      <div>
                        <h4>Early Detection</h4>
                        <p>Identify cognitive decline before symptoms emerge</p>
                      </div>
                    </motion.div>

                    <motion.div
                      className={styles.highlight}
                      whileHover={{ scale: 1.03 }}
                    >
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/>
                        <circle cx="12" cy="12" r="6"/>
                        <circle cx="12" cy="12" r="2"/>
                      </svg>
                      <div>
                        <h4>Clinical Precision</h4>
                        <p>AI-powered analysis with medical-grade accuracy</p>
                      </div>
                    </motion.div>

                    <motion.div
                      className={styles.highlight}
                      whileHover={{ scale: 1.03 }}
                    >
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                        <polyline points="22 4 12 14.01 9 11.01"/>
                      </svg>
                      <div>
                        <h4>Actionable Insights</h4>
                        <p>Comprehensive reports for informed decisions</p>
                      </div>
                    </motion.div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>

          {/* Interactive Timeline */}
          <InteractiveTimeline />

          {/* Feature Showcase Section */}
          <div className={styles.featureShowcase}>
            <motion.div
              className={styles.showcaseHeader}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
            >
              <h2>Powered by Advanced Technology</h2>
              <p>Comprehensive neurological analysis at your fingertips</p>
            </motion.div>

            <div className={styles.featuresGrid}>
              <motion.div
                className={styles.featureCard}
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5, duration: 0.6 }}
                whileHover={{ y: -8 }}
              >
                <div className={styles.featureIconBox} style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                    <path d="M12 2v20M2 12h20"/>
                    <circle cx="12" cy="12" r="10"/>
                  </svg>
                </div>
                <div className={styles.featureContent}>
                  <h3>Deep Learning Models</h3>
                  <p>State-of-the-art neural networks trained on thousands of EEG recordings for unparalleled accuracy</p>
                  <div className={styles.featureBadge}>95% Accuracy</div>
                </div>
              </motion.div>

              <motion.div
                className={styles.featureCard}
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6, duration: 0.6 }}
                whileHover={{ y: -8 }}
              >
                <div className={styles.featureIconBox} style={{ background: 'linear-gradient(135deg, #06d6a0 0%, #118ab2 100%)' }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                  </svg>
                </div>
                <div className={styles.featureContent}>
                  <h3>Real-time EEG Analysis</h3>
                  <p>Advanced signal processing extracts meaningful patterns from complex brain wave data instantly</p>
                  <div className={styles.featureBadge}>Live Processing</div>
                </div>
              </motion.div>

              <motion.div
                className={styles.featureCard}
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7, duration: 0.6 }}
                whileHover={{ y: -8 }}
              >
                <div className={styles.featureIconBox} style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                    <polyline points="10 9 9 9 8 9"/>
                  </svg>
                </div>
                <div className={styles.featureContent}>
                  <h3>Comprehensive Reports</h3>
                  <p>Detailed clinical documentation with visualizations tailored for patients and medical professionals</p>
                  <div className={styles.featureBadge}>Multi-format</div>
                </div>
              </motion.div>
            </div>
          </div>

          {/* CTA Section */}
          <motion.div
            className={styles.ctaContainer}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.8, duration: 0.6 }}
          >
            <div className={styles.ctaContent}>
              <h2>Ready to Begin Your Analysis?</h2>
              <p>Join thousands of healthcare professionals using AI4NEURO</p>

              <motion.button
                onClick={handleAnalyse}
                className={styles.analyzeButton}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <span className={styles.buttonText}>
                  {user ? 'Start Analysis Now' : 'Get Started - Login'}
                </span>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="5" y1="12" x2="19" y2="12"/>
                  <polyline points="12 5 19 12 12 19"/>
                </svg>
              </motion.button>

              {user && (
                <div className={styles.userWelcome}>
                  <div className={styles.userAvatar}>
                    {userProfile?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <div className={styles.userDetails}>
                    <p className={styles.userName}>{userProfile?.full_name || user?.email}</p>
                    <p className={styles.userRole}>
                      {userProfile?.role?.charAt(0).toUpperCase() + userProfile?.role?.slice(1) || 'User'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          <motion.div
            className={styles.stats}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.1, duration: 0.8 }}
          >
            {[
              { value: '95%', label: 'Accuracy' },
              { value: '10K+', label: 'Analyses' },
              { value: '500+', label: 'Clinicians' },
              { value: '24/7', label: 'Support' }
            ].map((stat, index) => (
              <motion.div
                key={stat.label}
                className={styles.statCard}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.2 + index * 0.1, duration: 0.6 }}
                whileHover={{
                  transform: 'translateY(-5px)',
                  boxShadow: '0 10px 30px rgba(6, 214, 160, 0.2)'
                }}
              >
                <div className={styles.statValue}>{stat.value}</div>
                <div className={styles.statLabel}>{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </main>
    </>
  );
}
