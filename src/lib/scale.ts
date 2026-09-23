/**
 * Recipe scaling: by a flat factor, by servings (from → to), or by pan size (ratio of areas).
 * Also converts a scaled, matched line to grams for the "convert entire recipe to grams" action.
 * Unmatched ingredients (no dataset match, or no unit) still get their quantity scaled numerically.
 */
import type { ParsedLine } from './parse-recipe';
import { toGrams, CUP_SIZES_ML, formatKitchen, isVolumeUnit, type Unit } from './units';

export type PanShape = 'round' | 'square' | 'rectangle';

export interface PanDims {
  shape: PanShape;
  /** cm for round (diameter) and square (side); cm for rectangle length/width. */
  a: number;
  b?: number; // rectangle width only
}

export function panArea(dims: PanDims): number {
  if (dims.shape === 'round') return Math.PI * (dims.a / 2) ** 2;
  if (dims.shape === 'square') return dims.a * dims.a;
  return dims.a * (dims.b ?? dims.a);
}

export function factorFromPans(from: PanDims, to: PanDims): number {
  const areaFrom = panArea(from);
  if (areaFrom <= 0) return 1;
  return panArea(to) / areaFrom;
}

export function factorFromServings(from: number, to: number): number {
  if (!from) return 1;
  return to / from;
}

export interface ScaledLine {
  line: ParsedLine;
  scaledValue: number | null; // midpoint value, scaled
  scaledMin: number | null;
  scaledMax: number | null;
  display: string; // formatted scaled quantity for the original unit (kitchen fractions for volumes)
  grams: number | null; // scaled amount converted to grams (midpoint, for a range), if ingredient + unit are known
  gramsMin: number | null; // for a range quantity ("2-3 tbsp"), the low end converted to grams
  gramsMax: number | null; // for a range quantity, the high end converted to grams
  uncertain: boolean; // true when the density behind a gram conversion is a lower-confidence estimate
}

function formatScaledValue(value: number, unit: Unit | null): string {
  if (unit && isVolumeUnit(unit)) return formatKitchen(value);
  if (Math.abs(value) >= 10) return String(Math.round(value * 10) / 10);
  return String(Math.round(value * 100) / 100);
}

export function scaleLine(line: ParsedLine, factor: number, cupKey: keyof typeof CUP_SIZES_ML = 'us'): ScaledLine {
  if (!line.quantity) {
    return { line, scaledValue: null, scaledMin: null, scaledMax: null, display: '', grams: null, gramsMin: null, gramsMax: null, uncertain: false };
  }
  const scaledValue = line.quantity.value * factor;
  const scaledMin = line.quantity.min * factor;
  const scaledMax = line.quantity.max * factor;
  const display = line.quantity.isRange
    ? `${formatScaledValue(scaledMin, line.unit)}–${formatScaledValue(scaledMax, line.unit)}`
    : formatScaledValue(scaledValue, line.unit);
  let grams: number | null = null;
  let gramsMin: number | null = null;
  let gramsMax: number | null = null;
  if (line.unit && line.ingredient) {
    grams = toGrams(scaledValue, line.unit, line.ingredient, CUP_SIZES_ML[cupKey]);
    // A range quantity ("2-3 tbsp honey") must convert as a range, not collapse to the midpoint
    // gram figure (audit gramcup-audit-1, P3: "Scaler range lines lose the range when converted
    // to grams").
    if (line.quantity.isRange) {
      gramsMin = toGrams(scaledMin, line.unit, line.ingredient, CUP_SIZES_ML[cupKey]);
      gramsMax = toGrams(scaledMax, line.unit, line.ingredient, CUP_SIZES_ML[cupKey]);
    }
  }
  const uncertain = Boolean(line.ingredient?.notes && /approximate|uncertain|lower-confidence/i.test(line.ingredient.notes));
  return { line, scaledValue, scaledMin, scaledMax, display, grams, gramsMin, gramsMax, uncertain };
}

export function scaleRecipe(lines: ParsedLine[], factor: number, cupKey: keyof typeof CUP_SIZES_ML = 'us'): ScaledLine[] {
  return lines.map((l) => scaleLine(l, factor, cupKey));
}
