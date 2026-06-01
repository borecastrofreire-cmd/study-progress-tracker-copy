import { useEffect } from 'react';

/**
 * Prevents iOS Safari from auto-zooming when an input/textarea/select is focused.
 *
 * iOS Safari zooms in whenever a focusable field has font-size < 16px.
 * The only reliable fix — short of setting font-size: 16px on every input
 * (which breaks visual design) — is to temporarily set `maximum-scale=1`
 * on the viewport <meta> while a field is focused, then restore it.
 *
 * We do NOT permanently set maximum-scale=1 because that would prevent users
 * from pinch-zooming when they want to. We only block it during input focus.
 */
export function usePreventIosZoom() {
  useEffect(() => {
    // Only needed on iOS Safari
    const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    if (!isIos) return;

    const getViewportMeta = (): HTMLMetaElement | null =>
      document.querySelector('meta[name="viewport"]');

    const disableZoom = () => {
      const meta = getViewportMeta();
      if (!meta) return;
      // Parse existing content and ensure maximum-scale=1 and user-scalable=no
      const content = meta.getAttribute('content') ?? '';
      if (content.includes('maximum-scale=1')) return; // already set
      // Append or replace maximum-scale
      let updated = content
        .replace(/,?\s*maximum-scale=[^,]*/gi, '')
        .replace(/,?\s*user-scalable=[^,]*/gi, '');
      updated = updated.trim().replace(/,$/, '');
      updated += ', maximum-scale=1, user-scalable=no';
      meta.setAttribute('content', updated);
    };

    const enableZoom = () => {
      const meta = getViewportMeta();
      if (!meta) return;
      let content = meta.getAttribute('content') ?? '';
      // Remove the restrictions we added
      content = content
        .replace(/,?\s*maximum-scale=[^,]*/gi, '')
        .replace(/,?\s*user-scalable=[^,]*/gi, '');
      content = content.trim().replace(/,$/, '');
      meta.setAttribute('content', content);
    };

    const FIELDS = ['INPUT', 'TEXTAREA', 'SELECT'];

    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (FIELDS.includes(target.tagName)) {
        disableZoom();
      }
    };

    const onFocusOut = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (FIELDS.includes(target.tagName)) {
        // Small delay so the browser finishes its zoom-out animation first
        setTimeout(enableZoom, 100);
      }
    };

    document.addEventListener('focusin', onFocusIn, true);
    document.addEventListener('focusout', onFocusOut, true);

    return () => {
      document.removeEventListener('focusin', onFocusIn, true);
      document.removeEventListener('focusout', onFocusOut, true);
      enableZoom(); // cleanup: restore zoom if unmounted while field focused
    };
  }, []);
}
