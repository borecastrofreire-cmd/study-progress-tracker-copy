import { BookOpen, CheckCircle, Clock, BarChart2 } from 'lucide-react';
import { ProgressBar } from './ProgressBar';
import type { Subject } from '../types/study';

interface StatsBarProps {
  subjects: Subject[];
}

export function StatsBar({ subjects }: StatsBarProps) {
  const totalTopics = subjects.reduce((sum, s) => sum + s.topics.length, 0);
  const doneTopics = subjects.reduce(
    (sum, s) => sum + s.topics.filter((t) => t.status === 'opt-done').length,
    0
  );
  const inProgressTopics = subjects.reduce(
    (sum, s) => sum + s.topics.filter((t) => t.status === 'opt-progress').length,
    0
  );

  const totalPages = subjects.reduce(
    (sum, s) => sum + s.topics.reduce((ts, t) => ts + t.totalPages, 0),
    0
  );
  const readPages = subjects.reduce(
    (sum, s) =>
      sum +
      s.topics.reduce((ts, t) => {
        const read = Math.max(0, t.currentPage - t.startPage + 1);
        return ts + Math.min(read, t.totalPages);
      }, 0),
    0
  );
  const overallProgress = totalPages > 0 ? (readPages / totalPages) * 100 : 0;

  const stats = [
    {
      icon: <BarChart2 className="w-3.5 h-3.5" />,
      label: 'Progreso total',
      value: `${Math.round(overallProgress)}%`,
      color: 'text-[#0a84ff]',
    },
    {
      icon: <BookOpen className="w-3.5 h-3.5" />,
      label: 'Páginas leídas',
      value: `${readPages} / ${totalPages}`,
      color: 'text-cyan-400',
    },
    {
      icon: <CheckCircle className="w-3.5 h-3.5" />,
      label: 'Temas completos',
      value: `${doneTopics} / ${totalTopics}`,
      color: 'text-[#30d158]',
    },
    {
      icon: <Clock className="w-3.5 h-3.5" />,
      label: 'En progreso',
      value: `${inProgressTopics}`,
      color: 'text-[#ff9f0a]',
    },
  ];

  return (
    <div className="bg-white border border-[#e5e5ea] rounded-2xl p-4 mb-6 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs text-[#8e8e93] uppercase tracking-widest font-medium">Vista general</span>
      </div>
      <ProgressBar progress={overallProgress} size="lg" color="blue" showLabel={false} className="mb-4" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="flex items-start gap-2">
            <span className={s.color + ' mt-0.5'}>{s.icon}</span>
            <div>
              <p className={`text-sm font-semibold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-[#8e8e93]">{s.label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
