import { useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { createSubject } from '../lib/api';
import { ColorEmojiPicker, COLOR_OPTIONS } from './ColorEmojiPicker';
import type { SubjectColor } from '../types/study';
import { cn } from '../lib/utils';

interface AddSubjectModalProps {
  onClose: () => void;
  onSaved: () => void;
  userId: string;
}

export function AddSubjectModal({ onClose, onSaved, userId }: AddSubjectModalProps) {
  const [name, setName] = useState('');
  const [color, setColor] = useState<SubjectColor>('blue');
  const [emoji, setEmoji] = useState('📖');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selectedColor = COLOR_OPTIONS.find((c) => c.id === color) ?? COLOR_OPTIONS[0];

  const handleSave = async () => {
    if (!name.trim()) { setError('Introduce el nombre de la asignatura'); return; }
    setSaving(true);
    try {
      await createSubject(userId, name.trim(), color, emoji);
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
        className={cn(
          'w-full max-w-sm bg-white border border-[#e5e5ea] rounded-2xl p-6 shadow-2xl transition-colors duration-300'
        )}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[#1c1c1e] font-semibold text-base">Nueva asignatura</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#f2f2f7] text-[#8e8e93] hover:text-[#1c1c1e] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Preview */}
        <div className={cn(
          'flex items-center gap-3 p-3 rounded-xl mb-5 border border-[#e5e5ea] transition-all duration-300',
          selectedColor.gradient
        )}>
          <span className="text-3xl">{emoji}</span>
          <span className={cn('font-semibold text-sm truncate', selectedColor.accent)}>
            {name || 'Nombre de la asignatura'}
          </span>
        </div>

        {/* Color & emoji picker */}
        <div className="mb-4">
          <label className="block text-xs text-[#8e8e93] mb-2 font-medium">Aspecto</label>
          <ColorEmojiPicker
            color={color}
            emoji={emoji}
            onColorChange={(c) => setColor(c)}
            onEmojiChange={(e) => setEmoji(e)}
          />
        </div>

        <div>
          <label className="block text-xs text-[#8e8e93] mb-1.5 font-medium">Nombre</label>
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setError(''); }}
            placeholder="Ej: Derecho Constitucional"
            autoFocus
            className="w-full bg-[#f2f2f7] border border-[#e5e5ea] rounded-xl px-3 py-2.5 text-sm text-[#1c1c1e] placeholder-[#aeaeb2] focus:outline-none focus:border-blue-500/50 focus:bg-white transition-colors"
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
          />
          {error && <p className="text-red-500 text-xs mt-2 font-medium">{error}</p>}
        </div>

        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-[#e5e5ea] text-[#8e8e93] text-sm hover:text-[#1c1c1e] hover:bg-[#f2f2f7] transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-[#007aff] text-white text-sm font-semibold hover:bg-[#1a8aff] transition-colors disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Crear'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
