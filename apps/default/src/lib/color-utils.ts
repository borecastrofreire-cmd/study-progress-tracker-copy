/**
 * Generate tinted backgrounds for a subject using color-mix.
 * Each section gets a slightly different tint so layers are distinguishable.
 */
export function subjectTint(hex: string) {
  return {
    // Card outer background — most saturated
    card: `color-mix(in srgb, ${hex} 26%, white)`,
    // Header row — slightly lighter
    header: `color-mix(in srgb, ${hex} 20%, white)`,
    // Topics container
    body: `color-mix(in srgb, ${hex} 13%, white)`,
    // Individual topic row
    topic: `color-mix(in srgb, ${hex} 9%, white)`,
    // Border color
    border: `color-mix(in srgb, ${hex} 42%, #d1d1d6)`,
    // Darker border for header
    headerBorder: `color-mix(in srgb, ${hex} 55%, #c7c7cc)`,
  };
}
