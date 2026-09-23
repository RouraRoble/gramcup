/**
 * Parses pasted recipe ingredient lines into structured quantity + unit + ingredient-text.
 * Handles unicode fractions (½ ¾ ⅓ …), mixed numbers ("1 1/2"), ranges ("2-3", "2 to 3"),
 * decimals, plain integers, and unit abbreviations/plurals. Ingredient text is matched against
 * the dataset via `matchIngredient`; unmatched text is kept so the line can still be scaled
 * numerically without a density conversion.
 */
import { matchIngredient, type Ingredient } from './ingredients';
import type { Unit } from './units';

const UNICODE_FRACTIONS: Record<string, number> = {
  '¼': 1 / 4,
  '½': 1 / 2,
  '¾': 3 / 4,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
  '⅕': 1 / 5,
  '⅖': 2 / 5,
  '⅗': 3 / 5,
  '⅘': 4 / 5,
  '⅙': 1 / 6,
  '⅚': 5 / 6,
  '⅛': 1 / 8,
  '⅜': 3 / 8,
  '⅝': 5 / 8,
  '⅞': 7 / 8,
};
const FRACTION_CHARS = Object.keys(UNICODE_FRACTIONS).join('');

export interface ParsedQuantity {
  value: number; // midpoint for a range, else the exact value
  min: number;
  max: number;
  isRange: boolean;
  display: string; // original quantity text, verbatim
}

/** Parses one leading numeric quantity (int, decimal, ascii fraction or unicode fraction, optionally mixed). */
function parseOneQuantity(s: string): { value: number; text: string; rest: string } | null {
  const str = s.trimStart();
  const lead = s.length - str.length;
  // integer + ascii fraction, e.g. "1 1/2" or "1-1/2"
  let m = str.match(/^(\d+)[\s-]+(\d+)\/(\d+)/);
  if (m) {
    if (Number(m[3]) === 0) return null; // "1 2/0" — a zero denominator is not a real quantity
    const value = Number(m[1]) + Number(m[2]) / Number(m[3]);
    return { value, text: m[0], rest: s.slice(lead + m[0].length) };
  }
  // integer + unicode fraction, e.g. "1½" or "1 ½"
  m = str.match(new RegExp(`^(\\d+)\\s*([${FRACTION_CHARS}])`));
  if (m) {
    const value = Number(m[1]) + UNICODE_FRACTIONS[m[2]];
    return { value, text: m[0], rest: s.slice(lead + m[0].length) };
  }
  // ascii fraction alone, e.g. "3/4"
  m = str.match(/^(\d+)\/(\d+)/);
  if (m) {
    if (Number(m[2]) === 0) return null; // "1/0" — a zero denominator is not a real quantity
    const value = Number(m[1]) / Number(m[2]);
    return { value, text: m[0], rest: s.slice(lead + m[0].length) };
  }
  // unicode fraction alone
  m = str.match(new RegExp(`^([${FRACTION_CHARS}])`));
  if (m) {
    const value = UNICODE_FRACTIONS[m[1]];
    return { value, text: m[0], rest: s.slice(lead + m[0].length) };
  }
  // decimal or integer
  m = str.match(/^(\d+(?:\.\d+)?)/);
  if (m) {
    return { value: Number(m[1]), text: m[0], rest: s.slice(lead + m[0].length) };
  }
  return null;
}

/** Parses a leading quantity, possibly a range ("2-3", "2 to 3", "1½-2"). Returns null if no quantity found. */
export function parseQuantity(input: string): { qty: ParsedQuantity; rest: string } | null {
  const first = parseOneQuantity(input);
  if (!first) return null;
  const afterFirst = first.rest;
  const rangeMatch = afterFirst.match(/^\s*(?:-|to|–|—)\s*/i);
  if (rangeMatch) {
    const second = parseOneQuantity(afterFirst.slice(rangeMatch[0].length));
    if (second) {
      const min = Math.min(first.value, second.value);
      const max = Math.max(first.value, second.value);
      return {
        qty: { value: (min + max) / 2, min, max, isRange: true, display: `${first.text}${rangeMatch[0]}${second.text}`.trim() },
        rest: second.rest,
      };
    }
  }
  return { qty: { value: first.value, min: first.value, max: first.value, isRange: false, display: first.text.trim() }, rest: afterFirst };
}

const UNIT_PATTERNS: [RegExp, Unit][] = [
  [/^(kilograms?|kgs?)\b\.?/i, 'kg'],
  [/^(grams?|gr|g)\b\.?/i, 'g'],
  [/^(pounds?|lbs?)\b\.?/i, 'lb'],
  [/^(ounces?|oz)\b\.?/i, 'oz'],
  [/^(fluid\s*ounces?|fl\.?\s*oz\.?)\b/i, 'floz'],
  [/^(millilit(?:er|re)s?|ml)\b\.?/i, 'ml'],
  [/^(tablespoons?|tbsps?|tbl\.?|tbs\.?)\b\.?/i, 'tbsp'],
  [/^(teaspoons?|tsps?)\b\.?/i, 'tsp'],
  [/^(cups?|c)\b\.?/i, 'cup'],
  // Bare "T"/"t" abbreviations (case-sensitive: capital T = tablespoon, lowercase t = teaspoon),
  // e.g. "1 T olive oil" or "1/2 t vanilla". Matched last so full words above take priority.
  [/^T\b\.?/, 'tbsp'],
  [/^t\b\.?/, 'tsp'],
];

function parseUnit(input: string): { unit: Unit; raw: string; rest: string } | null {
  const str = input.trimStart();
  const lead = input.length - str.length;
  for (const [re, unit] of UNIT_PATTERNS) {
    const m = str.match(re);
    if (m) return { unit, raw: m[0], rest: input.slice(lead + m[0].length) };
  }
  return null;
}

export interface ParsedLine {
  raw: string;
  quantity: ParsedQuantity | null;
  unit: Unit | null;
  unitRaw: string | null;
  ingredientText: string;
  ingredient: Ingredient | undefined;
}

/** Strips a leading bullet/list marker ("- ", "* ", "1. ", "•") some pasted recipes include. */
function stripBullet(line: string): string {
  return line.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '');
}

export function parseLine(line: string): ParsedLine {
  const raw = line;
  const cleaned = stripBullet(line.trim());
  const q = parseQuantity(cleaned);
  let rest = cleaned;
  let quantity: ParsedQuantity | null = null;
  if (q) {
    quantity = q.qty;
    rest = q.rest;
  }
  const u = parseUnit(rest);
  let unit: Unit | null = null;
  let unitRaw: string | null = null;
  if (u) {
    unit = u.unit;
    unitRaw = u.raw;
    rest = u.rest;
  }
  // "of" between unit and ingredient, e.g. "2 cups of flour"
  rest = rest.replace(/^\s*of\s+/i, '');
  // trailing parenthetical / comma notes are kept as part of ingredient text for display,
  // but matching uses the text before the first comma for better alias hits.
  const ingredientText = rest.trim().replace(/^[,;\s]+/, '');
  let matchText = ingredientText.split(',')[0].trim();
  // A leading parenthetical that itself starts with a number ("(1 stick) butter", "(8 oz) cream
  // cheese") is a secondary measurement note, not a description of which ingredient is meant —
  // unlike a trailing, non-numeric parenthetical ("Kosher Salt (Diamond Crystal)"), which
  // disambiguates *which* ingredient and must stay in the matched text. Only a *leading* numeric
  // parenthetical is stripped, so brand disambiguation elsewhere in the line is unaffected (audit
  // gramcup-audit-3, P1).
  matchText = matchText.replace(new RegExp(`^\\([^)]*[0-9${FRACTION_CHARS}][^)]*\\)\\s*`), '').trim();
  const ingredient = matchText.length > 1 ? matchIngredient(matchText) : undefined;
  return { raw, quantity, unit, unitRaw, ingredientText, ingredient };
}

/** Parses a full pasted recipe (one ingredient per line) into structured lines, skipping blanks. */
export function parseRecipe(text: string): ParsedLine[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map(parseLine);
}
