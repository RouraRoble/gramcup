/**
 * Measuring guidance, shared between the interactive converter and the static programmatic
 * amount/fraction pages (audit gramcup-audit-1, P2: "1,140 programmatic pages are near-identical
 * templates" — this is one source of genuinely differentiated, useful content rather than a purely
 * numeric template). Per-ingredient tips cover at least the top 30 ingredients (audit
 * gramcup-audit-2, P2: a same-category tip reads wrong on some pages — e.g. starch pages said
 * "fluff the flour", and dairy liquids got butter-wrapper advice — because the old version keyed
 * only off `category`, which lumps genuinely different ingredients together). Ingredients outside
 * this list still get a sensible category-level fallback below.
 */
import type { Ingredient } from './ingredients';

const PER_INGREDIENT: Record<string, string> = {
  // Flours
  'all-purpose-flour': 'Spoon & level: fluff the flour in its bag first, spoon it into the cup, then level with a knife. Scooping straight from the bag packs it in and can add 15–20% extra weight.',
  'bread-flour': 'Bread flour packs down more than all-purpose — spoon it lightly into the cup rather than scooping or shaking the cup level, which compresses it.',
  'whole-wheat-flour': "Whole wheat flour's bran flecks stop it settling as densely as white flour, but it still packs if scooped — spoon and level rather than dipping the cup into the bag.",
  'cake-flour': 'Cake flour is finer and packs more than all-purpose flour — always spoon it in and level; scooping can add a noticeably heavy hand to a delicate cake.',
  'almond-flour': "Almond flour clumps easily. Break up lumps with a fork before measuring, then spoon lightly into the cup — pressing it down can add 10%+ extra weight.",
  'coconut-flour': 'Coconut flour is very absorbent and compacts hard in the bag — fluff it with a fork, spoon into the cup, and level. Even a slightly heavy cup can noticeably dry out a batter.',
  'oat-flour': 'Oat flour is light and airy — spoon it into the cup without shaking or tapping the cup, which settles it and adds weight.',
  'self-rising-flour': 'Measure the same way as all-purpose flour: spoon into the cup and level. The baking powder and salt are already mixed through, so there is no need to sift first.',
  // Sugars
  'granulated-sugar': "Granulated sugar doesn't compress much, so scooping and levelling is close enough — but spooning it in is still the more repeatable habit.",
  'brown-sugar': 'Pack it firmly into the cup — press with the back of a spoon — unless a recipe says "lightly packed". It should hold the shape of the cup when turned out onto the counter.',
  'confectioners-sugar': "Confectioners' (powdered) sugar clumps in the bag. Sift it first if a recipe calls for a precise amount, then spoon lightly into the cup without packing.",
  'superfine-sugar': 'Superfine sugar is denser than granulated because the finer grains pack tighter — spoon and level rather than scooping to avoid over-measuring.',
  'turbinado-sugar': 'Turbinado sugar has coarse, syrup-coated crystals that clump — break up any clumps first, then spoon (not pack) it into the cup.',
  // Fats & oils
  butter: 'Use the tablespoon markings printed on the wrapper for whole or partial sticks — they are more accurate than a cup measure. For a loose cup measurement, press firmly into a dry-measure cup and level.',
  'vegetable-oil': 'Measure oil in a liquid measuring cup at eye level, not a dry-measure cup — the meniscus (the curve of the liquid surface) makes a dry cup read low.',
  'olive-oil': 'Use a liquid measuring cup and read it at eye level. Olive oil clings to the sides, so scrape the cup with a spatula to get the last of it into the bowl.',
  'coconut-oil': 'Measure it melted in a liquid measuring cup if the recipe calls for melted oil, or pack it solid into a dry-measure cup and level if the recipe calls for solid — the two give different weights for the same cup line.',
  // Grains
  'rolled-oats': 'Rolled oats are bulky and compress under their own weight — spoon them into the cup without pressing down, then level with the back of a knife.',
  'quick-oats': 'Quick oats are cut smaller than rolled oats and settle more densely — spoon into the cup rather than scooping and shaking it level.',
  'white-rice-dry': 'Dry rice pours evenly, so scoop-and-level is reasonably accurate — but for a precise recipe, spoon it in to avoid the slight extra weight from shaking the cup to settle it.',
  'white-rice-cooked': 'Cooked rice measures loosely, not packed — fluff it with a fork first so trapped air pockets from cooking don\'t make a cup read light.',
  'brown-rice-cooked': 'Like cooked white rice, fluff it with a fork before measuring so the cup isn\'t compacted by clumps from cooking.',
  'quinoa-dry': 'Dry quinoa pours like rice — scoop and level is close enough, since the small, uniform grains settle consistently cup to cup.',
  // Dairy & cheese
  'whole-milk': 'Use a liquid measuring cup and read the level at eye level on a flat surface — a dry-measure cup almost always reads a little short for liquids.',
  buttermilk: 'Measure in a liquid measuring cup at eye level; buttermilk is thicker than milk, so give it a moment to settle before reading the line.',
  'heavy-cream': 'Use a liquid measuring cup at eye level. Cream is thick enough to cling to the sides, so scrape it out with a spatula rather than assuming the cup poured clean.',
  'sour-cream': "Sour cream is thick enough to trap air pockets — press it into the cup with a spatula to settle it, then level the top, rather than just spooning it in loosely.",
  yogurt: 'Press plain yogurt into the cup with the back of a spoon to remove air pockets, then level the top — a loosely spooned cup can read up to 10% light.',
  'cream-cheese': 'Let it soften to room temperature first — cold cream cheese leaves gaps when packed. Press firmly into a dry-measure cup and level.',
  ricotta: 'Ricotta is loose and curdy — spoon it into the cup without pressing, then level gently; packing it down changes the texture it gives baked goods.',
  mascarpone: 'Mascarpone is soft enough to pack like a thick cream cheese — press it into the cup with a spatula to remove air pockets, then level.',
  'shredded-cheddar': 'Shredded cheese is loosely piled in the bag — spoon it into the cup without packing; pressing it down can add 20%+ extra weight for the same cup line.',
  'grated-parmesan': 'Finely grated parmesan settles more than coarser shredded cheese — spoon it in loosely rather than scooping straight from a tub, which compacts it.',
  'crumbled-feta': 'Feta crumbles are irregular in size — spoon them into the cup loosely; pressing them down to level can crush the crumbles and pack in extra weight.',
  'cottage-cheese': 'Spoon cottage cheese into the cup without pressing — it holds a lot of loose curd and whey, and packing it changes both the weight and the texture in the dish.',
  // Syrups
  honey: 'Weigh it if you can — honey clings to cups and spoons and rarely pours out clean. If measuring by volume, lightly oiling the cup first helps it release.',
  'maple-syrup': 'Use a liquid measuring cup at eye level. Like honey, it clings to the sides — a light coat of oil in the cup first helps it pour out completely.',
  'corn-syrup': 'Corn syrup is thicker and stickier than maple syrup — oil the measuring cup lightly first so it releases fully instead of leaving a coating behind.',
  molasses: "Molasses is the thickest of the common syrups and clings the most — oil the cup first, and expect it to take a few extra seconds to fully pour out.",
  'agave-syrup': 'Thinner than honey but still sticky — a liquid measuring cup at eye level works well, and a light oiling of the cup helps it release cleanly.',
  // Chocolate & cocoa
  'cocoa-powder': 'Cocoa powder clumps and compacts in the container — sift or whisk it first, then spoon lightly into the cup rather than scooping, which packs it in.',
  'chocolate-chips': 'Chocolate chips settle into the gaps between each other when the bag is shaken — spoon them into the cup rather than scooping straight from a jostled bag.',
  'chopped-chocolate': 'Chunk size affects how much air is trapped between pieces — a roughly chopped cup and a finely chopped cup of the same chocolate can differ noticeably in weight.',
  'mini-chocolate-chips': 'Mini chips pack more densely than standard chips because the smaller pieces settle into less gap space — spoon, don\'t scoop, for a more consistent cup.',
  'white-chocolate-chips': 'Measure the same way as standard chocolate chips: spoon into the cup rather than scooping, since the chips settle and pack when a bag is shaken or squeezed.',
  // Nuts, nut butter & coconut
  'peanut-butter': 'Press it firmly into a dry-measure cup with the back of a spoon to remove air pockets, then level — a loosely filled cup can read noticeably light.',
  'almond-butter': 'Stir it well first if the oil has separated, then press into a dry-measure cup and level, the same way as peanut butter.',
  'whole-almonds': 'Whole almonds leave more air gaps between nuts than a chopped measure — spoon them into the cup and level without shaking it to settle, which packs more in.',
  'chopped-walnuts': 'How finely they\'re chopped changes how much air is trapped between pieces — a coarsely chopped cup weighs less than a finely chopped cup of the same walnuts.',
  'pecan-halves': 'Pecan halves nest into each other when the cup is shaken — spoon them in loosely and level without tapping the cup on the counter.',
  'sweetened-shredded-coconut': 'Sweetened shredded coconut is moist and can clump — break up clumps with a fork, then spoon loosely into the cup rather than pressing it down.',
  // Leaveners, salt & yeast
  cornstarch: "Cornstarch packs down hard if scooped from the container — spoon it loosely into the cup, then level with a knife; a scooped cup can read 15%+ heavy.",
  'baking-powder': 'Baking powder is dense and fine — spoon it into a measuring spoon and level with a knife rather than dipping the spoon into the tin, which packs it in.',
  'baking-soda': 'Baking soda measures the same way as baking powder — spoon into the measuring spoon and level, rather than scooping directly from the box.',
  'salt-table': 'Fine table salt is denser than flaky or kosher salt — level a measuring spoon with a knife rather than a heaped spoonful, which can more than double the amount.',
  'instant-yeast': 'Spoon instant yeast into a measuring spoon and level it — it is light and fine enough that a "heaped" spoonful can meaningfully change how fast a dough rises.',
  // Miscellaneous
  'panko-breadcrumbs': "Panko is light and airy compared with fine dried breadcrumbs — spoon it into the cup without pressing down, which would crush the flakes and pack in extra weight.",
  raisins: 'Raisins nest into each other when the cup is shaken or packed — spoon them in loosely rather than pressing down, which can add 10%+ extra weight for the same cup line.',
  'chopped-dates': "Chopped dates are sticky and clump together — separate the pieces first so they don't leave large air gaps, then spoon them into the cup without pressing.",
  'dried-cranberries': 'Dried cranberries pack similarly to raisins — spoon them into the cup loosely; pressing them down to level can add noticeable extra weight.',
};

const CATEGORY_FALLBACK: Record<string, string> = {
  flour: 'Spoon & level: fluff the flour, spoon it into the cup, then level with a knife. Scooping straight from the bag packs it in and can add 15–20% extra weight.',
  starch: 'Starches like cornstarch pack down hard if scooped from the container — spoon it loosely into the cup, then level with a knife.',
  sugar: 'Spoon & level for an accurate cup measurement; granulated and powdered sugars settle less than flour, so scooping is closer, but spooning is still more consistent.',
  syrup: 'Measure liquids at eye level in a clear measuring cup, or weigh for the most accurate result — sticky syrups cling to spoons and cups.',
  'fat-oil': 'For solid fats like butter, use the markings on the wrapper or press firmly into a dry-measure cup and level. For liquids, use a liquid measuring cup at eye level.',
  dairy: 'Liquid dairy (milk, cream, buttermilk) needs a liquid measuring cup read at eye level. Thicker dairy (yogurt, sour cream) should be pressed into the cup to remove air pockets, then levelled.',
  cheese: 'Soft and shredded cheeses are loosely piled — spoon into the cup without packing, unless a recipe specifically says "packed".',
  leavener: 'Spoon into a measuring spoon and level with a knife rather than dipping the spoon into the container, which packs it in and can meaningfully change how a recipe rises.',
  salt: 'Level a measuring spoon with a knife rather than using a heaped spoonful — how densely a salt packs varies a lot by grain size and shape.',
  yeast: 'Spoon into a measuring spoon and level it — a heaped spoonful can meaningfully change how fast a dough rises.',
  nut: 'Spoon into the cup and level — nuts vary in size and settle differently depending on how they are chopped, so avoid shaking the cup to pack more in.',
  'nut-butter': 'Press it firmly into a dry-measure cup with the back of a spoon to remove air pockets, then level — a loosely filled cup can read noticeably light.',
  seed: 'Spoon seeds into the cup and level without shaking, which settles them and packs in extra weight.',
  coconut: 'Coconut shreds and flakes are light and can clump — break up clumps, then spoon loosely into the cup rather than pressing it down.',
  chocolate: 'Spoon chocolate chips or chunks into the cup rather than scooping — a shaken or jostled bag settles and packs more into the same cup measure.',
  'dried-fruit': 'Dried fruit pieces nest into each other when packed — spoon them into the cup loosely rather than pressing down, which adds extra weight.',
  breadcrumb: 'Breadcrumb texture (fine, dry or panko-style flakes) changes how much air is trapped — spoon into the cup without pressing down.',
  bean: 'Spoon cooked or canned beans into the cup without pressing — packing them changes both the weight and how much liquid clings to them.',
  spice: 'Spoon into a measuring spoon and level with a knife — ground spices vary in density, so a heaped spoonful can be well over the intended amount.',
  extract: 'Measure liquid extracts in a measuring spoon at eye level; a few drops either way rarely matters, but levelling keeps it consistent.',
  water: 'Use a liquid measuring cup and read it at eye level for the most accurate result.',
};

export function measuringTip(ingredient: Ingredient): string {
  return PER_INGREDIENT[ingredient.slug] ?? CATEGORY_FALLBACK[ingredient.category] ?? 'Spoon the ingredient into the cup and level it off for the most consistent, repeatable measurement.';
}
