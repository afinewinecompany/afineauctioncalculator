import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { DollarSign, ArrowRight, Sparkles } from 'lucide-react';
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

// Floating orb component
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
            <span style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 600, letterSpacing: '-0.025em' }}>AFAC</span>
          </motion.div>

          <motion.button
            onClick={onGetStarted}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
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

      {/* Hero Section */}
      <section style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
        <motion.div
          style={{
            transform: `translate(${mousePosition.x * -10}px, ${mousePosition.y * -10}px)`,
            position: 'relative',
            zIndex: 10,
            textAlign: 'center',
            maxWidth: '896px',
            margin: '0 auto',
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
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px' }}>Real-time auction intelligence</span>
          </motion.div>

          {/* Main headline with gradient */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            style={{
              fontSize: 'clamp(3rem, 8vw, 6rem)',
              fontWeight: 700,
              letterSpacing: '-0.025em',
              marginBottom: '24px',
              lineHeight: 1.1,
            }}
          >
            <span style={{ display: 'block', color: 'white' }}>Win Your</span>
            <span
              style={{
                display: 'block',
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
              fontSize: 'clamp(1.125rem, 2vw, 1.25rem)',
              color: 'rgba(255,255,255,0.5)',
              maxWidth: '576px',
              margin: '0 auto 16px',
              lineHeight: 1.625,
            }}
          >
            Live inflation tracking that syncs with your auction.
            Know exactly what every player is worth as your draft unfolds.
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
              color: 'rgba(255,255,255,0.3)',
              fontSize: '14px',
              marginBottom: '40px',
              textDecoration: 'none',
              transition: 'color 0.3s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = `${colors.amber400}b3`}
            onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.3)'}
          >
            by Dylan Merlo
          </motion.a>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}
          >
            <motion.button
              onClick={onGetStarted}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
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
              <span style={{ position: 'relative', zIndex: 10 }}>Start Free Draft</span>
              <ArrowRight style={{ width: '20px', height: '20px', position: 'relative', zIndex: 10 }} />
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
              justifyContent: 'center',
              gap: '32px',
              color: 'rgba(255,255,255,0.3)',
              fontSize: '14px',
              flexWrap: 'wrap',
            }}
          >
            <span>No credit card</span>
            <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.2)' }} />
            <span>Syncs with Couch Managers</span>
            <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.2)' }} />
            <span>Save to cloud</span>
          </motion.div>
        </motion.div>

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
              Connect, calculate, conquer. Three steps to draft domination.
            </p>
          </motion.div>

          {/* Steps */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '48px' }}>
            {[
              {
                step: "01",
                title: "Configure",
                description: "Enter your league settings - teams, budget, roster slots, and scoring categories.",
                gradient: `linear-gradient(90deg, ${colors.amber500}, ${colors.orange500})`
              },
              {
                step: "02",
                title: "Connect",
                description: "Link your Couch Managers draft room. Values update automatically as picks happen.",
                gradient: `linear-gradient(90deg, ${colors.orange500}, ${colors.rose500})`
              },
              {
                step: "03",
                title: "Dominate",
                description: "See real-time inflation. Green means bid, red means pass. Win your league.",
                gradient: `linear-gradient(90deg, ${colors.rose500}, ${colors.fuchsia500})`
              }
            ].map((item, index) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                style={{ position: 'relative' }}
              >
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '32px' }}>
            {[
              { value: 2, suffix: "min", label: "Sync interval" },
              { value: 100, suffix: "%", label: "Free to use" },
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
                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{stat.label}</div>
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
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '18px', marginBottom: '40px' }}>
              Join thousands of fantasy owners using real-time data to make better auction decisions.
            </p>

            <motion.button
              onClick={onGetStarted}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
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
