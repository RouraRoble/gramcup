import { describe, expect, it } from 'vitest';
import { parseLine, parseQuantity, parseRecipe } from '../../src/lib/parse-recipe';

describe('parseQuantity()', () => {
  it('parses a unicode fraction alone', () => {
    const r = parseQuantity('½ cup sugar');
    expect(r?.qty.value).toBeCloseTo(0.5);
    expect(r?.qty.isRange).toBe(false);
  });
  it('parses a mixed ascii fraction "1 1/2"', () => {
    const r = parseQuantity('1 1/2 cups flour');
    expect(r?.qty.value).toBeCloseTo(1.5);
  });
  it('parses an integer + unicode fraction "1½"', () => {
    const r = parseQuantity('1½ cups flour');
    expect(r?.qty.value).toBeCloseTo(1.5);
  });
  it('parses a plain ascii fraction "3/4"', () => {
    const r = parseQuantity('3/4 tsp salt');
    expect(r?.qty.value).toBeCloseTo(0.75);
  });
  it('parses a decimal', () => {
    const r = parseQuantity('1.5 cups milk');
    expect(r?.qty.value).toBeCloseTo(1.5);
  });
  it('parses a hyphen range "2-3"', () => {
    const r = parseQuantity('2-3 cups broth');
    expect(r?.qty.isRange).toBe(true);
    expect(r?.qty.min).toBe(2);
    expect(r?.qty.max).toBe(3);
    expect(r?.qty.value).toBe(2.5);
  });
  it('parses a worded range "2 to 3"', () => {
    const r = parseQuantity('2 to 3 tbsp oil');
    expect(r?.qty.min).toBe(2);
    expect(r?.qty.max).toBe(3);
  });
  it('returns null when the line has no leading quantity', () => {
    expect(parseQuantity('pinch of salt')).toBeNull();
  });
});

describe('parseLine()', () => {
  it('parses unit abbreviations and plurals', () => {
    expect(parseLine('2 tablespoons butter').unit).toBe('tbsp');
    expect(parseLine('2 tbsp butter').unit).toBe('tbsp');
    expect(parseLine('200 g flour').unit).toBe('g');
    expect(parseLine('200 grams flour').unit).toBe('g');
    expect(parseLine('1 cup sugar').unit).toBe('cup');
    expect(parseLine('2 cups sugar').unit).toBe('cup');
    expect(parseLine('1 tsp vanilla extract').unit).toBe('tsp');
  });

  it('matches ingredient text to the dataset via aliases', () => {
    const l = parseLine('2 cups ap flour');
    expect(l.ingredient?.slug).toBe('all-purpose-flour');
  });

  it('still returns a scalable quantity when the ingredient is unmatched', () => {
    const l = parseLine('3 whole dragonfruit');
    expect(l.quantity?.value).toBe(3);
    expect(l.ingredient).toBeUndefined();
  });

  it('handles a line with no unit', () => {
    const l = parseLine('2 large eggs');
    expect(l.quantity?.value).toBe(2);
    expect(l.unit).toBeNull();
    expect(l.ingredientText).toMatch(/eggs/);
  });

  it('strips a leading bullet or numbered-list marker', () => {
    expect(parseLine('- 2 cups flour').quantity?.value).toBe(2);
    expect(parseLine('1. 2 cups flour').quantity?.value).toBe(2);
    expect(parseLine('* 2 cups flour').quantity?.value).toBe(2);
  });

  it('handles "of" between unit and ingredient', () => {
    const l = parseLine('2 cups of granulated sugar');
    expect(l.ingredient?.slug).toBe('granulated-sugar');
  });

  // Regression tests for audit gramcup-audit-1, P1 finding #5.
  it('recognizes the "T"/"t" tablespoon/teaspoon abbreviations', () => {
    const tbsp = parseLine('1 T olive oil');
    expect(tbsp.unit).toBe('tbsp');
    expect(tbsp.ingredient?.slug).toBe('olive-oil');
    const tsp = parseLine('1/2 t vanilla extract');
    expect(tsp.unit).toBe('tsp');
    // a lowercase "t" must not swallow part of a spelled-out unit like "tsp"/"tbsp"
    expect(parseLine('2 tsp salt').unit).toBe('tsp');
    expect(parseLine('2 tbsp oil').unit).toBe('tbsp');
  });

  it('matches common adjective-prefixed lines that are not literal aliases', () => {
    expect(parseLine('1 cup unsalted butter').ingredient?.slug).toBe('butter');
    expect(parseLine('1 cup melted butter').ingredient?.slug).toBe('butter');
    expect(parseLine('1 cup self-raising flour').ingredient?.slug).toBe('self-rising-flour');
  });

  it('treats a zero-denominator fraction as an unparsed quantity, not a divide-by-zero result', () => {
    const l = parseLine('1/0 cup flour');
    expect(l.quantity).toBeNull();
  });
});

describe('parseRecipe()', () => {
  it('parses a multi-line recipe, skipping blank lines', () => {
    const lines = parseRecipe('2 cups flour\n\n1 cup sugar\n1/2 cup butter, softened');
    expect(lines).toHaveLength(3);
    expect(lines[2].ingredient?.slug).toBe('butter');
  });
});
