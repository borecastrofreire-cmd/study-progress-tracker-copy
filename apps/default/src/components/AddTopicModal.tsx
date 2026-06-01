import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, BookOpen } from 'lucide-react';
import { createTopic } from '../lib/api';

interface AddTopicModalProps {
  subjectId: string;
  subjectName: string;
  onClose: () => void;
  onSaved: () => void;
}

export function AddTopicModal({ subjectId, subjectName, onClose, onSaved }: AddTopicModalProps) {
  const [name, setName] = useState('');
  const [startPage, setStartPage] = useState('');
  const [totalPages, setTotalPages] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!name.trim()) { setError('Introduce un nombre para el tema'); return; }
    const start = parseInt(startPage, 10);
    const total = parseInt(totalPages, 10);
    if (isNaN(start) || start < 1) { setError('Página de inicio inválida'); return; }
    if (isNaN(total) || total < 1) { setError('Total de páginas inválido'); return; }

    setSaving(true);
    try {
      await createTopic(subjectId, {
        text: name.trim(),
        subject: subjectName,
        startPage: start,
        totalPages: total,
      });
      onSaved();
    } catch {
      setError('Error al guardar. Inténtalo de nuevo.');
      setSaving(false);
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
            <h3 className="text-[#1c1c1e] font-semibold text-base">Añadir tema</h3>
            <p className="text-[#8e8e93] text-sm">{subjectName}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#f2f2f7] text-[#8e8e93] hover:text-[#1c1c1e] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-[#8e8e93] mb-1.5 font-medium">Nombre del tema</label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(''); }}
              placeholder="Ej: Tema 4 · Geometría"
              className="w-full bg-[#f2f2f7] border border-[#e5e5ea] rounded-xl px-3 py-2.5 text-sm text-[#1c1c1e] placeholder-[#aeaeb2] focus:outline-none focus:border-blue-500/50 focus:bg-white transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#8e8e93] mb-1.5 font-medium">
                <BookOpen className="w-3 h-3 inline mr-1" />
                Página inicio
              </label>
              <input
                type="number"
                value={startPage}
                onChange={(e) => { setStartPage(e.target.value); setError(''); }}
                placeholder="1"
                min={1}
                className="w-full bg-[#f2f2f7] border border-[#e5e5ea] rounded-xl px-3 py-2.5 text-sm text-[#1c1c1e] placeholder-[#aeaeb2] focus:outline-none focus:border-blue-500/50 focus:bg-white transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-[#8e8e93] mb-1.5 font-medium">Nº páginas</label>
              <input
                type="number"
                value={totalPages}
                onChange={(e) => { setTotalPages(e.target.value); setError(''); }}
                placeholder="30"
                min={1}
                className="w-full bg-[#f2f2f7] border border-[#e5e5ea] rounded-xl px-3 py-2.5 text-sm text-[#1c1c1e] placeholder-[#aeaeb2] focus:outline-none focus:border-blue-500/50 focus:bg-white transition-colors"
              />
            </div>
          </div>

          {error && (
            <p className="text-red-500 text-xs font-medium">{error}</p>
          )}
        </div>

        <div className="flex gap-2 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-[#e5e5ea] text-[#8e8e93] text-sm hover:text-[#1c1c1e] hover:bg-[#f2f2f7] transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-[#007aff] hover:bg-[#1a8aff] text-white text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Añadir tema'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
