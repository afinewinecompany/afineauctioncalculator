import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useCallback } from 'react';
import { ProjectionsLoadingScreen } from './ProjectionsLoadingScreen';
import { DraftRoomLoadingScreen } from './DraftRoomLoadingScreen';

export type LoadingPhase = 'idle' | 'projections' | 'transitioning' | 'draftRoom' | 'complete';

interface LoadingTransitionManagerProps {
  phase: LoadingPhase;
  projectionSystem: string;
  leagueName: string;
  hasCouchManagerRoom: boolean;
  draftRoomMessage?: string;
  onProjectionsComplete?: () => void;
  onDraftRoomComplete?: () => void;
}

export function LoadingTransitionManager({
  phase,
  projectionSystem,
  leagueName,
  hasCouchManagerRoom,
  draftRoomMessage = 'Initializing...',
  onProjectionsComplete,
  onDraftRoomComplete,
}: LoadingTransitionManagerProps) {
  const [internalPhase, setInternalPhase] = useState<LoadingPhase>('idle');
  const [showTransition, setShowTransition] = useState(false);

  // Sync internal phase with external phase
  useEffect(() => {
    if (phase === 'projections' && internalPhase === 'idle') {
      setInternalPhase('projections');
    } else if (phase === 'draftRoom' && internalPhase !== 'draftRoom' && internalPhase !== 'complete') {
      // Start transition animation
      setShowTransition(true);
      setInternalPhase('transitioning');

      // After transition animation, show draft room loading
      const timer = setTimeout(() => {
        setShowTransition(false);
        setInternalPhase('draftRoom');
      }, 800);

      return () => clearTimeout(timer);
    } else if (phase === 'complete') {
      setInternalPhase('complete');
    } else if (phase === 'idle') {
      setInternalPhase('idle');
      setShowTransition(false);
    }
  }, [phase, internalPhase]);

  // Handle projections loading completion
  const handleProjectionsComplete = useCallback(() => {
    onProjectionsComplete?.();
  }, [onProjectionsComplete]);

  // Handle draft room loading completion
  const handleDraftRoomComplete = useCallback(() => {
    setInternalPhase('complete');
    onDraftRoomComplete?.();
  }, [onDraftRoomComplete]);

  return (
    <>
      {/* Projections Loading Screen */}
      <ProjectionsLoadingScreen
        isVisible={internalPhase === 'projections'}
        projectionSystem={projectionSystem}
        leagueName={leagueName}
        onLoadingComplete={handleProjectionsComplete}
      />

      {/* Transition animation between screens */}
      <AnimatePresence>
        {showTransition && (
          <motion.div
            className="fixed inset-0 z-[150] bg-slate-950"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            {/* Radial wipe effect */}
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              initial={{ scale: 0 }}
              animate={{ scale: 20 }}
              exit={{ scale: 30, opacity: 0 }}
              transition={{ duration: 0.8, ease: "easeInOut" }}
            >
              <div
                className="w-20 h-20 rounded-full"
                style={{
                  background: 'radial-gradient(circle, rgba(16, 185, 129, 0.8) 0%, rgba(16, 185, 129, 0.4) 50%, transparent 70%)',
                }}
              />
            </motion.div>

            {/* Center content during transition */}
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.2 }}
              transition={{ duration: 0.3, delay: 0.2 }}
            >
              <div className="text-center">
                <motion.div
                  className="text-3xl font-bold text-emerald-400 mb-2"
                  animate={{ opacity: [1, 0.5, 1] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                >
                  Entering Draft Room
                </motion.div>
                <div className="text-slate-400">Get ready to dominate...</div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Draft Room Loading Screen */}
      {hasCouchManagerRoom && (
        <DraftRoomLoadingScreen
          isVisible={internalPhase === 'draftRoom'}
          message={draftRoomMessage}
          onComplete={handleDraftRoomComplete}
        />
      )}
    </>
  );
}
