import { describe, expect, it } from 'vitest';
import { convert, toGrams, fromGrams, CUP_SIZES_ML, formatKitchen, kitchenValue, densityGPerMl, unitPhrase, UNIT_LABELS, roundForDisplay } from '../../src/lib/units';

const flour = { gramsPerCup: 120 }; // King Arthur all-purpose flour
const sugar = { gramsPerCup: 198 };

describe('density + grams round trip', () => {
  it('converts cup -> grams -> cup back to the original amount', () => {
    const grams = toGrams(1, 'cup', flour, CUP_SIZES_ML.us);
    expect(grams).toBeCloseTo(120, 5);
    const back = fromGrams(grams, 'cup', flour, CUP_SIZES_ML.us);
    expect(back).toBeCloseTo(1, 5);
  });

  it('200 g of flour is about 1.6 US cups', () => {
    const cups = fromGrams(200, 'cup', flour, CUP_SIZES_ML.us);
    expect(cups).toBeCloseTo(200 / 120, 5);
    expect(cups).toBeGreaterThan(1.5);
    expect(cups).toBeLessThan(1.7);
  });

  it('density is grams per cup divided by the US cup volume', () => {
    expect(densityGPerMl(flour)).toBeCloseTo(120 / 236.588, 6);
  });
});

describe('convert()', () => {
  it('is a no-op when from === to', () => {
    expect(convert(5, 'g', 'g', flour)).toBe(5);
  });

  it('weight-to-weight conversions do not depend on the ingredient', () => {
    expect(convert(1, 'kg', 'g', flour)).toBeCloseTo(1000, 6);
    expect(convert(16, 'oz', 'lb', sugar)).toBeCloseTo(1, 6);
  });

  it('tbsp and tsp are fixed volumes independent of the cup-size selector', () => {
    const gTbspUs = toGrams(1, 'tbsp', flour, CUP_SIZES_ML.us);
    const gTbspMetric = toGrams(1, 'tbsp', flour, CUP_SIZES_ML.metric);
    expect(gTbspUs).toBeCloseTo(gTbspMetric, 6);
    expect(gTbspUs).toBeCloseTo(120 / 16, 3);
  });

  it('a metric cup (250 ml) holds proportionally more grams than a US cup (236.588 ml)', () => {
    const gUs = toGrams(1, 'cup', flour, CUP_SIZES_ML.us);
    const gMetric = toGrams(1, 'cup', flour, CUP_SIZES_ML.metric);
    expect(gMetric).toBeGreaterThan(gUs);
    expect(gMetric / gUs).toBeCloseTo(CUP_SIZES_ML.metric / CUP_SIZES_ML.us, 4);
  });

  it('half-cup is exactly half of cup for any cup size', () => {
    const cup = toGrams(1, 'cup', sugar, CUP_SIZES_ML.imperial);
    const half = toGrams(1, 'half-cup', sugar, CUP_SIZES_ML.imperial);
    expect(half).toBeCloseTo(cup / 2, 6);
  });

  it('reverse direction toggle: converting a->b then b->a returns the original amount', () => {
    const cups = 2;
    const grams = convert(cups, 'cup', 'g', flour);
    const back = convert(grams, 'g', 'cup', flour);
    expect(back).toBeCloseTo(cups, 5);
  });
});

describe('formatKitchen()', () => {
  it('renders common fractions as glyphs', () => {
    expect(formatKitchen(0.5)).toBe('½');
    expect(formatKitchen(1.5)).toBe('1 ½');
    expect(formatKitchen(0.25)).toBe('¼');
    expect(formatKitchen(2)).toBe('2');
  });
  // Regression test for audit gramcup-audit-4, B5: 1 g of flour is 1/120 cup (~0.008), which used
  // to round straight down to a misleading "0 cups" instead of showing it's a small but real amount.
  it('shows a tiny nonzero amount as "< ⅛" instead of rounding it away to 0', () => {
    expect(formatKitchen(1 / 120)).toBe('< ⅛');
    expect(formatKitchen(0.01)).toBe('< ⅛');
  });
  it('still shows exactly 0 as "0"', () => {
    expect(formatKitchen(0)).toBe('0');
  });
});

describe('roundForDisplay() with non-finite input (audit gramcup-audit-1, P1 #2)', () => {
  it('is still 0 for a directly non-finite value (the Converter now guards this before calling it)', () => {
    expect(roundForDisplay(Infinity, 'g')).toBe(0);
    expect(roundForDisplay(NaN, 'cup')).toBe(0);
  });
});

describe('half-cup unit label (audit gramcup-audit-1, P1 #3)', () => {
  it('the plain-sentence form is "half-cups", not a bare "½ cups" that reads as a second fraction', () => {
    expect(UNIT_LABELS['half-cup'].split(' (')[0]).toBe('half-cups');
  });
});

describe('unitPhrase()', () => {
  it('is singular for an amount of exactly 1', () => {
    expect(unitPhrase(1, 'cup')).toBe('cup');
    expect(unitPhrase(1, 'g')).toBe('gram');
    expect(unitPhrase(1, 'lb')).toBe('pound');
    expect(unitPhrase(1, 'half-cup')).toBe('half-cup');
  });
  it('is plural for zero and for any amount greater than 1', () => {
    expect(unitPhrase(0, 'cup')).toBe('cups');
    expect(unitPhrase(2, 'cup')).toBe('cups');
    expect(unitPhrase(1.5, 'g')).toBe('grams');
  });
  // Regression test for audit gramcup-audit-2, P3: a fraction of a whole unit is said in the
  // singular ("½ cup"), not the plural ("½ cups") — this was still wrong in the re-audit.
  it('is singular for a fraction below 1, the way a baker would actually say it', () => {
    expect(unitPhrase(0.5, 'cup')).toBe('cup');
    expect(unitPhrase(0.25, 'cup')).toBe('cup');
    expect(unitPhrase(1 / 3, 'tbsp')).toBe('tablespoon');
  });
  // Regression test for audit gramcup-audit-4, N7: the fractional-singular idiom above is a
  // kitchen-measure thing ("½ cup") and should not extend to weight/ml units, where a fraction
  // below 1 still reads as plural ("0.68 kilograms of sugar", not "0.68 kilogram").
  it('is plural for a fraction below 1 of a weight or ml/floz unit', () => {
    expect(unitPhrase(0.68, 'kg')).toBe('kilograms');
    expect(unitPhrase(0.5, 'g')).toBe('grams');
    expect(unitPhrase(0.5, 'oz')).toBe('ounces');
    expect(unitPhrase(0.5, 'lb')).toBe('pounds');
    expect(unitPhrase(0.5, 'ml')).toBe('millilitres');
    expect(unitPhrase(0.5, 'floz')).toBe('fluid ounces');
  });
});

describe('kitchenValue() (audit gramcup-audit-2, P3: pluralisation must match the displayed text)', () => {
  it('snaps to the nearest common fraction, matching formatKitchen', () => {
    expect(kitchenValue(1.0101)).toBe(1); // 200 g granulated sugar in cups: displays "1", not "1.0101"
    expect(kitchenValue(0.51)).toBeCloseTo(0.5, 5);
    expect(kitchenValue(1.49)).toBeCloseTo(1.5, 5);
  });
  it('leaves a value that is not close to a common fraction unchanged', () => {
    expect(kitchenValue(1.2)).toBeCloseTo(1.2, 5);
  });
  it('combined with unitPhrase, a value that displays as "1" is singular, not "1 cups"', () => {
    expect(unitPhrase(kitchenValue(1.0101), 'cup')).toBe('cup');
  });
  it('a tiny nonzero amount stays singular alongside formatKitchen\'s "< ⅛" (audit gramcup-audit-4, B5)', () => {
    expect(unitPhrase(kitchenValue(1 / 120), 'cup')).toBe('cup');
  });
});
