/**
 * Ingredient dataset access: loading, alias-aware search, and the "top" subset used to generate
 * amount/fraction programmatic pages. Source of truth: src/data/ingredients.json (see
 * src/data/SOURCES.md for provenance and licence).
 */
import raw from '../data/ingredients.json';
import topSlugsRaw from '../data/top-ingredients.json';

export interface IngredientSource {
  name: string;
  url: string;
  gramsPerCup: number;
}

export interface Ingredient {
  slug: string;
  name: string;
  aliases: string[];
  category: string;
  gramsPerCup: number;
  gramsPerTbsp: number;
  gramsPerTsp: number;
  sources: IngredientSource[];
  notes?: string;
}

export const ingredients: Ingredient[] = raw as Ingredient[];
export const topIngredientSlugs: string[] = topSlugsRaw as string[];

const bySlug = new Map(ingredients.map((i) => [i.slug, i]));

export function getIngredient(slug: string): Ingredient | undefined {
  return bySlug.get(slug);
}

export function getTopIngredients(): Ingredient[] {
  return topIngredientSlugs.map((s) => bySlug.get(s)).filter((i): i is Ingredient => Boolean(i));
}

export const CATEGORY_LABELS: Record<string, string> = {
  flour: 'Flours',
  starch: 'Starches',
  leavener: 'Leaveners',
  salt: 'Salt',
  yeast: 'Yeast',
  sugar: 'Sugars',
  syrup: 'Syrups & sweeteners',
  'fat-oil': 'Fats & oils',
  dairy: 'Dairy',
  cheese: 'Cheese',
  grain: 'Grains & rice',
  nut: 'Nuts',
  'nut-butter': 'Nut butters',
  seed: 'Seeds',
  coconut: 'Coconut',
  chocolate: 'Chocolate & cocoa',
  'dried-fruit': 'Dried fruit',
  breadcrumb: 'Breadcrumbs',
  bean: 'Beans',
  spice: 'Spices',
  extract: 'Extracts',
  water: 'Water',
};

function normalize(s: string): string {
  // Hyphens are treated as word separators so "self-raising" matches the "self raising" alias,
  // and multi-word matching isn't sensitive to a recipe writer's hyphenation choice. Punctuation
  // (apostrophes, parentheses, commas, periods) is stripped so "confectioners sugar" (typed
  // without an apostrophe) still lines up with the dataset's "Confectioners' Sugar", and a
  // parenthetical like "Kosher Salt (Diamond Crystal)" tokenises cleanly (audit gramcup-audit-2,
  // new P1).
  return s
    .toLowerCase()
    .trim()
    .replace(/-/g, ' ')
    .replace(/['’.,()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(s: string): string[] {
  const n = normalize(s);
  return n ? n.split(' ') : [];
}

/**
 * Popularity rank (lower = more popular) used to break scoring ties. Backed by `top-ingredients.json`,
 * which is itself ordered by how commonly the ingredient shows up in recipes. Ingredients outside that
 * list sort after every ranked ingredient, then alphabetically, so results stay deterministic.
 */
const popularityRank = new Map(topIngredientSlugs.map((slug, i) => [slug, i]));
function rank(ingredient: Ingredient): number {
  return popularityRank.get(ingredient.slug) ?? Number.MAX_SAFE_INTEGER;
}

/**
 * Controlled list of descriptor words that may surround an ingredient name/alias without changing
 * which ingredient is meant ("unsalted butter", "melted butter", "granulated white sugar"). This is
 * intentionally short: a word that isn't on this list is treated as potentially changing the
 * ingredient (e.g. "coarse salt", "sugar snap peas") and blocks the match rather than guessing
 * (audit gramcup-audit-2, new P1).
 */
const DESCRIPTORS = new Set([
  'unsalted', 'salted', 'melted', 'softened', 'granulated', 'white', 'fresh', 'chopped', 'sifted', 'packed', 'large', 'cold',
  'warm', 'lukewarm', 'room', 'temperature',
]);

/** If every token of `phrase` is present in `query` (as a multiset), returns the leftover query
 * tokens once they're removed; otherwise null (the phrase isn't fully contained in the query). */
function subtractTokens(query: string[], phrase: string[]): string[] | null {
  if (!phrase.length) return null;
  const remaining = [...query];
  for (const t of phrase) {
    const idx = remaining.indexOf(t);
    if (idx === -1) return null;
    remaining.splice(idx, 1);
  }
  return remaining;
}

/**
 * Score an ingredient against a free-text query using name + aliases. Higher is better; 0 = no match.
 * Checks both directions: the query can be a prefix/substring of the name or alias (typing "ap flour"
 * or "flour" should find "All-Purpose Flour"), and the name or alias can be a whole word/phrase inside
 * a longer query (typing "unsalted butter" or "melted butter" should still find "Butter") so that an
 * adjective in front of or after the ingredient name doesn't block the match. Used for the interactive
 * combobox, where the user visually confirms a suggestion before picking it — looser than
 * `matchIngredient`, which auto-applies a match with no human check.
 */
function score(ingredient: Ingredient, q: string): number {
  const name = normalize(ingredient.name);
  if (name === q) return 100;
  if (name.startsWith(q)) return 80;
  for (const alias of ingredient.aliases) {
    const a = normalize(alias);
    if (a === q) return 95;
    if (a.startsWith(q)) return 70;
  }
  if (name.includes(q)) return 50;
  for (const alias of ingredient.aliases) {
    if (normalize(alias).includes(q)) return 40;
  }
  // Reverse containment: the query has extra words around the ingredient name/alias, but only when
  // every extra word is a known descriptor. A raw substring test here (the pre-fix behaviour) wrongly
  // matched "butter" inside "butternut squash" and "sugar" inside "sugar snap peas" — this is
  // word-boundary and descriptor-gated instead (audit gramcup-audit-2, new P1).
  const qTokens = q ? q.split(' ') : [];
  const nameLeftover = subtractTokens(qTokens, tokenize(ingredient.name));
  if (nameLeftover && nameLeftover.every((t) => DESCRIPTORS.has(t))) return 45;
  for (const alias of ingredient.aliases) {
    const aliasLeftover = subtractTokens(qTokens, tokenize(alias));
    if (aliasLeftover && aliasLeftover.every((t) => DESCRIPTORS.has(t))) return 35;
  }
  return 0;
}

/** Search ingredients by name/alias, best matches first. Empty query returns the full list ordered by name. */
export function searchIngredients(query: string, limit = 12): Ingredient[] {
  const q = normalize(query);
  if (!q) return [...ingredients].sort((a, b) => a.name.localeCompare(b.name)).slice(0, limit);
  return ingredients
    .map((i) => ({ i, s: score(i, q) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || rank(a.i) - rank(b.i) || a.i.name.localeCompare(b.i.name))
    .slice(0, limit)
    .map((x) => x.i);
}

function candidateStrings(ingredient: Ingredient): string[] {
  return [ingredient.name, ...ingredient.aliases];
}

function bestOf(candidates: Ingredient[]): Ingredient | undefined {
  if (!candidates.length) return undefined;
  return [...candidates].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))[0];
}

/**
 * Best single, high-confidence match for a free-text ingredient mention, used by the recipe
 * parser/scaler to silently pick a density with no human confirmation in the loop. Unlike
 * `searchIngredients` (loose, for the interactive combobox where the user picks from a visible
 * list), this only returns a match when it's confident, via a strict, ranked strategy:
 *
 *   1. Exact match: the whole line equals a known name or alias.
 *   2. Descriptor-stripped match: every extra word around a name/alias is on the controlled
 *      descriptor list ("unsalted butter", "granulated white sugar") — so a modifier that isn't on
 *      that list (e.g. "coarse salt", "sugar snap peas", "rice vinegar") never silently matches.
 *   3. Whole-word match for multi-word names/aliases only: every word of the name/alias appears in
 *      the line, and the line's last word (its head noun) matches the name/alias's last word — so a
 *      single shared word can never wrongly match on its own (that's what let "butter" match inside
 *      "butternut squash" and "sugar" inside "sugar snap peas" before this fix). Single-word
 *      names/aliases are excluded from this tier; they only match via 1 or 2.
 *
 * When none of these are confident, returns undefined so the caller scales the quantity only and
 * marks the line as not converted (audit gramcup-audit-2, new P1).
 */
export function matchIngredient(text: string): Ingredient | undefined {
  const q = normalize(text);
  if (!q) return undefined;
  const qTokens = q.split(' ');

  // Tier 1: exact match against a name or alias.
  const exact = ingredients.filter((i) => candidateStrings(i).some((c) => normalize(c) === q));
  if (exact.length) return bestOf(exact);

  // Tier 2: descriptor-stripped match.
  const tier2 = ingredients.filter((i) =>
    candidateStrings(i).some((c) => {
      const leftover = subtractTokens(qTokens, tokenize(c));
      return leftover !== null && leftover.every((t) => DESCRIPTORS.has(t));
    }),
  );
  if (tier2.length) return bestOf(tier2);

  // Tier 3: whole-word match for multi-word names/aliases, gated on both the head noun (last
  // word) matching *and* every leftover query word (words not part of the matched phrase) being
  // on the controlled descriptor list — the same discipline as tier 2, so a multi-word alias
  // doesn't open a back door for an unlisted modifier to slip through untested (a bare word check
  // alone let "flaky sea salt" match table salt via its "sea salt" alias; audit gramcup-audit-3,
  // P1). A shared word alone still never matches on its own.
  const queryHead = qTokens[qTokens.length - 1];
  const tier3 = ingredients.filter((i) =>
    candidateStrings(i).some((c) => {
      const cTokens = tokenize(c);
      if (cTokens.length < 2) return false;
      if (cTokens[cTokens.length - 1] !== queryHead) return false;
      if (!cTokens.every((t) => qTokens.includes(t))) return false;
      const leftover = subtractTokens(qTokens, cTokens);
      return leftover !== null && leftover.every((t) => DESCRIPTORS.has(t));
    }),
  );
  if (tier3.length) return bestOf(tier3);

  return undefined;
}

export function relatedIngredients(ingredient: Ingredient, limit = 6): Ingredient[] {
  return ingredients.filter((i) => i.category === ingredient.category && i.slug !== ingredient.slug).slice(0, limit);
}
