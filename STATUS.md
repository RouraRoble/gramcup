# STATUS — GramCup (WEB-04)

## Fixes after audit 1

Audit: `mission/audits/gramcup-audit-1.md` (verdict BLOCKED; P0=1, P1=4, P2=7, P3=8). Every P0 and
P1 finding is fixed and reproduced-then-verified with a regression test where practical; most P2s
are fixed; the P3s marked "if trivial" are mostly fixed too. All four verification commands pass
(`npm test`, the BASE build with icon generation + SEO audit, `npm run test:e2e`, and the plain
`npm run build`).

### Fixed

- **[P0] Generic-word mismatches ("sugar"→brown sugar, "salt"→kosher, "oil"→coconut, "rice"→rice
  flour)** — `src/lib/ingredients.ts`: added `sugar`/`salt`/`oil`/`rice` as canonical aliases on
  the everyday default ingredient (granulated sugar, table salt, vegetable oil, dry white rice —
  `src/data/ingredients.json`), and replaced the alphabetical tie-break with one based on
  `top-ingredients.json`'s popularity order (falling back to alphabetical only when neither
  ingredient is ranked). Regression tests in `tests/unit/ingredients.test.ts`.
- **[P1] Stale/wrong result for invalid amounts (negative, empty, `1e999`/`Infinity`)** —
  `src/components/Converter.tsx`: the displayed amount and the result are now both derived from
  the *currently typed* text on every render (previously the result used a separately-tracked
  `amount` state that only updated on valid input, so an invalid edit left the old result showing
  under the new, invalid label). Empty/negative/non-numeric input now shows an inline error and
  hides the numeric result instead of falling back to 0; a valid amount whose *converted* result
  overflows to `Infinity` (e.g. `1e308 kg`) shows "too large to convert" instead of silently
  showing 0.
- **[P1] "½ cups"/"half-cup" unit reads as a second, conflicting fraction** —
  `src/lib/units.ts`: relabelled to "half-cups (½ cup each)" so a sentence reads "2 half-cups", not
  "2 ½ cups" (which looked like 2.5 cups); the converter also now shows the whole-cup equivalent in
  parentheses when the "to" unit is half-cups.
- **[P1] Malformed `?f=`/`?t=` URL params crash the converter island** — `src/lib/state.ts`:
  `decodeConverterState` now validates `f`/`t`/`cup` with `Object.hasOwnProperty` against the real
  unit/cup-key sets (not the `in` operator, which also matches inherited keys like `constructor` —
  a `?f=constructor` link would otherwise sail through validation and then crash
  `UNIT_LABELS[fromUnit].split`), falling back to the defaults for anything else. Regression tests
  cover both plain junk (`f=foo`) and the `constructor`/`toString`/`hasOwnProperty` prototype-chain
  case.
- **[P1] Common recipe lines unrecognised ("unsalted butter", "melted butter", "1 T olive oil",
  "self-raising flour")** — `src/lib/ingredients.ts`: matching now also checks the reverse
  direction (an ingredient name/alias contained *within* a longer query), and hyphens normalize to
  spaces so "self-raising" matches the "self raising" alias. `src/lib/parse-recipe.ts`: added
  case-sensitive bare `T`→tablespoon / `t`→teaspoon abbreviations.
- **[P2] "Sources range" shows the same number twice (213–213 g) for 106/110 ingredients** —
  rather than fabricate unverified USDA figures for 60+ ingredients in the time available, hid the
  range line whenever an ingredient has only one source (`src/components/Converter.tsx`,
  `src/pages/[ingredient]/index.astro`), per the audit's own alternative suggested fix. Filling in
  real USDA FDC figures with FDC IDs is listed under Known issues/Next improvements.
- **[P2] "Nearby amounts" always lists 25–150 g on all 660 pages** —
  `src/pages/[amount]-grams-[ingredient]-to-cups.astro`: now sorts by distance from the current
  amount and takes the 6 closest.
- **[P2] Duplicate BreadcrumbList JSON-LD** — removed the redundant `breadcrumbLd(...)` entry from
  every page's `jsonLd` array; `<Breadcrumbs>` already emits it once, in one place.
- **[P2] Live affiliate link points to `#`** — `src/pages/index.astro`: the affiliate block only
  renders when `site.affiliate.kitchenScale.url !== '#'`.
- **[P2] Combobox missing `aria-activedescendant`; listbox is a tab stop; no "no matches" state** —
  `src/components/Converter.tsx`: added `aria-activedescendant`, `tabIndex={-1}` on the listbox,
  and a "No matching ingredient" status row.
- **[P2] Mobile (320–375px): tool starts below the fold, fields cramped** —
  `src/styles/tools.css` (single-column field grid below 400px) and `src/styles/identity.css`
  (smaller hero heading/lead below 480px so the tool sits higher on the page).
- **[P2, partial] 1,140 near-identical programmatic pages** — added genuinely differentiated,
  per-ingredient content (a category-aware measuring tip, shared via the new
  `src/lib/measuring-tip.ts`, plus the ingredient's sourcing `notes` where present) to every amount
  and fraction page, on top of the now-proximity-sorted nearby-amounts table. A full content
  rewrite (spooned-vs-scooped bands, metric/imperial rows, or noindexing the thinnest amounts) is
  a larger effort than fit in this pass — see Known issues.
- **[P3] Crafted scaler hash crashes the island** — `src/lib/state.ts`: `decodeScalerState` now
  sanitizes every field by type/enum (wrong-typed `factor`, unknown `mode`/`cup`/pan-shape values)
  instead of trusting the decoded JSON verbatim, dropping invalid fields rather than defaulting the
  whole object (so a legitimate partial state still round-trips unchanged — verified by the
  existing round-trip test plus new sanitization tests).
- **[P3] Scaler range lines lose the range when converted to grams** — `src/lib/scale.ts` /
  `Scaler.tsx`: a range quantity ("2-3 tbsp honey") now converts to a gram range (`gramsMin`–
  `gramsMax`), not the single midpoint figure.
- **[P3] Large paste freezes the page** — `src/components/Scaler.tsx`: pasted/typed text is capped
  at 300 lines (a generous ceiling for a real recipe) with a visible notice, bounding parse/scale/
  render cost and the URL-hash size.
- **[P3] Division by zero in the parser displays 0** — `src/lib/parse-recipe.ts`: a zero
  denominator (`1/0`, `1 2/0`) is now treated as an unparsed quantity instead of computing
  `Infinity`→0.
- **[P3] Privacy page generic template text; analytics processor unnamed** —
  `src/pages/privacy.astro`: removed the inapplicable "files you open"/local-storage bullets,
  states plainly that analytics are on, and names the processor (a Supabase Edge Function) and
  exactly what the beacon sends/doesn't send.
- **[P3] Structured data/metadata polish** — the 404 page's description is no longer 36 characters;
  `webAppLd()` only claims `browserRequirements: 'Requires JavaScript'` for the two pages that
  actually mount a client island (home, recipe scaler), not the static amount/fraction/ingredient
  pages (`src/lib/seo.ts`, new `interactive` option); the "USDA FoodData Central lists a *scooped*
  cup" claim in the flour dataset note was softened to not assert an unstated methodology.
- **Pluralization nits** ("1 cups", "1 pounds", "¼ cups") — added `unitPhrase()` to
  `src/lib/units.ts` (singular only when the amount is exactly 1) and applied it in `Converter.tsx`,
  `Scaler.tsx`, and the amount/fraction page templates; also removed two "use the converter above"
  references on pages that only link to the converter, not embed it.

### Not fixed (and why)

- **[P2] 1,140 near-identical programmatic pages, full remediation** — the measuring-tip/notes
  addition above is a real improvement but not the full remediation (spooned-vs-scooped bands,
  metric/imperial rows, or noindexing the thinnest amounts) the audit suggested; that's a
  content-authoring effort beyond this pass's time budget.
- **[P2] USDA FDC household-measure figures for 106 ingredients** — filling these in accurately
  (with real FDC IDs) needs per-ingredient sourcing research that doesn't fit safely in this pass;
  fabricating numbers would be worse than the current single-source display, so the range line is
  hidden instead (see Fixed, above) rather than filled with unverified data.
- **[P3] Sitemap `<lastmod>` uses the build timestamp for every URL** — giving false freshness
  signals. Fixing this correctly needs per-page last-modified tracking (e.g. from the dataset's own
  change history), which doesn't exist yet; not attempted rather than done partially/incorrectly.
- **[P3] "No skip-to-content link"** — re-checked `src/layouts/Base.astro` and
  `src/styles/base.css`: a skip link (`<a class="skip-link" href="#main">Skip to content</a>`) is
  already the first element in `<body>`, styled to appear on focus. Could not reproduce "first tab
  stop is the logo" against the current code; left as-is.

## Fixes after audit 2

Audit: `mission/audits/gramcup-audit-2.md` (P0=0, P1=1 new). This section was never written down
at the time (audit 3 flagged the gap); reconstructed here from audit 2's own "Status vs audit 1"
table and "New findings" section, which independently verified what the audit-2 fix pass changed
in `src/lib/ingredients.ts`, `src/data/ingredients.json` and elsewhere.

### Fixed

- **[P1, new] Loose "reverse containment" matching silently converted unrelated or wrong-density
  ingredients** (`confectioners sugar`, `cooked rice`, `cheese`, `butternut squash`→butter,
  `sugar snap peas`→sugar, `oil-packed tomatoes`→oil, `coconut`→coconut flour, and others) —
  `matchIngredient` was tightened from a raw, one-directional substring test to the strict, ranked
  tier system still in place today (exact match → descriptor-stripped match against a controlled
  modifier list → whole-word/head-noun match for multi-word names), and punctuation (apostrophes)
  is stripped in `normalize` so `confectioners sugar` matches without the apostrophe. Aliases were
  added for `cooked rice` and `cheese`. Regression tests for every false-positive case are in
  `tests/unit/ingredients.test.ts` ("strict matching rejects false positives").
- Confirmed still fixed from audit 1: generic sugar/salt/oil/rice, unsalted/melted butter and
  self-raising flour matching, invalid-amount handling, the half-cup unit label, malformed URL
  params, "Nearby amounts" proximity sort, duplicate BreadcrumbList JSON-LD, the affiliate link
  placeholder, and the scaler's crafted-hash/large-paste/division-by-zero hardening.

### Not fixed (carried over, and why)

- **[P2] USDA FDC data still missing for 106/110 ingredients** and **[P2] 1,140 near-identical
  programmatic pages** — same reasoning as audit 1: filling in unsourced figures or a full content
  rewrite doesn't fit safely in a single pass; partial mitigations (hiding the single-source range
  line; per-category measuring tips) were already in place from audit 1.
- **[P3] Pluralisation ("1 cups"), sitemap `<lastmod>`, scaler notice wording, category-level
  measuring-tip mismatches** — left open; partially addressed across audits 1 and 3 (see those
  sections).

### The over-correction this pass introduced (found and fixed in audit 3)

Tightening the matcher to strict, ranked tiers fixed the false positives above, but the tier-2
descriptor gate ended up requiring an exact name/alias match or a fully descriptor-modified one —
with no generic, bare-word alias for several very common ingredients (`flour` itself was never
added, only `ap flour`/`plain flour`/`all purpose flour`). That silently stopped bare `flour`,
`kosher salt`, `vanilla` and others from converting at all. See "Fixes after audit 3" below.

## Fixes after audit 3

Audit: `mission/audits/gramcup-audit-3.md` (verdict NEEDS FIXES; P0=0, P1=1). The one P1 (a
regression from the audit-2 matcher tightening) and the three new P2s are fixed and covered by new
regression tests; one additional cheap, clearly-reproducible P3 carried over from audit 2 is also
fixed. All four verification commands pass (`npm test`, the BASE build with SEO audit, `npm run
test:e2e`, and the plain `npm run build`).

### Fixed

- **[P1, regressed from audit 1] Bare category words and several common ingredient descriptions no
  longer matched** (`flour`, `kosher salt`, `sea salt`, `vanilla`, `active dry yeast`, `shredded
  coconut`, `cheddar cheese`, and a leading `(1 stick)`-style measurement parenthetical) —
  `src/lib/ingredients.ts` / `src/data/ingredients.json`:
  - Added `flour` as a canonical alias on All-Purpose Flour (the same pattern audit 1 established
    for `sugar`/`salt`/`oil`/`rice`), `vanilla` on Vanilla Extract, `kosher salt` on the Diamond
    Crystal entry (the brand most modern US recipes default to when none is named — a recipe
    naming Morton's by name still matches that brand's own entry), `sea salt`/`fine sea salt` on
    Table Salt, `active dry yeast` on Instant Yeast, `shredded coconut` on Sweetened Shredded
    Coconut, and `cheddar cheese`/`cheddar` on Shredded Cheddar Cheese — each is a documented,
    reasonable default (with a `notes` caveat where the substitution is approximate) rather than a
    fabricated distinct density.
  - `src/lib/parse-recipe.ts`: a *leading* parenthetical that itself starts with a number (`"(1
    stick) butter"`, `"(8 oz) cream cheese"`) is now stripped before matching — it's a secondary
    measurement note, not a description of which ingredient is meant — while a *trailing*,
    non-numeric parenthetical (`"Kosher Salt (Diamond Crystal)"`) is untouched, so audit-2's brand
    disambiguation still works.
  - Tightening the tier-3 (whole-word/head-noun) matcher exposed a related bug while fixing this:
    adding a two-word generic alias (`sea salt`) let tier 3's laxer rule accept an unlisted extra
    modifier ("flaky sea salt" wrongly matched table salt, since tier 3 didn't gate leftover words
    against the descriptor list the way tier 2 does). Tier 3 now applies the same descriptor gate,
    closing that door without weakening the tier-1/tier-2 fixes from audit 1/2.
  - Regression tests for every case above (plus the audit-1/2 false-positive rejections, re-run to
    confirm they still hold) are in `tests/unit/ingredients.test.ts`.
- **[P2, new] Dark-mode converter error text failed contrast (2.47:1)** — `src/styles/tokens.css`:
  `--danger` is now overridden in both dark-mode blocks (`#ff6b57`, 5.6:1 on the `#2a2216` elevated
  background it's shown on, 6.15:1 on the page background) instead of falling through to the
  light-mode value.
- **[P2, new] "No matching ingredient" row broke `aria-required-children` (axe critical)** — it was
  a `<li role="status">` inside `<ul role="listbox">`, whose only valid children are options.
  `src/components/Converter.tsx`: the status message is now a sibling `<p role="status">` outside
  the listbox; the (now-empty) `<ul id="ingredient-listbox">` stays in the DOM but hidden, so the
  input's `aria-controls` reference still resolves. New Playwright regression test in
  `tests/e2e/converter.spec.ts` runs axe with the combobox in this state.
- **[P2, new] No header/footer navigation to the tool from any of the 1,255 hub/amount/fraction
  pages** — `SiteHeader` was always rendered with no `links`. `src/layouts/Base.astro` now passes a
  primary nav (Converter, Recipe scaler, Ingredients) to every page. New Playwright regression test
  in `tests/e2e/smoke.spec.ts` checks this nav on every smoke-tested route, including hub, amount
  and fraction pages.
- **[P3, carried over from audit 2, cheap] "is 0.21 cup (0.21 cup)" on 342 of 660 amount pages** —
  when the gram amount doesn't land near a common kitchen fraction, `formatKitchen` and
  `roundForDisplay` print the same decimal, so showing both read as a pointless repeat.
  `src/pages/[amount]-grams-[ingredient]-to-cups.astro`: the parenthetical is now only shown when
  it differs from the kitchen-formatted text. New Playwright regression test in
  `tests/e2e/smoke.spec.ts`.

### Not fixed (carried over from audits 1/2, and why — unchanged from before, time-boxed out of this pass)

- USDA FDC data for 106/110 ingredients, full programmatic-page content remediation (near-identical
  amount/fraction pages), sitemap `<lastmod>` freshness, raw scientific notation for extreme inputs
  (e.g. `1e300`), the hero range claim (still reads oddly with only 4 multi-sourced ingredients),
  the scaler's "ingredient not recognized" wording for a `1/0` quantity (it's the quantity that's
  invalid, not the ingredient) and the 300-line truncation notice wording, and the `a=0` share-link
  mismatch. Each is either a content-authoring/data-sourcing effort beyond a time-boxed pass, or a
  cosmetic wording nit not reached in this pass — none are P0/P1, and the ones above were the
  cheapest, most clearly reproducible P2/P3s available in the time budget.

### Verification (this session, final run)

- `npm test` → **Test Files 7 passed (7), Tests 102 passed (102)** (10 new, all in
  `tests/unit/ingredients.test.ts`, for the matcher regressions/fixes).
- `MSYS_NO_PATHCONV=1 SITE=https://rouraroble.github.io BASE=/gramcup npm run build` →
  **1258 page(s) built**; `[seo] audited 1258 pages · 0 errors · 0 warnings`.
- `MSYS_NO_PATHCONV=1 BASE=/gramcup npm run test:e2e` → **87 passed** (17 new: the combobox
  no-match/axe test, the primary-nav test × 15 smoke-tested routes, and the redundant-cup-text
  test).
- `npm run build` (root base) → **1258 page(s) built**; `0 errors, 0 warnings`.

## Polish pass (post audit-4, no open P0/P1)

The latest independent audit (`mission/audits/gramcup-audit-4.md`, verdict **ACCEPTABLE**, P0=0,
P1=0) left only P2/P3 items and a portfolio-wide polish list
(`mission/POST_MVP_PLAN.md`). This pass worked through that list in priority order: correctness/
accessibility P2s, the one real Lighthouse failure, AEO freshness/structure, the template port,
and SEO depth. All four verification commands pass throughout; 13 new unit tests and 2 new/1
rewritten e2e tests were added alongside the fixes.

### 1. Open P2 correctness/accessibility/wording (audit-4)

- **[P2] B1: common recipe words with a dataset entry still didn't match** ("cream", "pecans",
  "oats", "cinnamon", "warm water", "greek yogurt") — `src/data/ingredients.json`: added `cream` to
  Heavy Cream, split the single literal `"pecans, diced"` alias into `pecans` + `pecans, diced` on
  Chopped Pecans, added `oats` to Rolled Oats and `cinnamon` to Ground Cinnamon, added `greek
  yogurt`/`greek yoghurt`/`yoghurt` to Yogurt (with a new `notes` caveat that Greek yogurt is
  denser and the figure is approximate for it — the existing `uncertain`-flag regex in
  `src/lib/scale.ts` picks this up automatically via the word "approximate"). `src/lib/
  ingredients.ts`: added `warm`/`lukewarm`/`room`/`temperature` to the controlled `DESCRIPTORS`
  list so "warm water"/"lukewarm water" match Water. Regression tests in
  `tests/unit/ingredients.test.ts` ("common recipe words that previously failed to match").
- **[P3] B2: bare "kosher salt" assumed Diamond Crystal with no on-screen uncertainty hint** (a
  2x-by-volume difference from Morton's) — reworded that ingredient's `notes` in
  `src/data/ingredients.json` to say the match is "assumed" and "approximate", which the existing
  `/approximate|uncertain|lower-confidence/i` regex in `src/lib/scale.ts` already checks — no code
  change needed, just accurate wording, so the scaler's existing uncertainty flag now fires for it
  like it already does for sea salt and active dry yeast.
- **[P3] A3-N5: `a=0` share link silently became `a=200`** — `src/lib/state.ts`:
  `decodeConverterState` conflated "no `a` param" and "`a=0`" because `Number(null)` and
  `Number('')` are both `0`; now a present, empty, or absent `a` are distinguished before the
  `>= 0` check, so a real `a=0` round-trips as 0 and only a genuinely missing/negative/non-numeric
  amount falls back to the default. Matching fix in `src/components/Converter.tsx`'s hydration
  effect (`s.a >= 0`, was `s.a > 0`). Regression tests in `tests/unit/state.test.ts`.
- **[P3] "1.5 pounds of granulated sugar = 0.68 kilogram"** — `src/lib/units.ts`: `unitPhrase`'s
  singular-for-any-fraction-below-1 rule is a kitchen-measure idiom ("½ cup", not "½ cups") that
  had incorrectly been applied to every unit; it's now scoped to `cup`/`half-cup`/`tbsp`/`tsp`
  only, so weight and ml/floz units are singular only for exactly 1. Regression tests in
  `tests/unit/units.test.ts`.
- **[P3] "1 gram of all-purpose flour = 0 cups"** — tiny nonzero amounts (below 1/16 of the
  displayed unit) now show "< ⅛" instead of rounding away to a misleading "0" (`formatKitchen`,
  `kitchenValue` in `src/lib/units.ts`, kept consistent with each other so the paired unit word
  stays singular: "< ⅛ cup"). Regression tests in `tests/unit/units.test.ts`.
- **[P3] Scientific notation for extreme inputs** (`1e300` tbsp honey → `2.1e+301 grams`) — the
  "too large to convert" guard in `src/components/Converter.tsx` checked only
  `!Number.isFinite(...)`, which a huge-but-finite JS number passes; it now also catches any
  |result| over 1e12 (a threshold no real kitchen conversion approaches).
- **[P3] Scaler notice showed "ingredient not recognized" even with gram conversion off, and for
  count nouns with no unit at all** — `src/components/Scaler.tsx`: both unmatched-ingredient
  notices now only render when "Convert entire recipe to grams" is checked, since the notice is
  specifically about *that* conversion. `tests/e2e/scaler.spec.ts`'s existing test for this was
  rewritten to assert the notice is now absent by default, plus a new test asserting it appears
  once the toggle is checked.

### 2. Lighthouse failure (`mission/metrics/gramcup-lh.json`)

Re-checked every audit with `score < 1`: `cache-insight`/`forced-reflow-insight`/
`network-dependency-tree-insight`/`render-blocking-insight` are informational "Insight" audits with
no scoring weight (performance category is still 100), and `cumulative-layout-shift` scores 1 (CLS
0, already reserved/stable). The one real, weighted failure was **`heading-order`** (accessibility
99/100): the converter island's "Quick reference: {ingredient} by cup" heading was an `<h3>` with
no `<h2>` on the page before it (an `<h1>` immediately precedes the converter). Changed to `<h2>` in
`src/components/Converter.tsx` (with a matching CSS selector update in `src/styles/tools.css`) — it
is the only heading inside the island and sits at the same level as the page's other top-level
sections, so `<h2>` is also the semantically correct level, not just a lint fix.

### 3. AEO freshness and structure on every programmatic/tool page

- **Visible "Data updated: `<date>`" line** added near the top of the home page, the recipe scaler,
  `/ingredients/`, every ingredient hub (`/{ingredient}/`), every amount page
  (`/{amount}-grams-{ingredient}-to-cups/`) and every fraction page
  (`/{n}-cup-{ingredient}-in-grams/`) — driven by a new `site.dataUpdated` field in
  `src/site.config.ts` (`about.astro`'s existing "Last updated" line now reads from the same field
  instead of its own separate hardcoded date, so the two can't drift apart).
- **`dateModified`/`datePublished` in JSON-LD** — `webAppLd()` in `src/lib/seo.ts` gained optional
  `dateModified`/`datePublished` parameters, now passed as `site.dataUpdated` from every page that
  calls it (home, recipe scaler, `/ingredients/`, ingredient hubs, amount pages, fraction pages).
- **`Dataset` schema on data hubs** — new `datasetLd()` helper in `src/lib/seo.ts` (name,
  description, url, license, `isBasedOn` sources, dateModified). Emitted on every ingredient hub
  (that ingredient's own `sources[]`, `license` pointing at `/about/` rather than asserting a
  blanket CC0/public-domain claim for a compilation that includes a branded source's published
  chart) and on `/ingredients/` (the aggregate 110-ingredient dataset, deduplicated sources).
- **`HowTo` schema on step guides** — `howToLd()` (already existed, unused) is now emitted on the
  recipe scaler ("How the recipe scaler reads your recipe", 4 steps — the visible `<ol>` on that
  page now renders from the same `parserSteps` array passed to the schema, so they can't drift) and
  on both new guide pages (see §5).

### 4. Template changes ported (`mission/POST_MVP_PLAN.md`, "Template changes to port")

- **`src/components/SiteHeader.astro`**: replaced the wrapping `flex-wrap: wrap` nav with the
  template's non-wrapping, horizontally-scrollable nav (`overflow-x: auto`, hidden scrollbar,
  `display: inline-block` on the links). Fixes audit-4 B3: at 320-375px the old nav wrapped to two
  rows whose link boxes started above the viewport and pushed the header past its 68px/~100px
  budget.
- **`src/styles/base.css`**: `.skip-link`'s hidden position changed from `top: -40px` to
  `top: -100px` (matching the template), fixing audit-3 N6 — at `-40px` the link's bottom edge sat
  ~1.6px inside the viewport, visible as an orange sliver above the header at 375px. Verified in a
  live preview: `getBoundingClientRect()` now reports `top: -100, bottom: -58.4` (fully off-screen).
- **`astro.config.mjs` / `src/layouts/Base.astro` / `src/components/AdSlot.astro`**: ported the
  conditional AdSense/Plausible CSP (`PUBLIC_ADSENSE_CLIENT`/`PUBLIC_PLAUSIBLE_DOMAIN` env vars
  gate `script-src`/`frame-src` origins, so no third-party CSP relaxation happens unless one of
  those is actually set at build time), the AdSense loader `<script>` in `Base.astro`'s `<head>`,
  and the `adsbygoogle.push({})` script in `AdSlot.astro`. GramCup has no product-specific CSP
  extras (unlike e.g. Pixlite's `'wasm-unsafe-eval'`), so nothing else needed preserving.

### 5. SEO depth with genuine value

Two new guide pages, both computed from GramCup's own dataset (no invented numbers), each with a
data table, a `<Faq>` (FAQPage schema), a `HowTo` schema for their step-by-step section, breadcrumbs,
a related-links block, and a `<Share>` bar; both added to `tests/routes.json` for smoke/axe/viewport
coverage and cross-linked from the home page and `/about/`:

- **`/guides/cup-sizes-explained/`** — "US Cup vs Metric Cup vs Imperial Cup, in Grams". Table:
  5 representative ingredients (flour, sugar, butter, honey, milk) × the 4 supported cup
  definitions, every cell computed via the same `convert()` function the converter tool uses (not
  hand-typed). 3-step HowTo ("how to convert a recipe between cup sizes"), 4-item FAQ.
- **`/guides/why-cup-weights-differ-by-source/`** — "Why Sites Disagree on Grams Per Cup". Table:
  every ingredient in the dataset (computed by filtering for `min !== max` across `sources[]`) where
  two published sources report a different gram figure — currently 5 of 110 (flour, table salt,
  granulated sugar, butter, whole milk), sorted by spread. 3-step HowTo ("how to measure a dry
  ingredient by spoon and level"), 4-item FAQ.

Both are linked from a new "Guides" section on the home page (between the recipe-scaler callout and
the ingredient browser) and from the two relevant paragraphs on `/about/`.

### 6. Share/retention polish

Not reached this pass beyond what shipped in §3-5 above (the new guides' own `<Share>` bars) — the
existing share/print/copy-link affordances on the converter and scaler were already in place from
prior passes and were not the priority given the P2/Lighthouse/AEO/template backlog above.

### Verification (this session, final run)

- `npm test` → **7 test files passed, 115 tests passed** (13 new: matcher-gap regressions, the
  weight-vs-kitchen-unit `unitPhrase` split, the tiny-amount `formatKitchen`/`kitchenValue` fix,
  and the `a=0` state round-trip).
- `MSYS_NO_PATHCONV=1 SITE=https://rouraroble.github.io BASE=/gramcup npm run build` →
  **1260 page(s) built** (2 new guide pages); `[seo] audited 1260 pages · 0 errors · 0 warnings`.
- `MSYS_NO_PATHCONV=1 BASE=/gramcup npm run test:e2e` → **98 passed** (the two new guide pages'
  smoke/axe/viewport/nav checks, the rewritten unmatched-ingredient-notice test, and one new test
  for the same notice appearing once gram conversion is requested).
- `npm run build` (root base) → **1260 page(s) built**; `0 errors, 0 warnings`.
- Manually verified in a live local preview (mobile 375px): single-row header nav, skip-link fully
  off-screen (`top: -100, bottom: -58.4`), and correct `h1 → h2 → h2 → …` heading order on the home
  page (no more `h3` skip).

### Known issues carried over, unchanged (declined again for the same reasons as prior audits)

USDA FDC figures for the ~105 single-sourced ingredients; a full content rewrite of the 1,140
amount/fraction pages (spooned-vs-scooped bands, metric/imperial rows, or noindexing the thinnest
amounts); sitemap `<lastmod>` using the build timestamp instead of per-page data freshness; the
`1/0`-quantity scaler notice wording; the "matched as: X ▾" chip audits have recommended three
times running (would need a small UI addition, not just a data/wording fix); fractional-count-noun
rounding for the scaler ("2.53 eggs") when gram conversion is off.

## Summary

Resumed from a folder that only had the untouched template scaffold (no custom `src/lib`, no
`src/data`, no islands, placeholder `site.config.ts`/`index.astro`). Built the full MVP in this
session: density-aware converter, recipe scaler, a 110-ingredient sourced dataset, 1,258
programmatic pages, kitchen-warm visual identity, and the two mission-wide extra tasks (MoreTools
cross-links, IndexNow verification file). All four required verification commands pass.

## What's done

- **Dataset** — `src/data/ingredients.json`: 110 ingredients (flours, starches, leaveners, salt,
  yeast, sugars, syrups, fats/oils, dairy, cheese, grains/rice, nuts, nut butters, seeds, coconut,
  chocolate/cocoa, dried fruit, breadcrumbs, one bean, one spice, vanilla extract, water), each
  with `gramsPerCup`, `gramsPerTbsp`, `gramsPerTsp`, `sources[]` (name + URL + that source's own
  figure), and `notes` where relevant. Compiled from King Arthur Baking's ingredient weight chart
  and cross-checked against USDA FoodData Central (public domain) — full provenance in
  `src/data/SOURCES.md`. `src/data/top-ingredients.json` holds the 60 most-searched ingredients
  used for programmatic amount/fraction pages.
- **Converter** (`/`, `src/components/Converter.tsx`) — searchable alias-aware ingredient
  combobox, amount input, from/to unit selects (g/kg/oz/lb/ml/fl oz/cup/½ cup/tbsp/tsp), a
  US/US-legal/metric/imperial cup-size selector, reverse-direction toggle, sources-range line,
  category-aware measuring tip, quick-reference table (¼–2 cups → g/oz), copy-link and print.
  State round-trips through the URL query string (`?i=&a=&f=&t=&cup=`).
- **Recipe scaler** (`/recipe-scaler/`, `src/components/Scaler.tsx`) — pastes a recipe, parses
  each line (unicode/ascii/mixed fractions, ranges, unit abbreviations, bullets), scales by
  factor/servings/pan-area, optional "convert entire recipe to grams", flags unmatched lines and
  low-confidence densities, copy/print, and a shareable lz-string-compressed hash link.
- **Programmatic pages** — 110 ingredient hubs (`/{ingredient}/`), 660 amount pages
  (`/{amount}-grams-{ingredient}-to-cups/`, 11 amounts × 60 ingredients), 480 cup-fraction pages
  (`/{fraction}-cup-{ingredient}-in-grams/`, 8 fractions × 60 ingredients) — 1,258 pages total,
  built in ~9s (well under the 3-minute cap). Each has an answer-first sentence, a data table,
  related/nearby links, and a real (non-templated) FAQ. One OG image per ingredient hub
  (`/og/{ingredient}.png`), reused by that ingredient's amount/fraction pages — no per-page OG
  generation, per the spec.
- **Identity** — kitchen-warm/editorial: Fraunces (display, italic h1) + Inter (body), terracotta
  accent (`#a04a26`, tuned for ≥4.5:1 contrast) on a cream ground with a full dark-mode palette,
  a custom measuring-cup favicon/icon set, no template placeholders remaining.
- **Standard pages** — home, about (real methodology: how figures are compiled, why sources
  differ, cup definitions, known limits, last-updated date), `/ingredients/` (full catalogue by
  category), contact, privacy, terms, 404, robots.txt, sitemap, manifest, default OG image.
- **Mission-wide extras** — `MoreTools.astro` copied in and rendered above the footer on the home
  page, recipe scaler, `/ingredients/`, every ingredient hub, and every amount/fraction page.
  `public/cdaf6d28d35c143e38586b7eb7f2a727.txt` holds the IndexNow key verbatim.
- **Tests** — 72 Vitest unit tests (unit conversion round-trips incl. cup-size scaling and
  tbsp/tsp fixed-volume behaviour, recipe parser cases, pan/servings scaling, URL-state
  round-trips, dataset integrity, plus the post-audit-1 regression tests listed above) + 70
  Playwright tests (template smoke/axe/viewport suite across 10 routes, plus dedicated converter
  and recipe-scaler interaction specs covering the "input → result → share link reproduces result"
  and "scaler doubles a 3-line recipe" flows the brief asks for).

## Test results (this session, final run — post audit-1 fixes)

- `npm test` → **Test Files 6 passed (6), Tests 72 passed (72)**
- `MSYS_NO_PATHCONV=1 SITE=https://rouraroble.github.io BASE=/gramcup npm run build` →
  **1258 page(s) built in ~9s**; `[seo] audited 1258 pages · 0 errors · 0 warnings` (the prior
  404-description warning is fixed — see "Fixes after audit 1").
- `MSYS_NO_PATHCONV=1 BASE=/gramcup npm run test:e2e` → **70 passed** (Chromium; axe + 7 viewports
  320–1920 × 10 routes + dedicated tool-interaction specs). Note: a stray `astro preview` process
  left running from the audit (PID 46484, port 4917, locking this product's `dist/`) was stopped
  before the build/e2e runs above; the playwright config starts its own server on a
  package-name-derived port (4400 + hash % 500) so normal runs don't need this.
- `npm run build` (root base) → **1258 page(s) built**; `0 errors, 0 warnings`.

## Known issues

- See "Fixes after audit 1" → "Not fixed" above for the audit-sourced items still open (full
  programmatic-page content remediation, USDA FDC figures for 106 ingredients, sitemap
  `<lastmod>` freshness).
- Ground cinnamon's gram-per-tablespoon figure is a lower-confidence estimate (flagged in its
  `notes` field and on its page) rather than a King Arthur/USDA-measured figure — no equally
  authoritative source was found during this session's research.
- The affiliate "kitchen scale" link is a documented placeholder (`#`) — no partner has been
  selected yet.
- Only one ingredient each for "beans" and "spices" categories (cooked black beans, ground
  cinnamon) — the King Arthur source chart didn't cover these categories, so they're deliberately
  thin rather than filled with invented data.
- The `.result__value` sentence in the converter can wrap awkwardly on very narrow phones for long
  ingredient names in low-magnification screenshots; Playwright's overflow check across
  320–1920px passed, but it hasn't been eyeballed on a physical device.

## Next 5 improvements (ranked by impact)

1. **Expand the dataset toward the spec's ~120+ target** — add more spices, gluten-free flour
   blends, and additional cheeses from further sourced references (more WebFetch/WebSearch
   passes against USDA FDC), each with proper `sources[]` provenance.
2. **Wire a real kitchen-scale affiliate partner** and swap the `#` placeholder — this is a named,
   documented revenue hook that just needs a partner decision.
3. **Add a dedicated print stylesheet** for the recipe scaler's output (currently reuses the page
   layout via `window.print()`) so a printed scaled recipe looks like a recipe card, not a webpage.
4. **Per-ingredient "common substitutions" cross-links** (e.g. butter ↔ oil ↔ applesauce ratios)
   to deepen the ingredient hub pages and add another shareable, answer-first surface.
5. **Full programmatic-page content remediation** — spooned-vs-scooped weight bands, metric/
   imperial rows, and/or noindexing the thinnest amount pages (25/75/125/400 g), beyond the
   measuring-tip/notes addition already made in this pass.

## Files touched

- `src/site.config.ts`, `public/favicon.svg`, `src/styles/{tokens,fonts,identity,tools}.css`
- `src/data/{ingredients.json,top-ingredients.json,SOURCES.md}`
- `src/lib/{units,ingredients,parse-recipe,scale,state,programmatic,seo,measuring-tip}.ts`
- `src/components/{Converter.tsx,Scaler.tsx,MoreTools.astro}`
- `src/pages/{index,about,404,privacy,recipe-scaler/index,ingredients/index,[ingredient]/index,[amount]-grams-[ingredient]-to-cups,[n]-cup-[ingredient]-in-grams,og/[ingredient].png}.astro`
- `tests/unit/{units,parse-recipe,scale,state,ingredients}.test.ts`, `tests/e2e/{converter,scaler}.spec.ts`, `tests/routes.json`

Files touched in the audit-1 fix pass specifically: `src/lib/ingredients.ts`, `src/lib/units.ts`,
`src/lib/parse-recipe.ts`, `src/lib/state.ts`, `src/lib/scale.ts`, `src/lib/seo.ts`, `src/lib/
measuring-tip.ts` (new), `src/data/ingredients.json`, `src/components/Converter.tsx`,
`src/components/Scaler.tsx`, `src/styles/tools.css`, `src/styles/identity.css`,
`src/pages/index.astro`, `src/pages/about.astro`, `src/pages/404.astro`, `src/pages/privacy.astro`,
`src/pages/ingredients/index.astro`, `src/pages/[ingredient]/index.astro`,
`src/pages/[amount]-grams-[ingredient]-to-cups.astro`,
`src/pages/[n]-cup-[ingredient]-in-grams.astro`, `tests/unit/{ingredients,parse-recipe,state,
units,scale}.test.ts`.
- `public/cdaf6d28d35c143e38586b7eb7f2a727.txt`
- `PRODUCT.md`, `STATUS.md` (this file)
