import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Share2, Check, X, Loader2, BookOpen, User } from 'lucide-react';
import { toast } from 'sonner';
import { acceptInvitation, rejectInvitation, type ShareInvitation } from '../lib/api';

interface ShareInviteModalProps {
  invitation: ShareInvitation;
  onAccepted: () => void;
  onRejected: () => void;
}

const COLOR_CLASSES: Record<string, string> = {
  blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/25',
  violet: 'from-violet-500/20 to-violet-600/10 border-violet-500/25',
  emerald: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/25',
  amber: 'from-amber-500/20 to-amber-600/10 border-amber-500/25',
  rose: 'from-rose-500/20 to-rose-600/10 border-rose-500/25',
  cyan: 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/25',
  orange: 'from-orange-500/20 to-orange-600/10 border-orange-500/25',
  pink: 'from-pink-500/20 to-pink-600/10 border-pink-500/25',
};

export function ShareInviteModal({ invitation, onAccepted, onRejected }: ShareInviteModalProps) {
  const [loading, setLoading] = useState<'accept' | 'reject' | null>(null);

  const senderDisplay =
    invitation.fromUser.charAt(0).toUpperCase() + invitation.fromUser.slice(1);

  const handleAccept = async () => {
    setLoading('accept');
    try {
      await acceptInvitation(invitation);
      toast.success(`¡Asignaturas de ${senderDisplay} añadidas correctamente!`);
      onAccepted();
    } catch {
      toast.error('Error al aceptar. Inténtalo de nuevo.');
      setLoading(null);
    }
  };

  const handleReject = async () => {
    setLoading('reject');
    try {
      await rejectInvitation(invitation);
      toast('Invitación rechazada', { icon: '✕' });
      onRejected();
    } catch {
      toast.error('Error al rechazar. Inténtalo de nuevo.');
      setLoading(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 24 }}
        transition={{ type: 'spring', damping: 26, stiffness: 300 }}
        className="w-full max-w-sm bg-[#0f1117] border border-[#38383a]/30 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header accent */}
        <div className="h-1 bg-[#0a84ff]" />

        <div className="p-5 space-y-4">
          {/* Icon + title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0a84ff]/10 border border-blue-500/25 flex items-center justify-center flex-shrink-0">
              <Share2 className="w-5 h-5 text-[#0a84ff]" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white/90">Solicitud de asignaturas</h2>
              <p className="text-xs text-white/35 mt-0.5">Invitación entrante</p>
            </div>
          </div>

          {/* Sender info */}
          <div className="flex items-center gap-3 px-3.5 py-3 rounded-xl bg-white/4 border border-[#38383a]/30">
            <div className="w-8 h-8 rounded-full bg-[#2c2c2e] border border-[#38383a]/30 flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-blue-300" />
            </div>
            <p className="text-sm text-white/80">
              <span className="font-semibold text-white">{senderDisplay}</span>
              {' '}quiere compartir estas asignaturas contigo. ¿Las aceptas?
            </p>
          </div>

          {/* Subject list */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-white/35 uppercase tracking-wide px-0.5 flex items-center gap-1.5">
              <BookOpen className="w-3 h-3" />
              {invitation.subjects.length} {invitation.subjects.length === 1 ? 'asignatura' : 'asignaturas'}
            </p>
            <div className="space-y-1.5 max-h-40 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent pr-1">
              <AnimatePresence>
                {invitation.subjects.map((s, i) => {
                  const colorClass = COLOR_CLASSES[s.color] ?? COLOR_CLASSES.blue;
                  return (
                    <motion.div
                      key={s.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border ${colorClass}`}
                    >
                      <span className="text-base leading-none">{s.emoji}</span>
                      <span className="text-sm font-medium text-white/80 truncate">{s.text}</span>
                      <span className="ml-auto text-xs text-white/30 flex-shrink-0">
                        {s.topics.length} {s.topics.length === 1 ? 'tema' : 'temas'}
                      </span>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleReject}
              disabled={loading !== null}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-[#38383a]/30 bg-white/4 text-white/50 hover:text-white/70 hover:bg-white/6 text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
            >
              {loading === 'reject' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <X className="w-4 h-4" />
              )}
              Rechazar
            </button>
            <button
              onClick={handleAccept}
              disabled={loading !== null}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-500 text-white text-sm font-medium hover:bg-blue-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 shadow-lg "
            >
              {loading === 'accept' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              Aceptar
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
