/**
 * Density-aware unit conversion. Weight units convert with fixed physical factors; volume units
 * convert through an ingredient's measured grams-per-US-cup, scaled to whichever cup definition
 * is selected (the "cup" unit itself is the only unit whose physical size changes with cupSize —
 * tablespoons and teaspoons are fixed volumes in every cup-measure system used here).
 */
import type { Ingredient } from './ingredients';

export type WeightUnit = 'g' | 'kg' | 'oz' | 'lb';
export type VolumeUnit = 'ml' | 'floz' | 'tsp' | 'tbsp' | 'cup' | 'half-cup';
export type Unit = WeightUnit | VolumeUnit;

export const WEIGHT_UNITS: WeightUnit[] = ['g', 'kg', 'oz', 'lb'];
export const VOLUME_UNITS: VolumeUnit[] = ['ml', 'floz', 'tsp', 'tbsp', 'cup', 'half-cup'];

export const UNIT_LABELS: Record<Unit, string> = {
  g: 'grams (g)',
  kg: 'kilograms (kg)',
  oz: 'ounces (oz)',
  lb: 'pounds (lb)',
  ml: 'millilitres (ml)',
  floz: 'fluid ounces (fl oz)',
  tsp: 'teaspoons (tsp)',
  tbsp: 'tablespoons (tbsp)',
  cup: 'cups',
  // Deliberately spelled out ("half-cups"), not "½ cups": prefixing that with a number reads as a
  // second, conflicting fraction ("2 ½ cups" looks like 2.5 cups, not 2 half-cup measures). The
  // parenthetical is stripped by `.split(' (')[0]` wherever the unit is embedded in a sentence.
  'half-cup': 'half-cups (½ cup each)',
};

export type CupKey = 'us' | 'uslegal' | 'metric' | 'imperial';

export const CUP_SIZES_ML: Record<CupKey, number> = {
  us: 236.588, // US customary cup
  uslegal: 240, // US "legal" cup (FDA nutrition labelling)
  metric: 250, // Metric cup (AU/NZ/UK recipe convention)
  imperial: 284.131, // Imperial (UK) cup, 1/2 imperial pint
};

export const CUP_LABELS: Record<CupKey, string> = {
  us: 'US customary cup (236.6 ml)',
  uslegal: 'US legal cup (240 ml)',
  metric: 'Metric cup (250 ml)',
  imperial: 'Imperial cup (284.1 ml)',
};

const WEIGHT_TO_G: Record<WeightUnit, number> = { g: 1, kg: 1000, oz: 28.349523125, lb: 453.59237 };
const FIXED_VOLUME_ML: Record<'ml' | 'floz' | 'tsp' | 'tbsp', number> = {
  ml: 1,
  floz: 29.5735295625,
  tsp: 4.92892159375,
  tbsp: 14.78676478125,
};

/**
 * Plain-English unit label for a sentence: singular for exactly one ("1 cup", not "1 cups") and for
 * any fraction of a whole unit ("½ cup", not "½ cups" — that's how a fraction below one is actually
 * said in the kitchen), plural otherwise ("0 cups", "2 cups", "1 ½ cups"). Pass the value that is
 * actually displayed next to the word (e.g. `kitchenValue(x)` for a cup/tbsp/tsp amount shown as a
 * kitchen fraction, or the same rounded figure shown alongside it) — pluralising off a more precise,
 * separately-rounded number is what produced "1 cups" when the displayed text read "1" (audit
 * gramcup-audit-2, P3).
 */
export function unitPhrase(amount: number, unit: Unit): string {
  const label = UNIT_LABELS[unit].split(' (')[0];
  // A fraction of a cup/tablespoon/teaspoon is said in the singular in the kitchen ("½ cup", not
  // "½ cups"). That idiom does not extend to weight units or millilitres/fluid ounces, where a
  // fractional amount still reads as plural ("0.68 kilograms", not "0.68 kilogram") — treating any
  // value in (0, 1] as singular produced exactly that wrong reading (audit gramcup-audit-3, N7:
  // "1.5 pounds of granulated sugar = 0.68 kilogram"). Only "cup"/"half-cup"/"tbsp"/"tsp" get the
  // fractional-singular treatment; every other unit is singular only for exactly 1.
  const kitchenUnit = unit === 'cup' || unit === 'half-cup' || unit === 'tbsp' || unit === 'tsp';
  const singular = kitchenUnit ? Math.abs(amount) > 0 && Math.abs(amount) <= 1 : Math.abs(amount) === 1;
  if (singular) return label.endsWith('s') ? label.slice(0, -1) : label;
  return label;
}

export function isWeightUnit(u: Unit): u is WeightUnit {
  return (WEIGHT_UNITS as string[]).includes(u);
}
export function isVolumeUnit(u: Unit): u is VolumeUnit {
  return (VOLUME_UNITS as string[]).includes(u);
}

/** Grams of the ingredient per millilitre, derived from its measured US-cup weight. */
export function densityGPerMl(ingredient: Pick<Ingredient, 'gramsPerCup'>): number {
  return ingredient.gramsPerCup / CUP_SIZES_ML.us;
}

function volumeUnitToMl(unit: VolumeUnit, cupMl: number): number {
  if (unit === 'cup') return cupMl;
  if (unit === 'half-cup') return cupMl / 2;
  return FIXED_VOLUME_ML[unit];
}

/** Convert an amount of `from` to grams. */
export function toGrams(amount: number, from: Unit, ingredient: Pick<Ingredient, 'gramsPerCup'>, cupMl: number): number {
  if (isWeightUnit(from)) return amount * WEIGHT_TO_G[from];
  const ml = amount * volumeUnitToMl(from, cupMl);
  return ml * densityGPerMl(ingredient);
}

/** Convert grams to an amount of `to`. */
export function fromGrams(grams: number, to: Unit, ingredient: Pick<Ingredient, 'gramsPerCup'>, cupMl: number): number {
  if (isWeightUnit(to)) return grams / WEIGHT_TO_G[to];
  const ml = grams / densityGPerMl(ingredient);
  return ml / volumeUnitToMl(to, cupMl);
}

/** Convert directly between any two supported units for a given ingredient and cup definition. */
export function convert(amount: number, from: Unit, to: Unit, ingredient: Pick<Ingredient, 'gramsPerCup'>, cupMl: number = CUP_SIZES_ML.us): number {
  if (from === to) return amount;
  const grams = toGrams(amount, from, ingredient, cupMl);
  return fromGrams(grams, to, ingredient, cupMl);
}

/** Round a result to a sensible number of decimals for display given its unit and magnitude. */
export function roundForDisplay(value: number, unit: Unit): number {
  if (!Number.isFinite(value)) return 0;
  if (unit === 'g' || unit === 'ml') return Math.round(value * 10) / 10;
  if (unit === 'kg' || unit === 'lb' || unit === 'oz' || unit === 'floz') return Math.round(value * 100) / 100;
  // cup/tbsp/tsp: show to a practical kitchen precision.
  if (Math.abs(value) >= 10) return Math.round(value * 10) / 10;
  return Math.round(value * 100) / 100;
}

const FRACTIONS: [number, string][] = [
  [1 / 8, '⅛'],
  [1 / 4, '¼'],
  [1 / 3, '⅓'],
  [3 / 8, '⅜'],
  [1 / 2, '½'],
  [5 / 8, '⅝'],
  [2 / 3, '⅔'],
  [3 / 4, '¾'],
  [7 / 8, '⅞'],
];

/**
 * Numeric value matching what `formatKitchen` would display for the same input: snapped to the
 * nearest common kitchen fraction (or the next/previous whole number) when it's close to one,
 * otherwise left as-is. Pass this to `unitPhrase` alongside a kitchen-formatted amount so the
 * singular/plural decision agrees with the text actually shown, instead of a separately-rounded
 * figure (e.g. 200 g granulated sugar is 1.0101 cups, which displays as "1" — pluralising off the
 * unrounded 1.0101 produced "1 cups"; audit gramcup-audit-2, P3).
 */
export function kitchenValue(value: number): number {
  if (!Number.isFinite(value)) return 0;
  // A genuinely tiny but nonzero amount (e.g. 1 g of flour is ~0.008 cup) used to snap to plain 0
  // via the "rem < 0.02" branch below, which reads as "0 cups" — misleadingly implying there's
  // nothing there. `formatKitchen` shows "< ⅛" for the same range; treat it as the smallest
  // fraction (⅛) here too, so the paired unit word stays singular ("< ⅛ cup", not "< ⅛ cups") —
  // audit gramcup-audit-4, B5.
  if (value > 0 && value < 1 / 16) return 1 / 8;
  const whole = Math.floor(value);
  const rem = value - whole;
  for (const [f] of FRACTIONS) {
    if (Math.abs(rem - f) < 0.02) return whole + f;
  }
  if (rem < 0.02) return whole;
  if (rem > 0.98) return whole + 1;
  return value;
}

/** Format a cup/tbsp/tsp amount as "1 ½" style kitchen text where it lands close to a common fraction. */
export function formatKitchen(value: number): string {
  if (!Number.isFinite(value)) return '0';
  // Below the smallest fraction this function otherwise shows (⅛), a nonzero amount used to round
  // straight down to "0" — e.g. 1 g of flour is 1/120 cup, displayed as "0 cups", which reads as
  // nothing at all rather than a genuinely small amount (audit gramcup-audit-4, B5: "Tiny amounts
  // round to '0 cups'"). Say so explicitly instead of rounding it away.
  if (value > 0 && value < 1 / 16) return '< ⅛';
  const whole = Math.floor(value);
  const rem = value - whole;
  for (const [f, glyph] of FRACTIONS) {
    if (Math.abs(rem - f) < 0.02) {
      return whole > 0 ? `${whole} ${glyph}` : glyph;
    }
  }
  if (rem < 0.02) return String(whole || 0);
  if (rem > 0.98) return String(whole + 1);
  const decimals = Math.abs(value) >= 10 ? 1 : 2;
  return (Math.round(value * 10 ** decimals) / 10 ** decimals).toString();
}
