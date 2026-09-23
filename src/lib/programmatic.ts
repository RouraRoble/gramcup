/**
 * Shared constants for the programmatic amount/fraction page generators
 * (`[amount]-grams-[ingredient]-to-cups.astro` and `[n]-cup-[ingredient]-in-grams.astro`).
 */
export const GRAM_AMOUNTS = [25, 50, 75, 100, 125, 150, 200, 250, 300, 400, 500] as const;

export interface CupFractionDef {
  key: string; // used in the URL, e.g. "quarter", "1", "2"
  value: number; // numeric cup amount
  words: string; // human-readable, e.g. "quarter", "two-thirds", "1", "2"
  glyph: string; // kitchen display, e.g. "¼", "1"
}

export const CUP_FRACTIONS: CupFractionDef[] = [
  { key: 'quarter', value: 0.25, words: 'quarter', glyph: '¼' },
  { key: 'third', value: 1 / 3, words: 'third', glyph: '⅓' },
  { key: 'half', value: 0.5, words: 'half', glyph: '½' },
  { key: 'two-thirds', value: 2 / 3, words: 'two-thirds', glyph: '⅔' },
  { key: 'three-quarters', value: 0.75, words: 'three-quarters', glyph: '¾' },
  { key: '1', value: 1, words: '1', glyph: '1' },
  { key: '2', value: 2, words: '2', glyph: '2' },
  { key: '3', value: 3, words: '3', glyph: '3' },
];
