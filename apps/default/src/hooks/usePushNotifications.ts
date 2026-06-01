/**
 * usePushNotifications.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * React hook that manages the full Web Push lifecycle for a given user,
 * with accurate per-platform capability detection.
 *
 * Returns platform-aware status so UI components can show the right guidance:
 * - iOS Safari browser → "Install as PWA" instructions
 * - iOS PWA + iOS 16.4+ → Full push support
 * - Android/Desktop → Full push support
 * - Unsupported browsers → Graceful hide
 */

import { useCallback, useEffect, useState } from 'react';
import {
  getPushStatus,
  getPushCapabilityInfo,
  registerServiceWorker,
  subscribeToPush,
  unsubscribeFromPush,
  type PushStatus,
  type PushCapabilityInfo,
} from '../lib/push';
import { requestPermission } from '../lib/notifications';

interface UsePushNotificationsReturn {
  status: PushStatus;
  capabilityInfo: PushCapabilityInfo;
  loading: boolean;
  error: string | null;
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function usePushNotifications(userId: string): UsePushNotificationsReturn {
  const [capabilityInfo] = useState<PushCapabilityInfo>(() => getPushCapabilityInfo());
  const [status, setStatus] = useState<PushStatus>('not-subscribed');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      const s = await getPushStatus();
      setStatus(s);
    } catch {
      // silent
    }
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!userId) return false;

    // Can't subscribe from iOS Safari browser — needs PWA install
    if (
      capabilityInfo.capability === 'needs-install' ||
      capabilityInfo.capability === 'needs-update' ||
      capabilityInfo.capability === 'unsupported'
    ) {
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      // Request permission (MUST be inside a user gesture — iOS enforces this strictly)
      const permission = await requestPermission();
      if (permission !== 'granted') {
        setStatus('denied');
        setError('Permiso denegado. Actívalo desde los ajustes del navegador.');
        return false;
      }

      // Register SW (strategy: try /sw.js → /_sw/sw.js → degraded mode)
      await registerServiceWorker();

      // Subscribe to push (saves to Taskade)
      await subscribeToPush(userId);

      setStatus('subscribed');
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al activar notificaciones';
      setError(msg);
      console.error('[usePushNotifications] subscribe error:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [userId, capabilityInfo.capability]);

  const unsubscribe = useCallback(async (): Promise<void> => {
    if (!userId) return;
    setLoading(true);
    setError(null);

    try {
      await unsubscribeFromPush(userId);
      setStatus('not-subscribed');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al desuscribirse';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  return {
    status,
    capabilityInfo,
    loading,
    error,
    subscribe,
    unsubscribe,
    refresh,
  };
}
