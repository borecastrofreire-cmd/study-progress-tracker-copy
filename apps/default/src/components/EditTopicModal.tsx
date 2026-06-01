import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Trash2 } from 'lucide-react';
import { updateTopic, deleteNode } from '../lib/api';
import type { Topic, Status } from '../types/study';

interface EditTopicModalProps {
  topic: Topic;
  onClose: () => void;
  onSaved: () => void;
}

const statusOptions: { value: Status; label: string }[] = [
  { value: 'opt-pending', label: 'Pendiente' },
  { value: 'opt-progress', label: 'En progreso' },
  { value: 'opt-done', label: 'Completado' },
];

export function EditTopicModal({ topic, onClose, onSaved }: EditTopicModalProps) {
  const [name, setName] = useState(topic.text);
  const [startPage, setStartPage] = useState(String(topic.startPage));
  const [totalPages, setTotalPages] = useState(String(topic.totalPages));
  const [currentPage, setCurrentPage] = useState(String(topic.currentPage || topic.startPage - 1));
  const [status, setStatus] = useState<Status>(topic.status);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!name.trim()) { setError('El nombre no puede estar vacío'); return; }
    const start = parseInt(startPage, 10);
    const total = parseInt(totalPages, 10);
    const current = parseInt(currentPage, 10);
    if (isNaN(start) || start < 1) { setError('Página de inicio inválida'); return; }
    if (isNaN(total) || total < 1) { setError('Total de páginas inválido'); return; }
    const clampedCurrent = Math.max(start - 1, Math.min(start + total - 1, isNaN(current) ? start - 1 : current));

    setSaving(true);
    try {
      await updateTopic(topic.id, {
        text: name.trim(),
        startPage: start,
        totalPages: total,
        currentPage: clampedCurrent,
        status,
      });
      onSaved();
    } catch {
      setError('Error al guardar. Inténtalo de nuevo.');
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteNode(topic.id);
      onSaved();
    } catch {
      setError('Error al eliminar.');
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="w-full max-w-md bg-white border border-[#e5e5ea] rounded-2xl p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-[#1c1c1e] font-semibold text-base">Editar tema</h3>
            <p className="text-[#8e8e93] text-xs mt-0.5 truncate max-w-xs">{topic.text}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#f2f2f7] text-[#8e8e93] hover:text-[#1c1c1e] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs text-[#8e8e93] mb-1.5 font-medium">Nombre del tema</label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(''); }}
              className="w-full bg-[#f2f2f7] border border-[#e5e5ea] rounded-xl px-3 py-2.5 text-sm text-[#1c1c1e] placeholder-[#aeaeb2] focus:outline-none focus:border-blue-500/50 focus:bg-white transition-colors"
            />
          </div>

          {/* Pages */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-[#8e8e93] mb-1.5 font-medium">Pág. inicio</label>
              <input
                type="number"
                value={startPage}
                min={1}
                onChange={(e) => { setStartPage(e.target.value); setError(''); }}
                className="w-full bg-[#f2f2f7] border border-[#e5e5ea] rounded-xl px-3 py-2.5 text-sm text-[#1c1c1e] focus:outline-none focus:border-blue-500/50 focus:bg-white transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-[#8e8e93] mb-1.5 font-medium">Nº páginas</label>
              <input
                type="number"
                value={totalPages}
                min={1}
                onChange={(e) => { setTotalPages(e.target.value); setError(''); }}
                className="w-full bg-[#f2f2f7] border border-[#e5e5ea] rounded-xl px-3 py-2.5 text-sm text-[#1c1c1e] focus:outline-none focus:border-blue-500/50 focus:bg-white transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-[#8e8e93] mb-1.5 font-medium">Voy en pág.</label>
              <input
                type="number"
                value={currentPage}
                onChange={(e) => { setCurrentPage(e.target.value); setError(''); }}
                className="w-full bg-[#f2f2f7] border border-[#e5e5ea] rounded-xl px-3 py-2.5 text-sm text-[#1c1c1e] focus:outline-none focus:border-blue-500/50 focus:bg-white transition-colors"
              />
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs text-[#8e8e93] mb-1.5 font-medium">Estado</label>
            <div className="flex gap-2">
              {statusOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setStatus(opt.value)}
                  className={`flex-1 py-2 rounded-xl border text-xs font-semibold transition-all ${
                    status === opt.value
                      ? opt.value === 'opt-done'
                        ? 'bg-[#34c759]/10 border-[#34c759]/30 text-[#34c759]'
                        : opt.value === 'opt-progress'
                        ? 'bg-blue-500/10 border-blue-500/30 text-[#007aff]'
                        : 'bg-[#8e8e93]/10 border-[#8e8e93]/30 text-[#1c1c1e]'
                      : 'bg-[#f2f2f7] border-[#e5e5ea] text-[#8e8e93] hover:bg-[#e5e5ea] hover:text-[#1c1c1e]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-red-500 text-xs font-medium">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex gap-2 mt-6">
          <button
            onClick={handleDelete}
            disabled={deleting || saving}
            className="w-9 h-9 flex items-center justify-center rounded-xl border border-[#e5e5ea] text-[#ff3b30] hover:border-[#ff3b30]/30 hover:bg-[#ff3b30]/5 transition-all disabled:opacity-30 flex-shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-[#e5e5ea] text-[#8e8e93] text-sm hover:text-[#1c1c1e] hover:bg-[#f2f2f7] transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || deleting}
            className="flex-1 py-2.5 rounded-xl bg-[#007aff] hover:bg-[#1a8aff] text-white text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
