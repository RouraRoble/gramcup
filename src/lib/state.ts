/**
 * URL-state encode/decode for the two tools.
 * Converter: plain query params (?i=flour&a=200&f=g&t=cup&cup=us) — short, human-editable, linkable.
 * Recipe scaler: lz-string-compressed JSON in the hash (#s=...) — recipes can be long paragraphs.
 */
// lz-string ships as a single CommonJS `module.exports = LZString` object (no named ESM exports),
// so it must be imported as a default and destructured rather than `import { compressToEncodedURIComponent } from 'lz-string'`.
import LZString from 'lz-string';
const { compressToEncodedURIComponent, decompressFromEncodedURIComponent } = LZString;
import { CUP_SIZES_ML, UNIT_LABELS, type Unit } from './units';
import type { CupKey } from './units';

export interface ConverterState {
  i: string; // ingredient slug
  a: number; // amount
  f: Unit; // from unit
  t: Unit; // to unit
  cup: CupKey;
}

const DEFAULT_STATE: ConverterState = { i: 'all-purpose-flour', a: 200, f: 'g', t: 'cup', cup: 'us' };

/**
 * `Object.hasOwnProperty` (not `in`) on purpose: `in` also matches inherited keys like
 * "constructor" or "toString", so a crafted `?f=constructor` would otherwise pass validation and
 * later crash the converter (`UNIT_LABELS[fromUnit].split` on a function, not a string).
 */
function isValidUnit(v: string | null): v is Unit {
  return !!v && Object.prototype.hasOwnProperty.call(UNIT_LABELS, v);
}
function isValidCupKey(v: string | null): v is CupKey {
  return !!v && Object.prototype.hasOwnProperty.call(CUP_SIZES_ML, v);
}

export function encodeConverterState(state: Partial<ConverterState>): string {
  const s = { ...DEFAULT_STATE, ...state };
  const p = new URLSearchParams();
  p.set('i', s.i);
  p.set('a', String(s.a));
  p.set('f', s.f);
  p.set('t', s.t);
  if (s.cup !== 'us') p.set('cup', s.cup);
  return p.toString();
}

export function decodeConverterState(search: string): ConverterState {
  const p = new URLSearchParams(search);
  const aParam = p.get('a');
  // A missing or empty `a` (no param at all, or `a=`) is genuinely absent and should fall back to
  // the default — but a *present* `a=0` is a legitimate amount (the converter accepts and converts
  // 0). `Number(null)` and `Number('')` are both 0, so without this distinction "no `a` at all"
  // and "`a=0`" were indistinguishable. Map "absent" to NaN so only a real, present number reaches
  // the `>= 0` check below.
  const a = aParam === null || aParam === '' ? NaN : Number(aParam);
  const cup = p.get('cup');
  return {
    i: p.get('i') || DEFAULT_STATE.i,
    // `a=0` is a legitimate amount (the converter accepts and converts 0), not an absent one — it
    // used to fall through to the default 200 and silently rewrite the URL out from under the
    // person who shared it (audit gramcup-audit-3, N5: "?a=0&... loads Amount 200, rewrites the
    // URL to a=200"). Only a genuinely missing/invalid/negative amount should fall back.
    a: Number.isFinite(a) && a >= 0 ? a : DEFAULT_STATE.a,
    f: isValidUnit(p.get('f')) ? (p.get('f') as Unit) : DEFAULT_STATE.f,
    t: isValidUnit(p.get('t')) ? (p.get('t') as Unit) : DEFAULT_STATE.t,
    cup: isValidCupKey(cup) ? (cup as CupKey) : DEFAULT_STATE.cup,
  };
}

export interface ScalerState {
  text: string;
  mode: 'factor' | 'servings' | 'pan';
  factor?: number;
  fromServings?: number;
  toServings?: number;
  panFromShape?: 'round' | 'square' | 'rectangle';
  panFromA?: number;
  panFromB?: number;
  panToShape?: 'round' | 'square' | 'rectangle';
  panToA?: number;
  panToB?: number;
  toGrams?: boolean;
  cup?: CupKey;
}

export function encodeScalerState(state: ScalerState): string {
  return compressToEncodedURIComponent(JSON.stringify(state));
}

const VALID_MODES = new Set(['factor', 'servings', 'pan']);
const VALID_PAN_SHAPES = new Set(['round', 'square', 'rectangle']);

function isPositiveFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0;
}

/**
 * Validates and strips a decoded hash payload field by field, rather than trusting it wholesale
 * (`parsed as ScalerState`). A crafted hash can carry any JSON — a string where a number is
 * expected (`"factor":"2"`, which later crashes `effectiveFactor.toFixed`), or a value like
 * `"cup":"constructor"` that isn't one of the real option keys — so every field is checked before
 * it's allowed through; anything invalid is simply omitted rather than defaulted, so a legitimate
 * partial state (e.g. only `text`/`mode`/`factor` set) still round-trips unchanged.
 */
function sanitizeScalerState(parsed: Record<string, unknown>): ScalerState {
  const out: ScalerState = {
    text: parsed.text as string,
    mode: VALID_MODES.has(parsed.mode as string) ? (parsed.mode as ScalerState['mode']) : 'factor',
  };
  if (isPositiveFiniteNumber(parsed.factor)) out.factor = parsed.factor;
  if (isPositiveFiniteNumber(parsed.fromServings)) out.fromServings = parsed.fromServings;
  if (isPositiveFiniteNumber(parsed.toServings)) out.toServings = parsed.toServings;
  if (VALID_PAN_SHAPES.has(parsed.panFromShape as string)) out.panFromShape = parsed.panFromShape as ScalerState['panFromShape'];
  if (isPositiveFiniteNumber(parsed.panFromA)) out.panFromA = parsed.panFromA;
  if (isPositiveFiniteNumber(parsed.panFromB)) out.panFromB = parsed.panFromB;
  if (VALID_PAN_SHAPES.has(parsed.panToShape as string)) out.panToShape = parsed.panToShape as ScalerState['panToShape'];
  if (isPositiveFiniteNumber(parsed.panToA)) out.panToA = parsed.panToA;
  if (isPositiveFiniteNumber(parsed.panToB)) out.panToB = parsed.panToB;
  if (typeof parsed.toGrams === 'boolean') out.toGrams = parsed.toGrams;
  if (isValidCupKey(parsed.cup as string | null)) out.cup = parsed.cup as CupKey;
  return out;
}

export function decodeScalerState(hash: string): ScalerState | null {
  const raw = hash.replace(/^#/, '');
  if (!raw) return null;
  try {
    const json = decompressFromEncodedURIComponent(raw);
    if (!json) return null;
    const parsed = JSON.parse(json);
    if (typeof parsed !== 'object' || parsed === null || typeof parsed.text !== 'string') return null;
    return sanitizeScalerState(parsed);
  } catch {
    return null;
  }
}
