import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { DollarSign, ArrowRight, Sparkles, Shield, RefreshCw, Cloud, Settings, Link, Trophy, Play, TrendingUp, TrendingDown, ChevronRight, Zap } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface LandingPageProps {
  onGetStarted: () => void;
}

// Color palette - using hex values directly for reliability
const colors = {
  bg: '#0d0d0d',
  amber400: '#fbbf24',
  amber500: '#f59e0b',
  orange400: '#fb923c',
  orange500: '#f97316',
  orange600: '#ea580c',
  rose400: '#fb7185',
  rose500: '#f43f5e',
  fuchsia500: '#d946ef',
  purple600: '#9333ea',
  cyan500: '#06b6d4',
  teal500: '#14b8a6',
  pink500: '#ec4899',
};

// Animated counter component
function AnimatedCounter({ value, duration = 2 }: { value: number; duration?: number }) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => Math.round(latest));
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const controls = animate(count, value, { duration });
    const unsubscribe = rounded.on("change", (v) => setDisplayValue(v));
    return () => {
      controls.stop();
      unsubscribe();
    };
  }, [value, duration, count, rounded]);

  return <span>{displayValue}</span>;
}

// Floating orb component with will-change optimization
function FloatingOrb({
  style,
  delay = 0,
  duration = 20
}: {
  style: React.CSSProperties;
  delay?: number;
  duration?: number;
}) {
  return (
    <motion.div
      style={{
        position: 'absolute',
        borderRadius: '9999px',
        filter: 'blur(60px)',
        opacity: 0.4,
        willChange: 'transform',
        ...style
      }}
      animate={{
        x: [0, 30, -20, 0],
        y: [0, -40, 20, 0],
        scale: [1, 1.1, 0.95, 1],
      }}
      transition={{
        duration,
        repeat: Infinity,
        ease: "easeInOut",
        delay,
      }}
    />
  );
}

// Mock player data for dashboard preview
const mockPlayers = [
  { name: 'Juan Soto', team: 'NYY', pos: 'OF', value: 48, adjusted: 52, inflation: 8.3, status: 'good' },
  { name: 'Bobby Witt Jr.', team: 'KC', pos: 'SS', value: 44, adjusted: 47, inflation: 6.8, status: 'good' },
  { name: 'Shohei Ohtani', team: 'LAD', pos: 'DH', value: 52, adjusted: 49, inflation: -5.8, status: 'great' },
  { name: 'Corbin Carroll', team: 'ARI', pos: 'OF', value: 28, adjusted: 35, inflation: 25.0, status: 'avoid' },
  { name: 'Gunnar Henderson', team: 'BAL', pos: 'SS', value: 38, adjusted: 41, inflation: 7.9, status: 'good' },
];

// Dashboard Mockup Component for hero visual proof
function DashboardMockup() {
  const [activeRow, setActiveRow] = useState(2); // Ohtani highlighted by default

  // Cycle through rows for animation effect
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveRow(prev => (prev + 1) % mockPlayers.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, x: 50, rotateY: -5 }}
      animate={{ opacity: 1, x: 0, rotateY: 0 }}
      transition={{ duration: 0.8, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: '480px',
        perspective: '1000px',
      }}
    >
      {/* Floating animation wrapper */}
      <motion.div
        animate={{
          y: [0, -8, 0],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        {/* Glow effect behind card */}
        <div
          style={{
            position: 'absolute',
            inset: '-20px',
            background: `linear-gradient(135deg, ${colors.amber500}20, ${colors.orange500}15, ${colors.rose500}20)`,
            borderRadius: '32px',
            filter: 'blur(40px)',
            opacity: 0.6,
          }}
        />

        {/* Main dashboard card */}
        <div
          style={{
            position: 'relative',
            backgroundColor: 'rgba(13, 13, 13, 0.8)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '20px',
            overflow: 'hidden',
            boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)',
          }}
        >
          {/* Header bar */}
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  background: `linear-gradient(135deg, ${colors.amber400}, ${colors.orange500})`,
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <DollarSign style={{ width: '16px', height: '16px', color: 'white' }} />
              </div>
              <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: '14px', fontWeight: 600 }}>
                Live Auction
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <motion.div
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                style={{
                  width: '8px',
                  height: '8px',
                  backgroundColor: '#22c55e',
                  borderRadius: '50%',
                }}
              />
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>Connected</span>
            </div>
          </div>

          {/* Stats bar */}
          <div
            style={{
              padding: '12px 20px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
              display: 'flex',
              gap: '24px',
            }}
          >
            <div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Inflation
              </div>
              <div style={{ color: colors.amber400, fontSize: '18px', fontWeight: 700 }}>
                +12.4%
              </div>
            </div>
            <div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Budget Left
              </div>
              <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: '18px', fontWeight: 700 }}>
                $187
              </div>
            </div>
            <div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Roster
              </div>
              <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: '18px', fontWeight: 700 }}>
                8/23
              </div>
            </div>
          </div>

          {/* Table header */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 50px 70px 60px',
              padding: '10px 20px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
              color: 'rgba(255,255,255,0.4)',
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            <span>Player</span>
            <span style={{ textAlign: 'right' }}>Value</span>
            <span style={{ textAlign: 'right' }}>Adjusted</span>
            <span style={{ textAlign: 'right' }}>Infl %</span>
          </div>

          {/* Player rows */}
          <div style={{ padding: '4px 0' }}>
            {mockPlayers.map((player, index) => {
              const isActive = index === activeRow;
              const statusColor = player.status === 'great'
                ? colors.teal500
                : player.status === 'good'
                  ? '#22c55e'
                  : colors.rose500;

              return (
                <motion.div
                  key={player.name}
                  animate={{
                    backgroundColor: isActive ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
                  }}
                  transition={{ duration: 0.3 }}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 50px 70px 60px',
                    padding: '12px 20px',
                    alignItems: 'center',
                    borderLeft: isActive ? `3px solid ${statusColor}` : '3px solid transparent',
                  }}
                >
                  <div>
                    <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: '14px', fontWeight: 500 }}>
                      {player.name}
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>
                      {player.team} - {player.pos}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', color: 'rgba(255,255,255,0.6)', fontSize: '14px' }}>
                    ${player.value}
                  </div>
                  <div style={{ textAlign: 'right', color: 'rgba(255,255,255,0.9)', fontSize: '14px', fontWeight: 600 }}>
                    ${player.adjusted}
                  </div>
                  <div
                    style={{
                      textAlign: 'right',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: player.inflation < 0 ? colors.teal500 : player.inflation > 15 ? colors.rose500 : '#22c55e',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      gap: '2px',
                    }}
                  >
                    {player.inflation > 0 ? (
                      <TrendingUp style={{ width: '12px', height: '12px' }} />
                    ) : (
                      <TrendingDown style={{ width: '12px', height: '12px' }} />
                    )}
                    {player.inflation > 0 ? '+' : ''}{player.inflation}%
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Footer hint */}
          <div
            style={{
              padding: '12px 20px',
              borderTop: '1px solid rgba(255, 255, 255, 0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <div
              style={{
                width: '8px',
                height: '8px',
                backgroundColor: colors.teal500,
                borderRadius: '50%',
              }}
            />
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>
              Green = Great Value
            </span>
            <span style={{ color: 'rgba(255,255,255,0.3)', margin: '0 4px' }}>|</span>
            <div
              style={{
                width: '8px',
                height: '8px',
                backgroundColor: colors.rose500,
                borderRadius: '50%',
              }}
            />
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>
              Red = Overpriced
            </span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// Responsive styles for the hero mockup and mobile optimizations
const heroResponsiveStyles = `
  @media (max-width: 900px) {
    .hero-mockup {
      display: none !important;
    }
    .feature-flow-arrow {
      display: none !important;
    }
  }
  @media (min-width: 901px) {
    .hero-mockup {
      display: flex !important;
    }
    .feature-flow-arrow {
      display: block !important;
    }
  }

  /* Mobile optimization - Stats section 2x2 grid */
  @media (max-width: 767px) {
    .stats-grid {
      grid-template-columns: repeat(2, 1fr) !important;
      gap: 24px !important;
    }
  }

  /* Touch target optimization for mobile buttons */
  @media (max-width: 767px) {
    .cta-button-primary,
    .cta-button-secondary,
    .header-signin-button {
      min-height: 44px !important;
      min-width: 44px !important;
    }
  }

  /* Feature card glassmorphism and hover effects */
  .feature-card {
    background: rgba(255, 255, 255, 0.03);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    padding: 24px;
    transition: transform 0.3s ease, box-shadow 0.3s ease, background 0.3s ease;
  }

  .feature-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
    background: rgba(255, 255, 255, 0.05);
  }

  /* Primary CTA button hover glow effect */
  .cta-button-primary {
    will-change: transform, box-shadow;
    transition: box-shadow 0.3s ease;
  }

  .cta-button-primary:hover {
    box-shadow: 0 20px 40px rgba(249, 115, 22, 0.4), 0 0 60px rgba(249, 115, 22, 0.2) !important;
  }

  /* Secondary CTA button styling */
  .cta-button-secondary {
    will-change: transform, background-color;
  }

  /* Final CTA button hover glow */
  .final-cta-button {
    will-change: transform, box-shadow;
    transition: box-shadow 0.3s ease;
  }

  .final-cta-button:hover {
    box-shadow: 0 25px 50px rgba(249, 115, 22, 0.5), 0 0 80px rgba(249, 115, 22, 0.25) !important;
  }
`;

export function LandingPage({ onGetStarted }: LandingPageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  // Track mouse for subtle parallax effect
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setMousePosition({
          x: (e.clientX - rect.width / 2) / rect.width,
          y: (e.clientY - rect.height / 2) / rect.height,
        });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        minHeight: '100vh',
        backgroundColor: colors.bg,
        overflow: 'hidden',
        position: 'relative'
      }}
    >
      {/* Responsive styles for hero mockup */}
      <style>{heroResponsiveStyles}</style>
      {/* Animated gradient mesh background */}
      <div style={{ position: 'fixed', inset: 0, overflow: 'hidden' }}>
        {/* Primary gradient orbs with retro colors */}
        <FloatingOrb
          style={{
            width: '800px',
            height: '800px',
            top: '-160px',
            left: '-160px',
            background: `linear-gradient(135deg, ${colors.amber500}4d, ${colors.orange600}33, transparent)`,
          }}
          delay={0}
          duration={25}
        />
        <FloatingOrb
          style={{
            width: '600px',
            height: '600px',
            top: '25%',
            right: 0,
            background: `linear-gradient(225deg, ${colors.fuchsia500}40, ${colors.purple600}26, transparent)`,
          }}
          delay={2}
          duration={22}
        />
        <FloatingOrb
          style={{
            width: '500px',
            height: '500px',
            bottom: 0,
            left: '25%',
            background: `linear-gradient(45deg, ${colors.cyan500}33, ${colors.teal500}26, transparent)`,
          }}
          delay={4}
          duration={28}
        />
        <FloatingOrb
          style={{
            width: '400px',
            height: '400px',
            bottom: '25%',
            right: '25%',
            background: `linear-gradient(315deg, ${colors.rose500}33, ${colors.pink500}1a, transparent)`,
          }}
          delay={1}
          duration={24}
        />

        {/* Subtle grid overlay for retro feel */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: 0.03,
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
          }}
        />

        {/* Radial gradient overlay for depth */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(ellipse at center, transparent 0%, ${colors.bg} 70%)`
          }}
        />

        {/* Subtle noise texture overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: 0.04,
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
            pointerEvents: 'none',
          }}
        />
      </div>

      {/* Header */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          padding: '20px 24px',
        }}
      >
        <div style={{ maxWidth: '1152px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <motion.div
            style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
            whileHover={{ scale: 1.02 }}
          >
            <div style={{ position: 'relative' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  background: `linear-gradient(135deg, ${colors.amber400}, ${colors.orange500}, ${colors.rose500})`,
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: `0 10px 25px ${colors.orange500}33`,
                }}
              >
                <DollarSign style={{ width: '20px', height: '20px', color: 'white' }} />
              </div>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: `linear-gradient(135deg, ${colors.amber400}, ${colors.orange500}, ${colors.rose500})`,
                  borderRadius: '12px',
                  filter: 'blur(12px)',
                  opacity: 0.4,
                }}
              />
            </div>
            <span style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 700, fontSize: '18px', letterSpacing: '0.1em' }}>AFAC</span>
          </motion.div>

          <motion.button
            onClick={onGetStarted}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="header-signin-button"
            style={{
              padding: '10px 20px',
              backgroundColor: 'rgba(255,255,255,0.08)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.9)',
              borderRadius: '9999px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.3s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.12)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'}
          >
            Sign In
          </motion.button>
        </div>
      </motion.header>

      {/* Hero Section - Split Layout */}
      <section
        style={{
          position: 'relative',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 24px',
          paddingTop: '120px',
          paddingBottom: '80px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '64px',
            maxWidth: '1200px',
            width: '100%',
            margin: '0 auto',
            flexWrap: 'wrap',
          }}
        >
          {/* Left side - Content */}
          <motion.div
            style={{
              transform: `translate(${mousePosition.x * -10}px, ${mousePosition.y * -10}px)`,
              position: 'relative',
              zIndex: 10,
              textAlign: 'left',
              flex: '1 1 480px',
              maxWidth: '560px',
            }}
          >
            {/* Animated sparkle badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                marginBottom: '32px',
                backgroundColor: 'rgba(255,255,255,0.05)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '9999px',
              }}
            >
              <Sparkles style={{ width: '16px', height: '16px', color: colors.amber400 }} />
              <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '15px', letterSpacing: '0.02em' }}>Real-time auction intelligence</span>
            </motion.div>

            {/* Main headline with gradient */}
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
              style={{
                fontWeight: 700,
                letterSpacing: '-0.025em',
                marginBottom: '24px',
                lineHeight: 1.1,
              }}
            >
              <span style={{ display: 'block', color: 'white', fontSize: 'clamp(1.5rem, 3.6vw, 2.7rem)' }}>Win Your</span>
              <span
                style={{
                  display: 'block',
                  fontSize: 'clamp(2.5rem, 6vw, 4.5rem)',
                  background: `linear-gradient(90deg, ${colors.amber400}, ${colors.orange400}, ${colors.rose400})`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                Fantasy Draft
              </span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              style={{
                fontSize: 'clamp(1rem, 2vw, 1.25rem)',
                color: 'rgba(255,255,255,0.5)',
                maxWidth: '520px',
                marginBottom: '16px',
                lineHeight: 1.625,
              }}
            >
              Auction projection calculator that builds custom values and tracks inflation live from your draft room.
            </motion.p>

            {/* Creator credit */}
            <motion.a
              href="https://x.com/afinewineco"
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              whileHover={{ scale: 1.02 }}
              style={{
                display: 'inline-block',
                color: 'rgba(255,255,255,0.5)',
                fontSize: '14px',
                marginBottom: '40px',
                textDecoration: 'none',
                transition: 'color 0.3s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = `${colors.amber400}b3`}
              onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}
            >
              by Dylan Merlo
            </motion.a>

            {/* CTA Buttons - now horizontal with ghost button */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.7 }}
              style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}
            >
              {/* Primary CTA */}
              <motion.button
                onClick={onGetStarted}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="cta-button-primary"
                style={{
                  position: 'relative',
                  padding: '16px 32px',
                  background: `linear-gradient(90deg, ${colors.amber500}, ${colors.orange500}, ${colors.rose500})`,
                  color: 'white',
                  fontSize: '18px',
                  fontWeight: 600,
                  borderRadius: '16px',
                  border: 'none',
                  boxShadow: `0 20px 40px ${colors.orange500}33`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  overflow: 'hidden',
                  cursor: 'pointer',
                }}
              >
                <span style={{ position: 'relative', zIndex: 10 }}>Add Your League</span>
                <ArrowRight style={{ width: '20px', height: '20px', position: 'relative', zIndex: 10 }} />
              </motion.button>

              {/* Secondary Ghost CTA - Watch Demo */}
              <motion.button
                onClick={() => {
                  // Scroll to features section or open demo modal
                  const featuresSection = document.querySelector('section:nth-of-type(2)');
                  if (featuresSection) {
                    featuresSection.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
                whileHover={{ scale: 1.02, backgroundColor: 'rgba(255,255,255,0.08)' }}
                whileTap={{ scale: 0.98 }}
                className="cta-button-secondary"
                style={{
                  padding: '16px 28px',
                  background: 'transparent',
                  color: 'rgba(255,255,255,0.9)',
                  fontSize: '18px',
                  fontWeight: 500,
                  borderRadius: '16px',
                  border: '1px solid rgba(255,255,255,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                }}
              >
                <Play style={{ width: '18px', height: '18px', fill: 'currentColor' }} />
                <span>See It In Action</span>
              </motion.button>
            </motion.div>

            {/* Trust indicators */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.9 }}
              style={{
                marginTop: '48px',
                display: 'flex',
                alignItems: 'center',
                gap: '24px',
                color: 'rgba(255,255,255,0.5)',
                fontSize: '14px',
                flexWrap: 'wrap',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Shield style={{ width: '16px', height: '16px', opacity: 0.7 }} />
                No credit card
              </span>
              <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.3)' }} />
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <RefreshCw style={{ width: '16px', height: '16px', opacity: 0.7 }} />
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  Couch Managers
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px',
                    padding: '2px 6px',
                    backgroundColor: 'rgba(251, 191, 36, 0.15)',
                    border: `1px solid ${colors.amber400}33`,
                    borderRadius: '4px',
                    fontSize: '10px',
                    fontWeight: 600,
                    color: colors.amber400,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}>
                    <Zap style={{ width: '10px', height: '10px' }} />
                    Live Sync
                  </span>
                </span>
              </span>
              <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.3)' }} />
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Cloud style={{ width: '16px', height: '16px', opacity: 0.7 }} />
                Save to cloud
              </span>
            </motion.div>
          </motion.div>

          {/* Right side - Dashboard Mockup */}
          <div
            style={{
              flex: '1 1 400px',
              maxWidth: '520px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}
            className="hero-mockup"
          >
            <DashboardMockup />
          </div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          style={{ position: 'absolute', bottom: '32px', left: '50%', transform: 'translateX(-50%)' }}
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            style={{
              width: '24px',
              height: '40px',
              border: '2px solid rgba(255,255,255,0.2)',
              borderRadius: '9999px',
              display: 'flex',
              justifyContent: 'center',
              paddingTop: '8px',
            }}
          >
            <div style={{ width: '6px', height: '6px', backgroundColor: 'rgba(255,255,255,0.4)', borderRadius: '50%' }} />
          </motion.div>
        </motion.div>
      </section>

      {/* Features Section - Simplified */}
      <motion.section
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.8 }}
        style={{ position: 'relative', padding: '128px 24px' }}
      >
        <div style={{ maxWidth: '1024px', margin: '0 auto' }}>
          {/* Section header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            style={{ textAlign: 'center', marginBottom: '80px' }}
          >
            <h2 style={{ fontSize: 'clamp(1.875rem, 5vw, 3rem)', fontWeight: 700, color: 'white', marginBottom: '16px' }}>
              How It Works
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '18px', maxWidth: '576px', margin: '0 auto' }}>
              Three steps to auction domination. No spreadsheets required.
            </p>
          </motion.div>

          {/* Steps */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '48px', alignItems: 'start' }}>
            {[
              {
                step: "01",
                title: "Import Your League",
                description: "ESPN, Yahoo, or manual entry in 60 seconds. Your settings, your way.",
                gradient: `linear-gradient(90deg, ${colors.amber500}, ${colors.orange500})`,
                Icon: Settings
              },
              {
                step: "02",
                title: "See Live Values",
                description: "Player values update in real-time as your auction unfolds. Never miss a bargain.",
                gradient: `linear-gradient(90deg, ${colors.orange500}, ${colors.rose500})`,
                Icon: Link
              },
              {
                step: "03",
                title: "Make Smart Bids",
                description: "Green light means bid. Red light means pass. Winning is that simple.",
                gradient: `linear-gradient(90deg, ${colors.rose500}, ${colors.fuchsia500})`,
                Icon: Trophy
              }
            ].map((item, index, arr) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="feature-card"
                style={{ position: 'relative' }}
              >
                {/* Flow arrow between cards - visible only on larger screens */}
                {index < arr.length - 1 && (
                  <div
                    className="feature-flow-arrow"
                    style={{
                      position: 'absolute',
                      right: '-36px',
                      top: '24px',
                      zIndex: 10,
                    }}
                  >
                    <ChevronRight
                      style={{
                        width: '24px',
                        height: '24px',
                        color: 'rgba(255,255,255,0.25)',
                      }}
                    />
                  </div>
                )}
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    background: item.gradient,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '16px',
                    boxShadow: `0 8px 24px rgba(0,0,0,0.3)`,
                  }}
                >
                  <item.Icon style={{ width: '24px', height: '24px', color: 'white' }} />
                </div>
                <div
                  style={{
                    fontSize: '112px',
                    fontWeight: 700,
                    background: item.gradient,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    opacity: 0.2,
                    lineHeight: 1,
                  }}
                >
                  {item.step}
                </div>
                <h3 style={{ fontSize: '20px', fontWeight: 600, color: 'white', marginTop: '16px', marginBottom: '12px' }}>{item.title}</h3>
                <p style={{ color: 'rgba(255,255,255,0.4)', lineHeight: 1.625 }}>{item.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* Stats Section */}
      <motion.section
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.8 }}
        style={{ position: 'relative', padding: '96px 24px' }}
      >
        <div style={{ maxWidth: '896px', margin: '0 auto' }}>
          <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '32px' }}>
            {[
              { value: 2, suffix: "min", label: "Live sync" },
              { value: 100, suffix: "%", label: "Free forever" },
              { value: 10, suffix: "+", label: "Scoring formats" }
            ].map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                style={{ textAlign: 'center' }}
              >
                <div style={{ fontSize: 'clamp(2.25rem, 6vw, 3.75rem)', fontWeight: 700, color: 'white', marginBottom: '8px' }}>
                  <AnimatedCounter value={stat.value} />
                  <span style={{ color: 'rgba(255,255,255,0.4)' }}>{stat.suffix}</span>
                </div>
                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* Final CTA Section */}
      <motion.section
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
        style={{ position: 'relative', padding: '128px 24px' }}
      >
        <div style={{ maxWidth: '672px', margin: '0 auto', textAlign: 'center' }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 style={{ fontSize: 'clamp(1.875rem, 5vw, 3rem)', fontWeight: 700, color: 'white', marginBottom: '24px' }}>
              Ready to draft smarter?
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '18px', marginBottom: '16px' }}>
              Build projected auction values and track inflation live as your draft unfolds.
            </p>
            <p style={{
              color: colors.amber400,
              fontSize: '14px',
              marginBottom: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}>
              <Zap style={{ width: '14px', height: '14px' }} />
              2025 draft season is here - get your edge now
            </p>

            <motion.button
              onClick={onGetStarted}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="final-cta-button"
              style={{
                position: 'relative',
                padding: '20px 40px',
                background: `linear-gradient(90deg, ${colors.amber500}, ${colors.orange500}, ${colors.rose500})`,
                color: 'white',
                fontSize: '18px',
                fontWeight: 600,
                borderRadius: '16px',
                border: 'none',
                boxShadow: `0 25px 50px ${colors.orange500}4d`,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '12px',
                overflow: 'hidden',
                cursor: 'pointer',
              }}
            >
              <span style={{ position: 'relative', zIndex: 10 }}>Get Started Free</span>
              <ArrowRight style={{ width: '20px', height: '20px', position: 'relative', zIndex: 10 }} />
            </motion.button>
          </motion.div>
        </div>
      </motion.section>

      {/* Footer */}
      <footer style={{ position: 'relative', padding: '32px 24px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ maxWidth: '1152px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                background: `linear-gradient(135deg, ${colors.amber400}, ${colors.orange500}, ${colors.rose500})`,
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <DollarSign style={{ width: '16px', height: '16px', color: 'white' }} />
            </div>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>A Fine Auction Calculator</span>
          </div>
          <a
            href="https://x.com/afinewineco"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: 'rgba(255,255,255,0.3)',
              fontSize: '14px',
              textDecoration: 'none',
              transition: 'color 0.3s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = `${colors.amber400}b3`}
            onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.3)'}
          >
            by Dylan Merlo
          </a>
        </div>
      </footer>
    </div>
  );
}
