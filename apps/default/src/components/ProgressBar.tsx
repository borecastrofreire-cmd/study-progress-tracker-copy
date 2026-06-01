import { motion } from 'framer-motion';
import { cn } from '../lib/utils';
import type { SubjectColor } from '../types/study';

interface ProgressBarProps {
  progress: number; // 0-100
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  color?: SubjectColor | 'blue' | 'green' | 'amber' | 'purple';
  className?: string;
}

const colorMap: Record<string, string> = {
  blue: 'bg-[#0a84ff]',
  green: 'bg-[#30d158]',
  emerald: 'bg-[#30d158]',
  amber: 'bg-[#ff9f0a]',
  orange: 'bg-[#ff9f0a]',
  purple: 'bg-[#0a84ff]',
  violet: 'bg-[#0a84ff]',
  rose: 'bg-[#ff453a]',
  cyan: 'bg-[#0a84ff]',
  pink: 'bg-[#ff453a]',
};

const sizeMap = {
  sm: 'h-1.5',
  md: 'h-2.5',
  lg: 'h-4',
};

export function ProgressBar({
  progress,
  size = 'md',
  showLabel = false,
  color = 'blue',
  className,
}: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, progress));

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div
        className={cn(
          'flex-1 rounded-full bg-[#e5e5ea] overflow-hidden',
          sizeMap[size]
        )}
      >
        <motion.div
          className={cn('h-full rounded-full', colorMap[color])}
          initial={{ width: 0 }}
          animate={{ width: `${clamped}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
      {showLabel && (
        <span className="text-xs font-medium text-[#8e8e93] w-9 text-right tabular-nums">
          {Math.round(clamped)}%
        </span>
      )}
    </div>
  );
}
