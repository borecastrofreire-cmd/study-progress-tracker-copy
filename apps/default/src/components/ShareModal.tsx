import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Share2, Check, AlertCircle, Loader2, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { sendShareInvitation, fetchAllUsers } from '../lib/api';
import type { Subject } from '../types/study';

interface ShareModalProps {
  subjects: Subject[];
  currentUserId: string;
  onClose: () => void;
}

export function ShareModal({ subjects, currentUserId, onClose }: ShareModalProps) {
  const [targetUserId, setTargetUserId] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set(subjects.map((s) => s.id)));
  const [importing, setImporting] = useState(false);
  const [userNotFound, setUserNotFound] = useState(false);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const trimmed = targetUserId.trim().toLowerCase();
  const isSelf = trimmed === currentUserId.toLowerCase();

  const handleUserChange = (value: string) => {
    setTargetUserId(value);
    setUserNotFound(false);
  };

  const handleShare = async () => {
    if (!trimmed) {
      toast.error('Escribe el nombre de usuario del destinatario');
      return;
    }
    if (isSelf) {
      toast.error('No puedes compartir contigo mismo');
      return;
    }
    if (selected.size === 0) {
      toast.error('Selecciona al menos una asignatura');
      return;
    }

    const toShare = subjects.filter((s) => selected.has(s.id));
    setImporting(true);
    setUserNotFound(false);
    try {
      // Verify the target user exists before sending
      const allUsers = await fetchAllUsers();
      const exists = allUsers.some((u) => u.toLowerCase() === trimmed);
      if (!exists) {
        setUserNotFound(true);
        return;
      }

      await sendShareInvitation(currentUserId, trimmed, toShare);
      const displayTarget = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
      toast.success(`Invitación enviada a ${displayTarget} — esperando que la acepte`);
      onClose();
    } catch {
      toast.error('Error al enviar la invitación. Inténtalo de nuevo.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-md bg-[#0f1117] border border-[#38383a]/30 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#38383a]/20">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#0a84ff]/10 border border-blue-500/20 flex items-center justify-center">
              <Share2 className="w-3.5 h-3.5 text-[#0a84ff]" />
            </div>
            <h2 className="text-sm font-semibold text-white/90">Compartir asignaturas</h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-white/30 hover:text-white/60 hover:bg-[#1a1a1c] transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">

          {/* Recipient input */}
          <div className="space-y-2">
            <label htmlFor="recipient" className="text-xs font-medium text-white/40 uppercase tracking-wide">
              Compartir con
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                <UserCheck className="w-4 h-4 text-white/25" />
              </div>
              <input
                id="recipient"
                type="text"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                value={targetUserId}
                onChange={(e) => handleUserChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleShare()}
                placeholder="Nombre de usuario…"
                className={`w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/4 border text-sm text-white/80 placeholder-white/20 focus:outline-none focus:bg-white/6 transition-all ${
                  userNotFound
                    ? 'border-red-500/50 focus:border-red-500/60'
                    : 'border-[#38383a]/30 focus:border-blue-500/40'
                }`}
              />
            </div>
            {isSelf && trimmed.length > 0 && (
              <p className="text-xs text-red-400/70 pl-1">No puedes compartir contigo mismo.</p>
            )}
            {userNotFound && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-1.5 pl-1"
              >
                <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                <p className="text-xs text-red-400">
                  El usuario <span className="font-semibold">"{trimmed}"</span> no existe.
                </p>
              </motion.div>
            )}
          </div>

          {/* Subject selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-white/40 uppercase tracking-wide">
                Asignaturas a compartir
              </p>
              <button
                onClick={() =>
                  selected.size === subjects.length
                    ? setSelected(new Set())
                    : setSelected(new Set(subjects.map((s) => s.id)))
                }
                className="text-xs text-[#0a84ff]/70 hover:text-[#0a84ff] transition-colors"
              >
                {selected.size === subjects.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
              </button>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent pr-1">
              {subjects.map((s) => {
                const isSelected = selected.has(s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => toggle(s.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-blue-500/10 border-blue-500/25 text-white/80'
                        : 'bg-white/2 border-[#38383a]/20 text-white/40 hover:bg-white/4'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-all ${
                        isSelected ? 'bg-blue-500 border-blue-500' : 'border-white/20'
                      }`}
                    >
                      {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                    </div>
                    <span className="text-base leading-none">{s.emoji}</span>
                    <span className="text-sm font-medium truncate">{s.text}</span>
                    <span className="ml-auto text-xs text-white/25 flex-shrink-0">
                      {s.topics.length} {s.topics.length === 1 ? 'tema' : 'temas'}
                    </span>
                  </button>
                );
              })}
              {subjects.length === 0 && (
                <p className="text-center text-white/25 text-xs py-4">Sin asignaturas para compartir</p>
              )}
            </div>
          </div>

          {/* Info callout */}
          <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-amber-500/5 border border-amber-500/15">
            <AlertCircle className="w-3.5 h-3.5 text-[#ff9f0a]/70 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-[#ff9f0a]/60 leading-relaxed">
              El destinatario recibirá un aviso y podrá aceptar o rechazar. Si acepta, obtendrá una copia propia de las asignaturas.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-[#38383a]/30 text-white/40 hover:text-white/60 hover:bg-white/4 text-sm transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={handleShare}
              disabled={importing || selected.size === 0 || !trimmed || isSelf}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-medium hover:bg-blue-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {importing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4" />
                  {selected.size > 0 ? `Enviar invitación (${selected.size})` : 'Enviar invitación'}
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
