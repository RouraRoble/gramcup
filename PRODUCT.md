# GramCup (WEB-04)

**One-liner:** Grams ↔ cups ↔ tablespoons converter that knows the ingredient (density-aware,
sources shown), plus a paste-a-recipe scaler/converter.

**Live at:** `https://rouraroble.github.io/gramcup/` (once deployed).

## What it is

A cup is a volume; a gram is a weight. Converting between them requires knowing how densely the
specific ingredient packs — a cup of flour and a cup of honey do not weigh the same. GramCup has
two tools:

1. **Converter** (`/`) — pick one of 110 ingredients, enter an amount, convert between g / kg / oz
   / lb / ml / fl oz / cup / ½ cup / tbsp / tsp, with a US/US-legal/metric/imperial cup-size
   selector, a reverse-direction toggle, a quick-reference table, the range published sources
   report, and a measuring tip. State lives in the URL query string (`?i=&a=&f=&t=&cup=`).
2. **Recipe scaler** (`/recipe-scaler/`) — paste a full recipe (one ingredient per line), scale it
   by a flat factor, by servings, or by the ratio of two pan areas (round/square/rectangular),
   optionally convert every matched line to grams, and copy/print/share the result. State lives in
   the URL hash, lz-string compressed. Unmatched ingredients still scale by quantity.

Programmatic pages: an ingredient hub for each of the 110 ingredients (`/{ingredient}/`, full
cups↔grams table + tbsp/tsp + sources + FAQ), plus for the 60 most-searched ingredients an
amount page for 11 common gram amounts (`/{amount}-grams-{ingredient}-to-cups/`) and a
cup-fraction page for 8 common cup amounts (`/{fraction}-cup-{ingredient}-in-grams/`) —
110 + 660 + 480 = 1,258 total pages, built in well under 3 minutes.

## Data sources & licence

Primary: **King Arthur Baking Company — Ingredient Weight Chart**
(https://www.kingarthurbaking.com/learn/ingredient-weight-chart). Cross-referenced against
**USDA FoodData Central** (https://fdc.nal.usda.gov/, public domain / CC0 1.0 Universal) for
all-purpose flour, granulated sugar, cooked white rice and cooked black beans, and a physical
constant for water. Full provenance, per-record methodology and licence notes:
`src/data/SOURCES.md`. Every ingredient's `sources[]` array (in `src/data/ingredients.json`) is
rendered on that ingredient's page, so every number traces back to where it came from. Retrieved
2026-09-23. Facts (measured weights) are not copyrightable; no source page's text is reproduced.

## Formulas

- `src/lib/units.ts` — density (`gramsPerCup / 236.588`) drives every weight↔volume conversion;
  weight-to-weight conversions use fixed physical factors, independent of the ingredient.
- `src/lib/parse-recipe.ts` — recipe-line parser (unicode/ascii/mixed fractions, ranges, unit
  abbreviations, bullet stripping, alias-aware ingredient matching).
- `src/lib/scale.ts` — scale-by-factor / servings / pan-area, plus scaled→grams conversion.
- `src/lib/state.ts` — URL-state encode/decode for both tools.

## Known limits

- 110 ingredients, not an exhaustive list; unmatched ingredients in the recipe scaler still scale
  numerically (no gram conversion, since that needs a known density).
- Ground cinnamon's gram-per-tablespoon figure is a lower-confidence, aggregated spice-density
  estimate rather than a directly measured King Arthur/USDA figure (flagged in its `notes`).
- Weights assume common, dry-stored ingredients; brand and humidity can shift real weights a few
  percent either way — this is why sources ranges are shown rather than a single "true" number.

## Monetization hooks (not wired to a real network yet)

- `<AdSlot slot="...">` placeholders below the converter, below the scaler, and mid-page on each
  ingredient hub — render nothing until `PUBLIC_ADSENSE_CLIENT` is set.
- Affiliate block on the home page: "Skip the guesswork: a digital kitchen scale"
  (`site.affiliate.kitchenScale` in `src/site.config.ts`), `rel="sponsored noopener"`, URL left as
  `#` — no kitchen-scale affiliate partner has been chosen yet; wire an Amazon Associates or
  direct-retailer link here when one is selected.

## Future ideas

- Add a "print-friendly card" layout distinct from the page (currently uses `window.print()` on
  the existing layout).
- Add more ingredients (spices, additional cheeses, gluten-free flour blends) as sourced data
  becomes available.
- Per-ingredient OG images could show the sources-range spread as a small bar, not just the
  headline number.
- A "common substitutions" cross-link between related ingredients on each hub page.
