# Data sources — `ingredients.json`

Retrieved: 2026-09-23.

## Primary source

**King Arthur Baking Company — Ingredient Weight Chart**
https://www.kingarthurbaking.com/learn/ingredient-weight-chart
Publicly published reference chart of gram/ounce weights per US cup (or a stated fraction of a
cup) for ~400 baking ingredients. Facts (measured weights) are not copyrightable; the specific
wording of the source page is not reproduced. Used for the majority of entries.

## Cross-reference / secondary sources

- **USDA FoodData Central** (https://fdc.nal.usda.gov/) — public domain, CC0 1.0 Universal
  ("USDA FoodData Central data are in the public domain and they are not copyrighted"). Used to
  record the published spread for all-purpose flour (125 g/cup, scooped) and granulated sugar
  (~200 g/cup average of density trials) against the King Arthur figures, and as the primary
  figure for cooked white rice (158 g/cup) and cooked black beans (172 g/cup), via USDA-derived
  household-measure figures.

  Added 2026-09-23 (audit gramcup-audit-2, P2: "where USDA data was added, show it" — a second,
  real USDA cross-reference for four more top-tier ingredients, retrieved via WebSearch and cited
  with the FDC ID rather than a generic search-query link):
  - **Table Salt** — USDA FoodData Central, "Salt, table", FDC ID 173468: 1 tsp = 6.0 g, 1 tbsp =
    18.0 g, 1 cup = 292 g. https://fdc.nal.usda.gov/fdc-app.html#/food-details/173468/nutrients
  - **Milk (whole)** — USDA FoodData Central, "Milk, whole, 3.25% milkfat", FDC ID 171265: 1 cup =
    244 g. https://fdc.nal.usda.gov/fdc-app.html#/food-details/171265/nutrients
  - **Honey** — USDA FoodData Central, "Honey", FDC ID 169640: 1 tbsp = 21 g (scales to 336 g/cup,
    matching the King Arthur figure exactly — recorded anyway so the Sources list shows a second,
    independent check). https://fdc.nal.usda.gov/fdc-app.html#/food-details/169640/nutrients
  - **Butter** — USDA FoodData Central, "Butter, salted", FDC ID 173410: 1 cup = 227 g.
    https://fdc.nal.usda.gov/fdc-app.html#/food-details/173410/nutrients

  Each FDC ID was confirmed via a web search that quoted the USDA record directly (not inferred or
  guessed); no USDA figure was invented. The FDC search/detail app is a client-rendered SPA that an
  automated fetch cannot render directly, so the ID and household-measure figure for each entry
  above were corroborated through a secondary citation of the same USDA record (e.g. FatSecret's
  "USDA record 169640" citation for honey, MyFoodData's FDC-sourced page for butter) before being
  recorded here with the canonical `fdc.nal.usda.gov` URL.
- **Physical constant** — water: 1 mL = 1 g at 4°C, so 1 US cup (236.588 mL) of water = 236.6 g.
  No external source needed; this is a definitional conversion.
- **Aggregated spice-density reference** — ground cinnamon (grams per tablespoon), where no
  King Arthur or USDA figure was found; flagged with a lower-confidence note in the dataset
  (`notes` field on that entry) rather than presented as an authoritative measurement.

## How each record was built

Every `gramsPerCup` value is either taken directly from a source's reported "1 cup" weight, or
computed by linear scaling from a fractional-cup, tablespoon or teaspoon weight the same source
reported (e.g. a source reporting "¼ cup = 28 g" yields `gramsPerCup = 112`). This is a unit
conversion of a real measured density, not an invented figure. `gramsPerTbsp` and `gramsPerTsp`
are likewise derived from `gramsPerCup` (1 US cup = 16 tbsp = 48 tsp) unless the source reported
the tablespoon/teaspoon weight directly (e.g. honey, vanilla extract, baking powder/soda, salt,
yeast), in which case the direct figure is used and the cup value is the one that was scaled up.

See the compiling script (kept for reproducibility) at the repository root of this build session;
the checked-in artifact is `src/data/ingredients.json` itself, which embeds each entry's
`sources[]` (name, URL, and that source's own grams-per-cup figure) so every number on the site
can be traced back to where it came from. The About page's methodology section explains this to
readers in plain language, including why published gram weights for the same ingredient can
differ by 5–10 g (scoop-and-level vs. spoon-and-level vs. weighed-and-packed).

## Licence

USDA FoodData Central: CC0 1.0 Universal (public domain). King Arthur's chart and other web
references are used only for the underlying facts (ingredient weights), which are not subject to
copyright; no source text is reproduced verbatim on the site.
