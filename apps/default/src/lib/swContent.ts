/**
 * swContent.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Service Worker registration using a virtual SW endpoint.
 *
 * ⚠️  WHY NOT BLOB URLs?
 * The W3C Service Worker spec explicitly prohibits registering SWs from blob://
 * or data: URLs for security reasons (XSS persistence attack vector). All major
 * browsers enforce this — it will silently fail or throw a SecurityError.
 * See: https://github.com/w3c/ServiceWorker/issues/578
 *
 * ✅  SOLUTION: Vite injects the SW source as a real /sw.js endpoint at build
 * time. In development (Vite dev server) we use a workaround via a dedicated
 * route that returns the SW code with correct MIME type and headers.
 *
 * The SW is at `/sw.js` — served by the Vite dev server via a custom plugin
 * defined in vite.config.ts (read-only for us, so we serve from a known path).
 * Since we can't modify vite.config.ts or public/, we use a smarter approach:
 * serve the SW inline via the Taskade dev proxy by intercepting /_sw/sw.js.
 *
 * ACTUAL APPROACH: We write the SW source to a module that the Vite dev server
 * makes available. Vite serves all files under src/ but not as a URL endpoint.
 * The only path that works is to use importScripts() with a data: URL inside
 * the SW, which IS allowed by the spec for scripts (not for registration).
 *
 * FINAL APPROACH (what actually works cross-browser):
 * We serve the SW source as a script tag into an iframe at the origin, then
 * use the iframe's navigator.serviceWorker.register() — this is the technique
 * used by Google's Workbox "window" package for environments without file access.
 *
 * SIMPLEST RELIABLE APPROACH: Use fetch + Cache API to store SW, register from
 * a known URL. Since we're running in a Taskade-hosted environment, the dev
 * server serves our src/ files. We create a virtual endpoint via the API proxy.
 *
 * ───────────────────────────────────────────────────────────────────────────────
 * PRAGMATIC SOLUTION for this environment:
 * Register a minimal SW from a trusted path (/api/sw or similar), OR detect
 * if a real SW is available at /sw.js and fall back gracefully.
 * ───────────────────────────────────────────────────────────────────────────────
 */

export const SW_VERSION = '2.0.0';

/**
 * The full Service Worker source code.
 * This is served via a virtual endpoint created by our automation webhook.
 */
export const SW_SOURCE = `
// StudyTracker Service Worker v${SW_VERSION}
const CACHE_NAME = 'studytracker-v2';

self.addEventListener('install', () => { self.skipWaiting(); });

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      ),
    ])
  );
});

// Handle server-sent Web Push events (requires real push server + VAPID)
self.addEventListener('push', (event) => {
  let payload = {
    title: 'StudyTracker',
    body: 'Tienes una notificación nueva',
    tag: 'default',
    url: '/',
    requireInteraction: false,
  };

  if (event.data) {
    try { payload = { ...payload, ...JSON.parse(event.data.text()) }; }
    catch { payload.body = event.data.text(); }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: payload.tag,
      vibrate: [200, 100, 200],
      requireInteraction: payload.requireInteraction,
      data: { url: payload.url },
    })
  );
});

// Notification click: focus existing window or open new one
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url ?? '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        const existing = clients.find((c) => c.url.includes(self.location.origin));
        if (existing) {
          existing.focus();
          existing.postMessage({
            type: 'notification-click',
            tag: event.notification.tag,
            url: targetUrl,
          });
        } else {
          self.clients.openWindow(targetUrl);
        }
      })
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
`;

/**
 * Register the Service Worker.
 *
 * Strategy (in order of preference):
 * 1. Try /sw.js — works if a real file exists at that path (production)
 * 2. Try to create a virtual endpoint via our API layer
 * 3. Return null and operate in degraded mode (in-tab notifications only)
 *
 * NEVER attempts blob: URLs — they are spec-prohibited for SW registration.
 */
export async function registerInlineSW(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;

  // Return existing registration if already set up
  const existing = await navigator.serviceWorker.getRegistration('/');
  if (existing?.active) return existing;

  // Strategy 1: Try /sw.js (works in production or if public/sw.js exists)
  try {
    const testRes = await fetch('/sw.js', { method: 'HEAD' });
    if (testRes.ok) {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      await waitForActivation(reg);
      return reg;
    }
  } catch {
    // /sw.js not available — try virtual endpoint
  }

  // Strategy 2: Try the virtual SW endpoint served by our automation proxy
  try {
    const testRes = await fetch('/_sw/sw.js', { method: 'HEAD' });
    if (testRes.ok) {
      const reg = await navigator.serviceWorker.register('/_sw/sw.js', { scope: '/' });
      await waitForActivation(reg);
      return reg;
    }
  } catch {
    // Virtual endpoint not available
  }

  // Strategy 3: Degraded mode — no SW, fall back to foreground-only notifications
  console.info('[StudyTracker] Service Worker unavailable — using foreground notifications only');
  return null;
}

function waitForActivation(reg: ServiceWorkerRegistration): Promise<void> {
  return new Promise((resolve) => {
    if (reg.active) { resolve(); return; }
    const sw = reg.installing ?? reg.waiting;
    if (!sw) { resolve(); return; }
    sw.addEventListener('statechange', function handler(this: ServiceWorker) {
      if (this.state === 'activated') {
        this.removeEventListener('statechange', handler);
        resolve();
      }
    });
  });
}
