/**
 * sw.ts — Service Worker source
 * ─────────────────────────────────────────────────────────────────────────────
 * This file is converted to a self-contained SW string and registered as a
 * Blob URL, scoped to '/'. It handles:
 *   • push events   → show notification (works with app CLOSED)
 *   • notificationclick → focus/open the app
 *
 * The SW string is exported and registered dynamically so the build system
 * doesn't need a separate rollup entry point.
 */

export const SW_SCRIPT = /* js */`
// ── Push event ──────────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = { title: 'Studily', body: 'Tienes una nueva notificación', tag: 'default' };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch {
      data.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag ?? 'studily-push',
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      requireInteraction: false,
      data: data,
    })
  );
});

// ── Notification click ───────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If the app is already open — focus it
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          client.postMessage({ type: 'notification-click', tag: event.notification.tag });
          return;
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

// ── Activate: take control immediately ─────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});
`;

/**
 * Register the SW as a Blob URL worker so we don't need a separate build step.
 * The Blob is served with the correct MIME type and bypasses same-origin issues.
 */
export async function registerBlobServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;

  try {
    // Build a blob from the SW source with the correct Content-Type
    const blob = new Blob([SW_SCRIPT], { type: 'application/javascript' });
    const blobUrl = URL.createObjectURL(blob);

    // NOTE: Blob URL SWs are scoped to the blob origin, so we must pass
    // a real path scope. Some browsers (Firefox, older Safari) may restrict
    // blob SWs. We try blob first, fall back to /sw.js if it exists.
    let reg: ServiceWorkerRegistration;
    try {
      reg = await navigator.serviceWorker.register(blobUrl, { scope: '/' });
    } catch {
      // Fallback: try /sw.js (if the hosting platform serves it)
      reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    }

    await navigator.serviceWorker.ready;
    return reg;
  } catch (e) {
    console.warn('[sw] registration failed', e);
    return null;
  }
}
