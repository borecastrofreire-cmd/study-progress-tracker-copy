/**
 * push.ts — Web Push & Notification Layer
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * HONEST CAPABILITY MATRIX (per platform):
 *
 * ┌─────────────────────────────┬──────────┬───────────┬─────────────────────┐
 * │ Feature                     │ Android  │ iOS (PWA) │ iOS (Safari browser)│
 * ├─────────────────────────────┼──────────┼───────────┼─────────────────────┤
 * │ Notification API            │ ✅       │ ✅ 16.4+  │ ❌                  │
 * │ Service Worker              │ ✅       │ ✅ 16.4+  │ ❌                  │
 * │ Web Push (server push)      │ ✅       │ ✅ 16.4+  │ ❌                  │
 * │ Push when app CLOSED        │ ✅       │ ✅*       │ ❌                  │
 * │ Push when app BACKGROUNDED  │ ✅       │ ✅        │ ❌                  │
 * │ SW.showNotification()       │ ✅       │ ✅ 16.4+  │ ❌                  │
 * ├─────────────────────────────┼──────────┼───────────┼─────────────────────┤
 * │ Desktop Chrome/Edge/Firefox │ ✅ full  │     -     │        -            │
 * │ Desktop Safari (macOS 13+)  │ ✅ 13+   │     -     │        -            │
 * └─────────────────────────────┴──────────┴───────────┴─────────────────────┘
 *
 * * iOS PWA push with app closed REQUIRES:
 *   1. App installed via "Add to Home Screen" in Safari
 *   2. Launched from home screen icon (not Safari)
 *   3. iOS 16.4+ (WebKit push support)
 *   4. Real VAPID server to send push (can't self-push from browser)
 *
 * WHAT THIS MODULE DOES:
 * 1. Detects the exact platform and its capabilities
 * 2. For iOS Safari (non-PWA): shows "Add to Home Screen" guide
 * 3. For supported platforms: registers SW + subscribes to push
 * 4. Falls back to in-tab SW.showNotification() when push server unavailable
 * 5. Never attempts blob: URL SW registration (spec-prohibited)
 */

import axios from 'axios';
import { registerInlineSW } from './swContent';

// ─── Constants ────────────────────────────────────────────────────────────────

const PUSH_PROJECT_BASE = '/api/taskade/projects/nBpkzyFPSrBaFrug/nodes';
const PUSH_SUB_PREFIX = '__push__';

/**
 * VAPID public key (URL-safe base64).
 * ⚠️  This is a DEMO key. For production:
 *   1. Generate: npx web-push generate-vapid-keys
 *   2. Store private key server-side ONLY
 *   3. Replace this public key
 * Without a matching server-side private key, subscriptions are stored
 * but no push messages can be sent when the app is closed.
 */
const VAPID_PUBLIC_KEY =
  'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDkBNR68l5DVErhpDG4JH9bIJMjBaMXjVvmqvSHH0AE';

// ─── Platform detection ───────────────────────────────────────────────────────

/** True when running in iOS Safari (includes WebView). */
export function isIOS(): boolean {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && !('MSStream' in window);
}

/** True when iOS 16.4+ (minimum for Web Push on iOS). */
export function isIOSSupportingPush(): boolean {
  if (!isIOS()) return false;
  const match = navigator.userAgent.match(/OS (\d+)_(\d+)/);
  if (!match) return false;
  const major = parseInt(match[1], 10);
  const minor = parseInt(match[2], 10);
  return major > 16 || (major === 16 && minor >= 4);
}

/**
 * True when the app is running as an installed PWA (standalone mode).
 * On iOS this means launched from "Add to Home Screen".
 * This is REQUIRED for push notifications on iOS.
 */
export function isInstalledPWA(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in window.navigator && (window.navigator as { standalone?: boolean }).standalone === true)
  );
}

/** True when running in iOS Safari browser (not installed PWA). */
export function isIOSSafariBrowser(): boolean {
  return isIOS() && !isInstalledPWA();
}

// ─── Capability types ─────────────────────────────────────────────────────────

export type PushCapability =
  | 'full'          // SW + push subscribe + server push possible
  | 'sw-only'       // SW available but no real push server (in-tab only)
  | 'needs-install' // iOS Safari: must be installed as PWA first
  | 'needs-update'  // iOS < 16.4: needs OS update
  | 'unsupported'   // Desktop browser without push, or denied
  | 'denied';       // Permission explicitly denied

export interface PushCapabilityInfo {
  capability: PushCapability;
  /** Short label for UI */
  label: string;
  /** Longer explanation for user */
  description: string;
  /** Whether notifications work at all (even in-tab) */
  notificationsWork: boolean;
  /** Whether push works when app is backgrounded */
  backgroundWork: boolean;
  /** Whether push works when app is fully closed */
  closedWork: boolean;
}

export function getPushCapabilityInfo(): PushCapabilityInfo {
  const isIos = isIOS();

  // iOS Safari browser (not installed as PWA)
  if (isIos && !isInstalledPWA()) {
    if (!isIOSSupportingPush()) {
      return {
        capability: 'needs-update',
        label: 'iOS no compatible',
        description: 'Actualiza a iOS 16.4 o superior para recibir notificaciones.',
        notificationsWork: false,
        backgroundWork: false,
        closedWork: false,
      };
    }
    return {
      capability: 'needs-install',
      label: 'Instalar para activar',
      description:
        'En iPhone, las notificaciones requieren instalar la app: Safari → Compartir → "Añadir a pantalla de inicio".',
      notificationsWork: false,
      backgroundWork: false,
      closedWork: false,
    };
  }

  // Browser doesn't support notifications at all
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    return {
      capability: 'unsupported',
      label: 'No compatible',
      description: 'Tu navegador no admite notificaciones push.',
      notificationsWork: false,
      backgroundWork: false,
      closedWork: false,
    };
  }

  // Permission denied
  if (Notification.permission === 'denied') {
    return {
      capability: 'denied',
      label: 'Permiso denegado',
      description: 'Activa las notificaciones en los ajustes del navegador.',
      notificationsWork: false,
      backgroundWork: false,
      closedWork: false,
    };
  }

  // PushManager not available (some older browsers)
  if (!('PushManager' in window)) {
    return {
      capability: 'sw-only',
      label: 'Solo en primer plano',
      description: 'Recibirás avisos mientras la app esté abierta o en segundo plano.',
      notificationsWork: true,
      backgroundWork: true,
      closedWork: false,
    };
  }

  // Full support (Chrome, Edge, Firefox, iOS PWA 16.4+)
  return {
    capability: 'full',
    label: 'Compatible',
    description:
      isIos
        ? 'Recibirás avisos aunque la app esté cerrada.'
        : 'Notificaciones completas, incluso con la app cerrada.',
    notificationsWork: true,
    backgroundWork: true,
    closedWork: true, // requires real VAPID server for truly closed
  };
}

// ─── Legacy helpers ───────────────────────────────────────────────────────────

export function pushSupported(): boolean {
  const info = getPushCapabilityInfo();
  return info.notificationsWork;
}

export type PushStatus = 'unsupported' | 'denied' | 'not-subscribed' | 'subscribed' | 'needs-install';

export async function getPushStatus(): Promise<PushStatus> {
  const info = getPushCapabilityInfo();

  if (info.capability === 'needs-install' || info.capability === 'needs-update') {
    return 'needs-install';
  }
  if (info.capability === 'unsupported') return 'unsupported';
  if (info.capability === 'denied') return 'denied';
  if (Notification.permission !== 'granted') return 'not-subscribed';

  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return sub ? 'subscribed' : 'not-subscribed';
  } catch {
    return 'not-subscribed';
  }
}

// ─── VAPID utilities ──────────────────────────────────────────────────────────

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

// ─── Service Worker ───────────────────────────────────────────────────────────

let swRegistration: ServiceWorkerRegistration | null = null;

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (swRegistration) return swRegistration;
  if (!('serviceWorker' in navigator)) return null;

  const reg = await registerInlineSW();
  swRegistration = reg;
  return reg;
}

// ─── Push subscription ────────────────────────────────────────────────────────

/**
 * Subscribe this browser to Web Push and persist the subscription in Taskade.
 *
 * On iOS (PWA): subscribes via WebKit's APNs-backed push implementation.
 * On Android/Desktop: subscribes via FCM or browser's push service.
 *
 * The subscription is saved to Taskade so a server-side component can later
 * send actual push messages when the app is closed.
 */
export async function subscribeToPush(userId: string): Promise<void> {
  const info = getPushCapabilityInfo();
  if (!info.notificationsWork) return;
  if (Notification.permission !== 'granted') return;

  const reg = await registerServiceWorker();
  if (!reg) {
    console.warn('[push] No SW registration — cannot subscribe to push');
    return;
  }

  if (!('PushManager' in window)) {
    console.info('[push] PushManager not available — SW notifications only');
    return;
  }

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    try {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    } catch (err) {
      // On iOS, VAPID subscription may fail if the key doesn't match APNs config
      console.warn('[push] Push subscription failed:', err);
      return;
    }
  }

  const subJson = sub.toJSON();
  const endpoint = subJson.endpoint ?? '';
  const auth = subJson.keys?.auth ?? '';
  const p256dh = subJson.keys?.p256dh ?? '';

  if (!endpoint) return;

  // Deduplicate before saving
  try {
    const existing = await fetchUserSubscriptions(userId);
    if (existing.some((e) => e.endpoint === endpoint)) return;

    await axios.post(PUSH_PROJECT_BASE, {
      '/text': `${PUSH_SUB_PREFIX}${userId}__${Date.now()}`,
      '/attributes/@pushU': userId,
      '/attributes/@pushE': endpoint,
      '/attributes/@pushK': JSON.stringify({ auth, p256dh }),
      '/attributes/@pushP': navigator.platform,
      '/attributes/@pushD': isIOS() ? 'ios' : 'other',
    });
  } catch (err) {
    // Non-fatal: subscription works locally even if save fails
    console.warn('[push] Failed to save subscription to Taskade:', err);
  }
}

export async function unsubscribeFromPush(userId: string): Promise<void> {
  if (!('serviceWorker' in navigator)) return;

  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();

    if (sub) {
      const endpoint = sub.toJSON().endpoint ?? '';
      await sub.unsubscribe();

      const existing = await fetchUserSubscriptions(userId);
      const match = existing.find((e) => e.endpoint === endpoint);
      if (match?.nodeId) {
        await axios.delete(`${PUSH_PROJECT_BASE}/${match.nodeId}`).catch(() => {});
      }
    }
  } catch (err) {
    console.warn('[push] Unsubscribe failed:', err);
  }
}

// ─── Subscription management ──────────────────────────────────────────────────

interface PushEntry {
  nodeId: string;
  userId: string;
  endpoint: string;
  auth: string;
  p256dh: string;
}

async function fetchUserSubscriptions(userId: string): Promise<PushEntry[]> {
  try {
    const res = await axios.get(PUSH_PROJECT_BASE);
    const nodes: Array<{ id: string; fieldValues: Record<string, string> }> =
      res.data?.payload?.nodes ?? [];

    return nodes
      .filter(
        (n) =>
          n.fieldValues['/attributes/@pushU'] === userId &&
          (n.fieldValues['/text'] ?? '').startsWith(PUSH_SUB_PREFIX),
      )
      .map((n) => {
        let auth = '';
        let p256dh = '';
        try {
          const keys = JSON.parse(n.fieldValues['/attributes/@pushK'] ?? '{}');
          auth = keys.auth ?? '';
          p256dh = keys.p256dh ?? '';
        } catch { /* malformed */ }
        return {
          nodeId: n.id,
          userId: n.fieldValues['/attributes/@pushU'] ?? '',
          endpoint: n.fieldValues['/attributes/@pushE'] ?? '',
          auth,
          p256dh,
        };
      });
  } catch {
    return [];
  }
}

// ─── In-tab SW notification (app open or backgrounded) ───────────────────────

/**
 * Show a notification via the active Service Worker.
 *
 * ✅ Works: app is open or in background (tab/window minimized)
 * ❌ Does NOT work: app is fully closed (tab/browser closed)
 *   → For closed-app push, a real VAPID server must send the push message.
 *
 * On iOS: only works if the app is installed as a PWA (Add to Home Screen).
 */
export async function showPushNotification(
  title: string,
  options: NotificationOptions & { onClick?: () => void },
): Promise<void> {
  if (Notification.permission !== 'granted') return;

  const { onClick, ...rest } = options;

  // Try SW notification first (works when app is backgrounded)
  try {
    const reg = swRegistration ?? (await navigator.serviceWorker.ready);
    await reg.showNotification(title, {
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      ...rest,
    });

    if (onClick) {
      navigator.serviceWorker.addEventListener(
        'message',
        (e) => {
          if (e.data?.type === 'notification-click' && e.data?.tag === options.tag) {
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

  // Fallback: plain Notification API (foreground tab only)
  try {
    const n = new Notification(title, { icon: '/favicon.ico', ...rest });
    if (onClick) n.onclick = () => { window.focus(); onClick(); };
  } catch {
    // Notification API also unavailable (e.g. iOS Safari browser tab)
  }
}
