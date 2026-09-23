import { describe, expect, it } from 'vitest';
import { ingredients, getIngredient, getTopIngredients, searchIngredients, matchIngredient } from '../../src/lib/ingredients';
import { parseLine } from '../../src/lib/parse-recipe';

describe('dataset integrity', () => {
  it('has a healthy number of ingredients with unique slugs', () => {
    expect(ingredients.length).toBeGreaterThanOrEqual(90);
    const slugs = new Set(ingredients.map((i) => i.slug));
    expect(slugs.size).toBe(ingredients.length);
  });

  it('every ingredient has a positive gramsPerCup, at least one source, and a valid category', () => {
    for (const i of ingredients) {
      expect(i.gramsPerCup, i.slug).toBeGreaterThan(0);
      expect(i.gramsPerTbsp, i.slug).toBeGreaterThan(0);
      expect(i.gramsPerTsp, i.slug).toBeGreaterThan(0);
      expect(i.sources.length, i.slug).toBeGreaterThan(0);
      for (const s of i.sources) {
        expect(s.url, i.slug).toMatch(/^https?:\/\//);
        expect(s.gramsPerCup, i.slug).toBeGreaterThan(0);
      }
    }
  });

  it('top-ingredient slugs all resolve to real ingredients', () => {
    const top = getTopIngredients();
    expect(top.length).toBe(60);
    for (const i of top) expect(i).toBeTruthy();
  });
});

describe('getIngredient()', () => {
  it('finds by slug', () => {
    expect(getIngredient('all-purpose-flour')?.name).toBe('All-Purpose Flour');
    expect(getIngredient('does-not-exist')).toBeUndefined();
  });
});

describe('searchIngredients() / matchIngredient()', () => {
  it('matches an alias', () => {
    expect(searchIngredients('ap flour')[0].slug).toBe('all-purpose-flour');
  });
  it('matches a plain substring', () => {
    const results = searchIngredients('sugar');
    expect(results.some((r) => r.slug === 'granulated-sugar')).toBe(true);
  });
  it('returns the alphabetical list for an empty query', () => {
    const results = searchIngredients('', 5);
    expect(results).toHaveLength(5);
  });
  it('matchIngredient resolves the best single hit', () => {
    expect(matchIngredient('all purpose flour')?.slug).toBe('all-purpose-flour');
    expect(matchIngredient('nonexistent-ingredient-xyz')).toBeUndefined();
  });
});

// Regression tests for audit gramcup-audit-1, P0 finding #1: a generic recipe word ("sugar",
// "salt", "oil", "rice") must resolve to the everyday default ingredient, not whichever
// same-scoring alternative happens to sort first alphabetically.
describe('generic-word matching (audit gramcup-audit-1, P0 #1)', () => {
  it('"sugar" matches granulated sugar, not brown sugar', () => {
    expect(matchIngredient('sugar')?.slug).toBe('granulated-sugar');
  });
  it('"salt" matches table salt, not a kosher salt brand', () => {
    expect(matchIngredient('salt')?.slug).toBe('salt-table');
  });
  it('"oil" matches vegetable oil, not coconut oil', () => {
    expect(matchIngredient('oil')?.slug).toBe('vegetable-oil');
  });
  it('"rice" matches dry white rice, not rice flour', () => {
    expect(matchIngredient('rice')?.slug).toBe('white-rice-dry');
  });
});

// Regression tests for audit gramcup-audit-1, P1 finding #5: an adjective in front of or after the
// ingredient name should not block matching.
describe('matching with adjectives (audit gramcup-audit-1, P1 #5)', () => {
  it('matches "unsalted butter" and "melted butter" to butter', () => {
    expect(matchIngredient('unsalted butter')?.slug).toBe('butter');
    expect(matchIngredient('melted butter')?.slug).toBe('butter');
  });
  it('matches "self-raising flour" (hyphenated, UK spelling) to self-rising flour', () => {
    expect(matchIngredient('self-raising flour')?.slug).toBe('self-rising-flour');
  });
  it('matches "granulated white sugar" via the contained alias', () => {
    expect(matchIngredient('granulated white sugar')?.slug).toBe('granulated-sugar');
  });
});

// Regression tests for audit gramcup-audit-2, new P1: the loose "reverse containment" matcher
// (raw substring, no word boundaries, no head-noun check) silently converted unrelated or
// differently-dense ingredients. The strict, ranked matcher must reject every one of these instead
// of guessing, while still resolving the legitimate adjective- and descriptor-prefixed cases above
// and the audit-1 generic-word cases below.
describe('strict matching rejects false positives (audit gramcup-audit-2, new P1)', () => {
  it('does not let a short word inside a longer, unrelated word match ("butternut", "buttercream")', () => {
    expect(matchIngredient('butternut squash')).toBeUndefined();
    expect(matchIngredient('buttercream frosting')).toBeUndefined();
  });
  it('does not match a modifying dish/product noun after a shared head word ("sugar snap peas", "salt pork")', () => {
    expect(matchIngredient('sugar snap peas')).toBeUndefined();
    expect(matchIngredient('salt pork')).toBeUndefined();
  });
  it('does not match a word that merely starts with an alias ("saltine crackers")', () => {
    expect(matchIngredient('saltine crackers')).toBeUndefined();
  });
  it('does not match "rice" as a head noun in unrelated rice-adjacent products', () => {
    expect(matchIngredient('rice vinegar')).toBeUndefined();
    expect(matchIngredient('rice noodles')).toBeUndefined();
    expect(matchIngredient('rice krispies')).toBeUndefined();
  });
  it('does not match "milk chocolate chips" to plain milk', () => {
    expect(matchIngredient('milk chocolate chips')?.slug).not.toBe('whole-milk');
  });
  it('does not match "oil-packed tomatoes" to oil (the head noun is tomatoes, not oil)', () => {
    expect(matchIngredient('oil-packed tomatoes')).toBeUndefined();
  });
  it('does not match salt variants whose modifier is not on the descriptor list ("coarse", "pickling")', () => {
    expect(matchIngredient('coarse salt')).toBeUndefined();
    expect(matchIngredient('pickling salt')).toBeUndefined();
  });
  it('does not match a bare unmodified generic word to an unrelated specific ingredient ("coconut")', () => {
    expect(matchIngredient('coconut')).toBeUndefined();
  });
  it('does not confidently match an unlisted ingredient ("flaky sea salt", "sweetened condensed milk")', () => {
    expect(matchIngredient('flaky sea salt')).toBeUndefined();
    expect(matchIngredient('sweetened condensed milk')).toBeUndefined();
  });
  it('still matches the specific ingredient, not a shorter generic alias, when the line names it', () => {
    expect(matchIngredient('almond flour')?.slug).toBe('almond-flour');
    expect(matchIngredient('coconut oil')?.slug).toBe('coconut-oil');
    expect(matchIngredient('brown sugar')?.slug).toBe('brown-sugar');
  });
  it('matches "confectioners sugar" without the apostrophe', () => {
    expect(matchIngredient('confectioners sugar')?.slug).toBe('confectioners-sugar');
  });
  it('matches "cooked rice" and "cheese" via the added aliases', () => {
    expect(matchIngredient('cooked rice')?.slug).toBe('white-rice-cooked');
    expect(matchIngredient('cheese')?.slug).toBe('shredded-cheddar');
  });
});

// Regression tests for audit gramcup-audit-3, P1: the audit-2 matcher tightening over-corrected
// and stopped recognising bare "flour" and several other very common recipe words that used to
// convert. Each of these must resolve to a confident match again, while the audit-1/audit-2
// false-positive rejections above must keep failing (covered by the tests above, re-asserted here
// for the specific phrases the tightened tier 3 could otherwise re-open a door for).
describe('generic-word regressions fixed (audit gramcup-audit-3, P1)', () => {
  it('"flour" alone matches all-purpose flour, in a full recipe line', () => {
    expect(matchIngredient('flour')?.slug).toBe('all-purpose-flour');
    expect(parseLine('2 cups flour').ingredient?.slug).toBe('all-purpose-flour');
    expect(parseLine('1 cup of flour').ingredient?.slug).toBe('all-purpose-flour');
    expect(parseLine('250g flour').ingredient?.slug).toBe('all-purpose-flour');
  });
  it('"kosher salt" with no brand named defaults to Diamond Crystal, but a named brand still wins', () => {
    expect(matchIngredient('kosher salt')?.slug).toBe('kosher-salt-diamond-crystal');
    expect(matchIngredient('kosher salt (Diamond Crystal)')?.slug).toBe('kosher-salt-diamond-crystal');
    expect(matchIngredient('morton kosher salt')?.slug).toBe('kosher-salt-mortons');
  });
  it('"sea salt" matches table salt (a documented fine-sea-salt approximation)', () => {
    expect(matchIngredient('sea salt')?.slug).toBe('salt-table');
  });
  it('"vanilla" alone matches vanilla extract', () => {
    expect(matchIngredient('vanilla')?.slug).toBe('vanilla-extract');
  });
  it('"active dry yeast" matches instant yeast (a documented 1:1-by-volume approximation)', () => {
    expect(matchIngredient('active dry yeast')?.slug).toBe('instant-yeast');
  });
  it('"shredded coconut" alone matches the sweetened default', () => {
    expect(matchIngredient('shredded coconut')?.slug).toBe('sweetened-shredded-coconut');
    expect(matchIngredient('unsweetened shredded coconut')?.slug).toBe('unsweetened-shredded-coconut');
  });
  it('"cheddar cheese" matches shredded cheddar', () => {
    expect(matchIngredient('cheddar cheese')?.slug).toBe('shredded-cheddar');
  });
  it('"cold butter, cubed" still matches butter (comma-trailing descriptor already worked; locked in)', () => {
    expect(parseLine('cold butter, cubed').ingredient?.slug).toBe('butter');
    expect(parseLine('1 cup cold butter, cubed').ingredient?.slug).toBe('butter');
  });
  it('a leading numeric parenthetical ("(1 stick)") is stripped for matching, not treated as an unknown modifier', () => {
    expect(parseLine('1/2 cup (1 stick) butter').ingredient?.slug).toBe('butter');
  });
  it('does not let a new multi-word generic alias open a back door for an unlisted modifier ("flaky sea salt")', () => {
    expect(matchIngredient('flaky sea salt')).toBeUndefined();
    expect(matchIngredient('coarse sea salt')).toBeUndefined();
  });
});

describe('common recipe words that previously failed to match (audit gramcup-audit-4, P2 #B1)', () => {
  it('"cream" alone matches heavy cream', () => {
    expect(matchIngredient('cream')?.slug).toBe('heavy-cream');
  });
  it('"pecans" alone matches chopped pecans', () => {
    expect(matchIngredient('pecans')?.slug).toBe('chopped-pecans');
  });
  it('"oats" alone matches rolled oats', () => {
    expect(matchIngredient('oats')?.slug).toBe('rolled-oats');
  });
  it('"cinnamon" alone matches ground cinnamon', () => {
    expect(matchIngredient('cinnamon')?.slug).toBe('ground-cinnamon');
  });
  it('"warm water" matches water (temperature words are descriptors)', () => {
    expect(matchIngredient('warm water')?.slug).toBe('water');
    expect(matchIngredient('lukewarm water')?.slug).toBe('water');
  });
  it('"greek yogurt" matches yogurt (flagged approximate via its notes)', () => {
    const m = matchIngredient('greek yogurt');
    expect(m?.slug).toBe('yogurt');
    expect(m?.notes).toMatch(/approximate/i);
  });
});
