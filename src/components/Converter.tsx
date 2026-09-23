/**
 * The core tool (home page): pick an ingredient, enter an amount, convert between weight and
 * volume units. State lives in the URL query string so results are shareable and reproducible.
 */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { ingredients, searchIngredients, getIngredient } from '../lib/ingredients';
import {
  convert,
  roundForDisplay,
  formatKitchen,
  kitchenValue,
  CUP_SIZES_ML,
  CUP_LABELS,
  UNIT_LABELS,
  unitPhrase,
  isVolumeUnit,
  type Unit,
  type CupKey,
} from '../lib/units';
import { decodeConverterState, encodeConverterState } from '../lib/state';
import { withBase, SITE, BASE } from '../lib/url';
import { measuringTip } from '../lib/measuring-tip';

const UNIT_OPTIONS: Unit[] = ['g', 'kg', 'oz', 'lb', 'cup', 'half-cup', 'tbsp', 'tsp', 'ml', 'floz'];
const QUICK_FRACTIONS: { label: string; value: number }[] = [
  { label: '¼ cup', value: 0.25 },
  { label: '⅓ cup', value: 1 / 3 },
  { label: '½ cup', value: 0.5 },
  { label: '⅔ cup', value: 2 / 3 },
  { label: '¾ cup', value: 0.75 },
  { label: '1 cup', value: 1 },
  { label: '2 cups', value: 2 },
];

export default function Converter() {
  const [ingredientSlug, setIngredientSlug] = useState('all-purpose-flour');
  const [amount, setAmount] = useState(200);
  const [amountText, setAmountText] = useState('200');
  const [fromUnit, setFromUnit] = useState<Unit>('g');
  const [toUnit, setToUnit] = useState<Unit>('cup');
  const [cupKey, setCupKey] = useState<CupKey>('us');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const hydrated = useRef(false);
  const [ready, setReady] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const ingredient = getIngredient(ingredientSlug) ?? ingredients[0];

  // Read state from the URL once, on mount (client-only; the prerendered HTML always shows defaults).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const s = decodeConverterState(window.location.search);
    if (getIngredient(s.i)) setIngredientSlug(s.i);
    // `a=0` is a valid, convertible amount — see the matching fix in decodeConverterState (audit
    // gramcup-audit-3, N5).
    if (Number.isFinite(s.a) && s.a >= 0) {
      setAmount(s.a);
      setAmountText(String(s.a));
    }
    setFromUnit(s.f);
    setToUnit(s.t);
    setCupKey(s.cup);
    hydrated.current = true;
    setReady(true);
  }, []);

  // Keep the URL (and thus share links) in sync without adding history entries.
  useEffect(() => {
    if (typeof window === 'undefined' || !hydrated.current) return;
    const qs = encodeConverterState({ i: ingredientSlug, a: amount, f: fromUnit, t: toUnit, cup: cupKey });
    const url = `${window.location.pathname}?${qs}`;
    window.history.replaceState(null, '', url);
  }, [ingredientSlug, amount, fromUnit, toUnit, cupKey]);

  const results = useMemo(() => (open ? searchIngredients(query, 10) : []), [query, open]);

  const cupMl = CUP_SIZES_ML[cupKey];

  // Validate the *currently typed* text on every render, rather than trusting the last value that
  // passed validation — that mismatch is what let a stale result stick around after typing an
  // invalid amount (e.g. "300" then "-5" still showed the "300" result under a "-5" label).
  const trimmedAmountText = amountText.trim();
  const parsedAmount = Number(trimmedAmountText);
  const amountError =
    trimmedAmountText === ''
      ? 'Enter an amount to convert.'
      : Number.isNaN(parsedAmount)
        ? 'Enter a valid number.'
        : parsedAmount < 0
          ? 'Enter a positive amount.'
          : !Number.isFinite(parsedAmount)
            ? 'That amount is too large to convert.'
            : null;

  const resultValue = useMemo(() => {
    if (!ingredient || amountError) return null;
    return convert(parsedAmount, fromUnit, toUnit, ingredient, cupMl);
  }, [ingredient, amountError, parsedAmount, fromUnit, toUnit, cupMl]);
  // A conversion can be finite yet still absurd for a kitchen tool (e.g. 1e300 tbsp of honey is a
  // finite JS number, so `!Number.isFinite` let it through to raw exponential notation:
  // "2.1000020992188953e+301 grams" — audit gramcup-audit-4, "Scientific notation"). Nothing a real
  // recipe would ever weigh reaches a trillion grams (1,000 tonnes), so treat that as the same
  // "too large to convert" case as a non-finite result.
  const resultTooLarge = resultValue !== null && (!Number.isFinite(resultValue) || Math.abs(resultValue) > 1e12);
  const resultRounded = resultValue !== null ? roundForDisplay(resultValue, toUnit) : 0;
  const resultKitchen = resultValue !== null && isVolumeUnit(toUnit) && (toUnit === 'cup' || toUnit === 'half-cup') ? formatKitchen(resultValue) : null;
  const halfCupEquivalent = resultValue !== null && toUnit === 'half-cup' && Number.isFinite(resultValue) ? formatKitchen(resultValue / 2) : null;
  // Pluralize off the same value the displayed text is built from — the kitchen-snapped figure
  // when a kitchen fraction is shown, otherwise the rounded display figure — never the raw,
  // unrounded result, which is what produced "1 cups" when the text read "1" (audit
  // gramcup-audit-2, P3).
  const resultWord = resultValue === null ? '' : unitPhrase(resultKitchen !== null ? kitchenValue(resultValue) : resultRounded, toUnit);
  const halfCupWord = resultValue !== null ? unitPhrase(kitchenValue(resultValue / 2), 'cup') : 'cups';

  const sourceRange = useMemo(() => {
    const vals = ingredient.sources.map((s) => s.gramsPerCup);
    return { min: Math.min(...vals), max: Math.max(...vals) };
  }, [ingredient]);

  function selectIngredient(slug: string) {
    setIngredientSlug(slug);
    const ing = getIngredient(slug);
    setQuery(ing?.name ?? '');
    setOpen(false);
  }

  function onQueryInput(e: Event) {
    const val = (e.target as HTMLInputElement).value;
    setQuery(val);
    setOpen(true);
    setActiveIndex(0);
  }

  function onQueryKeyDown(e: KeyboardEvent) {
    if (!open) {
      if (e.key === 'ArrowDown') setOpen(true);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const pick = results[activeIndex];
      if (pick) selectIngredient(pick.slug);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  function reverseDirection() {
    setFromUnit(toUnit);
    setToUnit(fromUnit);
    setAmount(resultRounded || 0);
    setAmountText(String(resultRounded || 0));
  }

  async function copyLink() {
    const qs = encodeConverterState({ i: ingredientSlug, a: amount, f: fromUnit, t: toUnit, cup: cupKey });
    const href = `${SITE}${BASE}/?${qs}`;
    try {
      await navigator.clipboard.writeText(href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      /* clipboard unavailable; the URL bar already reflects the state */
    }
  }

  return (
    <div class="converter card" data-hydrated={ready ? 'true' : 'false'}>
      <div class="converter__grid">
        <div class="field combobox-field">
          <label for="ingredient-input">Ingredient</label>
          <div class="combobox">
            <input
              id="ingredient-input"
              ref={inputRef}
              type="text"
              role="combobox"
              aria-expanded={open}
              aria-controls="ingredient-listbox"
              aria-autocomplete="list"
              aria-activedescendant={open && results.length > 0 ? `ingredient-option-${activeIndex}` : undefined}
              autocomplete="off"
              placeholder={ingredient.name}
              value={query}
              onInput={onQueryInput}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 120)}
              onKeyDown={onQueryKeyDown}
            />
            {/* A listbox's only valid children are options (aria-required-children); a status
                message belongs outside it as its own live region, not as a listbox child (axe
                "critical": audit gramcup-audit-3, P2). The listbox itself stays in the DOM, empty,
                so `aria-controls="ingredient-listbox"` on the input keeps pointing at a real
                element instead of dangling. */}
            {open && query.trim() !== '' && results.length === 0 && (
              <ul id="ingredient-listbox" role="listbox" class="combobox__list" hidden></ul>
            )}
            {open && query.trim() !== '' && results.length === 0 && (
              <p role="status" class="combobox__list combobox__empty muted small">
                No matching ingredient
              </p>
            )}
            {open && results.length > 0 && (
              <ul id="ingredient-listbox" role="listbox" tabIndex={-1} class="combobox__list">
                {results.map((r, i) => (
                  <li
                    key={r.slug}
                    id={`ingredient-option-${i}`}
                    role="option"
                    aria-selected={i === activeIndex}
                    class={i === activeIndex ? 'is-active' : ''}
                    onMouseDown={() => selectIngredient(r.slug)}
                  >
                    {r.name}
                    {r.aliases.length > 0 && <span class="muted small"> — {r.aliases[0]}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p class="muted small">
            Currently: <strong>{ingredient.name}</strong>
          </p>
        </div>

        <div class="field">
          <label for="amount-input">Amount</label>
          <input
            id="amount-input"
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={amountText}
            aria-invalid={amountError ? 'true' : 'false'}
            aria-describedby={amountError ? 'amount-error' : undefined}
            onInput={(e) => {
              const v = (e.target as HTMLInputElement).value;
              setAmountText(v);
              const n = Number(v);
              if (v.trim() !== '' && Number.isFinite(n) && n >= 0) setAmount(n);
            }}
          />
        </div>

        <div class="field">
          <label for="from-unit">From</label>
          <select id="from-unit" value={fromUnit} onChange={(e) => setFromUnit((e.target as HTMLSelectElement).value as Unit)}>
            {UNIT_OPTIONS.map((u) => (
              <option value={u}>{UNIT_LABELS[u]}</option>
            ))}
          </select>
        </div>

        <div class="field field--reverse">
          <button type="button" class="btn btn--secondary reverse-btn" onClick={reverseDirection} aria-label="Swap from and to units">
            ⇄ <span class="visually-hidden">Reverse direction</span>
          </button>
        </div>

        <div class="field">
          <label for="to-unit">To</label>
          <select id="to-unit" value={toUnit} onChange={(e) => setToUnit((e.target as HTMLSelectElement).value as Unit)}>
            {UNIT_OPTIONS.map((u) => (
              <option value={u}>{UNIT_LABELS[u]}</option>
            ))}
          </select>
        </div>

        <div class="field">
          <label for="cup-size">Cup definition</label>
          <select id="cup-size" value={cupKey} onChange={(e) => setCupKey((e.target as HTMLSelectElement).value as CupKey)}>
            {(Object.keys(CUP_LABELS) as CupKey[]).map((k) => (
              <option value={k}>{CUP_LABELS[k]}</option>
            ))}
          </select>
        </div>
      </div>

      <div class="result" role="status" aria-live="polite">
        <p class="result__eyebrow">Result</p>
        {amountError ? (
          <p id="amount-error" class="result__value result__value--error">
            {amountError}
          </p>
        ) : resultTooLarge ? (
          <p id="amount-error" class="result__value result__value--error">
            That amount is too large to convert — try a smaller number.
          </p>
        ) : (
          <p class="result__value">
            {trimmedAmountText} {unitPhrase(parsedAmount, fromUnit)} of {ingredient.name.toLowerCase()} ={' '}
            <strong>
              {resultKitchen ?? resultRounded} {resultWord}
              {halfCupEquivalent !== null && ` (${halfCupEquivalent} ${halfCupWord})`}
            </strong>
          </p>
        )}
        {sourceRange.min !== sourceRange.max && (
          <p class="muted small">Sources range: {sourceRange.min}–{sourceRange.max} g per US cup (different labs/brands measure slightly differently).</p>
        )}
        <p class="tip small">
          <strong>Measuring tip:</strong> {measuringTip(ingredient)}
        </p>
        <div class="result__actions">
          <button type="button" class="btn btn--secondary" onClick={copyLink}>
            {copied ? 'Link copied ✓' : 'Copy link'}
          </button>
          <button type="button" class="btn btn--secondary" onClick={() => window.print()}>
            Print
          </button>
          <a class="btn btn--secondary" href={withBase(`/${ingredient.slug}/`)}>
            Full {ingredient.name} chart
          </a>
        </div>
      </div>

      <div class="quick-table">
        {/* h2, not h3: this is the only heading inside the converter island, directly after the
            page's h1 — an h3 here with no intervening h2 skipped a level (Lighthouse
            "heading-order", mission/metrics/gramcup-lh.json). */}
        <h2>Quick reference: {ingredient.name} by cup</h2>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Cups</th>
                <th scope="col">Grams</th>
                <th scope="col">Ounces</th>
              </tr>
            </thead>
            <tbody>
              {QUICK_FRACTIONS.map((f) => {
                const g = convert(f.value, 'cup', 'g', ingredient, cupMl);
                const oz = convert(f.value, 'cup', 'oz', ingredient, cupMl);
                return (
                  <tr>
                    <th scope="row">{f.label}</th>
                    <td>{roundForDisplay(g, 'g')} g</td>
                    <td>{roundForDisplay(oz, 'oz')} oz</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
