import './index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App.tsx';

import './lib/leaflet-setup';

// ── Apple Touch Icon ────────────────────────────────────────────────────────
// Use an SVG data URL — emojis render in full color via SVG <text> + foreignObject
(function injectAppleTouchIcon() {
  document.querySelectorAll('link[rel="apple-touch-icon"]').forEach((el) => el.remove());

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#0f1729"/>
        <stop offset="100%" stop-color="#1e3a5f"/>
      </linearGradient>
    </defs>
    <rect width="180" height="180" rx="36" fill="url(#bg)"/>
    <text x="90" y="118" font-size="90" text-anchor="middle" font-family="Apple Color Emoji, Segoe UI Emoji, sans-serif">📚</text>
  </svg>`;

  const link = document.createElement('link');
  link.rel = 'apple-touch-icon';
  link.sizes = '180x180';
  link.href = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
  document.head.appendChild(link);
})();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
