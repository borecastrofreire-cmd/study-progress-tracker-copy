import { useEffect, useRef, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';

interface Props {
  subjectName: string;
  subjectEmoji: string;
  onClose: () => void;
}

// ---- Confetti particle ----
interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  rotation: number;
  rotationSpeed: number;
  shape: 'rect' | 'circle' | 'star';
  opacity: number;
}

const COLORS = [
  '#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff',
  '#f7a8d8', '#c3f0ca', '#ffe0a3', '#b5b9ff',
  '#ff9f43', '#54a0ff', '#5f27cd', '#00d2d3',
];

const MESSAGES = [
  'El esfuerzo siempre deja huella.',
  'Cada página, un paso más adelante.',
  'La constancia es tu mayor talento.',
  'Lo difícil ya está hecho.',
  'Así se construye el conocimiento.',
  'Un logro más en tu camino.',
];

function randomBetween(a: number, b: number) {
  return a + Math.random() * (b - a);
}

function makeParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: randomBetween(10, 90),
    y: randomBetween(-10, 30),
    vx: randomBetween(-4, 4),
    vy: randomBetween(2, 8),
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    size: randomBetween(6, 14),
    rotation: randomBetween(0, 360),
    rotationSpeed: randomBetween(-6, 6),
    shape: (['rect', 'circle', 'star'] as const)[Math.floor(Math.random() * 3)],
    opacity: 1,
  }));
}

function ConfettiCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>(makeParticles(120));
  const animRef = useRef<number>(0);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const drawStar = (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) => {
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
    };

    const animate = () => {
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);

      particles.current = particles.current.map((p) => {
        const nx = p.x + p.vx * 0.4;
        const ny = p.y + p.vy * 0.5;
        const nvy = p.vy + 0.12; // gravity
        const nOpacity = ny > 110 ? Math.max(0, p.opacity - 0.015) : p.opacity;
        return { ...p, x: nx, y: ny, vy: nvy, rotation: p.rotation + p.rotationSpeed, opacity: nOpacity };
      }).filter((p) => p.opacity > 0);

      particles.current.forEach((p) => {
        ctx.save();
        ctx.globalAlpha = p.opacity;
        ctx.translate((p.x / 100) * rect.width, (p.y / 100) * rect.height);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;

        if (p.shape === 'rect') {
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        } else if (p.shape === 'circle') {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          drawStar(ctx, 0, 0, p.size / 2);
          ctx.fill();
        }
        ctx.restore();
      });

      animRef.current = requestAnimationFrame(animate);
    };

    animate();
    return () => {
      cancelAnimationFrame(animRef.current);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
    />
  );
}

// Floating emoji burst
const BURST_EMOJIS = ['🎉', '⭐', '🔥', '✨', '🏆', '💪', '🎯', '🚀'];

export function SubjectCompletionModal({ subjectName, subjectEmoji, onClose }: Props) {
  const [message] = useState(() => MESSAGES[Math.floor(Math.random() * MESSAGES.length)]);
  const [visible, setVisible] = useState(true);

  // CRITICAL: Memoize random positions so they don't change on every render
  const emojiBurst = useMemo(() => {
    return BURST_EMOJIS.map((emoji, i) => ({
      key: i,
      emoji,
      initialX: `${randomBetween(5, 95)}vw`,
      finalY: `${randomBetween(5, 40)}vh`,
      duration: randomBetween(1.5, 2.5),
      delay: randomBetween(0, 0.8),
    }));
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 400);
  };

  // Auto-close after 6 seconds
  useEffect(() => {
    const t = setTimeout(handleClose, 6000);
    return () => clearTimeout(t);
  }, []);

  return createPortal(
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          onClick={handleClose}
        >
          {/* Blurred dark overlay */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

          {/* Confetti layer */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <ConfettiCanvas />
          </div>

          {/* Floating emoji bursts */}
          {emojiBurst.map((item) => (
            <motion.div
              key={item.key}
              className="absolute text-3xl pointer-events-none select-none"
              initial={{
                x: item.initialX,
                y: '60vh',
                opacity: 0,
                scale: 0,
              }}
              animate={{
                y: item.finalY,
                opacity: [0, 1, 1, 0],
                scale: [0, 1.4, 1, 0.8],
              }}
              transition={{
                duration: item.duration,
                delay: 0,
                ease: 'easeOut',
              }}
            >
              {item.emoji}
            </motion.div>
          ))}

          {/* Main card */}
          <motion.div
            initial={{ scale: 0.5, opacity: 0, y: 40 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: -20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 22 }}
            className={cn(
              'relative z-10 flex flex-col items-center gap-5 text-center',
              'bg-[#1a1a1c]',
              'border border-[#38383a]/30 rounded-3xl px-10 py-10 shadow-2xl',
              'w-full max-w-sm mx-4'
            )}
            onClick={(e) => e.stopPropagation()}
          >


            {/* Trophy animation */}
            <motion.div
              animate={{
                y: [0, -10, 0],
                rotate: [-3, 3, -3],
              }}
              transition={{
                duration: 1.8,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              className="text-7xl drop-shadow-[0_0_20px_rgba(255,215,0,0.6)]"
            >
              🏆
            </motion.div>

            {/* Stars burst */}
            <div className="relative h-0 w-0 overflow-visible pointer-events-none">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                <motion.div
                  key={i}
                  className="absolute text-yellow-400 text-lg pointer-events-none"
                  initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
                  animate={{
                    x: Math.cos((i / 8) * Math.PI * 2) * 55,
                    y: Math.sin((i / 8) * Math.PI * 2) * 55,
                    opacity: [0, 1, 0],
                    scale: [0, 1.2, 0],
                  }}
                  transition={{
                    duration: 1.2,
                    delay: i * 0.03,
                    repeat: Infinity,
                    repeatDelay: 1.5,
                  }}
                >
                  ✦
                </motion.div>
              ))}
            </div>

            {/* Heading */}
            <div className="space-y-1 mt-2">
              <h2 className="text-2xl font-bold text-white">¡Asignatura completada!</h2>
              <p className="text-white/50 text-sm">Has terminado de estudiar</p>
            </div>

            {/* Subject name chip */}
            <div className="flex items-center gap-2 bg-[#2a2a2c] border border-white/12 rounded-2xl px-5 py-3">
              <span className="text-2xl">{subjectEmoji}</span>
              <span className="text-white font-semibold text-base">{subjectName}</span>
            </div>

            {/* Motivational message */}
            <p className="text-[#30d158] font-semibold text-lg">{message}</p>

            {/* Progress bar fill animation */}
            <div className="w-full bg-[#1a1a1c] rounded-full h-2 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: '100%' }}
                transition={{ duration: 1, ease: 'easeOut' }}
                className="h-full rounded-full bg-[#30d158]"
              />
            </div>

            {/* Close hint */}
            <p className="text-white/20 text-xs animate-pulse">Toca para continuar</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
