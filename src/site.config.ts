/**
 * Product-level configuration. Every product edits this file.
 * Keep values honest: they end up in metadata, structured data and legal pages.
 */
export const site = {
  name: 'GramCup',
  slug: 'gramcup',
  tagline: 'Grams, cups and tablespoons — for the ingredient you actually have.',
  description: 'Convert grams to cups (and back) by ingredient, with sources shown. Plus a recipe scaler that converts and resizes a whole ingredient list at once.',
  locale: 'en',
  ogLocale: 'en_US',
  themeColor: '#f6efe2',
  backgroundColor: '#f6efe2',
  accent: '#a04a26',
  author: { name: 'RouraRoble', url: 'https://github.com/RouraRoble' },
  contactEmail: 'roura.roble@gmail.com',
  launched: '2026-09-23',
  // The date the ingredient dataset (src/data/ingredients.json) was last verified/changed. Shown
  // on every programmatic page as a visible "Data updated" line and used as dateModified in each
  // page's JSON-LD — freshness is a documented AI-citation factor (mission/POST_MVP_PLAN.md).
  dataUpdated: '2026-09-23',
  category: 'UtilitiesApplication', // schema.org SoftwareApplication applicationCategory
  keywords: ['grams to cups', 'cups to grams', 'cup to gram calculator', 'recipe converter', 'recipe scaler'] as string[],
  social: { twitter: '' },
  // US customary cup by definition (236.588 mL); other cup definitions live in src/lib/units.ts.
  usCupMl: 236.588,
  // Monetization / analytics hooks (all optional, env-driven at build time)
  adsenseClient: import.meta.env.PUBLIC_ADSENSE_CLIENT || '',
  beaconUrl: import.meta.env.PUBLIC_BEACON_URL || '',
  plausibleDomain: import.meta.env.PUBLIC_PLAUSIBLE_DOMAIN || '',
  // Affiliate hooks (placeholder partner — documented in PRODUCT.md). Leave url '#' until a partner is chosen.
  affiliate: {
    kitchenScale: {
      label: 'Skip the guesswork: a digital kitchen scale',
      url: '#',
      rel: 'sponsored noopener',
    },
  },
};
export type SiteConfig = typeof site;
