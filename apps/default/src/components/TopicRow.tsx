import { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronRight, BookOpen, Minus, Plus, Pencil } from 'lucide-react';
import { cn } from '../lib/utils';
import { ProgressBar } from './ProgressBar';
import { StatusBadge } from './StatusBadge';
import { EditTopicModal } from './EditTopicModal';
import { getColorMeta } from './ColorEmojiPicker';
import { subjectTint } from '../lib/color-utils';
import type { Topic, Status, SubjectColor } from '../types/study';
import { updateTopic } from '../lib/api';

// ── Spark burst ───────────────────────────────────────────────────────────────

const BURST_COLORS = [
  '#6ee7b7', '#34d399', '#10b981', '#059669',
  '#fde68a', '#fbbf24', '#f59e0b',
  '#a5b4fc', '#818cf8', '#6366f1',
  '#f9a8d4', '#fb7185', '#f43f5e',
  '#67e8f9', '#22d3ee', '#06b6d4',
  '#fff', '#d1fae5',
];

function rng(seed: number) {
  return ((Math.sin(seed * 9301 + 49297) * 233280) % 1 + 1) % 1;
}

// Two rings: inner close fast sparks + outer slower bigger ones
const SPARKS_INNER = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  angle: (i / 18) * 360 + (rng(i * 3) - 0.5) * 18,
  distance: 36 + rng(i * 7) * 20,
  color: BURST_COLORS[i % BURST_COLORS.length],
  size: 4 + rng(i * 13) * 3,
  delay: rng(i * 17) * 0.05,
  isRect: rng(i * 31) > 0.6,
}));

const SPARKS_OUTER = Array.from({ length: 14 }, (_, i) => ({
  id: i + 100,
  angle: (i / 14) * 360 + (rng(i * 5 + 1) - 0.5) * 25 + 13,
  distance: 62 + rng(i * 11) * 36,
  color: BURST_COLORS[(i * 3) % BURST_COLORS.length],
  size: 3 + rng(i * 19) * 4,
  delay: 0.04 + rng(i * 23) * 0.1,
  isRect: rng(i * 37) > 0.5,
}));

const ALL_SPARKS = [...SPARKS_INNER, ...SPARKS_OUTER];

// Motivational micro-messages shown on topic completion
const MICRO_MESSAGES = [
  '¡Tema dominado! 🔥',
  '¡Bien hecho! ✨',
  '¡Un paso más! 🚀',
  '¡Sigue así! 💪',
  '¡Lo lograste! ⭐',
  '¡Imparable! 🎯',
];

function SparkBurst({ visible }: { visible: boolean }) {
  return (
    <AnimatePresence>
      {visible && (
        <div
          className="absolute pointer-events-none"
          style={{ inset: 0, zIndex: 30, overflow: 'visible' }}
        >
          {ALL_SPARKS.map((s) => {
            const rad = (s.angle * Math.PI) / 180;
            const tx = Math.cos(rad) * s.distance;
            const ty = Math.sin(rad) * s.distance;
            return (
              <motion.div
                key={s.id}
                className="absolute"
                style={{
                  top: '50%',
                  left: '50%',
                  width: s.isRect ? s.size * 2 : s.size,
                  height: s.size,
                  marginTop: -s.size / 2,
                  marginLeft: s.isRect ? -s.size : -s.size / 2,
                  borderRadius: s.isRect ? 2 : '50%',
                  backgroundColor: s.color,
                  boxShadow: `0 0 ${s.size * 2.5}px ${s.color}`,
                  rotate: s.isRect ? `${s.angle}deg` : '0deg',
                }}
                initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                animate={{ x: tx, y: ty, opacity: 0, scale: 0.1 }}
                transition={{
                  duration: 0.7 + s.delay * 3,
                  ease: [0.12, 0.9, 0.3, 1],
                  delay: s.delay,
                }}
              />
            );
          })}

          {/* shockwave ring 1 */}
          <motion.div
            className="absolute rounded-full"
            style={{ top: '50%', left: '50%', border: '2px solid #34d399' }}
            initial={{ width: 10, height: 10, x: '-50%', y: '-50%', opacity: 1 }}
            animate={{ width: 70, height: 70, x: '-50%', y: '-50%', opacity: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
          />
          {/* shockwave ring 2 */}
          <motion.div
            className="absolute rounded-full"
            style={{ top: '50%', left: '50%', border: '1.5px solid #6ee7b7' }}
            initial={{ width: 10, height: 10, x: '-50%', y: '-50%', opacity: 0.7 }}
            animate={{ width: 100, height: 100, x: '-50%', y: '-50%', opacity: 0 }}
            transition={{ duration: 0.65, ease: 'easeOut', delay: 0.06 }}
          />
          {/* shockwave ring 3 — faint, large */}
          <motion.div
            className="absolute rounded-full"
            style={{ top: '50%', left: '50%', border: '1px solid #a7f3d0' }}
            initial={{ width: 10, height: 10, x: '-50%', y: '-50%', opacity: 0.4 }}
            animate={{ width: 140, height: 140, x: '-50%', y: '-50%', opacity: 0 }}
            transition={{ duration: 0.85, ease: 'easeOut', delay: 0.1 }}
          />
        </div>
      )}
    </AnimatePresence>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface TopicRowProps {
  topic: Topic;
  index: number;
  subjectColor: string;
  onUpdate: () => void;
}

const statusCycle: Status[] = ['opt-pending', 'opt-progress', 'opt-done'];

export function TopicRow({ topic, index, subjectColor, onUpdate }: TopicRowProps) {
  const [localPage, setLocalPage] = useState(topic.currentPage);
  const [localStatus, setLocalStatus] = useState<Status>(topic.status);
  const [showEdit, setShowEdit] = useState(false);
  const [burst, setBurst] = useState(false);
  const [btnScale, setBtnScale] = useState(1);
  const [rowGlow, setRowGlow] = useState(false);
  const [rowPulse, setRowPulse] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Debounce refs for page persistence
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPage = useRef<{ page: number; status: Status } | null>(null);
  const isSyncing = useRef(false);
  const burstTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync from server only when idle
  useEffect(() => {
    if (!isSyncing.current) {
      setLocalPage(topic.currentPage);
      setLocalStatus(topic.status);
    }
  }, [topic.currentPage, topic.status]);

  const pagesRead = Math.max(0, localPage - topic.startPage + 1);
  const progress = topic.totalPages > 0 ? Math.min(100, (pagesRead / topic.totalPages) * 100) : 0;
  const pagesLeft = Math.max(0, topic.totalPages - pagesRead);
  const isCompleted = localStatus === 'opt-done';

  const fireBurst = () => {
    if (burstTimer.current) clearTimeout(burstTimer.current);
    if (toastTimer.current) clearTimeout(toastTimer.current);

    setBurst(true);
    setRowGlow(true);
    setRowPulse(true);

    // Button: dramatic stamp bounce
    setBtnScale(0.6);
    setTimeout(() => setBtnScale(1.7), 60);
    setTimeout(() => setBtnScale(0.85), 180);
    setTimeout(() => setBtnScale(1.12), 270);
    setTimeout(() => setBtnScale(1), 360);

    // Pick a random micro-message
    const msg = MICRO_MESSAGES[Math.floor(Math.random() * MICRO_MESSAGES.length)];
    setTimeout(() => setToast(msg), 120);

    burstTimer.current = setTimeout(() => {
      setBurst(false);
      setRowGlow(false);
      setRowPulse(false);
    }, 900);

    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };

  const flushPage = async (page: number, status: Status) => {
    isSyncing.current = true;
    try {
      await updateTopic(topic.id, { currentPage: page, status });
      onUpdate();
    } finally {
      isSyncing.current = false;
    }
  };

  const changePage = (delta: number) => {
    const minPage = topic.startPage - 1;
    const maxPage = topic.startPage + topic.totalPages - 1;
    const next = Math.max(minPage, Math.min(maxPage, localPage + delta));
    if (next === localPage) return;

    const newPagesRead = Math.max(0, next - topic.startPage + 1);
    const newProgress = topic.totalPages > 0 ? (newPagesRead / topic.totalPages) * 100 : 0;
    const newStatus: Status =
      newProgress >= 100 ? 'opt-done' : newProgress > 0 ? 'opt-progress' : 'opt-pending';

    setLocalPage(next);
    setLocalStatus(newStatus);

    if (newStatus === 'opt-done' && localStatus !== 'opt-done') fireBurst();

    // Debounce: cancel previous timer, schedule new flush
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    pendingPage.current = { page: next, status: newStatus };
    debounceTimer.current = setTimeout(() => {
      if (pendingPage.current) {
        flushPage(pendingPage.current.page, pendingPage.current.status);
        pendingPage.current = null;
      }
    }, 400);
  };

  const cycleStatus = async () => {
    const idx = statusCycle.indexOf(localStatus);
    const next = statusCycle[(idx + 1) % statusCycle.length];
    const hasPagesConfig = topic.totalPages > 0;

    setLocalStatus(next);
    isSyncing.current = true;

    if (next === 'opt-done') {
      fireBurst();
      if (hasPagesConfig) {
        const lastPage = topic.startPage + topic.totalPages - 1;
        setLocalPage(lastPage);
        await updateTopic(topic.id, { status: next, currentPage: lastPage });
      } else {
        await updateTopic(topic.id, { status: next });
      }
    } else if (next === 'opt-pending') {
      if (hasPagesConfig) {
        setLocalPage(topic.startPage);
        await updateTopic(topic.id, { status: next, currentPage: topic.startPage });
      } else {
        await updateTopic(topic.id, { status: next });
      }
    } else {
      await updateTopic(topic.id, { status: next });
    }

    isSyncing.current = false;
    onUpdate();
  };

  const canDecrement = localPage > topic.startPage - 1;
  const canIncrement = localPage < topic.startPage + topic.totalPages - 1;

  return (
    <>
      <motion.div
        layout="position"
        initial={{ opacity: 0, y: 15, scale: 0.98 }}
        animate={{
          opacity: 1,
          y: 0,
          scale: rowPulse ? [1, 1.018, 1] : 1,
          boxShadow: rowGlow
            ? '0 0 0 1.5px rgba(52,211,153,0.25), 0 0 28px rgba(52,211,153,0.12)'
            : '0 0 0 0px rgba(52,211,153,0)',
        }}
        transition={{
          opacity: { duration: 0.3, delay: index * 0.04 },
          y: { duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: index * 0.04 },
          scale: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
          boxShadow: { duration: 0.55 },
          layout: { duration: 0.3, ease: 'easeOut' }
        }}
        className={cn(
          'group relative rounded-xl border transition-colors duration-200 p-4 shadow-sm',
          isCompleted && 'opacity-50'
        )}
        style={{
          backgroundColor: subjectTint(getColorMeta(subjectColor).hex).topic,
          borderColor: subjectTint(getColorMeta(subjectColor).hex).border,
        }}
      >
        {/* Completion shimmer overlay */}
        <AnimatePresence>
          {rowPulse && (
            <motion.div
              className="absolute inset-0 rounded-xl pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.08, 0] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              style={{
                background: 'transparent',
              }}
            />
          )}
        </AnimatePresence>

        {/* Floating micro-toast */}
        <AnimatePresence>
          {toast && (
            <motion.div
              className="absolute -top-9 left-8 z-50 pointer-events-none"
              initial={{ opacity: 0, y: 6, scale: 0.85 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.9 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="flex items-center gap-1.5 bg-white border border-[#34c759]/30 shadow-md shadow-emerald-500/[0.08] rounded-full px-3 py-1 text-xs font-semibold text-[#34c759] whitespace-nowrap">
                {toast}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Edit button */}
        <button
          onClick={() => setShowEdit(true)}
          className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 bg-[#f2f2f7] hover:bg-[#e5e5ea] border border-[#e5e5ea] text-[#8e8e93] hover:text-[#1c1c1e] transition-all duration-150"
          title="Editar tema"
        >
          <Pencil className="w-3 h-3" />
        </button>

        <div className="flex items-start gap-3">
          {/* Status button + burst */}
          <div className="relative mt-0.5 flex-shrink-0 w-5 h-5">
            <SparkBurst visible={burst} />
            <motion.button
              onClick={cycleStatus}
              animate={{ scale: btnScale }}
              transition={{ duration: 0.1, ease: 'easeOut' }}
              className={cn(
                'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors duration-200',
                localStatus === 'opt-done'
                  ? 'bg-[#34c759] border-[#30d158] shadow-[0_0_10px_rgba(52,211,153,0.3)]'
                  : localStatus === 'opt-progress'
                  ? 'border-blue-400 bg-blue-50'
                  : 'border-[#aeaeb2] hover:border-[#8e8e93]'
              )}
            >
              <AnimatePresence mode="wait">
                {localStatus === 'opt-done' && (
                  <motion.div
                    key="check"
                    initial={{ scale: 0, rotate: -45, opacity: 0 }}
                    animate={{ scale: 1, rotate: 0, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <Check className="w-3 h-3 text-white" strokeWidth={3} />
                  </motion.div>
                )}
                {localStatus === 'opt-progress' && (
                  <motion.div
                    key="dot"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={{ duration: 0.15 }}
                    className="w-1.5 h-1.5 rounded-full bg-blue-500"
                  />
                )}
              </AnimatePresence>
            </motion.button>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 pr-6">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <motion.span
                animate={{
                  opacity: isCompleted ? 0.45 : 0.9,
                }}
                transition={{ duration: 0.4 }}
                className={cn(
                  'text-sm font-semibold text-[#1c1c1e]',
                  isCompleted && 'line-through'
                )}
              >
                {topic.text}
              </motion.span>
              <StatusBadge status={localStatus} />
            </div>

            <ProgressBar
              progress={progress}
              size="sm"
              showLabel={true}
              color={subjectColor as SubjectColor}
              className="mb-2"
            />

            <div className="flex items-center justify-between flex-wrap gap-y-1.5">
              <div className="flex items-center gap-1 text-xs text-[#8e8e93]">
                <BookOpen className="w-3 h-3" />
                <span>
                  Pág. {topic.startPage}–{topic.startPage + topic.totalPages - 1}
                </span>
                {pagesLeft > 0 && (
                  <>
                    <ChevronRight className="w-3 h-3" />
                    <span className="text-[#aeaeb2]">{pagesLeft} págs. restantes</span>
                  </>
                )}
              </div>

              {/* Page stepper — never blocked by network */}
              {topic.totalPages > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-[#aeaeb2] font-medium">Voy en:</span>
                  <div className="flex items-center gap-1 bg-[#f2f2f7] rounded-lg border border-[#e5e5ea] p-0.5">
                    <button
                      onClick={() => changePage(-1)}
                      disabled={!canDecrement}
                      className="w-5 h-5 flex items-center justify-center rounded-md hover:bg-white disabled:opacity-25 transition-colors"
                    >
                      <Minus className="w-3 h-3 text-[#aeaeb2]" />
                    </button>
                    <motion.span
                      key={localPage}
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.14, ease: 'easeOut' }}
                      className="text-xs font-mono text-[#1c1c1e] w-8 text-center tabular-nums font-semibold"
                    >
                      {localPage <= topic.startPage - 1 ? '—' : localPage}
                    </motion.span>
                    <button
                      onClick={() => changePage(1)}
                      disabled={!canIncrement}
                      className="w-5 h-5 flex items-center justify-center rounded-md hover:bg-white disabled:opacity-25 transition-colors"
                    >
                      <Plus className="w-3 h-3 text-[#aeaeb2]" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {showEdit && (
          <EditTopicModal
            topic={topic}
            onClose={() => setShowEdit(false)}
            onSaved={() => {
              setShowEdit(false);
              onUpdate();
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}
