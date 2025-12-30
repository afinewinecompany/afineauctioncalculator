import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useMemo } from 'react';
import {
  Wifi,
  Users,
  RefreshCw,
  CheckCircle,
  Loader2,
  Radio,
  Activity
} from 'lucide-react';

interface DraftRoomLoadingScreenProps {
  isVisible: boolean;
  message: string;
  onComplete?: () => void;
}

// Data pulse visualization
function DataPulse({ delay, size }: { delay: number; size: number }) {
  return (
    <motion.div
      className="absolute rounded-full border border-emerald-500/40"
      style={{
        width: size,
        height: size,
        left: '50%',
        top: '50%',
        marginLeft: -size / 2,
        marginTop: -size / 2,
      }}
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{
        scale: [0.5, 1.5],
        opacity: [0.8, 0],
      }}
      transition={{
        duration: 2,
        delay,
        repeat: Infinity,
        ease: "easeOut",
      }}
    />
  );
}

// Connection line animation
function ConnectionLine({ angle, length, delay }: { angle: number; length: number; delay: number }) {
  const radians = (angle * Math.PI) / 180;
  const endX = Math.cos(radians) * length;
  const endY = Math.sin(radians) * length;

  return (
    <motion.div
      className="absolute left-1/2 top-1/2"
      style={{
        width: length,
        height: 2,
        transformOrigin: 'left center',
        transform: `rotate(${angle}deg)`,
      }}
    >
      <motion.div
        className="h-full bg-gradient-to-r from-emerald-500 to-transparent"
        initial={{ width: 0 }}
        animate={{ width: ['0%', '100%', '100%', '0%'] }}
        transition={{
          duration: 2,
          delay,
          repeat: Infinity,
          times: [0, 0.3, 0.7, 1],
          ease: "easeInOut",
        }}
      />
      <motion.div
        className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-emerald-400"
        initial={{ opacity: 0, scale: 0 }}
        animate={{
          opacity: [0, 1, 1, 0],
          scale: [0, 1, 1, 0],
        }}
        transition={{
          duration: 2,
          delay: delay + 0.3,
          repeat: Infinity,
          times: [0, 0.1, 0.6, 0.7],
        }}
      />
    </motion.div>
  );
}

// Status indicator component
function StatusIndicator({ label, status, delay }: {
  label: string;
  status: 'pending' | 'connecting' | 'connected';
  delay: number;
}) {
  const [currentStatus, setCurrentStatus] = useState<typeof status>('pending');

  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];

    timers.push(setTimeout(() => setCurrentStatus('connecting'), delay));
    timers.push(setTimeout(() => setCurrentStatus('connected'), delay + 1000));

    return () => timers.forEach(t => clearTimeout(t));
  }, [delay]);

  return (
    <motion.div
      className="flex items-center gap-3 px-4 py-2 bg-slate-800/50 rounded-lg border border-slate-700/50"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: delay / 1000 }}
    >
      {currentStatus === 'pending' && (
        <div className="w-4 h-4 rounded-full bg-slate-600" />
      )}
      {currentStatus === 'connecting' && (
        <motion.div
          className="w-4 h-4"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <Loader2 className="w-4 h-4 text-amber-400" />
        </motion.div>
      )}
      {currentStatus === 'connected' && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          <CheckCircle className="w-4 h-4 text-emerald-400" />
        </motion.div>
      )}
      <span className={`text-sm ${
        currentStatus === 'connected' ? 'text-emerald-400' :
        currentStatus === 'connecting' ? 'text-amber-400' : 'text-slate-400'
      }`}>
        {label}
      </span>
    </motion.div>
  );
}

export function DraftRoomLoadingScreen({
  isVisible,
  message,
  onComplete
}: DraftRoomLoadingScreenProps) {
  const [dots, setDots] = useState('');

  // Animated dots for loading text
  useEffect(() => {
    if (!isVisible) return;

    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);

    return () => clearInterval(interval);
  }, [isVisible]);

  // Connection lines configuration
  const connectionLines = useMemo(() =>
    Array.from({ length: 8 }, (_, i) => ({
      angle: i * 45,
      length: 80 + Math.random() * 40,
      delay: i * 0.2,
    })),
  []);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{
            opacity: 0,
            scale: 0.95,
            filter: "blur(10px)",
          }}
          transition={{
            duration: 0.5,
            exit: { duration: 0.6, ease: "easeInOut" }
          }}
        >
          {/* Background */}
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-xl" />

          {/* Animated mesh gradient */}
          <motion.div
            className="absolute inset-0"
            style={{
              background: `
                radial-gradient(ellipse at 20% 30%, rgba(16, 185, 129, 0.1) 0%, transparent 50%),
                radial-gradient(ellipse at 80% 70%, rgba(16, 185, 129, 0.08) 0%, transparent 50%),
                radial-gradient(ellipse at 50% 50%, rgba(16, 185, 129, 0.05) 0%, transparent 70%)
              `,
            }}
            animate={{
              opacity: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />

          {/* Main content */}
          <motion.div
            className="relative z-10 flex flex-col items-center"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.6 }}
          >
            {/* Central connection hub visualization */}
            <div className="relative w-64 h-64 mb-8">
              {/* Data pulse rings */}
              <DataPulse delay={0} size={200} />
              <DataPulse delay={0.5} size={250} />
              <DataPulse delay={1} size={300} />

              {/* Connection lines */}
              {connectionLines.map((line, i) => (
                <ConnectionLine key={i} {...line} />
              ))}

              {/* Central hub */}
              <motion.div
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32"
              >
                {/* Outer ring */}
                <motion.div
                  className="absolute inset-0 rounded-full border-4 border-emerald-500/30"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                />

                {/* Middle spinning ring */}
                <motion.div
                  className="absolute inset-2 rounded-full border-2 border-transparent"
                  style={{
                    borderTopColor: 'rgba(16, 185, 129, 0.8)',
                    borderRightColor: 'rgba(16, 185, 129, 0.4)',
                  }}
                  animate={{ rotate: -360 }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                />

                {/* Inner core */}
                <motion.div
                  className="absolute inset-4 rounded-full bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 border border-emerald-500/50 flex items-center justify-center"
                  animate={{
                    boxShadow: [
                      '0 0 20px rgba(16, 185, 129, 0.3)',
                      '0 0 40px rgba(16, 185, 129, 0.6)',
                      '0 0 20px rgba(16, 185, 129, 0.3)',
                    ],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                >
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Radio className="w-10 h-10 text-emerald-400" />
                  </motion.div>
                </motion.div>

                {/* Activity indicator */}
                <motion.div
                  className="absolute -top-2 left-1/2 -translate-x-1/2"
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  <Activity className="w-6 h-6 text-emerald-400" />
                </motion.div>
              </motion.div>
            </div>

            {/* Title */}
            <motion.h2
              className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-green-300 to-emerald-400 mb-4"
              animate={{
                backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
              }}
              style={{ backgroundSize: '200% 200%' }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            >
              Connecting to Draft Room
            </motion.h2>

            {/* Dynamic message */}
            <motion.div
              className="flex items-center gap-2 text-emerald-400 text-lg mb-6"
              key={message}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Wifi className="w-5 h-5" />
              <span>{message}{dots}</span>
            </motion.div>

            {/* Connection status indicators */}
            <div className="flex flex-col gap-2 mb-8">
              <StatusIndicator label="Auction Server" status="pending" delay={500} />
              <StatusIndicator label="Player Data" status="pending" delay={1000} />
              <StatusIndicator label="Team Rosters" status="pending" delay={1500} />
              <StatusIndicator label="Live Updates" status="pending" delay={2000} />
            </div>

            {/* Progress wave */}
            <div className="flex gap-1.5">
              {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                <motion.div
                  key={i}
                  className="w-2 h-8 bg-emerald-500 rounded-full"
                  animate={{
                    scaleY: [0.3, 1, 0.3],
                    opacity: [0.5, 1, 0.5],
                  }}
                  transition={{
                    duration: 1,
                    delay: i * 0.1,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
              ))}
            </div>

            {/* Hint */}
            <motion.p
              className="text-slate-500 text-sm mt-8"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              Syncing with Couch Managers...
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
