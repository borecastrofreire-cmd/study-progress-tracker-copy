import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '../lib/utils';
import type { SubjectColor } from '../types/study';

export const COLOR_OPTIONS: {
  id: SubjectColor;
  gradient: string;
  bgDark: string;
  accent: string;
  border: string;
  dot: string;
  hex: string;
  label: string;
}[] = [
  { id: 'blue',    gradient: 'bg-[#0a84ff]/22',    bgDark: 'bg-[#0a84ff]/[0.18]',    accent: 'text-[#0a84ff]',    border: 'border-[#0a84ff]/45',    dot: 'bg-[#0a84ff]',    hex: '#0a84ff',    label: 'Azul' },
  { id: 'violet',  gradient: 'bg-[#5e5ce6]/22',    bgDark: 'bg-[#5e5ce6]/[0.18]',    accent: 'text-[#5e5ce6]',    border: 'border-[#5e5ce6]/45',    dot: 'bg-[#5e5ce6]',    hex: '#5e5ce6',    label: 'Violeta' },
  { id: 'emerald', gradient: 'bg-[#30d158]/22',    bgDark: 'bg-[#30d158]/[0.18]',    accent: 'text-[#30d158]',    border: 'border-[#30d158]/45',    dot: 'bg-[#30d158]',    hex: '#30d158',    label: 'Verde' },
  { id: 'amber',   gradient: 'bg-[#ff9f0a]/22',    bgDark: 'bg-[#ff9f0a]/[0.18]',    accent: 'text-[#ff9f0a]',    border: 'border-[#ff9f0a]/45',    dot: 'bg-[#ff9f0a]',    hex: '#ff9f0a',    label: 'Ámbar' },
  { id: 'rose',    gradient: 'bg-[#ff453a]/22',    bgDark: 'bg-[#ff453a]/[0.18]',    accent: 'text-[#ff453a]',    border: 'border-[#ff453a]/45',    dot: 'bg-[#ff453a]',    hex: '#ff453a',    label: 'Rosa' },
  { id: 'cyan',    gradient: 'bg-[#64d2ff]/22',    bgDark: 'bg-[#64d2ff]/[0.18]',    accent: 'text-[#64d2ff]',    border: 'border-[#64d2ff]/45',    dot: 'bg-[#64d2ff]',    hex: '#64d2ff',    label: 'Cian' },
  { id: 'orange',  gradient: 'bg-[#ff9f0a]/22',    bgDark: 'bg-[#ff9f0a]/[0.18]',    accent: 'text-[#ff9f0a]',    border: 'border-[#ff9f0a]/45',    dot: 'bg-[#ff9f0a]',    hex: '#ff9f0a',    label: 'Naranja' },
  { id: 'pink',    gradient: 'bg-[#ff375f]/22',    bgDark: 'bg-[#ff375f]/[0.18]',    accent: 'text-[#ff375f]',    border: 'border-[#ff375f]/45',    dot: 'bg-[#ff375f]',    hex: '#ff375f',    label: 'Rosa cl.' },
];

export function getColorMeta(colorId: SubjectColor) {
  return COLOR_OPTIONS.find((c) => c.id === colorId) ?? COLOR_OPTIONS[0];
}

function extractFirstGrapheme(str: string): string | null {
  if (!str) return null;
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const seg = new (Intl as any).Segmenter(undefined, { granularity: 'grapheme' });
    const [first] = seg.segment(str);
    return first?.segment ?? null;
  }
  return [...str][0] ?? null;
}

function useIsTouch() {
  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => {
    setIsTouch('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);
  return isTouch;
}

// Renders children into document.body to escape any overflow:hidden ancestor
function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}

interface ColorEmojiPickerProps {
  color: SubjectColor;
  emoji: string;
  onColorChange: (color: SubjectColor) => void;
  onEmojiChange: (emoji: string) => void;
  compact?: boolean;
}

export function ColorEmojiPicker({
  color,
  emoji,
  onColorChange,
  onEmojiChange,
  compact = false,
}: ColorEmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const [emojiMode, setEmojiMode] = useState(false);
  const emojiInputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selectedColor = getColorMeta(color);
  const isTouch = useIsTouch();

  // Lock body scroll when a sheet is open on mobile
  useEffect(() => {
    const active = isTouch && (open || emojiMode);
    document.body.style.overflow = active ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open, emojiMode, isTouch]);

  const openEmojiMode = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen(false);
    setEmojiMode(true);
    setTimeout(() => emojiInputRef.current?.focus(), 80);
  };

  const handleEmojiInput = (e: React.FormEvent<HTMLInputElement>) => {
    const val = e.currentTarget.value;
    const first = extractFirstGrapheme(val);
    if (first) {
      onEmojiChange(first);
      setEmojiMode(false);
    }
    e.currentTarget.value = '';
  };

  const handleEmojiKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') setEmojiMode(false);
  };

  const sheetTransition = { type: 'spring', damping: 30, stiffness: 320 } as const;
  const popTransition = { duration: 0.15 } as const;

  // Desktop popover position — anchored below the trigger button
  const [popPos, setPopPos] = useState({ top: 0, left: 0 });
  const updatePopPos = () => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setPopPos({ top: r.bottom + 8, left: r.left });
  };

  const handleTriggerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEmojiMode(false);
    if (!open) updatePopPos();
    setOpen((v) => !v);
  };

  return (
    <div className="relative">
      {/* ── Trigger ─────────────────────────────────────────────── */}
      <button
        ref={triggerRef}
        type="button"
        onClick={handleTriggerClick}
        className={cn(
          'flex items-center gap-2 rounded-xl border transition-all duration-200 active:scale-95',
          compact ? 'px-2 py-1.5' : 'px-3 py-2',
          'bg-[#1a1a1c] border-[#38383a]/30 hover:bg-[#2a2a2c] hover:border-white/20',
        )}
        title="Cambiar color y emoticono"
      >
        <span className={compact ? 'text-lg leading-none' : 'text-xl leading-none'}>{emoji}</span>
        <div className={cn('rounded-full flex-shrink-0', compact ? 'w-2.5 h-2.5' : 'w-3 h-3', selectedColor.dot)} />
      </button>

      {/* ══════════════════════════════════════════════════════════
          COLOR PICKER — rendered in a Portal to escape overflow
          ══════════════════════════════════════════════════════════ */}
      <Portal>
        <AnimatePresence>
          {open && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm"
                style={{ zIndex: 9998 }}
                onClick={() => setOpen(false)}
              />

              {isTouch ? (
                /* ── Mobile: bottom sheet ── */
                <motion.div
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  transition={sheetTransition}
                  className="fixed bottom-0 left-0 right-0 bg-[#0f1117] border-t border-[#38383a]/30 rounded-t-3xl"
                  style={{ zIndex: 9999 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Drag handle */}
                  <div className="flex justify-center pt-3 pb-1">
                    <div className="w-10 h-1 rounded-full bg-white/25" />
                  </div>

                  {/* Scrollable content */}
                  <div className="overflow-y-auto max-h-[70vh] px-6 pb-10">
                    {/* Header */}
                    <div className="flex items-center justify-between py-4">
                      <p className="text-base font-semibold text-white/90">Personalizar</p>
                      <button
                        onClick={() => setOpen(false)}
                        className="w-8 h-8 flex items-center justify-center rounded-xl bg-[#1a1a1c] border border-[#38383a]/30 text-white/40 hover:text-white/70 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Color grid */}
                    <p className="text-[11px] text-white/35 uppercase tracking-widest mb-3 font-medium">Color</p>
                    <div className="grid grid-cols-4 gap-3 mb-6">
                      {COLOR_OPTIONS.map((c) => {
                        const isSelected = c.id === color;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => { onColorChange(c.id); setOpen(false); }}
                            className={cn(
                              'flex flex-col items-center gap-2 py-3 rounded-2xl border transition-all duration-150',
                              isSelected
                                ? 'border-white/40 bg-white/10 scale-95'
                                : 'border-[#38383a]/20 bg-white/3 hover:bg-[#2a2a2c] active:scale-95',
                            )}
                          >
                            <div className={cn('w-8 h-8 rounded-full shadow-lg', c.dot)} />
                            <span className="text-[10px] text-white/40 leading-none">{c.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="border-t border-[#38383a]/20 mb-5" />

                    {/* Emoji button */}
                    <p className="text-[11px] text-white/35 uppercase tracking-widest mb-3 font-medium">Emoticono</p>
                    <button
                      type="button"
                      onClick={openEmojiMode}
                      className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl bg-[#1a1a1c] border border-[#38383a]/30 hover:bg-[#2a2a2c] transition-all active:scale-98 group mb-2"
                    >
                      <span className="text-3xl leading-none">{emoji}</span>
                      <div className="flex-1 text-left">
                        <p className="text-sm font-medium text-white/60 group-hover:text-white/85 transition-colors">Cambiar emoticono</p>
                        <p className="text-xs text-white/25 mt-0.5">Toca para abrir el teclado</p>
                      </div>
                      <span className="text-xl opacity-40">✏️</span>
                    </button>
                  </div>
                </motion.div>
              ) : (
                /* ── Desktop: popover ── */
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -4 }}
                  transition={popTransition}
                  className="fixed bg-[#0f1117] border border-[#38383a]/30 rounded-2xl shadow-2xl shadow-black/60 p-3 w-56"
                  style={{ zIndex: 9999, top: popPos.top, left: popPos.left }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="text-[11px] text-white/35 uppercase tracking-widest mb-3 px-0.5 font-medium">Color</p>
                  <div className="grid grid-cols-4 gap-2 mb-4">
                    {COLOR_OPTIONS.map((c) => {
                      const isSelected = c.id === color;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => { onColorChange(c.id); setOpen(false); }}
                          title={c.label}
                          className={cn(
                            'flex flex-col items-center gap-1.5 py-2.5 rounded-xl border transition-all duration-150',
                            isSelected
                              ? 'border-white/30 bg-[#2a2a2c] scale-95'
                              : 'border-transparent hover:bg-[#1a1a1c] hover:scale-105 active:scale-95',
                          )}
                        >
                          <div className={cn('w-5 h-5 rounded-full', c.dot)} />
                          <span className="text-[9px] text-white/35 leading-none">{c.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="border-t border-[#38383a]/20 mb-3" />

                  <p className="text-[11px] text-white/35 uppercase tracking-widest mb-2 px-0.5 font-medium">Emoticono</p>
                  <button
                    type="button"
                    onClick={openEmojiMode}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[#1a1a1c] border border-[#38383a]/30 hover:bg-[#2a2a2c] transition-all group"
                  >
                    <span className="text-xl leading-none">{emoji}</span>
                    <span className="flex-1 text-left text-xs text-white/50 group-hover:text-white/75 transition-colors">Cambiar emoji…</span>
                    <span className="text-sm opacity-40">✏️</span>
                  </button>
                </motion.div>
              )}
            </>
          )}
        </AnimatePresence>
      </Portal>

      {/* ══════════════════════════════════════════════════════════
          EMOJI PICKER — also in a Portal
          ══════════════════════════════════════════════════════════ */}
      <Portal>
        <AnimatePresence>
          {emojiMode && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="fixed inset-0 bg-black/55 backdrop-blur-sm"
                style={{ zIndex: 9998 }}
                onClick={() => setEmojiMode(false)}
              />

              {isTouch ? (
                /* ── Mobile: bottom sheet ── */
                <motion.div
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  transition={sheetTransition}
                  className="fixed bottom-0 left-0 right-0 bg-[#0f1117] border-t border-[#38383a]/30 rounded-t-3xl px-6 pb-10"
                  style={{ zIndex: 9999 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Drag handle */}
                  <div className="flex justify-center pt-3 pb-1">
                    <div className="w-10 h-1 rounded-full bg-white/25" />
                  </div>

                  {/* Header */}
                  <div className="flex items-center justify-between py-4">
                    <p className="text-base font-semibold text-white/90">Elige un emoticono</p>
                    <button
                      onClick={() => setEmojiMode(false)}
                      className="w-8 h-8 flex items-center justify-center rounded-xl bg-[#1a1a1c] border border-[#38383a]/30 text-white/40 hover:text-white/70 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Input row */}
                  <div className="flex items-center gap-4 mb-5">
                    <span className="text-5xl leading-none select-none">{emoji}</span>
                    <div className="flex-1">
                      <p className="text-xs text-white/40 mb-3 leading-relaxed">
                        Toca el campo y abre el teclado emoji del sistema
                      </p>
                      <input
                        ref={emojiInputRef}
                        type="text"
                        inputMode="text"
                        className="w-full bg-[#2a2a2c] border border-white/20 rounded-2xl px-4 py-4 text-4xl text-center focus:outline-none focus:border-blue-400/60 text-white placeholder-white/20"
                        placeholder="😀"
                        onKeyDown={handleEmojiKeyDown}
                        onInput={handleEmojiInput}
                        autoComplete="off"
                        autoCorrect="off"
                        spellCheck={false}
                      />
                    </div>
                  </div>

                  <p className="text-center text-xs text-white/25 pb-2">
                    iOS: mantén 🌐 · Android: toca ☺ en el teclado
                  </p>
                </motion.div>
              ) : (
                /* ── Desktop: popover ── */
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -4 }}
                  transition={popTransition}
                  className="fixed bg-[#0f1117] border border-[#38383a]/30 rounded-2xl shadow-2xl shadow-black/60 p-4 w-64"
                  style={{ zIndex: 9999, top: popPos.top, left: popPos.left }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm font-semibold text-white/80">Elige un emoticono</p>
                    <button
                      onClick={() => setEmojiMode(false)}
                      className="w-7 h-7 flex items-center justify-center rounded-xl bg-[#1a1a1c] border border-[#38383a]/30 text-white/40 hover:text-white/70 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-4xl leading-none">{emoji}</span>
                    <div className="flex-1">
                      <p className="text-xs text-white/40 mb-2">Escribe o pega un emoji</p>
                      <input
                        ref={emojiInputRef}
                        type="text"
                        inputMode="text"
                        className="w-full bg-[#2a2a2c] border border-white/20 rounded-xl px-3 py-2.5 text-2xl text-center focus:outline-none focus:border-blue-400/50 text-white placeholder-white/20"
                        placeholder="😀"
                        onKeyDown={handleEmojiKeyDown}
                        onInput={handleEmojiInput}
                        autoComplete="off"
                        autoCorrect="off"
                        spellCheck={false}
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </>
          )}
        </AnimatePresence>
      </Portal>
    </div>
  );
}
