/**
 * Persists and restores the user-defined subject order in localStorage.
 * Key: `subject_order:{userId}`
 * Value: JSON array of subject IDs in the desired order.
 */

const PREFIX = 'subject_order:';

export function saveSubjectOrder(userId: string, ids: string[]): void {
  try {
    localStorage.setItem(PREFIX + userId, JSON.stringify(ids));
  } catch {
    // quota exceeded or private mode — silently ignore
  }
}

export function loadSubjectOrder(userId: string): string[] | null {
  try {
    const raw = localStorage.getItem(PREFIX + userId);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as string[];
    return null;
  } catch {
    return null;
  }
}

/**
 * Applies a saved order to a list of subjects.
 * - Subjects whose id appears in the saved order are sorted accordingly.
 * - New subjects (not yet in saved order) are appended at the end.
 */
export function applySubjectOrder<T extends { id: string }>(
  subjects: T[],
  savedOrder: string[] | null,
): T[] {
  if (!savedOrder || savedOrder.length === 0) return subjects;

  const indexMap = new Map(savedOrder.map((id, i) => [id, i]));
  const known: T[] = [];
  const unknown: T[] = [];

  for (const s of subjects) {
    if (indexMap.has(s.id)) {
      known.push(s);
    } else {
      unknown.push(s);
    }
  }

  known.sort((a, b) => (indexMap.get(a.id) ?? 0) - (indexMap.get(b.id) ?? 0));

  return [...known, ...unknown];
}
