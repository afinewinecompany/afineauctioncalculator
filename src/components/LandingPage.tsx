import { motion, useScroll, useTransform } from 'framer-motion';
import { DollarSign, TrendingUp, Users, BarChart3, Target, LineChart, ChevronDown, LogIn, Zap, Play, RefreshCw, Palette, Calculator } from 'lucide-react';
import { useRef } from 'react';

interface LandingPageProps {
  onGetStarted: () => void;
}

export function LandingPage({ onGetStarted }: LandingPageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  // Parallax transforms for hero elements
  const heroY = useTransform(scrollYProgress, [0, 0.3], [0, -100]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);

  // Animation variants
  const fadeInUp = {
    hidden: { opacity: 0, y: 40 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }
    }
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  };

  const scaleIn = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { type: "spring" as const, stiffness: 100, damping: 15 }
    }
  };

  return (
    <div ref={containerRef} className="min-h-screen bg-[#0a0f1a] overflow-hidden">
      {/* Gradient background overlay */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-gradient-to-r from-violet-600/10 to-fuchsia-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-gradient-to-r from-cyan-600/10 to-blue-600/10 rounded-full blur-3xl" />
      </div>

      {/* Fixed Header with Login Button */}
      <motion.header
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.6, ease: "easeOut" }}
        className="fixed top-0 left-0 right-0 z-50 px-6 py-4"
      >
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-fuchsia-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-500/25">
              <DollarSign className="w-5 h-5 text-white" />
            </div>
            <span className="text-white/90 font-semibold hidden sm:block">AFAC</span>
          </div>
          <motion.button
            onClick={onGetStarted}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-2 px-5 py-2.5 bg-white/5 hover:bg-white/10 backdrop-blur-sm border border-white/10 text-white rounded-full text-sm font-medium transition-all"
          >
            <LogIn className="w-4 h-4" />
            <span>Login</span>
          </motion.button>
        </div>
      </motion.header>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center px-4">
        <motion.div
          style={{ y: heroY, opacity: heroOpacity }}
          className="relative z-10 text-center max-w-4xl mx-auto pt-20"
        >
          {/* Logo */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.2 }}
            className="flex items-center justify-center mb-8"
          >
            <div className="w-20 h-20 bg-gradient-to-br from-violet-500 via-fuchsia-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-2xl shadow-violet-500/30 rotate-3">
              <DollarSign className="w-10 h-10 text-white" />
            </div>
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="text-5xl md:text-7xl font-bold mb-4"
          >
            <span className="bg-gradient-to-r from-white via-violet-200 to-white bg-clip-text text-transparent">
              A Fine Auction Calculator
            </span>
          </motion.h1>

          <motion.a
            href="https://x.com/afinewineco"
            target="_blank"
            rel="noopener noreferrer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            whileHover={{ scale: 1.05 }}
            className="inline-block text-slate-400 hover:text-violet-400 italic text-lg mb-8 transition-colors"
          >
            by Dylan Merlo
          </motion.a>

          {/* Tagline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.6 }}
            className="text-xl md:text-2xl text-slate-300 mb-6 max-w-2xl mx-auto leading-relaxed"
          >
            The only fantasy baseball auction tool with{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-violet-400 font-semibold">
              real-time inflation tracking
            </span>
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.6 }}
            className="text-lg text-slate-400 mb-10 max-w-xl mx-auto"
          >
            Syncs with Couch Managers to adjust player values live as your draft unfolds.
            Stop guessing. Start winning.
          </motion.p>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9, duration: 0.6 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <motion.button
              onClick={onGetStarted}
              whileHover={{ scale: 1.03, boxShadow: "0 20px 40px rgba(139, 92, 246, 0.3)" }}
              whileTap={{ scale: 0.97 }}
              className="group px-8 py-4 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white text-lg font-semibold rounded-2xl shadow-xl shadow-violet-500/25 flex items-center gap-3"
            >
              <Play className="w-5 h-5 group-hover:scale-110 transition-transform" />
              Start Your Draft
            </motion.button>
            <p className="text-slate-500 text-sm">Free to use • No credit card</p>
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="flex flex-col items-center text-slate-500"
          >
            <span className="text-xs mb-2">Learn more</span>
            <ChevronDown className="w-5 h-5" />
          </motion.div>
        </motion.div>
      </section>

      {/* What It Does Section */}
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
              What is{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400">
                A Fine Auction Calculator
              </span>
              ?
            </h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              A real-time auction draft companion that calculates player values based on your league settings
              and adjusts them as your draft progresses
            </p>
          </motion.div>

          {/* Core Features Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Calculator,
                title: "Custom Value Calculations",
                description: "Enter your league's exact settings—teams, budget, roster spots, scoring categories—and get player values tailored specifically to your league.",
                gradient: "from-violet-500 to-purple-600"
              },
              {
                icon: RefreshCw,
                title: "Live Couch Managers Sync",
                description: "Connect to your Couch Managers draft room and watch values automatically update every 2 minutes as players are drafted.",
                gradient: "from-cyan-500 to-blue-600"
              },
              {
                icon: TrendingUp,
                title: "Real-Time Inflation Tracking",
                description: "See exactly how inflation is affecting each price tier. Elite players often deflate while $1-5 players can inflate 1000%+.",
                gradient: "from-fuchsia-500 to-pink-600"
              },
              {
                icon: Palette,
                title: "Color-Coded Value Alerts",
                description: "Instantly know if a player is a steal (green), fair value (yellow), or overpay (red) based on current inflation-adjusted prices.",
                gradient: "from-emerald-500 to-teal-600"
              },
              {
                icon: Target,
                title: "Positional Scarcity Alerts",
                description: "Get warned when catcher, closer, or other thin positions are running low so you don't get stuck paying premium prices.",
                gradient: "from-orange-500 to-amber-600"
              },
              {
                icon: LineChart,
                title: "Post-Draft Analysis",
                description: "After your draft, see your best picks, biggest reaches, and total value gained or lost compared to projections.",
                gradient: "from-rose-500 to-red-600"
              }
            ].map((feature, i) => (
              <motion.div
                key={feature.title}
                variants={scaleIn}
                whileHover={{ y: -6, transition: { duration: 0.2 } }}
                className="group relative bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-6 hover:border-slate-700 transition-all"
              >
                <div className={`w-12 h-12 bg-gradient-to-br ${feature.gradient} rounded-xl flex items-center justify-center mb-5 shadow-lg group-hover:scale-110 transition-transform`}>
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">{feature.title}</h3>
                <p className="text-slate-400 leading-relaxed">{feature.description}</p>
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
        className="relative py-24 px-4 bg-gradient-to-b from-slate-900/50 to-transparent"
      >
        <div className="max-w-5xl mx-auto">
          <motion.div variants={fadeInUp} className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
              How It Works
            </h2>
            <p className="text-slate-400 text-lg">Three simple steps to draft domination</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Configure Your League",
                description: "Set your number of teams, auction budget, roster positions, and scoring categories. Takes about 30 seconds."
              },
              {
                step: "02",
                title: "Connect Your Draft",
                description: "Paste your Couch Managers room ID. We'll automatically pull draft results every 2 minutes."
              },
              {
                step: "03",
                title: "Draft With Confidence",
                description: "Watch values adjust in real-time. Green means bid, red means let it go. It's that simple."
              }
            ].map((item, index) => (
              <motion.div
                key={item.step}
                variants={fadeInUp}
                className="relative text-center"
              >
                {index < 2 && (
                  <div className="hidden md:block absolute top-12 left-[60%] w-[80%] h-0.5 bg-gradient-to-r from-violet-600/50 to-transparent" />
                )}
                <motion.div
                  whileHover={{ scale: 1.1, rotate: 3 }}
                  className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-violet-600 to-fuchsia-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-xl shadow-violet-500/25"
                >
                  {item.step}
                </motion.div>
                <h3 className="text-xl font-semibold text-white mb-3">{item.title}</h3>
                <p className="text-slate-400">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* Projection Systems */}
      <motion.section
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        variants={staggerContainer}
        className="relative py-24 px-4"
      >
        <div className="max-w-5xl mx-auto">
          <motion.div variants={fadeInUp} className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Powered by Pro Projections
            </h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              Choose from industry-leading projection systems, calculated for your exact league format
            </p>
          </motion.div>

          <motion.div variants={fadeInUp} className="flex flex-wrap justify-center gap-4">
            {[
              { name: "Steamer", desc: "Most popular" },
              { name: "THE BAT X", desc: "Hybrid approach" },
              { name: "Harry Knows Ball", desc: "Dynasty rankings" }
            ].map((proj) => (
              <div
                key={proj.name}
                className="px-6 py-4 bg-slate-900/50 border border-slate-800 rounded-xl text-center"
              >
                <div className="text-white font-semibold mb-1">{proj.name}</div>
                <div className="text-slate-500 text-sm">{proj.desc}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </motion.section>

      {/* CTA Section */}
      <motion.section
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={staggerContainer}
        className="relative py-24 px-4"
      >
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            variants={scaleIn}
            className="relative bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700/50 rounded-3xl p-8 md:p-12 overflow-hidden"
          >
            {/* Background gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-violet-600/10 via-transparent to-fuchsia-600/10" />

            <div className="relative">
              <motion.div
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-violet-500 to-fuchsia-600 rounded-2xl flex items-center justify-center shadow-xl shadow-violet-500/30"
              >
                <DollarSign className="w-8 h-8 text-white" />
              </motion.div>

              <h2 className="text-2xl md:text-4xl font-bold text-white mb-4">
                Ready to Win Your Draft?
              </h2>
              <p className="text-slate-400 mb-8 max-w-lg mx-auto">
                Join thousands of fantasy owners using real-time data to make smarter auction decisions.
              </p>

              <motion.button
                onClick={onGetStarted}
                whileHover={{ scale: 1.03, boxShadow: "0 25px 50px rgba(139, 92, 246, 0.3)" }}
                whileTap={{ scale: 0.97 }}
                className="px-10 py-4 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white text-lg font-semibold rounded-2xl shadow-xl shadow-violet-500/25 inline-flex items-center gap-3"
              >
                <Zap className="w-5 h-5" />
                Get Started Free
              </motion.button>

              <p className="mt-6 text-slate-500 text-sm">
                No credit card required • Save drafts to cloud
              </p>
            </div>
          </motion.div>
        </div>
      </motion.section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-slate-800/50">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center text-slate-500 text-sm">
          <div className="flex items-center gap-3 mb-4 md:mb-0">
            <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-fuchsia-600 rounded-lg flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-white" />
            </div>
            <span className="text-slate-400">A Fine Auction Calculator</span>
          </div>
          <a
            href="https://x.com/afinewineco"
            target="_blank"
            rel="noopener noreferrer"
            className="italic hover:text-violet-400 transition-colors"
          >
            by Dylan Merlo
          </a>
        </div>
      </footer>
    </div>
  );
}
