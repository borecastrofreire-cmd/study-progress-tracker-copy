import { motion } from 'framer-motion';
import { AppLogo } from './AppLogo';

interface SplashScreenProps {
  username?: string;
}

export function SplashScreen({ username }: SplashScreenProps) {
  return (
    <motion.div
      key="splash"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.06, filter: 'blur(8px)' }}
      transition={{ duration: 0.45, ease: [0.25, 0.1, 0.25, 1] }}
      className="fixed inset-0 z-[99999] flex flex-col items-center justify-center select-none overflow-hidden"
      style={{ background: '#ffffff' }}
    >
      {/* Ambient glow behind logo */}
      <motion.div
        className="absolute w-64 h-64 rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(0,122,255,0.08) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }}
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1.2 }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
      />

      <div className="relative flex flex-col items-center gap-6">
        {/* Logo — dramatic bounce */}
        <motion.div
          initial={{ opacity: 0, scale: 0.3, rotate: -10 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{
            type: 'spring',
            stiffness: 200,
            damping: 12,
            delay: 0.1,
          }}
        >
          <AppLogo size="lg" />
        </motion.div>

        {/* Title with character stagger */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.3 }}
          className="flex flex-col items-center gap-1.5 text-center px-8"
        >
          <motion.h1
            className="text-[28px] font-semibold tracking-tight text-[#1c1c1e]"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            {username ? username : 'StudyTracker'}
          </motion.h1>

          <motion.p
            className="text-sm text-[#8e8e93] font-normal tracking-wide"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            {username ? '¡Bienvenido de nuevo!' : 'Tu universo de estudio'}
          </motion.p>
        </motion.div>

        {/* Loading dots — wave effect */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.4 }}
          className="flex items-center gap-1.5 mt-2"
        >
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="block w-1.5 h-1.5 rounded-full bg-[#aeaea2]"
              animate={{
                opacity: [0.3, 1, 0.3],
                y: [0, -4, 0],
              }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                delay: i * 0.2,
                ease: 'easeInOut',
              }}
            />
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
}
