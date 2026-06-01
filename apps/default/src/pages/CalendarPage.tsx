import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  GraduationCap,
  Target,
} from 'lucide-react';
import { cn } from '../lib/utils';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  addDays,
  eachDayOfInterval,
  isToday,
  getDate,
} from 'date-fns';
import { es } from 'date-fns/locale';
import type { StudyPlan, StudyBlock } from '../lib/api';

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

interface Props {
  plans?: StudyPlan[];
  blocks?: StudyBlock[];
}

interface DayInfo {
  exam?: StudyPlan;
  blocks: StudyBlock[];
  doneCount: number;
  totalCount: number;
}

export function CalendarPage({ plans = [], blocks = [] }: Props) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [direction, setDirection] = useState(0);

  const goPrev = () => {
    setDirection(-1);
    setCurrentMonth((m) => subMonths(m, 1));
  };

  const goNext = () => {
    setDirection(1);
    setCurrentMonth((m) => addMonths(m, 1));
  };

  const goToday = () => {
    const today = new Date();
    setDirection(today < currentMonth ? -1 : 1);
    setCurrentMonth(today);
    setSelectedDate(today);
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { locale: es, weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { locale: es, weekStartsOn: 1 });

  const days = useMemo(
    () => eachDayOfInterval({ start: calendarStart, end: calendarEnd }),
    [calendarStart, calendarEnd]
  );

  // Build day info map from real plans and blocks
  const dayInfoMap = useMemo(() => {
    const map = new Map<string, DayInfo>();
    for (const plan of plans) {
      const key = plan.examDate;
      const existing = map.get(key) ?? { blocks: [], doneCount: 0, totalCount: 0 };
      existing.exam = plan;
      map.set(key, existing);
    }
    for (const block of blocks) {
      const key = block.date;
      const existing = map.get(key) ?? { blocks: [], doneCount: 0, totalCount: 0 };
      existing.blocks.push(block);
      existing.totalCount++;
      if (block.status === 'opt-done') existing.doneCount++;
      map.set(key, existing);
    }
    return map;
  }, [plans, blocks]);

  function getDayInfo(date: Date): DayInfo | undefined {
    const key = format(date, 'yyyy-MM-dd');
    return dayInfoMap.get(key);
  }

  const selectedInfo = selectedDate ? getDayInfo(selectedDate) : undefined;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 sm:px-6 pt-4 pb-3 flex-shrink-0">
        <div className="flex items-baseline gap-2 min-w-0">
          <h2 className="text-[15px] font-semibold text-white capitalize truncate">
            {format(currentMonth, 'MMMM', { locale: es })}
          </h2>
          <span className="text-[13px] text-white/35 tabular-nums">
            {format(currentMonth, 'yyyy')}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={goToday}
            className="hidden sm:flex items-center px-2.5 py-1.5 rounded-lg text-[12px] text-white/55 hover:text-white hover:bg-[#1a1a1c] transition-all font-medium"
          >
            Hoy
          </button>
          <button
            onClick={goPrev}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-white/45 hover:text-white hover:bg-[#1a1a1c] transition-all active:scale-95"
            aria-label="Mes anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={goNext}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-white/45 hover:text-white hover:bg-[#1a1a1c] transition-all active:scale-95"
            aria-label="Mes siguiente"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Weekday labels */}
      <div className="grid grid-cols-7 px-4 sm:px-6 pb-2 flex-shrink-0">
        {WEEKDAYS.map((label, i) => (
          <div
            key={label}
            className={cn(
              'text-center text-[11px] font-semibold uppercase tracking-wider py-2',
              i >= 5 ? 'text-white/25' : 'text-white/35'
            )}
          >
            {label}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={format(currentMonth, 'yyyy-MM')}
            custom={direction}
            initial={{ opacity: 0, x: direction > 0 ? 30 : -30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction > 0 ? -30 : 30 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="grid grid-cols-7 gap-1"
          >
            {days.map((day) => {
              const inMonth = isSameMonth(day, currentMonth);
              const selected = selectedDate ? isSameDay(day, selectedDate) : false;
              const today = isToday(day);
              const info = getDayInfo(day);
              const hasExam = !!info?.exam;
              const hasBlocks = (info?.blocks.length ?? 0) > 0;
              const allDone = hasBlocks && info!.doneCount === info!.totalCount;
              const progress = hasBlocks && info!.totalCount > 0 ? (info!.doneCount / info!.totalCount) * 100 : 0;

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDate(day)}
                  className={cn(
                    'relative aspect-square rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-all duration-200',
                    'hover:bg-[#1a1a1c] active:scale-95',
                    !inMonth && 'opacity-20 pointer-events-none',
                    selected
                      ? 'bg-blue-500/20 border border-blue-500/40 '
                      : 'border border-transparent',
                    today && !selected && 'bg-[#2a2a2c] border-[#38383a]/30'
                  )}
                >
                  {/* Today indicator dot */}
                  {today && (
                    <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#0a84ff] " />
                  )}

                  {/* Exam indicator */}
                  {hasExam && (
                    <div className="absolute top-1.5 left-1.5 w-1.5 h-1.5 rounded-full bg-rose-400 " />
                  )}

                  {/* Day number */}
                  <span
                    className={cn(
                      'text-sm font-medium tabular-nums',
                      today
                        ? 'text-[#0a84ff] font-bold'
                        : selected
                        ? 'text-white'
                        : 'text-white/60'
                    )}
                  >
                    {getDate(day)}
                  </span>

                  {/* Mini progress bar for days with blocks */}
                  {hasBlocks && inMonth && (
                    <div className="w-5 h-1 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-300',
                          allDone ? 'bg-emerald-400' : 'bg-[#0a84ff]'
                        )}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  )}

                  {/* Dot for days with exam but no blocks */}
                  {hasExam && !hasBlocks && inMonth && (
                    <div className="w-1 h-1 rounded-full bg-rose-400/60" />
                  )}
                </button>
              );
            })}
          </motion.div>
        </AnimatePresence>

        {/* Mobile "Hoy" button */}
        <div className="sm:hidden flex justify-center mt-4">
          <button
            onClick={goToday}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1a1a1c] border border-[#38383a]/30 text-white/50 hover:text-white/75 hover:bg-[#2a2a2c] text-sm transition-all"
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            Ir a hoy
          </button>
        </div>

        {/* Selected day detail panel */}
        <AnimatePresence>
          {selectedDate && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2 }}
              className="mt-6 p-5 rounded-2xl bg-[#1a1a1c] border border-[#38383a]/30"
            >
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg bg-[#0a84ff]/10 flex items-center justify-center">
                  <Clock className="w-3.5 h-3.5 text-[#0a84ff]" />
                </div>
                <h3 className="text-sm font-semibold text-white/80">
                  {format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}
                </h3>
              </div>

              {selectedInfo ? (
                <div className="space-y-3">
                  {/* Exam info */}
                  {selectedInfo.exam && (
                    <div className="p-3 rounded-xl bg-rose-500/8 border border-rose-500/15">
                      <div className="flex items-center gap-2 mb-1">
                        <GraduationCap className="w-4 h-4 text-[#ff453a]" />
                        <span className="text-sm font-semibold text-white/80">Examen</span>
                      </div>
                      <p className="text-xs text-white/40">
                        {selectedInfo.exam.subject} · {selectedInfo.exam.totalPages} páginas
                      </p>
                    </div>
                  )}

                  {/* Blocks info */}
                  {selectedInfo.blocks.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Target className="w-3.5 h-3.5 text-[#0a84ff]" />
                        <span className="text-xs font-medium text-white/40">
                          Bloques de estudio ({selectedInfo.doneCount}/{selectedInfo.totalCount})
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {selectedInfo.blocks.map((blk) => {
                          const isDone = blk.status === 'opt-done';
                          return (
                            <div
                              key={blk.id}
                              className={cn(
                                'p-2.5 rounded-xl border text-xs transition-all',
                                isDone
                                  ? 'bg-emerald-500/8 border-emerald-500/15 text-[#30d158]'
                                  : 'bg-[#1a1a1c] border-[#38383a]/20 text-white/50'
                              )}
                            >
                              <div className="font-medium">Págs {blk.startPage}-{blk.endPage}</div>
                              <div className="text-[10px] opacity-60 mt-0.5">
                                {isDone ? 'Completado' : 'Pendiente'}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-4 text-white/25 text-sm">
                  Sin datos de estudio para este día
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
