import { cn } from '../lib/utils';
import type { Status } from '../types/study';

const config: Record<Status, { label: string; className: string; dot: string }> = {
  'opt-pending': {
    label: 'Pendiente',
    className: 'bg-[#1a1a1c] text-white/40 border border-[#38383a]/30',
    dot: 'bg-white/30',
  },
  'opt-progress': {
    label: 'En progreso',
    className: 'bg-blue-500/10 text-[#0a84ff] border border-blue-500/20',
    dot: 'bg-blue-400',
  },
  'opt-done': {
    label: 'Completado',
    className: 'bg-[#30d158]/10 text-[#30d158] border border-[#30d158]/20',
    dot: 'bg-emerald-400',
  },
};

export function StatusBadge({ status }: { status: Status }) {
  const c = config[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium',
        c.className
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full', c.dot)} />
      {c.label}
    </span>
  );
}
