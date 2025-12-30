import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useMemo } from 'react';
import {
  Database,
  TrendingUp,
  Calculator,
  Sparkles,
  Zap,
  BarChart3,
  Target,
  Cpu
} from 'lucide-react';

interface ProjectionsLoadingScreenProps {
  isVisible: boolean;
  projectionSystem: string;
  leagueName: string;
  onLoadingComplete?: () => void;
}

// Loading stages with their progress percentages and display info
const LOADING_STAGES = [
  { id: 'connect', label: 'Connecting to projection servers', icon: Cpu, progress: 0, duration: 800 },
  { id: 'fetch', label: 'Fetching player projections', icon: Database, progress: 25, duration: 1200 },
  { id: 'analyze', label: 'Analyzing player statistics', icon: BarChart3, progress: 50, duration: 1000 },
  { id: 'calculate', label: 'Calculating auction values', icon: Calculator, progress: 75, duration: 1000 },
  { id: 'optimize', label: 'Optimizing for your league', icon: Target, progress: 90, duration: 600 },
  { id: 'finalize', label: 'Finalizing player rankings', icon: Sparkles, progress: 100, duration: 400 },
];

// Floating particle component for background
function FloatingParticle({ delay, duration, size, startX, startY }: {
  delay: number;
  duration: number;
  size: number;
  startX: number;
  startY: number;
}) {
  return (
    <motion.div
      className="absolute rounded-full"
      style={{
        width: size,
        height: size,
        left: `${startX}%`,
        top: `${startY}%`,
        background: `radial-gradient(circle, rgba(16, 185, 129, 0.6) 0%, rgba(16, 185, 129, 0) 70%)`,
      }}
      animate={{
        y: [-20, -100, -20],
        x: [0, Math.random() * 40 - 20, 0],
        opacity: [0, 0.8, 0],
        scale: [0.5, 1.2, 0.5],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    />
  );
}

// Orbital ring component
function OrbitalRing({ radius, duration, direction, children }: {
  radius: number;
  duration: number;
  direction: 1 | -1;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      className="absolute"
      style={{
        width: radius * 2,
        height: radius * 2,
        left: '50%',
        top: '50%',
        marginLeft: -radius,
        marginTop: -radius,
      }}
      animate={{ rotate: direction * 360 }}
      transition={{
        duration,
        repeat: Infinity,
        ease: "linear",
      }}
    >
      {children}
    </motion.div>
  );
}

// Baseball seam SVG path
function BaseballSeams() {
  return (
    <motion.svg
      viewBox="0 0 100 100"
      className="absolute inset-0 w-full h-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 0.15 }}
      transition={{ duration: 1 }}
    >
      {/* Left seam */}
      <motion.path
        d="M 35 10 Q 20 30 20 50 Q 20 70 35 90"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-red-500"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 2, ease: "easeInOut" }}
      />
      {/* Right seam */}
      <motion.path
        d="M 65 10 Q 80 30 80 50 Q 80 70 65 90"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-red-500"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 2, ease: "easeInOut", delay: 0.3 }}
      />
      {/* Stitch marks left */}
      {[15, 25, 35, 45, 55, 65, 75, 85].map((y, i) => (
        <motion.line
          key={`left-${i}`}
          x1={33 - Math.abs(y - 50) * 0.2}
          y1={y}
          x2={28 - Math.abs(y - 50) * 0.2}
          y2={y + 2}
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-red-500"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 + i * 0.1, duration: 0.3 }}
        />
      ))}
      {/* Stitch marks right */}
      {[15, 25, 35, 45, 55, 65, 75, 85].map((y, i) => (
        <motion.line
          key={`right-${i}`}
          x1={67 + Math.abs(y - 50) * 0.2}
          y1={y}
          x2={72 + Math.abs(y - 50) * 0.2}
          y2={y + 2}
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-red-500"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 + i * 0.1, duration: 0.3 }}
        />
      ))}
    </motion.svg>
  );
}

export function ProjectionsLoadingScreen({
  isVisible,
  projectionSystem,
  leagueName,
  onLoadingComplete
}: ProjectionsLoadingScreenProps) {
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  // Debug logging
  console.log('[ProjectionsLoadingScreen] Render - isVisible:', isVisible, 'leagueName:', leagueName);

  // Generate random particles - use stable IDs based on index
  const particles = useMemo(() =>
    Array.from({ length: 20 }, (_, i) => ({
      id: `particle-${i}`,
      delay: Math.random() * 5,
      duration: 3 + Math.random() * 4,
      size: 4 + Math.random() * 12,
      startX: Math.random() * 100,
      startY: 50 + Math.random() * 50,
    })),
  []);

  // Simulate loading stages
  useEffect(() => {
    if (!isVisible) {
      setCurrentStageIndex(0);
      setProgress(0);
      return;
    }

    let stageIndex = 0;
    let currentProgress = 0;

    const advanceStage = () => {
      if (stageIndex >= LOADING_STAGES.length - 1) {
        setProgress(100);
        return;
      }

      const stage = LOADING_STAGES[stageIndex];
      const nextStage = LOADING_STAGES[stageIndex + 1];
      const progressIncrement = (nextStage.progress - stage.progress) / (stage.duration / 50);

      const progressInterval = setInterval(() => {
        currentProgress += progressIncrement;
        if (currentProgress >= nextStage.progress) {
          currentProgress = nextStage.progress;
          clearInterval(progressInterval);
          stageIndex++;
          setCurrentStageIndex(stageIndex);
          setTimeout(advanceStage, 200);
        }
        setProgress(Math.min(currentProgress, 100));
      }, 50);
    };

    const initialDelay = setTimeout(advanceStage, 300);

    return () => clearTimeout(initialDelay);
  }, [isVisible]);

  const currentStage = LOADING_STAGES[currentStageIndex];
  const StageIcon = currentStage.icon;

  // Early return with null if not visible - AnimatePresence handles exit
  if (!isVisible) {
    console.log('[ProjectionsLoadingScreen] Not visible, returning null');
    return null;
  }

  console.log('[ProjectionsLoadingScreen] VISIBLE - rendering loading screen');

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{
        opacity: 0,
        scale: 1.1,
        filter: "blur(20px)",
      }}
      transition={{
        duration: 0.6,
        exit: { duration: 0.8, ease: "easeInOut" }
      }}
    >
          {/* Gradient background with multiple layers */}
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950" />

          {/* Animated grid pattern */}
          <motion.div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: `
                linear-gradient(rgba(16, 185, 129, 0.1) 1px, transparent 1px),
                linear-gradient(90deg, rgba(16, 185, 129, 0.1) 1px, transparent 1px)
              `,
              backgroundSize: '50px 50px',
            }}
            animate={{
              backgroundPosition: ['0px 0px', '50px 50px'],
            }}
            transition={{
              duration: 20,
              repeat: Infinity,
              ease: "linear",
            }}
          />

          {/* Radial glow effects */}
          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(16, 185, 129, 0.15) 0%, transparent 60%)',
            }}
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />

          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(239, 68, 68, 0.1) 0%, transparent 50%)',
            }}
            animate={{
              scale: [1.2, 1, 1.2],
              opacity: [0.2, 0.4, 0.2],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />

          {/* Floating particles */}
          {particles.map(particle => (
            <FloatingParticle key={particle.id} {...particle} />
          ))}

          {/* Main content container */}
          <motion.div
            className="relative z-10 flex flex-col items-center"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.8, ease: "easeOut" }}
          >
            {/* Central orb with baseball design */}
            <div className="relative w-48 h-48 mb-12">
              {/* Outer glow ring */}
              <motion.div
                className="absolute -inset-8 rounded-full"
                style={{
                  background: 'radial-gradient(circle, rgba(16, 185, 129, 0.3) 0%, transparent 70%)',
                }}
                animate={{
                  scale: [1, 1.3, 1],
                  opacity: [0.5, 0.8, 0.5],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />

              {/* Orbital rings */}
              <OrbitalRing radius={100} duration={8} direction={1}>
                <motion.div
                  className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-emerald-400 rounded-full shadow-lg shadow-emerald-400/50"
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
              </OrbitalRing>

              <OrbitalRing radius={80} duration={6} direction={-1}>
                <motion.div
                  className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-red-400 rounded-full shadow-lg shadow-red-400/50"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                />
              </OrbitalRing>

              <OrbitalRing radius={120} duration={12} direction={1}>
                <motion.div
                  className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-blue-400 rounded-full shadow-lg shadow-blue-400/50"
                  animate={{ scale: [1, 1.4, 1] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                />
              </OrbitalRing>

              {/* Main baseball orb */}
              <motion.div
                className="absolute inset-0 rounded-full bg-gradient-to-br from-slate-100 to-slate-300 shadow-2xl"
                style={{
                  boxShadow: `
                    0 0 60px rgba(16, 185, 129, 0.4),
                    inset 0 -20px 40px rgba(0, 0, 0, 0.2),
                    inset 0 20px 40px rgba(255, 255, 255, 0.3)
                  `,
                }}
                animate={{
                  rotate: [0, 360],
                }}
                transition={{
                  duration: 20,
                  repeat: Infinity,
                  ease: "linear",
                }}
              >
                <BaseballSeams />
              </motion.div>

              {/* Center icon overlay */}
              <motion.div
                className="absolute inset-0 flex items-center justify-center"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.5, type: "spring" }}
              >
                <motion.div
                  className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-xl"
                  animate={{
                    boxShadow: [
                      '0 0 20px rgba(16, 185, 129, 0.5)',
                      '0 0 40px rgba(16, 185, 129, 0.8)',
                      '0 0 20px rgba(16, 185, 129, 0.5)',
                    ],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                >
                  <motion.div
                    key={currentStageIndex}
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    exit={{ scale: 0, rotate: 180 }}
                    transition={{ type: "spring", stiffness: 200 }}
                  >
                    <StageIcon className="w-10 h-10 text-white" />
                  </motion.div>
                </motion.div>
              </motion.div>
            </div>

            {/* League and system info */}
            <motion.div
              className="text-center mb-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <motion.h1
                className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-emerald-200 to-white mb-2"
                animate={{
                  backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
                }}
                style={{
                  backgroundSize: '200% 200%',
                }}
                transition={{
                  duration: 5,
                  repeat: Infinity,
                  ease: "linear",
                }}
              >
                {leagueName}
              </motion.h1>
              <div className="flex items-center justify-center gap-2 text-emerald-400">
                <Zap className="w-4 h-4" />
                <span className="text-lg font-medium uppercase tracking-wider">
                  {projectionSystem} Projections
                </span>
              </div>
            </motion.div>

            {/* Loading stage display */}
            <motion.div
              className="flex items-center gap-3 mb-6 min-h-[32px]"
              key={`stage-${currentStageIndex}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              >
                <StageIcon className="w-5 h-5 text-emerald-400" />
              </motion.div>
              <span className="text-slate-300 text-lg">{currentStage.label}</span>
            </motion.div>

            {/* Progress bar */}
            <div className="w-80 h-2 bg-slate-800 rounded-full overflow-hidden mb-4">
              <motion.div
                className="h-full rounded-full relative overflow-hidden"
                style={{
                  background: 'linear-gradient(90deg, #10b981, #34d399, #10b981)',
                  backgroundSize: '200% 100%',
                }}
                initial={{ width: 0 }}
                animate={{
                  width: `${progress}%`,
                  backgroundPosition: ['0% 50%', '100% 50%'],
                }}
                transition={{
                  width: { duration: 0.3, ease: "easeOut" },
                  backgroundPosition: { duration: 1, repeat: Infinity, ease: "linear" },
                }}
              >
                {/* Shimmer effect */}
                <motion.div
                  className="absolute inset-0"
                  style={{
                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
                  }}
                  animate={{
                    x: ['-100%', '100%'],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
              </motion.div>
            </div>

            {/* Progress percentage */}
            <motion.div
              className="text-emerald-400 font-mono text-2xl font-bold"
              key={`progress-${Math.floor(progress)}`}
            >
              {Math.floor(progress)}%
            </motion.div>

            {/* Stage indicators */}
            <div className="flex items-center gap-2 mt-8">
              {LOADING_STAGES.map((stage, index) => {
                const isActive = index === currentStageIndex;
                const isComplete = index < currentStageIndex;
                const Icon = stage.icon;

                return (
                  <motion.div
                    key={stage.id}
                    className={`relative flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors ${
                      isComplete
                        ? 'bg-emerald-500 border-emerald-500'
                        : isActive
                          ? 'bg-emerald-500/20 border-emerald-400'
                          : 'bg-slate-800 border-slate-700'
                    }`}
                    animate={isActive ? {
                      scale: [1, 1.1, 1],
                      boxShadow: [
                        '0 0 0 0 rgba(16, 185, 129, 0)',
                        '0 0 0 8px rgba(16, 185, 129, 0.3)',
                        '0 0 0 0 rgba(16, 185, 129, 0)',
                      ],
                    } : {}}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                    }}
                  >
                    <Icon className={`w-4 h-4 ${
                      isComplete ? 'text-white' : isActive ? 'text-emerald-400' : 'text-slate-500'
                    }`} />

                    {/* Connecting line */}
                    {index < LOADING_STAGES.length - 1 && (
                      <div className="absolute left-full w-2 h-0.5">
                        <motion.div
                          className="h-full bg-emerald-500"
                          initial={{ width: 0 }}
                          animate={{ width: isComplete ? '100%' : '0%' }}
                          transition={{ duration: 0.3 }}
                        />
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>

            {/* Hint text */}
            <motion.p
              className="text-slate-500 text-sm mt-8"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              Preparing your draft experience...
            </motion.p>
          </motion.div>
        </motion.div>
  );
}
