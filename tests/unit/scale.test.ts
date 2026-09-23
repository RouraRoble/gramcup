import { describe, expect, it } from 'vitest';
import { parseLine, parseRecipe } from '../../src/lib/parse-recipe';
import { factorFromPans, factorFromServings, scaleLine, scaleRecipe } from '../../src/lib/scale';

describe('factorFromServings()', () => {
  it('doubling servings gives factor 2', () => {
    expect(factorFromServings(4, 8)).toBe(2);
  });
  it('halving servings gives factor 0.5', () => {
    expect(factorFromServings(4, 2)).toBe(0.5);
  });
});

describe('factorFromPans()', () => {
  it('scales by the ratio of areas for two round pans', () => {
    const factor = factorFromPans({ shape: 'round', a: 20 }, { shape: 'round', a: 25 });
    expect(factor).toBeCloseTo((25 / 20) ** 2, 4);
  });
  it('a 9x13 rectangle vs an 8x8 square scales by area ratio', () => {
    const factor = factorFromPans({ shape: 'square', a: 20.3 }, { shape: 'rectangle', a: 33, b: 23 });
    const expected = (33 * 23) / (20.3 * 20.3);
    expect(factor).toBeCloseTo(expected, 3);
  });
});

describe('scaleLine() / scaleRecipe()', () => {
  it('doubles a 3-line recipe', () => {
    const lines = parseRecipe('2 cups flour\n1 cup sugar\n1/2 cup butter');
    const scaled = scaleRecipe(lines, 2);
    expect(scaled[0].scaledValue).toBeCloseTo(4);
    expect(scaled[1].scaledValue).toBeCloseTo(2);
    expect(scaled[2].scaledValue).toBeCloseTo(1);
  });

  it('formats a scaled volume amount with kitchen fractions', () => {
    const line = parseLine('1 cup flour');
    const scaled = scaleLine(line, 0.5);
    expect(scaled.display).toBe('½');
  });

  it('converts a matched line to grams at the scaled quantity', () => {
    const line = parseLine('1 cup all-purpose flour');
    const scaled = scaleLine(line, 2);
    expect(scaled.grams).toBeCloseTo(240, 0);
  });

  it('scales an unmatched ingredient numerically without a gram conversion', () => {
    const line = parseLine('3 dragonfruit');
    const scaled = scaleLine(line, 2);
    expect(scaled.scaledValue).toBe(6);
    expect(scaled.grams).toBeNull();
  });

  it('preserves a range when scaling', () => {
    const line = parseLine('2-3 cups broth');
    const scaled = scaleLine(line, 2);
    expect(scaled.scaledMin).toBe(4);
    expect(scaled.scaledMax).toBe(6);
    expect(scaled.display).toContain('4');
    expect(scaled.display).toContain('6');
  });

  // Regression test for audit gramcup-audit-1, P3: "Scaler range lines lose the range when
  // converted to grams" — a "2-3 tbsp honey" line ticked to grams collapsed to the single
  // midpoint figure (105 g) instead of a range (84-126 g).
  it('converts a range quantity to a gram range, not just the midpoint', () => {
    const line = parseLine('2-3 tbsp honey');
    const scaled = scaleLine(line, 1);
    expect(scaled.gramsMin).not.toBeNull();
    expect(scaled.gramsMax).not.toBeNull();
    expect(scaled.gramsMin as number).toBeLessThan(scaled.gramsMax as number);
    expect(scaled.gramsMin).toBeCloseTo((2 * 21) as number, 0); // honey: 21 g/tbsp
    expect(scaled.gramsMax).toBeCloseTo((3 * 21) as number, 0);
  });
});
