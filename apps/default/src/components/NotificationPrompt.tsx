import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, BellOff, X, CheckCircle2, Loader2, Share, Plus, Smartphone } from 'lucide-react';
import { notificationsSupported } from '../lib/notifications';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { isIOS, isInstalledPWA, isIOSSupportingPush } from '../lib/push';

interface Props {
  userId: string;
  onDone: () => void;
}

/**
 * Notification permission banner — platform-aware.
 *
 * Shows different UI depending on the platform:
 *
 * 1. iOS Safari (browser, not installed):
 *    → Guides user through "Add to Home Screen" steps
 *    → Notifications only work from the installed PWA on iOS 16.4+
 *
 * 2. iOS PWA (installed) or Android/Desktop:
 *    → Standard permission request flow
 *
 * 3. Unsupported (old iOS, no SW support):
 *    → Silently hidden
 *
 * NOTE: We NEVER call requestPermission() on mount — iOS Safari silently
 * swallows permission dialogs that aren't triggered by a direct user tap.
 */
export function NotificationPrompt({ userId, onDone }: Props) {
  const { status, capabilityInfo, loading, subscribe } = usePushNotifications(userId);
  const [showIOSSteps, setShowIOSSteps] = useState(false);

  const ios = isIOS();
  const iosPwa = ios && isInstalledPWA();
  const iosSafariBrowser = ios && !isInstalledPWA();
  const iosSupported = isIOSSupportingPush();

  // ── Don't render in these cases ──────────────────────────────────────────
  // Browser has no notification support at all
  if (!notificationsSupported() && !ios) return null;
  // iOS < 16.4 — upgrade message not actionable, just hide
  if (ios && !iosSupported) return null;
  // Already subscribed — no need to prompt
  if (status === 'subscribed') return null;

  const isDone = status === 'subscribed';
  const isDenied = status === 'denied';

  const handleEnable = async () => {
    const ok = await subscribe();
    if (ok || isDenied) {
      setTimeout(onDone, 1600);
    }
  };

  // ── iOS Safari (not installed as PWA) ─────────────────────────────────────
  if (iosSafariBrowser) {
    return (
      <motion.div
        initial={{ y: 120, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 120, opacity: 0 }}
        transition={{ type: 'spring', damping: 26, stiffness: 260 }}
        className="fixed bottom-6 left-4 right-4 z-50 mx-auto max-w-sm"
      >
        <div className="bg-[#0f1117] border border-white/12 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden">

          {/* Header */}
          <div className="p-4 flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 bg-orange-500/20 border border-orange-500/25">
              <Smartphone className="w-4 h-4 text-orange-400" />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white/90 leading-snug">
                Instala la app para activar
              </p>
              <p className="text-xs text-white/45 mt-0.5 leading-relaxed">
                En iPhone, las notificaciones requieren instalar StudyTracker desde Safari.
              </p>

              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={() => setShowIOSSteps(!showIOSSteps)}
                  className="flex-1 py-2 rounded-xl bg-orange-500/20 hover:bg-orange-500/30 active:scale-95 text-orange-400 text-xs font-semibold transition-all"
                >
                  {showIOSSteps ? 'Ocultar pasos' : 'Ver cómo instalar'}
                </button>
                <button
                  onClick={onDone}
                  className="flex-1 py-2 rounded-xl bg-white/6 hover:bg-white/10 active:scale-95 text-white/50 text-xs font-medium transition-all border border-[#38383a]/30"
                >
                  Ahora no
                </button>
              </div>
            </div>

            <button
              onClick={onDone}
              className="w-6 h-6 flex items-center justify-center rounded-lg text-white/25 hover:text-white/50 transition-colors flex-shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Step-by-step guide */}
          <AnimatePresence>
            {showIOSSteps && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-4 border-t border-[#38383a]/20 pt-3 space-y-2.5">
                  <p className="text-xs font-medium text-white/50 uppercase tracking-wide mb-3">
                    Pasos para instalar
                  </p>

                  {[
                    {
                      icon: <Share className="w-3.5 h-3.5" />,
                      step: '1',
                      text: 'Pulsa el botón Compartir',
                      sub: 'El icono □↑ en la barra de Safari',
                    },
                    {
                      icon: <Plus className="w-3.5 h-3.5" />,
                      step: '2',
                      text: 'Toca "Añadir a pantalla de inicio"',
                      sub: 'Desplázate hacia abajo en el menú',
                    },
                    {
                      icon: <Bell className="w-3.5 h-3.5" />,
                      step: '3',
                      text: 'Abre la app desde tu pantalla',
                      sub: 'Luego activa las notificaciones',
                    },
                  ].map((item) => (
                    <div key={item.step} className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-xl bg-[#1a1a1c] border border-[#38383a]/30 flex items-center justify-center flex-shrink-0 text-white/40">
                        {item.icon}
                      </div>
                      <div className="min-w-0 pt-0.5">
                        <p className="text-xs font-medium text-white/80">{item.text}</p>
                        <p className="text-xs text-white/35 mt-0.5">{item.sub}</p>
                      </div>
                    </div>
                  ))}

                  <div className="mt-3 pt-3 border-t border-[#38383a]/20">
                    <p className="text-xs text-white/30 text-center">
                      Requiere iOS 16.4 o superior · Safari
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    );
  }

  // ── iOS PWA or Android/Desktop ────────────────────────────────────────────
  const iconBg = isDone
    ? 'bg-emerald-500/20 border-emerald-500/25'
    : isDenied
    ? 'bg-red-500/15 border-red-500/20'
    : iosPwa
    ? 'bg-orange-500/20 border-orange-500/25'
    : 'bg-blue-500/20 border-blue-500/25';

  const iconColor = isDone
    ? 'text-[#30d158]'
    : isDenied
    ? 'text-red-400'
    : iosPwa
    ? 'text-orange-400'
    : 'text-[#0a84ff]';

  const IconEl = isDone ? (
    <CheckCircle2 className={`w-4 h-4 ${iconColor}`} />
  ) : isDenied ? (
    <BellOff className={`w-4 h-4 ${iconColor}`} />
  ) : loading ? (
    <Loader2 className={`w-4 h-4 ${iconColor} animate-spin`} />
  ) : (
    <Bell className={`w-4 h-4 ${iconColor}`} />
  );

  // Build description based on actual capability
  const getDescription = () => {
    if (isDone) {
      return capabilityInfo.closedWork
        ? 'Recibirás avisos aunque la app esté cerrada.'
        : 'Recibirás avisos mientras la app esté abierta o en segundo plano.';
    }
    if (isDenied) return 'Actívalo desde Ajustes > Safari > Notificaciones.';
    return capabilityInfo.description;
  };

  return (
    <motion.div
      initial={{ y: 120, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 120, opacity: 0 }}
      transition={{ type: 'spring', damping: 26, stiffness: 260 }}
      className="fixed bottom-6 left-4 right-4 z-50 mx-auto max-w-sm"
    >
      <div className="bg-[#0f1117] border border-white/12 rounded-2xl shadow-2xl shadow-black/60 p-4 flex items-start gap-3">

        {/* Icon */}
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 border transition-colors duration-300 ${iconBg}`}>
          {IconEl}
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white/90 leading-snug">
            {isDone
              ? '¡Notificaciones activadas!'
              : isDenied
              ? 'Permiso denegado'
              : 'Activar notificaciones'}
          </p>
          <p className="text-xs text-white/45 mt-0.5 leading-relaxed">
            {getDescription()}
          </p>

          {/* Capability badge — only when not subscribed */}
          {!isDone && !isDenied && capabilityInfo.closedWork && (
            <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#30d158]/10 border border-emerald-500/15">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-[10px] text-[#30d158] font-medium">
                Funciona con app cerrada
              </span>
            </div>
          )}

          {/* Actions */}
          {!isDone && !isDenied && (
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={handleEnable}
                disabled={loading}
                className="flex-1 py-2 rounded-xl bg-blue-500 hover:bg-blue-400 active:scale-95 text-white text-xs font-semibold transition-all disabled:opacity-60 flex items-center justify-center gap-1.5"
              >
                {loading && <Loader2 className="w-3 h-3 animate-spin" />}
                {loading ? 'Activando…' : 'Activar'}
              </button>
              <button
                onClick={onDone}
                className="flex-1 py-2 rounded-xl bg-white/6 hover:bg-white/10 active:scale-95 text-white/50 hover:text-white/70 text-xs font-medium transition-all border border-[#38383a]/30"
              >
                Ahora no
              </button>
            </div>
          )}

          {/* Denied state retry hint */}
          {isDenied && (
            <p className="text-xs text-white/30 mt-2">
              Ajustes → {isIOS() ? 'Safari → Sitios web → Notificaciones' : 'Privacidad → Notificaciones'}
            </p>
          )}
        </div>

        {/* Close */}
        <button
          onClick={onDone}
          className="w-6 h-6 flex items-center justify-center rounded-lg text-white/25 hover:text-white/50 transition-colors flex-shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  );
}
