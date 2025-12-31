import { motion, useScroll, useTransform, useMotionValue, useSpring, AnimatePresence } from 'framer-motion';
import { DollarSign, TrendingUp, TrendingDown, Users, BarChart3, Target, LineChart, ChevronDown, LogIn, Zap, Play, ArrowRight, Sparkles, Activity, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useRef, useState, useEffect } from 'react';

interface LandingPageProps {
  onGetStarted: () => void;
}

// Animated counter component
function AnimatedCounter({ value, suffix = '', prefix = '' }: { value: number; suffix?: string; prefix?: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const duration = 2000;
    const steps = 60;
    const increment = value / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setCount(value);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [value]);

  return <span>{prefix}{count}{suffix}</span>;
}

// Live inflation ticker simulation
function InflationTicker() {
  const [inflation, setInflation] = useState(18.4);
  const [direction, setDirection] = useState<'up' | 'down'>('up');

  useEffect(() => {
    const interval = setInterval(() => {
      setInflation(prev => {
        const change = (Math.random() - 0.45) * 2;
        const newVal = Math.max(5, Math.min(35, prev + change));
        setDirection(change > 0 ? 'up' : 'down');
        return Math.round(newVal * 10) / 10;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-2">
      <span className="text-4xl md:text-5xl font-bold text-white tabular-nums">
        {inflation.toFixed(1)}%
      </span>
      <motion.div
        key={direction}
        initial={{ y: direction === 'up' ? 10 : -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className={direction === 'up' ? 'text-red-400' : 'text-emerald-400'}
      >
        {direction === 'up' ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
      </motion.div>
    </div>
  );
}

// Floating particle effect
function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(20)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 bg-emerald-500/30 rounded-full"
          initial={{
            x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1000),
            y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 800),
          }}
          animate={{
            y: [null, -20, 20, -10, 0],
            opacity: [0.2, 0.5, 0.3, 0.6, 0.2],
          }}
          transition={{
            duration: 5 + Math.random() * 5,
            repeat: Infinity,
            delay: Math.random() * 2,
          }}
        />
      ))}
    </div>
  );
}

// Mock draft board preview
function DraftBoardPreview() {
  const players = [
    { name: 'Shohei Ohtani', pos: 'DH', proj: 52, actual: 48, status: 'steal' },
    { name: 'Ronald Acuña Jr.', pos: 'OF', proj: 45, actual: 44, status: 'fair' },
    { name: 'Mookie Betts', pos: 'SS', proj: 38, actual: 42, status: 'overpay' },
    { name: 'Corey Seager', pos: 'SS', proj: 28, actual: 26, status: 'steal' },
    { name: 'Gunnar Henderson', pos: '3B', proj: 32, actual: 35, status: 'overpay' },
  ];

  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex(prev => (prev + 1) % players.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-4 w-full max-w-md">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-slate-400 uppercase tracking-wider">Live Draft</span>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          <span className="text-xs text-emerald-400">Connected</span>
        </div>
      </div>

      <div className="space-y-2">
        {players.map((player, i) => (
          <motion.div
            key={player.name}
            initial={false}
            animate={{
              backgroundColor: i === activeIndex ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
              borderColor: i === activeIndex ? 'rgba(16, 185, 129, 0.3)' : 'rgba(71, 85, 105, 0.3)',
            }}
            className="flex items-center justify-between p-2 rounded-lg border transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500 w-6">{player.pos}</span>
              <span className="text-sm text-white font-medium">{player.name}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-xs text-slate-500">Proj</div>
                <div className="text-sm text-slate-300">${player.proj}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-500">Actual</div>
                <div className={`text-sm font-semibold ${
                  player.status === 'steal' ? 'text-emerald-400' :
                  player.status === 'overpay' ? 'text-red-400' : 'text-yellow-400'
                }`}>
                  ${player.actual}
                </div>
              </div>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                player.status === 'steal' ? 'bg-emerald-500/20' :
                player.status === 'overpay' ? 'bg-red-500/20' : 'bg-yellow-500/20'
              }`}>
                {player.status === 'steal' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> :
                 player.status === 'overpay' ? <AlertTriangle className="w-3.5 h-3.5 text-red-400" /> :
                 <Activity className="w-3.5 h-3.5 text-yellow-400" />}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export function LandingPage({ onGetStarted }: LandingPageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  // Smooth spring-based scroll progress
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });

  // Parallax transforms
  const heroY = useTransform(smoothProgress, [0, 0.3], [0, -150]);
  const heroOpacity = useTransform(smoothProgress, [0, 0.15], [1, 0]);
  const heroScale = useTransform(smoothProgress, [0, 0.3], [1, 0.9]);

  // Mouse parallax for hero
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springX = useSpring(mouseX, { stiffness: 50, damping: 20 });
  const springY = useSpring(mouseY, { stiffness: 50, damping: 20 });

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    mouseX.set((e.clientX - centerX) / 50);
    mouseY.set((e.clientY - centerY) / 50);
  };

  // Animation variants
  const fadeInUp = {
    hidden: { opacity: 0, y: 60 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }
    }
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.12,
        delayChildren: 0.1
      }
    }
  };

  const scaleIn = {
    hidden: { opacity: 0, scale: 0.8, y: 20 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: { type: "spring" as const, stiffness: 100, damping: 15 }
    }
  };

  const slideInLeft = {
    hidden: { opacity: 0, x: -60 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }
    }
  };

  const slideInRight = {
    hidden: { opacity: 0, x: 60 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }
    }
  };

  return (
    <div ref={containerRef} className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 overflow-hidden">
      <FloatingParticles />

      {/* Fixed Header */}
      <motion.header
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.6, ease: "easeOut" }}
        className="fixed top-0 left-0 right-0 z-50 px-6 py-4"
      >
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <motion.div
              whileHover={{ rotate: 360 }}
              transition={{ duration: 0.6 }}
              className="w-10 h-10 bg-gradient-to-br from-red-600 to-red-800 rounded-xl flex items-center justify-center shadow-lg shadow-red-500/30"
            >
              <DollarSign className="w-5 h-5 text-white" />
            </motion.div>
            <div className="hidden sm:block">
              <div className="text-white font-semibold text-sm">AFAC</div>
              <div className="text-slate-400 text-xs">Auction Calculator</div>
            </div>
          </div>
          <motion.button
            onClick={onGetStarted}
            whileHover={{ scale: 1.05, backgroundColor: 'rgba(255,255,255,0.2)' }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-2 px-5 py-2.5 bg-white/10 backdrop-blur-sm border border-white/20 text-white rounded-full text-sm font-medium transition-all"
          >
            <LogIn className="w-4 h-4" />
            <span>Sign In</span>
          </motion.button>
        </div>
      </motion.header>

      {/* Hero Section */}
      <section
        className="relative min-h-screen flex items-center justify-center pt-20"
        onMouseMove={handleMouseMove}
      >
        {/* Animated gradient orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            style={{ x: springX, y: springY }}
            className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 rounded-full blur-3xl"
          />
          <motion.div
            style={{ x: useTransform(springX, v => -v * 1.5), y: useTransform(springY, v => -v * 1.5) }}
            className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-gradient-to-r from-red-500/20 to-orange-500/20 rounded-full blur-3xl"
          />
        </div>

        <motion.div
          style={{ y: heroY, opacity: heroOpacity, scale: heroScale }}
          className="relative z-10 w-full max-w-7xl mx-auto px-4"
        >
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Content */}
            <div className="text-center lg:text-left">
              {/* Badge */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full mb-6"
              >
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-400 text-sm font-medium">2025 Season Ready</span>
              </motion.div>

              {/* Title */}
              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.8 }}
                className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-4 leading-[1.1]"
              >
                <span className="bg-gradient-to-r from-white via-slate-200 to-white bg-clip-text text-transparent">
                  A Fine Auction
                </span>
                <br />
                <span className="bg-gradient-to-r from-emerald-400 via-emerald-300 to-cyan-400 bg-clip-text text-transparent">
                  Calculator
                </span>
              </motion.h1>

              <motion.a
                href="https://x.com/afinewineco"
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                whileHover={{ scale: 1.02 }}
                className="inline-block text-slate-400 hover:text-emerald-400 italic text-base mb-6 transition-colors"
              >
                by Dylan Merlo
              </motion.a>

              {/* Value prop */}
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.6 }}
                className="text-lg md:text-xl text-slate-300 mb-8 max-w-xl mx-auto lg:mx-0"
              >
                Know exactly what every player is worth—
                <span className="text-white font-semibold"> as the draft happens</span>.
                Real-time inflation tracking synced with Couch Managers.
              </motion.p>

              {/* CTA Buttons */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start"
              >
                <motion.button
                  onClick={onGetStarted}
                  whileHover={{ scale: 1.03, boxShadow: "0 20px 40px rgba(239, 68, 68, 0.3)" }}
                  whileTap={{ scale: 0.97 }}
                  className="group relative px-8 py-4 bg-gradient-to-r from-red-600 via-red-600 to-red-700 text-white text-lg font-semibold rounded-2xl shadow-xl shadow-red-500/25 flex items-center gap-3 overflow-hidden"
                >
                  <span className="relative z-10 flex items-center gap-3">
                    <Play className="w-5 h-5" />
                    Start Free Draft
                  </span>
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-red-500 to-orange-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  />
                </motion.button>
                <span className="text-slate-500 text-sm">No credit card required</span>
              </motion.div>

              {/* Trust indicators */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
                className="flex items-center gap-6 mt-8 justify-center lg:justify-start"
              >
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 border-2 border-slate-900" />
                    ))}
                  </div>
                  <span className="text-slate-400 text-sm">500+ drafts tracked</span>
                </div>
              </motion.div>
            </div>

            {/* Right: Product Preview */}
            <motion.div
              initial={{ opacity: 0, x: 60, rotateY: -10 }}
              animate={{ opacity: 1, x: 0, rotateY: 0 }}
              transition={{ delay: 0.6, duration: 1, ease: "easeOut" }}
              className="hidden lg:block perspective-1000"
            >
              <motion.div
                style={{ x: useTransform(springX, v => v * 2), y: useTransform(springY, v => v * 2) }}
                className="relative"
              >
                {/* Glow effect */}
                <div className="absolute -inset-4 bg-gradient-to-r from-emerald-500/20 via-cyan-500/20 to-emerald-500/20 rounded-3xl blur-2xl" />

                {/* Main preview card */}
                <div className="relative bg-slate-900/90 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-6 shadow-2xl">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <div className="text-sm text-slate-400 mb-1">Current Inflation</div>
                      <InflationTicker />
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-slate-400 mb-1">Your Budget</div>
                      <div className="text-2xl font-bold text-white">$187</div>
                      <div className="text-xs text-slate-500">of $260 remaining</div>
                    </div>
                  </div>

                  <DraftBoardPreview />
                </div>

                {/* Floating stat cards */}
                <motion.div
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute -top-4 -right-4 bg-emerald-500/90 backdrop-blur-sm rounded-xl px-4 py-2 shadow-lg"
                >
                  <div className="text-white text-sm font-semibold">+$4 value found</div>
                </motion.div>

                <motion.div
                  animate={{ y: [0, 10, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                  className="absolute -bottom-4 -left-4 bg-slate-800/90 backdrop-blur-sm border border-slate-700 rounded-xl px-4 py-2 shadow-lg"
                >
                  <div className="text-slate-300 text-sm">SP scarcity: <span className="text-red-400 font-semibold">High</span></div>
                </motion.div>
              </motion.div>
            </motion.div>
          </div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 12, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="flex flex-col items-center text-slate-500 cursor-pointer hover:text-slate-400 transition-colors"
          >
            <span className="text-xs mb-2 uppercase tracking-wider">Explore</span>
            <ChevronDown className="w-5 h-5" />
          </motion.div>
        </motion.div>
      </section>

      {/* Trust Bar - Key Stats */}
      <motion.section
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-50px" }}
        variants={staggerContainer}
        className="relative py-12 border-y border-slate-800/50 bg-slate-900/30 backdrop-blur-sm"
      >
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { value: 6, suffix: '+', label: 'Auctions Analyzed', icon: BarChart3 },
              { value: 20, suffix: '%', label: 'Avg. Inflation Swing', prefix: '±', icon: TrendingUp },
              { value: 990, suffix: '%', label: '$1-5 Player Markup', icon: AlertTriangle },
              { value: 17, suffix: '%', label: 'Elite Player Discount', icon: Target },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                variants={fadeInUp}
                className="text-center"
              >
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-slate-800/50 mb-3">
                  <stat.icon className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="text-2xl md:text-3xl font-bold text-white mb-1">
                  <AnimatedCounter value={stat.value} suffix={stat.suffix} prefix={stat.prefix} />
                </div>
                <div className="text-sm text-slate-400">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* Problem/Solution Section */}
      <motion.section
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        variants={staggerContainer}
        className="relative py-24 px-4"
      >
        <div className="max-w-6xl mx-auto">
          <motion.div variants={fadeInUp} className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
              The Auction Draft Problem
            </h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              Static dollar values become worthless the moment your draft starts
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Without AFAC */}
            <motion.div
              variants={slideInLeft}
              className="relative group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-transparent rounded-3xl" />
              <div className="relative bg-slate-900/50 backdrop-blur-sm border border-red-500/20 rounded-3xl p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-red-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-white">Without AFAC</h3>
                </div>
                <ul className="space-y-4">
                  {[
                    'Spreadsheet values are outdated by pick #10',
                    'No idea if $28 for Seager is good or bad',
                    'Panic bidding when your targets go early',
                    'End up with $40 for replacement-level closers',
                    'Miss value on elite players who go cheap'
                  ].map((item, i) => (
                    <motion.li
                      key={i}
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      viewport={{ once: true }}
                      className="flex items-start gap-3 text-slate-300"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-2 flex-shrink-0" />
                      {item}
                    </motion.li>
                  ))}
                </ul>
              </div>
            </motion.div>

            {/* With AFAC */}
            <motion.div
              variants={slideInRight}
              className="relative group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent rounded-3xl" />
              <div className="relative bg-slate-900/50 backdrop-blur-sm border border-emerald-500/20 rounded-3xl p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-white">With AFAC</h3>
                </div>
                <ul className="space-y-4">
                  {[
                    'Values update every 2 minutes from your draft',
                    'Color-coded: green = steal, red = overpay',
                    'Positional scarcity alerts before it\'s too late',
                    'Know when inflation makes $5 players worth $1',
                    'Identify elite bargains when others panic'
                  ].map((item, i) => (
                    <motion.li
                      key={i}
                      initial={{ opacity: 0, x: 20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      viewport={{ once: true }}
                      className="flex items-start gap-3 text-slate-300"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-2 flex-shrink-0" />
                      {item}
                    </motion.li>
                  ))}
                </ul>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.section>

      {/* Feature Showcase */}
      <motion.section
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        variants={staggerContainer}
        className="relative py-24 px-4 bg-gradient-to-b from-slate-900/50 to-transparent"
      >
        <div className="max-w-6xl mx-auto">
          <motion.div variants={fadeInUp} className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
              Built for Auction Dominance
            </h2>
            <p className="text-slate-400 text-lg">Everything you need to win your draft</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Activity,
                title: 'Live Couch Managers Sync',
                description: 'Paste your room ID and watch values update automatically as bids happen. No manual entry.',
                color: 'blue',
                highlight: '2-min sync'
              },
              {
                icon: TrendingUp,
                title: 'Tier-Weighted Inflation',
                description: 'Elite players deflate while $1-5 players see 1000%+ inflation. We track both separately.',
                color: 'emerald',
                highlight: 'Smart math'
              },
              {
                icon: Target,
                title: 'Scarcity Alerts',
                description: 'Know when catcher or closer supply is running thin before prices spike.',
                color: 'orange',
                highlight: 'Position depth'
              },
              {
                icon: BarChart3,
                title: 'Steamer & JA Projections',
                description: 'Professional projections calculated for your exact league settings and scoring.',
                color: 'purple',
                highlight: 'Custom values'
              },
              {
                icon: Users,
                title: 'Dynasty Support',
                description: 'Harry Knows Ball rankings integration for keeper and dynasty leagues.',
                color: 'pink',
                highlight: 'Long-term value'
              },
              {
                icon: LineChart,
                title: 'Post-Draft Analysis',
                description: 'See your best picks, biggest reaches, and total value gained vs. projections.',
                color: 'cyan',
                highlight: 'Full review'
              },
            ].map((feature, i) => (
              <motion.div
                key={feature.title}
                variants={scaleIn}
                whileHover={{ y: -8, transition: { duration: 0.2 } }}
                className="group relative bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 hover:border-slate-600/50 transition-all overflow-hidden"
              >
                {/* Gradient overlay on hover */}
                <div className={`absolute inset-0 bg-gradient-to-br from-${feature.color}-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity`} />

                <div className="relative">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-12 h-12 rounded-xl bg-${feature.color}-500/20 flex items-center justify-center group-hover:scale-110 transition-transform`}>
                      <feature.icon className={`w-6 h-6 text-${feature.color}-400`} />
                    </div>
                    <span className="text-xs px-2 py-1 bg-slate-800 rounded-full text-slate-400">
                      {feature.highlight}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{feature.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* How It Works */}
      <motion.section
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        variants={staggerContainer}
        className="relative py-24 px-4"
      >
        <div className="max-w-5xl mx-auto">
          <motion.div variants={fadeInUp} className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
              Ready in 60 Seconds
            </h2>
            <p className="text-slate-400 text-lg">Three steps to draft domination</p>
          </motion.div>

          <div className="relative">
            {/* Connection line */}
            <div className="hidden md:block absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent -translate-y-1/2" />

            <div className="grid md:grid-cols-3 gap-8">
              {[
                { step: '01', title: 'Configure League', desc: 'Set teams, budget, roster spots, and scoring. Takes 30 seconds.', icon: BarChart3 },
                { step: '02', title: 'Connect Draft', desc: 'Paste your Couch Managers room ID. We handle the rest.', icon: Users },
                { step: '03', title: 'Dominate', desc: 'Watch values adjust live. Green = bid. Red = let it go.', icon: Target },
              ].map((item, index) => (
                <motion.div
                  key={item.step}
                  variants={fadeInUp}
                  className="relative text-center"
                >
                  <motion.div
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    className="relative w-20 h-20 mx-auto mb-6"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-2xl rotate-6 opacity-20" />
                    <div className="relative w-full h-full bg-slate-900 border border-slate-700 rounded-2xl flex items-center justify-center">
                      <span className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                        {item.step}
                      </span>
                    </div>
                  </motion.div>
                  <h3 className="text-xl font-semibold text-white mb-2">{item.title}</h3>
                  <p className="text-slate-400 text-sm max-w-xs mx-auto">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <motion.div variants={fadeInUp} className="text-center mt-16">
            <motion.button
              onClick={onGetStarted}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="group px-8 py-4 bg-gradient-to-r from-emerald-600 to-cyan-600 text-white text-lg font-semibold rounded-2xl shadow-xl shadow-emerald-500/25 inline-flex items-center gap-3"
            >
              <Zap className="w-5 h-5" />
              Get Started Free
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </motion.button>
          </motion.div>
        </div>
      </motion.section>

      {/* Final CTA */}
      <motion.section
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={staggerContainer}
        className="relative py-24 px-4"
      >
        <div className="max-w-4xl mx-auto">
          <motion.div
            variants={scaleIn}
            className="relative overflow-hidden"
          >
            {/* Background effects */}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 rounded-3xl" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-500/10 via-transparent to-transparent" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-red-500/10 via-transparent to-transparent" />

            <div className="relative border border-slate-700/50 rounded-3xl p-8 md:p-12 text-center">
              <motion.div
                animate={{
                  rotate: [0, 5, -5, 0],
                  scale: [1, 1.05, 1]
                }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="w-20 h-20 mx-auto mb-8 bg-gradient-to-br from-red-600 to-red-800 rounded-2xl flex items-center justify-center shadow-2xl shadow-red-500/30"
              >
                <DollarSign className="w-10 h-10 text-white" />
              </motion.div>

              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Draft Season is Coming
              </h2>
              <p className="text-slate-400 text-lg mb-8 max-w-xl mx-auto">
                Don't walk into your auction with a static spreadsheet.
                Get real-time intelligence that updates as the draft unfolds.
              </p>

              <motion.button
                onClick={onGetStarted}
                whileHover={{ scale: 1.03, boxShadow: "0 25px 50px rgba(239, 68, 68, 0.3)" }}
                whileTap={{ scale: 0.97 }}
                className="px-10 py-4 bg-gradient-to-r from-red-600 via-red-600 to-red-700 text-white text-lg font-semibold rounded-2xl shadow-2xl shadow-red-500/30 inline-flex items-center gap-3"
              >
                <Play className="w-5 h-5" />
                Create Free Account
              </motion.button>

              <p className="mt-6 text-slate-500 text-sm">
                Free forever • No credit card • Drafts saved to cloud
              </p>
            </div>
          </motion.div>
        </div>
      </motion.section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-slate-800/50">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center text-slate-500 text-sm">
          <div className="flex items-center gap-3 mb-4 md:mb-0">
            <div className="w-8 h-8 bg-gradient-to-br from-red-600 to-red-800 rounded-lg flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-white" />
            </div>
            <span className="text-slate-400">A Fine Auction Calculator</span>
          </div>
          <a
            href="https://x.com/afinewineco"
            target="_blank"
            rel="noopener noreferrer"
            className="italic hover:text-emerald-400 transition-colors"
          >
            by Dylan Merlo
          </a>
        </div>
      </footer>
    </div>
  );
}
