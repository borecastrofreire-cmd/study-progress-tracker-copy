import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock, BookOpen, Plus, Trash2, CheckCircle2, AlertCircle,
  Sparkles, CalendarDays, FileText, Target, X,
  Zap, BrainCircuit,
} from 'lucide-react';
import { cn } from '../lib/utils';
import {
  format, addDays, differenceInDays, isBefore, startOfDay,
  parseISO, isValid, isPast, isToday,
} from 'date-fns';
import { es } from 'date-fns/locale';
import type { Subject } from '../types/study';
import type { StudyPlan, StudyBlock } from '../lib/api';
import { getEstimatedMinutes, formatMinutes } from '../lib/readingTime';

type Difficulty = 'easy' | 'normal' | 'hard';

interface StudyPlannerPageProps {
  userId: string;
  subjects: Subject[];
  existingPlans: StudyPlan[];
  existingBlocks: StudyBlock[];
  onCreatePlan: (plan: Omit<StudyPlan, 'id' | 'userId' | 'status'>, blocks: Omit<StudyBlock, 'id' | 'userId' | 'status'>[]) => void;
  onDeletePlan: (planId: string) => void;
  onToggleBlock: (blockId: string, status: StudyBlock['status']) => void;
}

interface PlanPreview {
  totalBlocks: number;
  pagesPerBlock: number;
  totalMinutes: number;
  blocks: { date: Date; startPage: number; endPage: number }[];
}

function calculatePlan(
  examDateStr: string,
  remainingPages: number,
  baseTimeMinutes: number,
  difficulty: Difficulty,
  blockMinutes: number,
  startPage: number,
): PlanPreview | null {
  const examDate = parseISO(examDateStr);
  const today = startOfDay(new Date());
  if (!isValid(examDate) || isBefore(examDate, today)) return null;
  if (remainingPages <= 0 || baseTimeMinutes <= 0 || blockMinutes <= 0) return null;

  const difficultyBonus = difficulty === 'easy' ? 0 : difficulty === 'normal' ? 30 : 60;
  const totalMinutes = baseTimeMinutes + difficultyBonus;
  const totalBlocks = Math.max(1, Math.ceil(totalMinutes / blockMinutes));
  const daysAvailable = Math.max(1, differenceInDays(examDate, today));
  const blocksPerDay = Math.max(1, Math.ceil(totalBlocks / daysAvailable));
  const pagesPerBlock = Math.max(1, Math.ceil(remainingPages / totalBlocks));

  const blocks: { date: Date; startPage: number; endPage: number }[] = [];
  let currentPage = startPage;
  let dayIndex = 0;
  let blocksInCurrentDay = 0;

  for (let i = 0; i < totalBlocks; i++) {
    if (blocksInCurrentDay >= blocksPerDay) {
      dayIndex++;
      blocksInCurrentDay = 0;
    }
    const date = addDays(today, dayIndex);
    const endPage = Math.min(currentPage + pagesPerBlock - 1, startPage + remainingPages - 1);
    blocks.push({ date, startPage: currentPage, endPage });
    currentPage = endPage + 1;
    blocksInCurrentDay++;
    if (currentPage > startPage + remainingPages - 1) break;
  }

  return { totalBlocks: blocks.length, pagesPerBlock, totalMinutes, blocks };
}

export function StudyPlannerPage({
  subjects,
  existingPlans,
  existingBlocks,
  onCreatePlan,
  onDeletePlan,
  onToggleBlock,
}: StudyPlannerPageProps) {
  const [mode, setMode] = useState<'list' | 'create'>('list');

  const [selectedSubject, setSelectedSubject] = useState('');
  const [examDate, setExamDate] = useState('');
  const [totalPages, setTotalPages] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [blockMinutes, setBlockMinutes] = useState('70');
  const [startPage, setStartPage] = useState('1');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Tiempo base calculado automáticamente desde las páginas restantes
  const baseTime = useMemo(() => {
    const pages = Number(totalPages);
    if (!pages || pages <= 0) return 0;
    return getEstimatedMinutes(pages);
  }, [totalPages]);

  useEffect(() => {
    if (!selectedSubject) return;
    const subject = subjects.find((s) => s.text === selectedSubject);
    if (!subject || subject.topics.length === 0) return;

    const sumTotalPages = subject.topics.reduce((sum, t) => sum + (t.totalPages || 0), 0);
    const currentPageVal = subject.topics[0]?.currentPage ?? 1;
    const remaining = Math.max(0, sumTotalPages - currentPageVal + 1);

    if (sumTotalPages > 0) setTotalPages(String(remaining));
    if (currentPageVal > 0) setStartPage(String(currentPageVal));
  }, [selectedSubject, subjects]);

  const preview = useMemo(() => {
    if (!examDate || !totalPages || !baseTime) return null;
    return calculatePlan(
      examDate,
      Number(totalPages),
      Number(baseTime),
      difficulty,
      Number(blockMinutes) || 70,
      Number(startPage) || 1,
    );
  }, [examDate, totalPages, baseTime, difficulty, blockMinutes, startPage]);

  const totalStudyHours = useMemo(() => {
    if (!preview) return 0;
    return Math.round((preview.totalMinutes / 60) * 10) / 10;
  }, [preview]);

  const handleCreate = async () => {
    if (!preview || !selectedSubject || !examDate) return;
    setIsSubmitting(true);

    try {
      const plan: Omit<StudyPlan, 'id' | 'userId' | 'status'> = {
        subject: selectedSubject,
        examDate,
        blockDurationMinutes: Number(blockMinutes) || 70,
        totalPages: Number(totalPages),
        pagesPerHour: 0,
        startPage: Number(startPage) || 1,
      };

      const blocks: Omit<StudyBlock, 'id' | 'userId' | 'status'>[] = preview.blocks.map((b) => ({
        planId: '',
        date: format(b.date, 'yyyy-MM-dd'),
        startPage: b.startPage,
        endPage: b.endPage,
      }));

      await onCreatePlan(plan, blocks);

      setSelectedSubject('');
      setExamDate('');
      setTotalPages('');
      setDifficulty('normal');
      setBlockMinutes('70');
      setStartPage('1');
      setMode('list');
    } catch (err) {
      console.error('Error creando plan:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (planId: string) => {
    if (!confirm('Eliminar este plan y todos sus bloques?')) return;
    onDeletePlan(planId);
  };

  const groupedBlocks = useMemo(() => {
    const map = new Map<string, StudyBlock[]>();
    for (const b of existingBlocks) {
      const list = map.get(b.planId) ?? [];
      list.push(b);
      map.set(b.planId, list);
    }
    return map;
  }, [existingBlocks]);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {mode === 'list' && existingPlans.length > 0 && (
        <div className="flex items-center justify-between px-4 sm:px-6 pt-4 pb-2 flex-shrink-0">
          <div className="flex items-baseline gap-2">
            <h2 className="text-[15px] font-semibold text-white/90">Tus planes</h2>
            <span className="text-xs text-white/30 tabular-nums">{existingPlans.length}</span>
          </div>
          <button
            onClick={() => setMode('create')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-black text-[13px] font-medium hover:bg-white/90 transition-all active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            Nuevo plan
          </button>
        </div>
      )}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 pt-2 pb-24 sm:pb-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        <AnimatePresence mode="wait">
          {mode === 'create' ? (
            <CreatePlanForm
              key="create"
              subjects={subjects}
              selectedSubject={selectedSubject}
              onSelectSubject={setSelectedSubject}
              examDate={examDate}
              onExamDate={setExamDate}
              totalPages={totalPages}
              onTotalPages={setTotalPages}
              baseTime={baseTime}
              difficulty={difficulty}
              onDifficulty={setDifficulty}
              blockMinutes={blockMinutes}
              onBlockMinutes={setBlockMinutes}
              startPage={startPage}
              onStartPage={setStartPage}
              preview={preview}
              totalStudyHours={totalStudyHours}
              isSubmitting={isSubmitting}
              onCancel={() => setMode('list')}
              onCreate={handleCreate}
            />
          ) : (
            <PlanList
              key="list"
              plans={existingPlans}
              blocksMap={groupedBlocks}
              onDelete={handleDelete}
              onToggleBlock={onToggleBlock}
              onStartCreate={() => setMode('create')}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

interface CreatePlanFormProps {
  subjects: Subject[];
  selectedSubject: string;
  onSelectSubject: (v: string) => void;
  examDate: string;
  onExamDate: (v: string) => void;
  totalPages: string;
  onTotalPages: (v: string) => void;
  baseTime: number;
  difficulty: Difficulty;
  onDifficulty: (v: Difficulty) => void;
  blockMinutes: string;
  onBlockMinutes: (v: string) => void;
  startPage: string;
  onStartPage: (v: string) => void;
  preview: PlanPreview | null;
  totalStudyHours: number;
  isSubmitting: boolean;
  onCancel: () => void;
  onCreate: () => void;
}

function CreatePlanForm({
  subjects, selectedSubject, onSelectSubject, examDate, onExamDate,
  totalPages, onTotalPages, baseTime, difficulty, onDifficulty,
  blockMinutes, onBlockMinutes, startPage, onStartPage,
  preview, totalStudyHours, isSubmitting, onCancel, onCreate,
}: CreatePlanFormProps) {
  const difficultyBonus = difficulty === 'easy' ? 0 : difficulty === 'normal' ? 30 : 60;
  const adjustedTime = baseTime + difficultyBonus;
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.2 }} className="max-w-xl mx-auto">
      <div className="flex items-center justify-between mb-6 pt-2">
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 text-[13px] text-white/45 hover:text-white/80 transition-colors"
        >
          <X className="w-4 h-4" />
          Cancelar
        </button>
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-[#0a84ff]" />
          <h3 className="text-sm font-semibold text-white/85">Nuevo plan</h3>
        </div>
        <div className="w-16" />
      </div>
      <div className="space-y-5">
        {/* SECCIÓN: Qué y cuándo */}
        <section className="space-y-3 p-4 rounded-2xl bg-[#1a1a1c] border border-[#38383a]/30">
          <div className="flex items-center gap-1.5 mb-1">
            <BookOpen className="w-3 h-3 text-white/40" />
            <span className="text-[11px] uppercase tracking-wider font-semibold text-white/40">Asignatura y fecha</span>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-white/50 mb-1.5">Asignatura</label>
            <select value={selectedSubject} onChange={(e) => onSelectSubject(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-[#1a1a1c] border border-[#38383a]/30 text-sm text-white/85 focus:outline-none focus:border-[#0a84ff]/60 focus:bg-[#2a2a2c] transition-colors">
              <option value="" disabled>Selecciona una asignatura</option>
              {subjects.map((s) => <option key={s.id} value={s.text}>{s.text}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-white/50 mb-1.5">Fecha del examen</label>
            <input type="date" value={examDate} onChange={(e) => onExamDate(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-[#1a1a1c] border border-[#38383a]/30 text-sm text-white/85 focus:outline-none focus:border-[#0a84ff]/60 focus:bg-[#2a2a2c] transition-colors [color-scheme:dark]" />
          </div>
        </section>

        {/* SECCIÓN: Páginas */}
        <section className="space-y-3 p-4 rounded-2xl bg-[#1a1a1c] border border-[#38383a]/30">
          <div className="flex items-center gap-1.5 mb-1">
            <FileText className="w-3 h-3 text-white/40" />
            <span className="text-[11px] uppercase tracking-wider font-semibold text-white/40">Páginas</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-white/50 mb-1.5">Página actual</label>
              <input type="number" min={1} value={startPage} onChange={(e) => onStartPage(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-[#1a1a1c] border border-[#38383a]/30 text-sm text-white/85 focus:outline-none focus:border-[#0a84ff]/60 focus:bg-[#2a2a2c] transition-colors tabular-nums" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-white/50 mb-1.5">Páginas restantes</label>
              <input type="number" min={1} value={totalPages} onChange={(e) => onTotalPages(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-[#1a1a1c] border border-[#38383a]/30 text-sm text-white/85 focus:outline-none focus:border-[#0a84ff]/60 focus:bg-[#2a2a2c] transition-colors tabular-nums" />
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1a1a1c] text-[11px] text-white/45">
            <Clock className="w-3 h-3 text-white/30 flex-shrink-0" />
            {baseTime > 0 ? (
              <span>
                Tiempo base: <strong className="text-white/70">{formatMinutes(baseTime)}</strong>
              </span>
            ) : (
              <span className="text-white/30">Selecciona una asignatura para estimar tiempo</span>
            )}
          </div>
        </section>

        {/* SECCIÓN: Dificultad y bloque */}
        <section className="space-y-3 p-4 rounded-2xl bg-[#1a1a1c] border border-[#38383a]/30">
          <div className="flex items-center gap-1.5 mb-1">
            <BrainCircuit className="w-3 h-3 text-white/40" />
            <span className="text-[11px] uppercase tracking-wider font-semibold text-white/40">Dificultad y ritmo</span>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-white/50 mb-1.5">Dificultad</label>
            <div className="grid grid-cols-3 gap-2">
            {(['easy', 'normal', 'hard'] as Difficulty[]).map((d) => {
              const isActive = difficulty === d;
              const label = d === 'easy' ? 'Fácil' : d === 'normal' ? 'Normal' : 'Difícil';
              const icon = d === 'easy' ? <Zap className="w-3.5 h-3.5" /> : d === 'normal' ? <BrainCircuit className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />;
              const colorClass =
                d === 'easy' ? 'text-[#30d158] border-emerald-500/30' :
                d === 'normal' ? 'text-[#0a84ff] border-[#0a84ff]/30' :
                'text-[#ff453a] border-rose-500/30';
              const activeClass =
                d === 'easy' ? 'bg-emerald-500/15' :
                d === 'normal' ? 'bg-[#0a84ff]/10' :
                'bg-rose-500/15';
              return (
                <button
                  key={d}
                  onClick={() => onDifficulty(d)}
                  className={cn(
                    'flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl border text-xs font-medium transition-all',
                    isActive ? `${colorClass} ${activeClass} border-opacity-60` : 'border-[#38383a]/30 text-white/40 hover:border-white/20 hover:text-white/60'
                  )}
                >
                  {icon}
                  {label}
                </button>
              );
            })}
          </div>
            <p className="text-[10px] text-white/30 mt-1.5">
              {difficulty === 'easy' ? `Tiempo ajustado: ${formatMinutes(baseTime)} (sin ajuste)` :
               difficulty === 'normal' ? `Tiempo ajustado: ${formatMinutes(adjustedTime)} (+30 min)` :
               `Tiempo ajustado: ${formatMinutes(adjustedTime)} (+1 h)`}
            </p>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-white/50 mb-1.5">Minutos por bloque</label>
            <input type="number" min={10} step={5} value={blockMinutes} onChange={(e) => onBlockMinutes(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-[#1a1a1c] border border-[#38383a]/30 text-sm text-white/85 focus:outline-none focus:border-[#0a84ff]/60 focus:bg-[#2a2a2c] transition-colors tabular-nums" />
          </div>
        </section>

        {/* PREVIEW */}
        {preview && preview.blocks.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-2xl bg-[#1a1a1c] border border-[#0a84ff]/20"
          >
            <div className="flex items-center gap-1.5 mb-3">
              <Sparkles className="w-3.5 h-3.5 text-[#0a84ff]" />
              <span className="text-[11px] uppercase tracking-wider font-semibold text-[#0a84ff]">Vista previa</span>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <Stat label="Bloques" value={String(preview.totalBlocks)} />
              <Stat label="Días" value={String(new Set(preview.blocks.map((b) => format(b.date, 'yyyy-MM-dd'))).size)} />
              <Stat label="Total" value={`${totalStudyHours}h`} />
            </div>
            <div className="flex flex-wrap gap-1">
              {preview.blocks.slice(0, 10).map((blk, i) => (
                <span key={i} className="px-2 py-0.5 rounded-md bg-[#2a2a2c] text-[10px] text-white/55 tabular-nums">{format(blk.date, 'd/M')} · p.{blk.startPage}–{blk.endPage}</span>
              ))}
              {preview.blocks.length > 10 && <span className="px-2 py-0.5 rounded-md text-[10px] text-white/40">+{preview.blocks.length - 10} más</span>}
            </div>
          </motion.section>
        )}

        <button onClick={onCreate} disabled={isSubmitting || !preview} className={cn('w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.98]', isSubmitting || !preview ? 'bg-[#1a1a1c] text-white/20 cursor-not-allowed' : 'bg-white text-black hover:bg-white/90 ')}>
          <CheckCircle2 className="w-4 h-4" />
          {isSubmitting ? 'Creando…' : 'Crear plan'}
        </button>
      </div>
    </motion.div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-2 px-1 rounded-lg bg-[#2a2a2c]">
      <span className="text-base font-semibold text-white tabular-nums">{value}</span>
      <span className="text-[10px] text-white/40 mt-0.5">{label}</span>
    </div>
  );
}

interface PlanListProps {
  plans: StudyPlan[];
  blocksMap: Map<string, StudyBlock[]>;
  onDelete: (planId: string) => void;
  onToggleBlock: (blockId: string, status: StudyBlock['status']) => void;
}

interface PlanListPropsExt extends PlanListProps {
  onStartCreate?: () => void;
}

function PlanList({ plans, blocksMap, onDelete, onToggleBlock, onStartCreate }: PlanListPropsExt) {
  if (plans.length === 0) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-14 h-14 rounded-2xl bg-[#1a1a1c] border border-[#38383a]/30 flex items-center justify-center mb-4">
          <Target className="w-6 h-6 text-white/25" />
        </div>
        <p className="text-white/70 text-[15px] font-medium mb-1">Aún no tienes planes</p>
        <p className="text-white/35 text-xs max-w-[260px] mb-5">
          Crea un plan para distribuir páginas y bloques de estudio hasta el día del examen.
        </p>
        {onStartCreate && (
          <button
            onClick={onStartCreate}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-black text-sm font-medium hover:bg-white/90 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Crear primer plan
          </button>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
      {plans.map((plan) => {
        const planBlocks = blocksMap.get(plan.id) ?? [];
        const done = planBlocks.filter((b) => b.status === 'opt-done').length;
        const total = planBlocks.length;
        const exam = parseISO(plan.examDate);
        const isExamPast = isPast(exam) && !isToday(exam);

        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
        const daysToExam = differenceInDays(exam, startOfDay(new Date()));

        return (
          <motion.div
            key={plan.id}
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl bg-[#1a1a1c] border border-[#38383a]/30 hover:border-[#38383a]/50 transition-colors overflow-hidden"
          >
            <div className="p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <h3 className="text-[15px] font-semibold text-white truncate">{plan.subject}</h3>
                    {isExamPast ? (
                      <span className="px-1.5 py-0.5 rounded-md bg-[#1a1a1c] text-[10px] text-white/40 flex-shrink-0">Finalizado</span>
                    ) : daysToExam <= 7 ? (
                      <span className="px-1.5 py-0.5 rounded-md bg-[#ff9f0a]/10 text-[#ff9f0a] text-[10px] font-medium flex-shrink-0">
                        {daysToExam <= 0 ? 'Hoy' : `${daysToExam}d restantes`}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-x-3 gap-y-1 text-[11px] text-white/40 flex-wrap">
                    <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" />{format(exam, "d MMM yyyy", { locale: es })}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{plan.blockDurationMinutes} min</span>
                    <span className="flex items-center gap-1"><FileText className="w-3 h-3" />{plan.totalPages} págs</span>
                  </div>
                </div>
                <button
                  onClick={() => onDelete(plan.id)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-white/30 hover:text-[#ff453a] hover:bg-[#ff453a]/10 transition-all flex-shrink-0"
                  aria-label="Eliminar plan"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-[#0a84ff]"
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                  />
                </div>
                <span className="text-[11px] text-white/55 tabular-nums font-medium">
                  {done}/{total}
                  <span className="text-white/30 ml-1">({pct}%)</span>
                </span>
              </div>
            </div>

            {planBlocks.length > 0 && (
              <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-3 border-t border-[#38383a]/20 bg-[#111113]">
                <div className="grid grid-cols-7 gap-1.5">
                  {planBlocks.slice(0, 14).map((blk) => {
                    const blkDate = parseISO(blk.date);
                    const isDone = blk.status === 'opt-done';
                    const isMissed = blk.status === 'opt-missed' || (isPast(blkDate) && !isToday(blkDate) && blk.status !== 'opt-done');
                    const isCurrentDay = isToday(blkDate);
                    return (
                      <button
                        key={blk.id}
                        onClick={() => onToggleBlock(blk.id, isDone ? 'opt-pending' : 'opt-done')}
                        title={`${format(blkDate, "EEE d MMM", { locale: es })} · págs ${blk.startPage}-${blk.endPage}`}
                        className={cn(
                          'flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 rounded-lg border text-[10px] transition-all active:scale-95',
                          isDone
                            ? 'bg-emerald-500/12 border-emerald-500/25 text-emerald-300'
                            : isMissed
                            ? 'bg-rose-500/8 border-[#ff453a]/20 text-rose-300/80'
                            : isCurrentDay
                            ? 'bg-blue-500/12 border-[#0a84ff]/30 text-blue-300'
                            : 'bg-[#1a1a1c] border-[#38383a]/30 text-white/45 hover:bg-[#2a2a2c] hover:text-white/65'
                        )}
                      >
                        <span className="font-semibold tabular-nums">{format(blkDate, 'd')}</span>
                        <span className="opacity-60 tabular-nums text-[9px]">{blk.startPage}–{blk.endPage}</span>
                      </button>
                    );
                  })}
                  {planBlocks.length > 14 && (
                    <div className="flex items-center justify-center text-[10px] text-white/30 font-medium">
                      +{planBlocks.length - 14}
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        );
      })}
    </motion.div>
  );
}
