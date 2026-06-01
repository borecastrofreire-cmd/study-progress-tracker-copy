// ─── Reading time estimation ──────────────────────────────────────────────────
// Uses a range: 5 min/page (low) to 5.5 min/page (high)

export function calcReadingTime(pages: number): { low: number; high: number } {
  return { low: pages * 5, high: Math.round(pages * 5.5) };
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export function formatReadingTime(pages: number): string {
  const { low, high } = calcReadingTime(pages);
  if (low === high) return formatMinutes(low);
  const fLow = formatMinutes(low);
  const fHigh = formatMinutes(high);
  if (fLow === fHigh) return fLow;
  return `${fLow} – ${fHigh}`;
}

/** Returns the base estimated minutes (using the LOW end of the range) */
export function getEstimatedMinutes(pages: number): number {
  return calcReadingTime(pages).low;
}
