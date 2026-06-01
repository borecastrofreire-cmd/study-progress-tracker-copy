export type Status = 'opt-pending' | 'opt-progress' | 'opt-done';

export type SubjectColor =
  | 'blue'
  | 'violet'
  | 'emerald'
  | 'amber'
  | 'rose'
  | 'cyan'
  | 'orange'
  | 'pink';

export interface Topic {
  id: string;
  text: string;
  subject: string;
  startPage: number;
  totalPages: number;
  currentPage: number;
  estimatedMinutes: number;
  status: Status;
  parentId: string | null;
}

export interface Subject {
  id: string;
  text: string;
  status: Status;
  topics: Topic[];
  color: SubjectColor;
  emoji: string;
  order: number; // persisted server-side for cross-device sort
}

export interface TaskGroup {
  id: string;
  name: string;
  tasks: Task[];
}

export interface Task {
  id: string;
  text: string;
  deadline: string | null; // ISO datetime string or null
  completed: boolean;
  groupId: string; // id of parent TaskGroup node
}

export interface NodeRaw {
  id: string;
  parentId: string | null;
  fieldValues: {
    '/text'?: string;
    '/attributes/@sub01'?: string;
    '/attributes/@sub02'?: number;
    '/attributes/@sub03'?: number;
    '/attributes/@sub04'?: number;
    '/attributes/@sub05'?: Status;
    '/attributes/@sub06'?: number;
    '/attributes/note'?: string; // JSON: { color, emoji } for subjects; PIN hash for auth nodes
  };
}
