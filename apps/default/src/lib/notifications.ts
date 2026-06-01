/**
 * notifications.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Handles browser notifications for:
 *   1. Incoming share invitations
 *   2. Tasks with a deadline ≤ 24 h from now (fired once per task per session)
 *
 * Prefers the Service Worker showNotification API so alerts work even when the
 * app is backgrounded. Falls back to Notification API when SW is unavailable.
 */

import { differenceInHours, parseISO, isFuture } from 'date-fns';
import type { Task } from '../types/study';

// ── Permission ────────────────────────────────────────────────────────────────

export function notificationsSupported(): boolean {
  return 'Notification' in window;
}

export function notificationsGranted(): boolean {
  return notificationsSupported() && Notification.permission === 'granted';
}

/**
 * Ask the user for notification permission (only if not already decided).
 * Returns the resulting permission state.
 */
export async function requestPermission(): Promise<NotificationPermission> {
  if (!notificationsSupported()) return 'denied';
  if (Notification.permission !== 'default') return Notification.permission;
  return Notification.requestPermission();
}

// ── Core fire ─────────────────────────────────────────────────────────────────

/**
 * Show a notification — prefers SW registration (works in background),
 * falls back to Notification API (foreground only).
 */
async function fire(
  title: string,
  opts: NotificationOptions & { onClick?: () => void },
) {
  if (!notificationsGranted()) return;
  const { onClick, ...rest } = opts;

  // Prefer Service Worker notification (works when app is backgrounded)
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        vibrate: [200, 100, 200],
        ...rest,
      });

      if (onClick) {
        navigator.serviceWorker.addEventListener(
          'message',
          (e) => {
            if (
              e.data?.type === 'notification-click' &&
              e.data?.tag === opts.tag
            ) {
              window.focus();
              onClick();
            }
          },
          { once: true },
        );
      }
      return;
    } catch {
      // SW not ready — fall through to Notification API
    }
  }

  // Fallback: plain Notification API (foreground only)
  const n = new Notification(title, {
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    ...rest,
  });
  if (onClick) n.onclick = () => { window.focus(); onClick(); };
}

// ── Share invitation notification ─────────────────────────────────────────────

/**
 * Fire a notification telling the current user that someone wants to share subjects.
 */
export function notifyShareInvitation(
  fromUser: string,
  count: number,
  onOpen: () => void,
) {
  const sender = fromUser.charAt(0).toUpperCase() + fromUser.slice(1);
  fire(`📚 ${sender} quiere compartir contigo`, {
    body: `${count} asignatura${count !== 1 ? 's' : ''} · Toca para aceptar o rechazar`,
    tag: `share-inv-${fromUser}`,
    requireInteraction: true,
    onClick: onOpen,
  });
}

// ── Deadline notifications ────────────────────────────────────────────────────

/**
 * Set of task IDs for which we have already fired a deadline notification
 * this session. Prevents repeated alerts on every polling cycle.
 */
const firedDeadlines = new Set<string>();

/**
 * Check all tasks and fire a notification for any incomplete task whose
 * deadline is between now and 24 hours from now (once per session per task).
 */
export function checkDeadlineNotifications(
  tasks: Task[],
  onOpen?: () => void,
) {
  if (!notificationsGranted()) return;

  const now = new Date();

  for (const task of tasks) {
    if (task.completed) continue;
    if (!task.deadline) continue;
    if (firedDeadlines.has(task.id)) continue;

    const deadline = parseISO(task.deadline);
    if (!isFuture(deadline)) continue;

    const hoursLeft = differenceInHours(deadline, now);
    if (hoursLeft > 24) continue;

    firedDeadlines.add(task.id);

    const hoursLabel =
      hoursLeft < 1
        ? 'menos de 1 hora'
        : `${hoursLeft} hora${hoursLeft !== 1 ? 's' : ''}`;

    fire(`⏰ Tarea próxima a vencer`, {
      body: `"${task.text}" · Quedan ${hoursLabel}`,
      tag: `deadline-${task.id}`,
      requireInteraction: false,
      onClick: onOpen,
    });
  }
}

/**
 * Clear the fired-deadlines memory (call on logout so the next login
 * re-evaluates all tasks fresh).
 */
export function clearDeadlineMemory() {
  firedDeadlines.clear();
}
