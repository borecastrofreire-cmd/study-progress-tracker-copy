import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, RefreshCw, Trash2, CheckCircle2, Circle,
  CalendarClock, X, ChevronDown, FolderOpen, Pencil, Tag,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  fetchGroups, createGroup, deleteGroup, renameGroup,
  createTask, toggleTask, deleteTask, NOGROUP_ID,
} from '../lib/api';
import type { Task, TaskGroup } from '../types/study';
import { format, isToday, isTomorrow, isPast, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '../lib/utils';

interface TasksPanelProps { userId: string; }

// ─── helpers ─────────────────────────────────────────────────────────────────
function deadlineLabel(iso: string): { label: string; overdue: boolean; urgent: boolean } {
  const date = parseISO(iso);
  const overdue = isPast(date) && !isToday(date);
  const urgent  = isToday(date) || isTomorrow(date) || overdue;
  const label   = isToday(date)
    ? `Hoy · ${format(date, 'HH:mm')}`
    : isTomorrow(date)
    ? `Mañana · ${format(date, 'HH:mm')}`
    : format(date, 'd MMM · HH:mm', { locale: es });
  return { label, overdue, urgent };
}

const inputCls =
  'w-full bg-[#1a1a1c] border border-[#38383a]/30 rounded-xl px-3 py-2.5 text-sm ' +
  'text-white/90 placeholder-white/25 focus:outline-none focus:border-white/30 transition-colors';

// ─── Modal: rename / new group ────────────────────────────────────────────────
function GroupModal({
  initial = '',
  title,
  onClose,
  onConfirm,
}: {
  initial?: string;
  title: string;
  onClose: () => void;
  onConfirm: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { setTimeout(() => ref.current?.focus(), 80); }, []);

  const confirm = async () => {
    if (!name.trim()) { setError('Escribe un nombre'); return; }
    setSaving(true);
    try { await onConfirm(name.trim()); onClose(); }
    catch { setError('Error al guardar.'); setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 32, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 32, scale: 0.97 }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        className="w-full max-w-xs bg-[#0f1117] border border-[#38383a]/30 rounded-2xl p-5 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold text-sm">{title}</h3>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <input
          ref={ref}
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); setError(''); }}
          placeholder="Ej: Universidad, Casa, Trabajo…"
          className={inputCls}
          onKeyDown={(e) => { if (e.key === 'Enter') confirm(); }}
        />
        {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[#38383a]/30 text-white/40 text-sm hover:text-white/60 transition-all">
            Cancelar
          </button>
          <button onClick={confirm} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold transition-colors disabled:opacity-50">
            {saving ? 'Guardando…' : 'Confirmar'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Modal: Add task ──────────────────────────────────────────────────────────
function AddTaskModal({
  groups,
  defaultGroupId,
  onClose,
  onAdd,
  onCreateGroup,
}: {
  groups: TaskGroup[];
  defaultGroupId: string;
  onClose: () => void;
  onAdd: (groupId: string, text: string, deadline: string | null) => Promise<void>;
  onCreateGroup: (name: string) => Promise<TaskGroup>;
}) {
  const [text, setText] = useState('');
  const [groupId, setGroupId] = useState(defaultGroupId);
  const [deadline, setDeadline] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // inline "create group" state
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [savingGroup, setSavingGroup] = useState(false);

  const textRef = useRef<HTMLInputElement>(null);
  const groupRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setTimeout(() => textRef.current?.focus(), 80); }, []);
  useEffect(() => {
    if (creatingGroup) setTimeout(() => groupRef.current?.focus(), 60);
  }, [creatingGroup]);

  // named groups (exclude the virtual NOGROUP)
  const namedGroups = groups.filter((g) => g.id !== NOGROUP_ID);

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    setSavingGroup(true);
    try {
      const created = await onCreateGroup(newGroupName.trim());
      setGroupId(created.id);
      setNewGroupName('');
      setCreatingGroup(false);
    } catch {
      toast.error('Error al crear el grupo');
    } finally {
      setSavingGroup(false);
    }
  };

  const confirm = async () => {
    if (!text.trim()) { setError('Escribe el nombre de la tarea'); return; }
    setSaving(true);
    try {
      await onAdd(groupId, text.trim(), deadline ? new Date(deadline).toISOString() : null);
      onClose();
    } catch { setError('Error al guardar.'); setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 32, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 32, scale: 0.97 }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        className="w-full max-w-sm bg-[#0f1117] border border-[#38383a]/30 rounded-2xl p-5 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold text-sm">Nueva tarea</h3>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          {/* Task name */}
          <div>
            <label className="block text-xs text-white/40 mb-1.5">Tarea</label>
            <input
              ref={textRef}
              type="text"
              value={text}
              onChange={(e) => { setText(e.target.value); setError(''); }}
              placeholder="Ej: Estudiar tema 3"
              className={inputCls}
              onKeyDown={(e) => { if (e.key === 'Enter') confirm(); }}
            />
          </div>

          {/* Group selector */}
          <div>
            <label className="block text-xs text-white/40 mb-1.5">Grupo <span className="text-white/20">(opcional)</span></label>

            {!creatingGroup ? (
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <select
                    value={groupId}
                    onChange={(e) => setGroupId(e.target.value)}
                    className="w-full appearance-none bg-[#1a1a1c] border border-[#38383a]/30 rounded-xl px-3 py-2.5 text-sm text-white/90 focus:outline-none focus:border-white/30 transition-colors pr-8"
                    style={{ colorScheme: 'dark' }}
                  >
                    <option value={NOGROUP_ID} style={{ background: '#0f1117' }}>— Sin grupo —</option>
                    {namedGroups.map((g) => (
                      <option key={g.id} value={g.id} style={{ background: '#0f1117' }}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
                </div>
                {/* Inline new group */}
                <button
                  onClick={() => setCreatingGroup(true)}
                  className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl border border-dashed border-white/15 text-white/30 hover:text-[#0a84ff] hover:border-blue-400/40 transition-all"
                  title="Crear nuevo grupo"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  ref={groupRef}
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="Nombre del grupo…"
                  className={cn(inputCls, 'flex-1')}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreateGroup(); if (e.key === 'Escape') setCreatingGroup(false); }}
                />
                <button
                  onClick={handleCreateGroup}
                  disabled={savingGroup || !newGroupName.trim()}
                  className="flex-shrink-0 px-3 h-10 rounded-xl bg-blue-500/20 text-[#0a84ff] text-xs font-semibold hover:bg-blue-500/30 transition-all disabled:opacity-40"
                >
                  {savingGroup ? '…' : 'Crear'}
                </button>
                <button
                  onClick={() => setCreatingGroup(false)}
                  className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl text-white/25 hover:text-white/50 transition-all"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Deadline */}
          <div>
            <label className="block text-xs text-white/40 mb-1.5">
              Fecha límite <span className="text-white/20">(opcional)</span>
            </label>
            <input
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className={cn(inputCls, !deadline && 'text-white/25')}
              style={{ colorScheme: 'dark' }}
            />
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[#38383a]/30 text-white/40 text-sm hover:text-white/60 transition-all">
            Cancelar
          </button>
          <button onClick={confirm} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold transition-colors disabled:opacity-50">
            {saving ? 'Añadiendo…' : 'Añadir'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Task row ─────────────────────────────────────────────────────────────────
function TaskRow({
  task, toggling, onToggle, onDelete,
}: {
  task: Task; toggling: boolean;
  onToggle: (id: string, val: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const dl = task.deadline ? deadlineLabel(task.deadline) : null;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -14, scale: 0.97 }}
      transition={{ duration: 0.15 }}
      className={cn(
        'flex items-center gap-3 px-3.5 py-3 rounded-xl border transition-all',
        task.completed ? 'bg-[#1a1a1c] border-[#38383a]/20' : 'bg-[#2a2a2c] border-white/[0.07]',
      )}
    >
      <button
        onClick={() => !toggling && onToggle(task.id, !task.completed)}
        disabled={toggling}
        className="flex-shrink-0 w-6 h-6 flex items-center justify-center transition-all active:scale-90"
      >
        {task.completed
          ? <CheckCircle2 className="w-5 h-5 text-[#30d158] drop-shadow-[0_0_6px_rgba(52,211,153,0.4)]" />
          : <Circle className="w-5 h-5 text-white/20 hover:text-white/45 transition-colors" />}
      </button>

      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-sm leading-snug truncate transition-all',
          task.completed ? 'line-through text-white/25' : 'text-white/85',
        )}>
          {task.text}
        </p>
        {dl && (
          <span className={cn(
            'inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded-lg text-xs font-medium',
            task.completed ? 'bg-[#1a1a1c] text-white/20'
              : dl.overdue ? 'bg-red-500/15 text-red-400'
              : dl.urgent  ? 'bg-amber-500/15 text-[#ff9f0a]'
              : 'bg-white/6 text-white/40',
          )}>
            <CalendarClock className="w-3 h-3 flex-shrink-0" />
            {dl.label}
          </span>
        )}
      </div>

      <button
        onClick={() => onDelete(task.id)}
        className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-lg text-white/10 hover:text-red-400/70 hover:bg-red-500/8 transition-all active:scale-90"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </motion.div>
  );
}

// ─── Group card ───────────────────────────────────────────────────────────────
function GroupCard({
  group, togglingId, onToggle, onDeleteTask,
  onAddTask, onRename, onDeleteGroup,
}: {
  group: TaskGroup; togglingId: string | null;
  onToggle: (id: string, val: boolean) => void;
  onDeleteTask: (id: string) => void;
  onAddTask: (gid: string) => void;
  onRename: (g: TaskGroup) => void;
  onDeleteGroup: (gid: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const isNoGroup = group.id === NOGROUP_ID;
  const pending   = group.tasks.filter((t) => !t.completed);
  const done      = group.tasks.filter((t) =>  t.completed);
  const total     = group.tasks.length;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.18 }}
      className="bg-[#1a1a1c] border border-white/[0.07] rounded-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-white/25 hover:text-white/55 transition-colors active:scale-90"
        >
          <motion.div animate={{ rotate: open ? 0 : -90 }} transition={{ duration: 0.16 }}>
            <ChevronDown className="w-3.5 h-3.5" />
          </motion.div>
        </button>

        {isNoGroup
          ? <Tag className="w-3.5 h-3.5 text-white/25 flex-shrink-0" />
          : <FolderOpen className="w-3.5 h-3.5 text-white/25 flex-shrink-0" />}

        <button onClick={() => setOpen((v) => !v)} className="flex-1 min-w-0 text-left">
          <span className={cn(
            'text-sm font-semibold truncate',
            isNoGroup ? 'text-white/40' : 'text-white/80',
          )}>
            {group.name}
          </span>
          <span className="ml-2 text-white/20 text-xs">{pending.length}/{total}</span>
        </button>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => onAddTask(group.id)}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-blue-500/12 text-[#0a84ff]/70 hover:bg-blue-500/22 hover:text-[#0a84ff] transition-all active:scale-90"
            title="Añadir tarea"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          {!isNoGroup && (
            <>
              <button
                onClick={() => onRename(group)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-white/12 hover:text-white/50 hover:bg-white/6 transition-all active:scale-90"
                title="Renombrar"
              >
                <Pencil className="w-3 h-3" />
              </button>
              <button
                onClick={() => onDeleteGroup(group.id)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-white/10 hover:text-red-400/70 hover:bg-red-500/8 transition-all active:scale-90"
                title="Eliminar grupo"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tasks */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="tasks"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-1.5">
              {total === 0 ? (
                <button
                  onClick={() => onAddTask(group.id)}
                  className="w-full py-3 rounded-xl border border-dashed border-[#38383a]/30 text-white/18 text-xs hover:border-white/18 hover:text-white/32 transition-all"
                >
                  + Añadir primera tarea
                </button>
              ) : (
                <AnimatePresence mode="popLayout">
                  {pending.map((t) => (
                    <TaskRow key={t.id} task={t} toggling={togglingId === t.id}
                      onToggle={onToggle} onDelete={onDeleteTask} />
                  ))}

                  {pending.length > 0 && done.length > 0 && (
                    <motion.div key="div" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="flex items-center gap-2 py-0.5">
                      <div className="flex-1 h-px bg-white/6" />
                      <span className="text-white/18 text-xs">Hechas</span>
                      <div className="flex-1 h-px bg-white/6" />
                    </motion.div>
                  )}

                  {done.map((t) => (
                    <TaskRow key={t.id} task={t} toggling={togglingId === t.id}
                      onToggle={onToggle} onDelete={onDeleteTask} />
                  ))}
                </AnimatePresence>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────
export function TasksPanel({ userId }: TasksPanelProps) {
  const [groups, setGroups]       = useState<TaskGroup[]>([]);
  const [loading, setLoading]     = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [showAdd, setShowAdd]             = useState(false);
  const [addDefaultGid, setAddDefaultGid] = useState<string>(NOGROUP_ID);
  const [showAddGroup, setShowAddGroup]   = useState(false);
  const [renameTarget, setRenameTarget]   = useState<TaskGroup | null>(null);

  const load = useCallback(async (spinner = false) => {
    if (spinner) setLoading(true);
    try {
      const data = await fetchGroups(userId);
      data.forEach((g) => {
        g.tasks.sort((a, b) => {
          if (a.completed !== b.completed) return a.completed ? 1 : -1;
          if (!a.deadline && !b.deadline) return 0;
          if (!a.deadline) return 1;
          if (!b.deadline) return -1;
          return a.deadline.localeCompare(b.deadline);
        });
      });
      setGroups(data);
    } catch { toast.error('Error cargando tareas'); }
    finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { load(true); }, [load]);

  // ── group actions ────────────────────────────────────────────────────────────
  const handleCreateGroup = async (name: string): Promise<TaskGroup> => {
    const created = await createGroup(userId, name);
    setGroups((prev) => {
      const filtered = prev.filter((g) => g.id !== NOGROUP_ID);
      const noGroup  = prev.find((g) => g.id === NOGROUP_ID);
      return [...(noGroup ? [noGroup] : []), ...filtered, created];
    });
    toast.success(`Grupo "${name}" creado`);
    return created;
  };

  const handleRenameGroup = async (name: string) => {
    if (!renameTarget) return;
    const old = renameTarget.name;
    setGroups((prev) => prev.map((g) => g.id === renameTarget.id ? { ...g, name } : g));
    try { await renameGroup(renameTarget.id, name); }
    catch {
      setGroups((prev) => prev.map((g) => g.id === renameTarget.id ? { ...g, name: old } : g));
      toast.error('Error al renombrar');
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    const snap = groups;
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
    try { await deleteGroup(groupId); toast.success('Grupo eliminado'); }
    catch { setGroups(snap); toast.error('Error al eliminar el grupo'); }
  };

  // ── task actions ─────────────────────────────────────────────────────────────
  const handleAddTask = async (groupId: string, text: string, deadline: string | null) => {
    const tempId = `tmp-${Date.now()}`;
    const temp: Task = { id: tempId, text, deadline, completed: false, groupId };

    // Optimistic update — show task immediately
    setGroups((prev) => {
      const hasGroup = prev.some((g) => g.id === groupId);
      const base = hasGroup ? prev : [{ id: NOGROUP_ID, name: 'Sin grupo', tasks: [] }, ...prev];
      return base.map((g) => g.id === groupId ? { ...g, tasks: [...g.tasks, temp] } : g);
    });

    try {
      await createTask(userId, groupId, text, deadline);
      toast.success('Tarea añadida');
      // Silent background sync to replace tmp ID with real server ID
      load(false);
    } catch {
      // Roll back optimistic update
      setGroups((prev) => prev.map((g) =>
        g.id === groupId ? { ...g, tasks: g.tasks.filter((t) => t.id !== tempId) } : g
      ));
      throw new Error('create task failed');
    }
  };

  const handleToggle = async (id: string, completed: boolean) => {
    setTogglingId(id);
    setGroups((prev) => prev.map((g) => ({
      ...g, tasks: g.tasks.map((t) => t.id === id ? { ...t, completed } : t),
    })));
    try { await toggleTask(id, completed); }
    catch {
      setGroups((prev) => prev.map((g) => ({
        ...g, tasks: g.tasks.map((t) => t.id === id ? { ...t, completed: !completed } : t),
      })));
      toast.error('Error al actualizar');
    } finally { setTogglingId(null); }
  };

  const handleDeleteTask = async (id: string) => {
    setGroups((prev) => prev.map((g) => ({ ...g, tasks: g.tasks.filter((t) => t.id !== id) })));
    try { await deleteTask(id); }
    catch { toast.error('Error al eliminar'); load(false); }
  };

  const totalPending = groups.reduce((s, g) => s + g.tasks.filter((t) => !t.completed).length, 0);
  const totalDone    = groups.reduce((s, g) => s + g.tasks.filter((t) =>  t.completed).length, 0);

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 flex-shrink-0">
        <div>
          <h2 className="text-white font-semibold text-sm leading-tight">Mis Tareas</h2>
          <p className="text-white/30 text-xs leading-tight">
            {totalPending} pendiente{totalPending !== 1 ? 's' : ''} · {totalDone} hecha{totalDone !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => load(false)} disabled={loading}
            className="w-8 h-8 flex items-center justify-center rounded-xl border border-[#38383a]/30 text-white/30 hover:text-white/60 hover:bg-[#1a1a1c] transition-all active:scale-95"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
          </button>
          <button
            onClick={() => setShowAddGroup(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#38383a]/30 text-white/40 hover:text-white/70 hover:bg-[#1a1a1c] text-sm transition-colors active:scale-95"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-xs">Grupo</span>
          </button>
          {/* + Tarea — always visible */}
          <button
            onClick={() => { setAddDefaultGid(NOGROUP_ID); setShowAdd(true); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold transition-colors active:scale-95 shadow-lg "
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Tarea</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-3">
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-24 rounded-2xl bg-white/3 border border-[#38383a]/20 animate-pulse" />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-16 gap-4 text-center"
          >
            <div className="w-14 h-14 rounded-2xl bg-white/3 border border-[#38383a]/30 flex items-center justify-center text-2xl">📋</div>
            <div>
              <p className="text-white/40 text-sm mb-1">Sin tareas todavía</p>
              <p className="text-white/20 text-xs">Pulsa + para añadir tu primera tarea</p>
            </div>
            <button
              onClick={() => { setAddDefaultGid(NOGROUP_ID); setShowAdd(true); }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 transition-colors active:scale-95"
            >
              <Plus className="w-4 h-4" />
              Añadir tarea
            </button>
          </motion.div>
        ) : (
          <AnimatePresence mode="popLayout">
            {groups.map((g) => (
              <GroupCard
                key={g.id}
                group={g}
                togglingId={togglingId}
                onToggle={handleToggle}
                onDeleteTask={handleDeleteTask}
                onAddTask={(gid) => { setAddDefaultGid(gid); setShowAdd(true); }}
                onRename={(grp) => setRenameTarget(grp)}
                onDeleteGroup={handleDeleteGroup}
              />
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showAddGroup && (
          <GroupModal
            key="add-group"
            title="Nuevo grupo"
            onClose={() => setShowAddGroup(false)}
            onConfirm={handleCreateGroup}
          />
        )}
        {renameTarget && (
          <GroupModal
            key="rename"
            title="Renombrar grupo"
            initial={renameTarget.name}
            onClose={() => setRenameTarget(null)}
            onConfirm={handleRenameGroup}
          />
        )}
        {showAdd && (
          <AddTaskModal
            key="add-task"
            groups={groups}
            defaultGroupId={addDefaultGid}
            onClose={() => setShowAdd(false)}
            onAdd={handleAddTask}
            onCreateGroup={handleCreateGroup}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
