import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Plus, Trash2, BookOpen, Pencil, Check, X, Clock, GripVertical } from 'lucide-react';
import { SubjectCompletionModal } from './SubjectCompletionModal';
import type { DraggableProvidedDragHandleProps } from '@hello-pangea/dnd';

import { formatReadingTime } from '../lib/readingTime';
import { cn } from '../lib/utils';
import { ProgressBar } from './ProgressBar';
import { TopicRow } from './TopicRow';
import { AddTopicModal } from './AddTopicModal';
import { ColorEmojiPicker, getColorMeta } from './ColorEmojiPicker';
import type { Subject, SubjectColor } from '../types/study';
import { updateSubjectAppearance } from '../lib/api';
import { subjectTint } from '../lib/color-utils';
import axios from 'axios';

const PROJECT_ID = '3SkaV97RjbW7Yt1f';

interface SubjectCardProps {
  subject: Subject;
  index: number;
  onUpdate: () => void;
  onPatch: (id: string, patch: { color?: SubjectColor; emoji?: string; text?: string }) => void;
  onDelete: (id: string) => void;
  dragHandleProps?: DraggableProvidedDragHandleProps | null;
  isDragging?: boolean;
}

export function SubjectCard({ subject, index, onUpdate, onPatch, onDelete, dragHandleProps, isDragging }: SubjectCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showAddTopic, setShowAddTopic] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(subject.text);
  const [savingName, setSavingName] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync nameValue when parent data refreshes (skip while actively saving)
  useEffect(() => {
    if (!savingName) setNameValue(subject.text);
  }, [subject.text, savingName]);

  const colorMeta = getColorMeta(subject.color);
  const { accent, hex } = colorMeta;
  const tints = subjectTint(hex);

  const totalPages = subject.topics.reduce((sum, t) => sum + t.totalPages, 0);
  const readPages = subject.topics.reduce((sum, t) => {
    const read = Math.max(0, t.currentPage - t.startPage + 1);
    return sum + Math.min(read, t.totalPages);
  }, 0);
  const progress = totalPages > 0 ? (readPages / totalPages) * 100 : 0;
  const completedTopics = subject.topics.filter((t) => t.status === 'opt-done').length;
  const pagesLeft = Math.max(0, totalPages - readPages);
  const isSubjectComplete =
    subject.topics.length > 0 &&
    subject.topics.every((t) => t.status === 'opt-done');

  // Initialise ref with the real value so the first render never fires celebration
  const wasCompleteRef = useRef<boolean>(isSubjectComplete);

  // Detect transition from incomplete → complete and trigger celebration
  useEffect(() => {
    if (isSubjectComplete && !wasCompleteRef.current) {
      setShowCelebration(true);
    }
    wasCompleteRef.current = isSubjectComplete;
  }, [isSubjectComplete]);

  useEffect(() => {
    if (editingName && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingName]);

  const startEditing = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNameValue(subject.text);
    setEditingName(true);
  };

  const cancelEditing = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setNameValue(subject.text);
    setEditingName(false);
  };

  const saveName = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const trimmed = nameValue.trim();
    if (!trimmed || trimmed === subject.text) {
      setEditingName(false);
      return;
    }
    const prev = subject.text;
    onPatch(subject.id, { text: trimmed }); // optimistic — update App state instantly
    setSavingName(true);
    setEditingName(false);
    try {
      await axios.patch(`/api/taskade/projects/${PROJECT_ID}/nodes/${subject.id}`, {
        '/text': trimmed,
      });
    } catch {
      onPatch(subject.id, { text: prev }); // revert on error
    } finally {
      setSavingName(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') saveName();
    if (e.key === 'Escape') cancelEditing();
  };

  const handleColorChange = async (newColor: SubjectColor) => {
    if (newColor === subject.color) return;
    const prev = subject.color;
    onPatch(subject.id, { color: newColor }); // instant App-level update
    try {
      await updateSubjectAppearance(subject.id, newColor, subject.emoji, subject.order);
    } catch {
      onPatch(subject.id, { color: prev }); // revert on error
    }
  };

  const handleEmojiChange = async (newEmoji: string) => {
    if (newEmoji === subject.emoji) return;
    const prev = subject.emoji;
    onPatch(subject.id, { emoji: newEmoji }); // instant App-level update
    try {
      await updateSubjectAppearance(subject.id, subject.color, newEmoji, subject.order);
    } catch {
      onPatch(subject.id, { emoji: prev }); // revert on error
    }
  };

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, y: 15, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{
          duration: 0.4,
          ease: [0.16, 1, 0.3, 1], // cinematic spring-like ease
          delay: index * 0.05 // staggered entry
        }}
        className={cn(
          'rounded-2xl border transition-colors duration-300',
          isDragging && 'shadow-xl shadow-black/[0.06] ring-1 ring-[#e5e5ea] scale-[1.02]'
        )}
        style={{
          backgroundColor: tints.card,
          borderColor: tints.border,
          transition: isDragging ? 'box-shadow 0.15s, transform 0.15s' : undefined,
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-4 p-5 cursor-pointer transition-colors rounded-t-2xl"
          onClick={() => !editingName && setExpanded(!expanded)}
          style={{ backgroundColor: tints.header }}
        >
          {/* Drag handle */}
          <div
            {...dragHandleProps}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'flex-shrink-0 flex items-center justify-center w-5 h-8 rounded-md -ml-1.5',
              'text-[#aeaeb2] hover:text-[#8e8e93] transition-colors cursor-grab active:cursor-grabbing',
              'hover:bg-[#f2f2f7]'
            )}
            title="Arrastra para reordenar"
          >
            <GripVertical className="w-4 h-4" />
          </div>

          {/* Emoji + color picker */}
          <div
            className="flex-shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <ColorEmojiPicker
              color={subject.color}
              emoji={subject.emoji}
              onColorChange={handleColorChange}
              onEmojiChange={handleEmojiChange}
              compact
            />
          </div>

          <div className="flex-1 min-w-0">
            {/* Editable name */}
            <div className="flex items-center gap-2 mb-1 group/name">
              {editingName ? (
                <div
                  className="flex items-center gap-1.5 flex-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    ref={inputRef}
                    type="text"
                    value={nameValue}
                    onChange={(e) => setNameValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={savingName}
                    className={cn(
                      'flex-1 bg-[#f2f2f7] border border-[#e5e5ea] rounded-lg px-2 py-0.5 text-sm font-semibold',
                      'focus:outline-none focus:border-blue-500/40 transition-colors text-[#1c1c1e] min-w-0'
                    )}
                  />
                  <button
                    onClick={saveName}
                    disabled={savingName}
                    className="w-6 h-6 flex items-center justify-center rounded-md bg-[#34c759]/10 border border-[#34c759]/30 text-[#34c759] hover:bg-[#34c759]/20 transition-colors flex-shrink-0"
                  >
                    <Check className="w-3 h-3" />
                  </button>
                  <button
                    onClick={cancelEditing}
                    className="w-6 h-6 flex items-center justify-center rounded-md bg-[#f2f2f7] border border-[#e5e5ea] text-[#8e8e93] hover:text-[#1c1c1e] transition-colors flex-shrink-0"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <>
                  <h2 className={cn('text-base font-semibold truncate', accent)}>
                    {subject.text}
                  </h2>
                  <button
                    onClick={startEditing}
                    className="opacity-0 group-hover/name:opacity-100 w-5 h-5 flex items-center justify-center rounded-md hover:bg-[#f2f2f7] text-[#aeaeb2] hover:text-[#8e8e93] transition-all flex-shrink-0"
                    title="Renombrar asignatura"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  <span className="text-xs text-[#8e8e93] bg-[#f2f2f7] px-2 py-0.5 rounded-full flex-shrink-0 font-medium">
                    {completedTopics}/{subject.topics.length} temas
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-3">
              <ProgressBar
                progress={progress}
                size="sm"
                showLabel={true}
                color={subject.color}
                className="flex-1"
              />
            </div>

            <div className="flex items-center gap-2 mt-1.5 text-xs text-[#8e8e93] flex-wrap">
              <span className="flex items-center gap-1">
                <BookOpen className="w-3 h-3" />
                {totalPages} págs. totales
              </span>
              {pagesLeft > 0 && (
                <>
                  <span className="text-[#aeaeb2]">·</span>
                  <span>{pagesLeft} págs. restantes</span>
                  <span className="text-[#aeaeb2]">·</span>
                  <span className={cn(
                    'flex items-center gap-1 px-1.5 py-0.5 rounded-md font-medium',
                    'bg-[#f2f2f7] border border-[#e5e5ea] text-[#8e8e93]'
                  )}>
                    <Clock className="w-3 h-3" />
                    ~{formatReadingTime(pagesLeft)}
                  </span>
                </>
              )}
              {pagesLeft === 0 && totalPages > 0 && (
                <span className="text-[#34c759] font-medium">✓ Completa</span>
              )}
            </div>
          </div>

          {!editingName && (
            <motion.div
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              className="text-[#aeaeb2] flex-shrink-0"
            >
              <ChevronDown className="w-4 h-4" />
            </motion.div>
          )}
        </div>

        {/* Topics */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div
                className="px-5 pb-5 space-y-2.5 border-t pt-4 rounded-b-2xl"
                style={{ backgroundColor: tints.body, borderColor: tints.border }}
              >
                {subject.topics.length === 0 && (
                  <div className="text-center py-6 text-[#aeaeb2] text-sm">
                    Sin temas. Añade uno.
                  </div>
                )}
                {subject.topics.map((topic, i) => (
                  <TopicRow
                    key={topic.id}
                    topic={topic}
                    index={i}
                    subjectColor={subject.color}
                    onUpdate={onUpdate}
                  />
                ))}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={() => setShowAddTopic(true)}
                    className={cn(
                      'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all duration-200',
                      'border-[#e5e5ea] text-[#8e8e93] hover:text-[#1c1c1e] hover:bg-white hover:border-[#aeaeb2]'
                    )}
                  >
                    <Plus className="w-3 h-3" />
                    Añadir tema
                  </button>
                  <button
                    onClick={() => onDelete(subject.id)}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-[#e5e5ea] text-[#ff3b30] hover:text-[#ff3b30] hover:border-[#ff3b30]/30 hover:bg-[#ff3b30]/5 transition-all duration-200 ml-auto font-medium"
                  >
                    <Trash2 className="w-3 h-3" />
                    Eliminar
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {showAddTopic && (
        <AddTopicModal
          subjectId={subject.id}
          subjectName={subject.text}
          onClose={() => setShowAddTopic(false)}
          onSaved={() => {
            setShowAddTopic(false);
            onUpdate();
          }}
        />
      )}

      {showCelebration && (
        <SubjectCompletionModal
          subjectName={subject.text}
          subjectEmoji={subject.emoji}
          onClose={() => setShowCelebration(false)}
        />
      )}
    </>
  );
}
