import { describe, expect, it } from 'vitest';
import { measuringTip } from '../../src/lib/measuring-tip';
import { getTopIngredients, getIngredient } from '../../src/lib/ingredients';

// Regression tests for audit gramcup-audit-2, P2: "1,140 programmatic pages are near-identical" —
// measuring tips must be per-ingredient (not just per-category) for at least the top 30
// ingredients, so neighbouring pages carry genuinely different guidance.
describe('measuringTip()', () => {
  it('gives at least 30 of the top ingredients their own distinct tip, not a shared category fallback', () => {
    const top = getTopIngredients();
    const tips = new Set(top.map((i) => measuringTip(i)));
    // If tips were only assigned per-category, the number of distinct strings would collapse to
    // the handful of categories present. Requiring most of the 60 top ingredients to be distinct
    // demonstrates real per-ingredient differentiation.
    expect(tips.size).toBeGreaterThanOrEqual(30);
  });

  it('does not give a starch ("cornstarch") the flour-specific "fluff the flour" wording (audit gramcup-audit-2 category-fallback bug)', () => {
    const cornstarch = getIngredient('cornstarch')!;
    expect(measuringTip(cornstarch)).not.toMatch(/flour/i);
  });

  it('gives a liquid dairy ingredient (milk) different advice than a semi-solid one (cream cheese)', () => {
    const milk = getIngredient('whole-milk')!;
    const creamCheese = getIngredient('cream-cheese')!;
    expect(measuringTip(milk)).not.toBe(measuringTip(creamCheese));
    expect(measuringTip(milk)).toMatch(/liquid measuring cup/i);
  });

  it('falls back to a sensible category-level tip for an ingredient outside the top list', () => {
    const pastryFlour = getIngredient('pastry-flour')!; // flour category, not in top-ingredients.json
    expect(measuringTip(pastryFlour)).toMatch(/spoon/i);
  });
});
