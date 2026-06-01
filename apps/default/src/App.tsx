import { useCallback, useEffect, useRef, useState } from 'react';
import { usePreventIosZoom } from './hooks/usePreventIosZoom';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, RefreshCw, Sparkles, Share2, LogOut, User, Menu, BookOpen, CheckSquare, Calendar, GraduationCap, Bell, BellOff } from 'lucide-react';
import { AppLogo } from './components/AppLogo';
import { Toaster, toast } from 'sonner';
import { loadSession, logout, type AuthUser } from './lib/auth';
import { fetchNodes, deleteNode, saveSubjectOrderServer } from './lib/api';
import type { Subject, SubjectColor } from './types/study';
import { SubjectCard } from './components/SubjectCard';
import { DraggableSubjectList } from './components/DraggableSubjectList';
import type { DropResult } from '@hello-pangea/dnd';
import { StatsBar } from './components/StatsBar';
import { AddSubjectModal } from './components/AddSubjectModal';
import { ChatPanel } from './components/ChatPanel';
import { NotificationPrompt } from './components/NotificationPrompt';
import { LoginScreen } from './components/LoginScreen';
import { ShareModal } from './components/ShareModal';
import { ShareInviteModal } from './components/ShareInviteModal';
import { SplashScreen } from './components/SplashScreen';
import { TasksPanel } from './components/TasksPanel';
import { CalendarPage } from './pages/CalendarPage';
import { StudyPlannerPage } from './pages/StudyPlannerPage';
import {
  fetchStudyPlans,
  fetchStudyBlocks,
  createStudyPlan,
  createStudyBlock,
  deleteStudyPlan,
  toggleBlockStatus,
  type StudyPlan,
  type StudyBlock,
} from './lib/api';
import { fetchPendingInvitations, fetchGroups, type ShareInvitation } from './lib/api';
import {
  notifyShareInvitation,
  checkDeadlineNotifications,
  clearDeadlineMemory,
} from './lib/notifications';
import { usePushNotifications } from './hooks/usePushNotifications';
import { showPushNotification } from './lib/push';

type AppTab = 'subjects' | 'tasks' | 'calendar' | 'planner';

// sessionStorage key — lives only for the current browser session (tab lifetime)
const SPLASH_KEY = 'splash_shown';

export default function App() {
  usePreventIosZoom();

  const [user, setUser] = useState<AuthUser | null>(() => loadSession());
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [pendingInvitation, setPendingInvitation] = useState<ShareInvitation | null>(null);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showNotifPrompt, setShowNotifPrompt] = useState(false);
  const [activeTab, setActiveTab] = useState<AppTab>('subjects');
  const loadedRef = useRef(false);

  // Study plans state
  const [studyPlans, setStudyPlans] = useState<StudyPlan[]>([]);
  const [studyBlocks, setStudyBlocks] = useState<StudyBlock[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);

  // Splash: true only on cold launch
  const [showSplash, setShowSplash] = useState<boolean>(() => {
    const already = sessionStorage.getItem(SPLASH_KEY);
    if (already) return false;
    sessionStorage.setItem(SPLASH_KEY, '1');
    return true;
  });

  useEffect(() => {
    if (!showSplash) return;
    const duration = user ? 1500 : 2000;
    const t = setTimeout(() => setShowSplash(false), duration);
    return () => clearTimeout(t);
  }, [showSplash]);

  const userId = user?.username ?? '';
  const raw = user?.username ?? '';
  const userName = raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : '';

  // ── Push notification subscription status ─────────────────────────────────
  const {
    status: pushStatus,
    capabilityInfo: pushCapability,
    subscribe: pushSubscribe,
    unsubscribe: pushUnsubscribe,
  } = usePushNotifications(userId);

  const load = useCallback(async (uid: string, showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const { subjects: data } = await fetchNodes(uid);
      setSubjects(data);
    } catch {
      toast.error('Error cargando asignaturas');
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (userId && !loadedRef.current) {
      loadedRef.current = true;
      load(userId, true);
      // Show notification prompt after a short delay (only if not yet decided).
      // We intentionally do NOT call requestPermission() here because iOS Safari
      // requires an explicit user gesture (tap).
      if ('Notification' in window && Notification.permission === 'default') {
        setTimeout(() => setShowNotifPrompt(true), 2500);
      }
    }
  }, [userId, load]);

  // ── Poll for incoming share invitations ─────────────────────────────────────
  useEffect(() => {
    if (!userId || pendingInvitation) return;

    const check = async () => {
      try {
        const invitations = await fetchPendingInvitations(userId);
        if (invitations.length > 0) {
          const inv = invitations[0];
          notifyShareInvitation(
            inv.fromUser,
            inv.subjects.length,
            () => setPendingInvitation(inv),
          );
          setPendingInvitation(inv);
        }
      } catch {
        // silent
      }
    };

    const initial = setTimeout(check, 3000);
    const interval = setInterval(check, 8000);
    return () => { clearTimeout(initial); clearInterval(interval); };
  }, [userId, pendingInvitation]);

  // ── Poll for task deadline notifications ─────────────────────────────────────
  useEffect(() => {
    if (!userId) return;

    const checkDeadlines = async () => {
      try {
        const groups = await fetchGroups(userId);
        const allTasks = groups.flatMap((g) => g.tasks);

        if (pushStatus === 'subscribed') {
          // Use SW push notification (works in background)
          const { differenceInHours, parseISO, isFuture } = await import('date-fns');
          const now = new Date();
          for (const task of allTasks) {
            if (task.completed || !task.deadline) continue;
            const deadline = parseISO(task.deadline);
            if (!isFuture(deadline)) continue;
            const hoursLeft = differenceInHours(deadline, now);
            if (hoursLeft > 24) continue;
            const hoursLabel = hoursLeft < 1 ? 'menos de 1 hora' : `${hoursLeft}h`;
            await showPushNotification('⏰ Tarea próxima a vencer', {
              body: `"${task.text}" · Quedan ${hoursLabel}`,
              tag: `deadline-${task.id}`,
              requireInteraction: false,
              onClick: () => { setActiveTab('tasks'); window.focus(); },
            });
          }
        } else {
          // Fallback: in-session only Notification API
          checkDeadlineNotifications(allTasks, () => {
            setActiveTab('tasks');
            window.focus();
          });
        }
      } catch {
        // silent
      }
    };

    const initial = setTimeout(checkDeadlines, 5000);
    const interval = setInterval(checkDeadlines, 5 * 60 * 1000);
    return () => { clearTimeout(initial); clearInterval(interval); };
  }, [userId, pushStatus]);

  const reload = useCallback(() => {
    if (!userId) return;
    load(userId, true);
  }, [userId, load]);

  const silentReload = useCallback(() => {
    if (!userId) return;
    load(userId, false);
  }, [userId, load]);

  const patchSubject = useCallback(
    (id: string, patch: { color?: SubjectColor; emoji?: string; text?: string }) => {
      setSubjects((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    },
    [],
  );

  const handleDelete = async (id: string) => {
    try {
      await deleteNode(id);
      toast.success('Asignatura eliminada');
      reload();
    } catch {
      toast.error('Error al eliminar');
    }
  };

  const handleReorder = useCallback((result: DropResult) => {
    if (!result.destination) return;
    const from = result.source.index;
    const to = result.destination.index;
    if (from === to) return;

    setSubjects((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);

      // Persist the new order server-side so it syncs across devices
      const reordered = next.map((s, idx) => ({ ...s, order: idx }));
      if (userId) {
        saveSubjectOrderServer(reordered.map((s) => ({
          id: s.id,
          color: s.color,
          emoji: s.emoji,
          order: s.order,
        }))).catch(() => {
          toast.error('Error guardando el orden');
        });
      }

      return reordered;
    });
  }, [userId]);

  const handleAuth = (authedUser: AuthUser) => {
    setUser(authedUser);
    loadedRef.current = false;
  };

  const handleLogout = () => {
    // Clean up push subscription for this device
    if (pushStatus === 'subscribed') {
      pushUnsubscribe().catch(() => {});
    }
    logout();
    setUser(null);
    setSubjects([]);
    setStudyPlans([]);
    setStudyBlocks([]);
    loadedRef.current = false;
    setShowMobileMenu(false);
    clearDeadlineMemory();
  };

  // ── Study plans logic ───────────────────────────────────────────────────────
  const loadPlans = useCallback(async (uid: string) => {
    setPlansLoading(true);
    try {
      const [p, b] = await Promise.all([fetchStudyPlans(uid), fetchStudyBlocks(uid)]);
      setStudyPlans(p);
      setStudyBlocks(b);
    } catch {
      // silent
    } finally {
      setPlansLoading(false);
    }
  }, []);

  useEffect(() => {
    if (userId) {
      loadPlans(userId);
    }
  }, [userId, loadPlans]);

  const handleCreatePlan = async (
    plan: Omit<StudyPlan, 'id' | 'userId' | 'status'>,
    blocks: Omit<StudyBlock, 'id' | 'userId' | 'status'>[]
  ) => {
    try {
      const created = await createStudyPlan(userId, {
        subject: plan.subject,
        examDate: plan.examDate,
        blockDurationMinutes: plan.blockDurationMinutes,
        totalPages: plan.totalPages,
        pagesPerHour: plan.pagesPerHour,
        startPage: plan.startPage,
      });
      for (const blk of blocks) {
        await createStudyBlock(userId, {
          planId: created.id,
          date: blk.date,
          startPage: blk.startPage,
          endPage: blk.endPage,
        });
      }
      toast.success(`Plan creado con ${blocks.length} bloques`);
      loadPlans(userId);
    } catch (err) {
      console.error('Error creando plan:', err);
      const msg = err instanceof Error ? err.message : 'Error creando el plan';
      toast.error(msg);
    }
  };

  const handleDeletePlan = async (planId: string) => {
    try {
      await deleteStudyPlan(planId);
      toast.success('Plan eliminado');
      loadPlans(userId);
    } catch {
      toast.error('Error eliminando plan');
    }
  };

  const handleToggleBlock = async (blockId: string, status: StudyBlock['status']) => {
    try {
      await toggleBlockStatus(blockId, status);
      setStudyBlocks((prev) => prev.map((b) => (b.id === blockId ? { ...b, status } : b)));
    } catch {
      toast.error('Error actualizando bloque');
    }
  };

  if (!user) {
    return (
      <>
        <AnimatePresence>
          {showSplash && <SplashScreen />}
        </AnimatePresence>
        {!showSplash && <LoginScreen onAuth={handleAuth} />}
      </>
    );
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  const pushIsSubscribed = pushStatus === 'subscribed';
  const pushIsDenied = pushStatus === 'denied';
  const pushIsUnsupported =
    pushCapability.capability === 'unsupported' ||
    pushCapability.capability === 'needs-update';
  const pushNeedsInstall = pushCapability.capability === 'needs-install';

  const handlePushToggle = async () => {
    if (pushIsSubscribed) {
      toast.success('Notificaciones activas ✓', {
        description: pushCapability.closedWork
          ? 'Recibirás avisos aunque la app esté cerrada.'
          : 'Recibirás avisos mientras la app esté abierta o en segundo plano.',
      });
    } else if (pushIsDenied) {
      toast.error('Permiso denegado', {
        description: 'Actívalo desde los ajustes del navegador.',
      });
    } else if (pushNeedsInstall) {
      toast.info('Instala la app primero', {
        description: 'En Safari: Compartir → "Añadir a pantalla de inicio".',
      });
    } else {
      const ok = await pushSubscribe();
      if (ok) {
        toast.success('¡Notificaciones activadas!', {
          description: pushCapability.closedWork
            ? 'Recibirás avisos aunque la app esté cerrada.'
            : 'Recibirás avisos mientras la app esté abierta.',
        });
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#f2f2f7] text-[#1c1c1e] font-sans">
      {/* Splash */}
      <AnimatePresence>
        {showSplash && <SplashScreen username={userName} />}
      </AnimatePresence>

      <Toaster
        theme="light"
        position="top-center"
        toastOptions={{
          style: {
            background: '#ffffff',
            border: '1px solid #e5e5ea',
            color: '#1c1c1e',
          },
        }}
      />

      {/* ── Mobile bottom sheet menu ─────────────────────────────── */}
      <AnimatePresence>
        {showMobileMenu && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
              onClick={() => setShowMobileMenu(false)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[#e5e5ea] rounded-t-3xl pb-safe"
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-[#e5e5ea]" />
              </div>

              {/* User info */}
              <div className="px-6 py-4 border-b border-[#e5e5ea] flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#f2f2f7] border border-[#e5e5ea] flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-[#8e8e93]" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#1c1c1e] truncate">{userName}</p>
                  <p className="text-xs text-[#8e8e93]">Sesión activa</p>
                </div>
              </div>

              {/* Actions */}
              <div className="p-4 space-y-2">
                <button
                  onClick={() => { setShowAddSubject(true); setShowMobileMenu(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-[#007aff]/10 text-[#007aff] hover:bg-[#007aff]/15 transition-all active:scale-98"
                >
                  <Plus className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm font-medium">Nueva asignatura</span>
                </button>

                <button
                  onClick={() => { setShowShare(true); setShowMobileMenu(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-[#f2f2f7] text-[#1c1c1e] hover:bg-[#e5e5ea] transition-all active:scale-98"
                >
                  <Share2 className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm font-medium">Compartir mis datos</span>
                </button>

                {/* Push toggle */}
                {!pushIsUnsupported && (
                  <button
                    onClick={async () => {
                      setShowMobileMenu(false);
                      await handlePushToggle();
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all active:scale-98 ${
                      pushIsSubscribed
                        ? 'bg-[#34c759]/10 text-[#34c759]'
                        : pushIsDenied
                        ? 'bg-[#ff3b30]/10 text-[#ff3b30]'
                        : pushNeedsInstall
                        ? 'bg-[#ff9500]/10 text-[#ff9500]'
                        : 'bg-[#f2f2f7] text-[#1c1c1e] hover:bg-[#e5e5ea]'
                    }`}
                  >
                    {pushIsDenied
                      ? <BellOff className="w-5 h-5 flex-shrink-0" />
                      : <Bell className="w-5 h-5 flex-shrink-0" />
                    }
                    <div className="min-w-0 text-left">
                      <p className="text-sm font-medium">
                        {pushIsSubscribed
                          ? 'Notificaciones activas'
                          : pushIsDenied
                          ? 'Notificaciones denegadas'
                          : pushNeedsInstall
                          ? 'Instala la app primero'
                          : 'Activar notificaciones'}
                      </p>
                      <p className="text-xs text-[#8e8e93] mt-0.5">
                        {pushIsSubscribed
                          ? pushCapability.closedWork
                            ? 'Recibes avisos aunque la app esté cerrada'
                            : 'Recibes avisos en primer y segundo plano'
                          : pushIsDenied
                          ? 'Actívalo en ajustes del navegador'
                          : pushNeedsInstall
                          ? 'Safari → Compartir → Añadir a pantalla de inicio'
                          : 'Avisos de tareas y comparticiones'}
                      </p>
                    </div>
                  </button>
                )}

                <button
                  onClick={() => { setChatOpen(!chatOpen); setShowMobileMenu(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-[#f2f2f7] text-[#1c1c1e] hover:bg-[#e5e5ea] transition-all active:scale-98"
                >
                  <Sparkles className="w-5 h-5 flex-shrink-0 text-[#007aff]" />
                  <span className="text-sm font-medium">Asistente IA</span>
                </button>

                <div className="pt-1">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-[#ff3b30]/10 text-[#ff3b30] hover:bg-[#ff3b30]/15 transition-all active:scale-98"
                  >
                    <LogOut className="w-5 h-5 flex-shrink-0" />
                    <span className="text-sm font-medium">Cerrar sesión</span>
                  </button>
                </div>
              </div>

              <div className="h-4" />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="flex h-[100dvh] overflow-hidden relative">
        {/* Main content */}
        <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${chatOpen ? 'sm:mr-80' : ''}`}>

          {/* ── Top bar ─────────────────────────────────────────────── */}
          <header className="flex items-center justify-between px-4 sm:px-6 h-14 border-b border-[#e5e5ea] bg-white flex-shrink-0 sticky top-0 z-30">
            {/* Left: logo + page label */}
            <div className="flex items-center gap-3 min-w-0">
              <AppLogo size="sm" />
              <div className="hidden sm:flex flex-col min-w-0">
                <span className="text-[13px] font-semibold text-[#1c1c1e] leading-none tracking-tight">
                  {activeTab === 'subjects' && 'Asignaturas'}
                  {activeTab === 'tasks' && 'Tareas'}
                  {activeTab === 'calendar' && 'Calendario'}
                  {activeTab === 'planner' && 'Planificador'}
                </span>
                <span className="text-[11px] text-[#8e8e93] mt-0.5 truncate">
                  {activeTab === 'subjects' && 'Tu universo de estudio'}
                  {activeTab === 'tasks' && 'Pendientes y deberes'}
                  {activeTab === 'calendar' && 'Vista temporal de bloques'}
                  {activeTab === 'planner' && 'Distribuye páginas hasta el examen'}
                </span>
              </div>
            </div>

            {/* Right: actions */}
            <div className="flex items-center gap-1.5">
              {/* Refresh */}
              {activeTab === 'subjects' && (
                <button
                  onClick={reload}
                  disabled={loading}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-[#8e8e93] hover:text-[#1c1c1e] hover:bg-[#f2f2f7] transition-all active:scale-95"
                  title="Actualizar"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              )}

              {/* Desktop-only actions */}
              <div className="hidden sm:flex items-center gap-1.5">
                {activeTab === 'subjects' && (
                  <>
                    <button
                      onClick={() => setShowShare(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[#8e8e93] hover:text-[#1c1c1e] hover:bg-[#f2f2f7] text-[13px] font-medium transition-all"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      Compartir
                    </button>
                    <button
                      onClick={() => setShowAddSubject(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#007aff] text-white hover:bg-[#1a8aff] text-[13px] font-medium transition-all active:scale-95"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Asignatura
                    </button>
                  </>
                )}

                {/* Push notification toggle */}
                {!pushIsUnsupported && (
                  <button
                    onClick={handlePushToggle}
                    title={
                      pushIsSubscribed
                        ? 'Notificaciones activas'
                        : pushIsDenied
                        ? 'Permiso denegado — actívalo en ajustes'
                        : pushNeedsInstall
                        ? 'Instala la app para activar notificaciones'
                        : 'Activar notificaciones push'
                    }
                    className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all active:scale-95 ${
                      pushIsSubscribed
                        ? 'text-[#34c759] hover:bg-[#34c759]/10'
                        : pushIsDenied
                        ? 'text-[#ff3b30] hover:bg-[#ff3b30]/10'
                        : pushNeedsInstall
                        ? 'text-[#ff9500] hover:bg-[#ff9500]/10'
                        : 'text-[#8e8e93] hover:text-[#1c1c1e] hover:bg-[#f2f2f7]'
                    }`}
                  >
                    {pushIsDenied
                      ? <BellOff className="w-4 h-4" />
                      : <Bell className="w-4 h-4" />
                    }
                  </button>
                )}

                <button
                  onClick={() => setChatOpen(!chatOpen)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
                    chatOpen
                      ? 'bg-violet-500/10 text-violet-600'
                      : 'text-[#8e8e93] hover:text-[#1c1c1e] hover:bg-[#f2f2f7]'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Asistente
                </button>

                <div className="w-px h-5 bg-[#e5e5ea] mx-1" />

                {/* User + logout */}
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-lg hover:bg-[#ff3b30]/10 hover:text-[#ff3b30] text-[#8e8e93] transition-all group"
                  title="Cerrar sesión"
                >
                  <div className="w-6 h-6 rounded-full bg-[#f2f2f7] border border-[#e5e5ea] flex items-center justify-center flex-shrink-0">
                    <User className="w-3 h-3 text-[#8e8e93]" />
                  </div>
                  <span className="text-[12px] font-medium max-w-[80px] truncate">{userName}</span>
                  <LogOut className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
                </button>
              </div>

              {/* Mobile hamburger */}
              <button
                onClick={() => setShowMobileMenu(true)}
                className="sm:hidden w-9 h-9 flex items-center justify-center rounded-lg text-[#8e8e93] hover:text-[#1c1c1e] hover:bg-[#f2f2f7] transition-all active:scale-95"
                aria-label="Menú"
              >
                <Menu className="w-[18px] h-[18px]" />
              </button>
            </div>
          </header>

          {/* ── Tab navigation — iOS segmented control ────────────── */}
          <div className="flex items-center justify-center px-4 sm:px-6 py-3 flex-shrink-0 border-b border-[#e5e5ea] bg-white">
            <div className="flex items-center bg-[#e3e3e9] rounded-lg p-0.5">
              {([
                { id: 'subjects', label: 'Asignaturas' },
                { id: 'tasks', label: 'Tareas' },
                { id: 'calendar', label: 'Calendario' },
                { id: 'planner', label: 'Planificador' },
              ] as const).map(({ id, label }) => {
                const active = activeTab === id;
                return (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id)}
                    className={`relative px-3.5 py-1.5 text-[12px] font-medium rounded-md transition-all whitespace-nowrap ${
                      active
                        ? 'text-[#1c1c1e] bg-white shadow-sm'
                        : 'text-[#8e8e93] hover:text-[#1c1c1e]'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Content ──────────────────────────────────────────── */}
          <div className="flex-1 overflow-hidden">
            <AnimatePresence mode="wait">
              {activeTab === 'subjects' ? (
                <motion.main
                  key="subjects"
                  initial={{ opacity: 0, y: 15, scale: 0.98, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -10, scale: 0.98, filter: 'blur(4px)' }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  className="h-full overflow-y-auto px-4 sm:px-6 py-4 sm:py-6 pb-24 sm:pb-6 scrollbar-thin scrollbar-thumb-[#e5e5ea] scrollbar-track-transparent"
                >
                  {loading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="h-28 rounded-2xl skeleton" />
                      ))}
                    </div>
                  ) : subjects.length === 0 ? (
                    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-5 text-center">
                      <div className="w-16 h-16 rounded-2xl bg-white border border-[#e5e5ea] flex items-center justify-center text-3xl shadow-sm">
                        📚
                      </div>
                      <div>
                        <p className="text-[#1c1c1e] text-base font-semibold mb-1.5 tracking-tight">Empieza tu universo de estudio</p>
                        <p className="text-[#8e8e93] text-xs max-w-[280px]">Añade tu primera asignatura para organizar temas, tareas y planes hasta el examen.</p>
                      </div>
                      <button
                        onClick={() => setShowAddSubject(true)}
                        className="flex items-center gap-2 px-5 py-3 rounded-xl bg-[#007aff] text-white text-sm font-semibold hover:bg-[#1a8aff] transition-all active:scale-95 shadow-md"
                      >
                        <Plus className="w-4 h-4" />
                        Añadir asignatura
                      </button>
                    </div>
                  ) : (
                    <>
                      <StatsBar subjects={subjects} />
                      <DraggableSubjectList
                        subjects={subjects}
                        onReorder={handleReorder}
                        onUpdate={silentReload}
                        onPatch={patchSubject}
                        onDelete={handleDelete}
                      />
                    </>
                  )}
                </motion.main>
              ) : activeTab === 'tasks' ? (
                <motion.div
                  key="tasks"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  transition={{ duration: 0.15 }}
                  className="h-full overflow-hidden"
                >
                  <TasksPanel userId={userId} />
                </motion.div>
              ) : activeTab === 'calendar' ? (
                <motion.div
                  key="calendar"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  transition={{ duration: 0.15 }}
                  className="h-full overflow-hidden"
                >
                  <CalendarPage plans={studyPlans} blocks={studyBlocks} />
                </motion.div>
              ) : (
                <motion.div
                  key="planner"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  transition={{ duration: 0.15 }}
                  className="h-full overflow-hidden"
                >
                  <StudyPlannerPage
                    userId={userId}
                    subjects={subjects}
                    existingPlans={studyPlans}
                    existingBlocks={studyBlocks}
                    onCreatePlan={handleCreatePlan}
                    onDeletePlan={handleDeletePlan}
                    onToggleBlock={handleToggleBlock}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── Chat panel ────────────────────────────────────────────── */}
        <AnimatePresence>
          {chatOpen && (
            <motion.div
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              className="fixed right-0 top-0 w-full sm:w-80 z-40 flex flex-col"
              style={{ height: '100dvh' }}
            >
              <ChatPanel onClose={() => setChatOpen(false)} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Mobile FAB ────────────────────────────────────────────── */}
      <AnimatePresence>
        {activeTab === 'subjects' && !showMobileMenu && !chatOpen && !showAddSubject && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => setShowAddSubject(true)}
            className="sm:hidden fixed bottom-6 right-5 z-30 w-14 h-14 rounded-full bg-[#007aff] hover:bg-[#1a8aff] text-white flex items-center justify-center transition-colors active:scale-95 shadow-lg"
            aria-label="Añadir asignatura"
          >
            <Plus className="w-6 h-6" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Notification prompt ───────────────────────────────────── */}
      <AnimatePresence>
        {showNotifPrompt && (
          <NotificationPrompt userId={userId} onDone={() => setShowNotifPrompt(false)} />
        )}
      </AnimatePresence>

      {/* ── Modals ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {showAddSubject && (
          <AddSubjectModal
            userId={userId}
            onClose={() => setShowAddSubject(false)}
            onSaved={() => { setShowAddSubject(false); silentReload(); }}
          />
        )}
        {showShare && (
          <ShareModal
            subjects={subjects}
            currentUserId={userId}
            onClose={() => setShowShare(false)}
          />
        )}
        {pendingInvitation && (
          <ShareInviteModal
            invitation={pendingInvitation}
            onAccepted={() => { setPendingInvitation(null); silentReload(); }}
            onRejected={() => { setPendingInvitation(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
