/**
 * Recipe scaler (/recipe-scaler/): paste a recipe, scale it by factor / servings / pan size,
 * optionally convert every matched line to grams. State round-trips through the URL hash
 * (lz-string) so a share link reproduces the exact scaled recipe.
 */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { parseRecipe, type ParsedLine } from '../lib/parse-recipe';
import { factorFromPans, factorFromServings, scaleRecipe, type PanShape, type ScaledLine } from '../lib/scale';
import { CUP_LABELS, roundForDisplay, unitPhrase, type CupKey, type Unit } from '../lib/units';
import { decodeScalerState, encodeScalerState, type ScalerState } from '../lib/state';
import { SITE, BASE } from '../lib/url';

type Mode = 'factor' | 'servings' | 'pan';

// Parsing, scaling and re-rendering are all O(lines); an unbounded paste (the audit tried 5,000
// lines) blocks the main thread for tens of seconds and balloons the shareable URL hash. A real
// recipe is at most a few dozen lines, so a generous cap keeps the tool responsive without
// affecting normal use (audit gramcup-audit-1, P3: "Large paste freezes the page").
const MAX_RECIPE_LINES = 300;

const EXAMPLE = `2 cups all-purpose flour
1 cup granulated sugar
1/2 cup butter, softened
2 large eggs
1 tsp vanilla extract
3/4 cup milk
1 1/2 tsp baking powder
1/4 tsp salt`;

const FACTOR_PRESETS: { label: string; value: number }[] = [
  { label: '½×', value: 0.5 },
  { label: '1×', value: 1 },
  { label: '1½×', value: 1.5 },
  { label: '2×', value: 2 },
  { label: '3×', value: 3 },
];

/** Singular for exactly 1 of a non-range unit ("1 cup"), plural otherwise ("2 cups", "2-3 cups"). */
function unitLabel(u: Unit | null, amount: number | null, isRange: boolean): string {
  if (!u) return '';
  return unitPhrase(isRange ? 2 : (amount ?? 2), u);
}

export default function Scaler() {
  const [text, setText] = useState(EXAMPLE);
  const [mode, setMode] = useState<Mode>('factor');
  const [factor, setFactor] = useState(2);
  const [fromServings, setFromServings] = useState(4);
  const [toServings, setToServings] = useState(8);
  const [panFromShape, setPanFromShape] = useState<PanShape>('round');
  const [panFromA, setPanFromA] = useState(20);
  const [panFromB, setPanFromB] = useState(20);
  const [panToShape, setPanToShape] = useState<PanShape>('round');
  const [panToA, setPanToA] = useState(23);
  const [panToB, setPanToB] = useState(23);
  const [convertToGrams, setConvertToGrams] = useState(false);
  const [cupKey, setCupKey] = useState<CupKey>('us');
  const [copied, setCopied] = useState(false);
  const [ready, setReady] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const hydrated = useRef(false);

  function updateText(value: string) {
    const lines = value.split(/\r?\n/);
    if (lines.length > MAX_RECIPE_LINES) {
      setText(lines.slice(0, MAX_RECIPE_LINES).join('\n'));
      setTruncated(true);
    } else {
      setText(value);
      setTruncated(false);
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const s = decodeScalerState(window.location.hash);
    if (s) {
      updateText(s.text);
      setMode(s.mode);
      if (s.factor) setFactor(s.factor);
      if (s.fromServings) setFromServings(s.fromServings);
      if (s.toServings) setToServings(s.toServings);
      if (s.panFromShape) setPanFromShape(s.panFromShape);
      if (s.panFromA) setPanFromA(s.panFromA);
      if (s.panFromB) setPanFromB(s.panFromB);
      if (s.panToShape) setPanToShape(s.panToShape);
      if (s.panToA) setPanToA(s.panToA);
      if (s.panToB) setPanToB(s.panToB);
      if (typeof s.toGrams === 'boolean') setConvertToGrams(s.toGrams);
      if (s.cup) setCupKey(s.cup);
    }
    hydrated.current = true;
    setReady(true);
  }, []);

  const effectiveFactor = useMemo(() => {
    if (mode === 'factor') return factor;
    if (mode === 'servings') return factorFromServings(fromServings, toServings);
    return factorFromPans({ shape: panFromShape, a: panFromA, b: panFromB }, { shape: panToShape, a: panToA, b: panToB });
  }, [mode, factor, fromServings, toServings, panFromShape, panFromA, panFromB, panToShape, panToA, panToB]);

  useEffect(() => {
    if (typeof window === 'undefined' || !hydrated.current) return;
    const state: ScalerState = {
      text,
      mode,
      factor,
      fromServings,
      toServings,
      panFromShape,
      panFromA,
      panFromB,
      panToShape,
      panToA,
      panToB,
      toGrams: convertToGrams,
      cup: cupKey,
    };
    const hash = encodeScalerState(state);
    window.history.replaceState(null, '', `${window.location.pathname}#${hash}`);
  }, [text, mode, factor, fromServings, toServings, panFromShape, panFromA, panFromB, panToShape, panToA, panToB, convertToGrams, cupKey]);

  const parsed: ParsedLine[] = useMemo(() => parseRecipe(text), [text]);
  const scaled: ScaledLine[] = useMemo(() => scaleRecipe(parsed, effectiveFactor, cupKey), [parsed, effectiveFactor, cupKey]);

  function lineText(s: ScaledLine): string {
    if (!s.line.quantity) return s.line.raw;
    const qtyPart = s.display;
    const unitPart = unitLabel(s.line.unit, s.scaledValue, s.line.quantity.isRange);
    const showGrams = convertToGrams && s.grams != null;
    const gramsPart =
      s.line.quantity.isRange && s.gramsMin != null && s.gramsMax != null
        ? `${roundForDisplay(s.gramsMin, 'g')}–${roundForDisplay(s.gramsMax, 'g')} g`
        : `${roundForDisplay(s.grams as number, 'g')} g`;
    const amountPart = showGrams ? gramsPart : [qtyPart, unitPart].filter(Boolean).join(' ');
    return [amountPart, s.line.ingredientText].filter(Boolean).join(' ');
  }

  const outputText = useMemo(() => scaled.map(lineText).join('\n'), [scaled, convertToGrams]);

  async function copyRecipe() {
    try {
      await navigator.clipboard.writeText(outputText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      /* clipboard unavailable */
    }
  }

  async function copyShareLink() {
    const state: ScalerState = { text, mode, factor, fromServings, toServings, panFromShape, panFromA, panFromB, panToShape, panToA, panToB, toGrams: convertToGrams, cup: cupKey };
    const hash = encodeScalerState(state);
    try {
      await navigator.clipboard.writeText(`${SITE}${BASE}/recipe-scaler/#${hash}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div class="scaler" data-hydrated={ready ? 'true' : 'false'}>
      <div class="scaler__input card">
        <label for="recipe-text">Paste your recipe (one ingredient per line)</label>
        <textarea
          id="recipe-text"
          rows={10}
          value={text}
          aria-describedby={truncated ? 'recipe-text-truncated' : undefined}
          onInput={(e) => updateText((e.target as HTMLTextAreaElement).value)}
        />
        {truncated && (
          <p id="recipe-text-truncated" class="muted small" role="status">
            Only the first {MAX_RECIPE_LINES} lines are scaled — trim the recipe to shorten it.
          </p>
        )}
      </div>

      <div class="scaler__controls card">
        <fieldset>
          <legend>Scale by</legend>
          <div class="mode-tabs" role="tablist" aria-label="Scale by">
            {(['factor', 'servings', 'pan'] as Mode[]).map((m) => (
              <button type="button" role="tab" aria-selected={mode === m} class={`mode-tab ${mode === m ? 'is-active' : ''}`} onClick={() => setMode(m)}>
                {m === 'factor' ? 'Factor' : m === 'servings' ? 'Servings' : 'Pan size'}
              </button>
            ))}
          </div>
        </fieldset>

        {mode === 'factor' && (
          <div class="field-row">
            {FACTOR_PRESETS.map((p) => (
              <button type="button" class={`btn btn--secondary chip ${factor === p.value ? 'is-active' : ''}`} onClick={() => setFactor(p.value)}>
                {p.label}
              </button>
            ))}
            <div class="field field--inline">
              <label for="custom-factor">Custom</label>
              <input id="custom-factor" type="number" min="0.1" step="0.1" value={factor} onInput={(e) => setFactor(Number((e.target as HTMLInputElement).value) || 1)} />
            </div>
          </div>
        )}

        {mode === 'servings' && (
          <div class="field-row">
            <div class="field field--inline">
              <label for="from-servings">From servings</label>
              <input id="from-servings" type="number" min="1" step="1" value={fromServings} onInput={(e) => setFromServings(Number((e.target as HTMLInputElement).value) || 1)} />
            </div>
            <div class="field field--inline">
              <label for="to-servings">To servings</label>
              <input id="to-servings" type="number" min="1" step="1" value={toServings} onInput={(e) => setToServings(Number((e.target as HTMLInputElement).value) || 1)} />
            </div>
          </div>
        )}

        {mode === 'pan' && (
          <div class="pan-grid">
            <div class="pan-col">
              <p class="eyebrow">Current pan</p>
              <div class="field">
                <label for="pan-from-shape">Shape</label>
                <select id="pan-from-shape" value={panFromShape} onChange={(e) => setPanFromShape((e.target as HTMLSelectElement).value as PanShape)}>
                  <option value="round">Round</option>
                  <option value="square">Square</option>
                  <option value="rectangle">Rectangular</option>
                </select>
              </div>
              <div class="field-row">
                <div class="field field--inline">
                  <label for="pan-from-a">{panFromShape === 'round' ? 'Diameter (cm)' : panFromShape === 'square' ? 'Side (cm)' : 'Length (cm)'}</label>
                  <input id="pan-from-a" type="number" min="1" step="0.5" value={panFromA} onInput={(e) => setPanFromA(Number((e.target as HTMLInputElement).value) || 1)} />
                </div>
                {panFromShape === 'rectangle' && (
                  <div class="field field--inline">
                    <label for="pan-from-b">Width (cm)</label>
                    <input id="pan-from-b" type="number" min="1" step="0.5" value={panFromB} onInput={(e) => setPanFromB(Number((e.target as HTMLInputElement).value) || 1)} />
                  </div>
                )}
              </div>
            </div>
            <div class="pan-col">
              <p class="eyebrow">New pan</p>
              <div class="field">
                <label for="pan-to-shape">Shape</label>
                <select id="pan-to-shape" value={panToShape} onChange={(e) => setPanToShape((e.target as HTMLSelectElement).value as PanShape)}>
                  <option value="round">Round</option>
                  <option value="square">Square</option>
                  <option value="rectangle">Rectangular</option>
                </select>
              </div>
              <div class="field-row">
                <div class="field field--inline">
                  <label for="pan-to-a">{panToShape === 'round' ? 'Diameter (cm)' : panToShape === 'square' ? 'Side (cm)' : 'Length (cm)'}</label>
                  <input id="pan-to-a" type="number" min="1" step="0.5" value={panToA} onInput={(e) => setPanToA(Number((e.target as HTMLInputElement).value) || 1)} />
                </div>
                {panToShape === 'rectangle' && (
                  <div class="field field--inline">
                    <label for="pan-to-b">Width (cm)</label>
                    <input id="pan-to-b" type="number" min="1" step="0.5" value={panToB} onInput={(e) => setPanToB(Number((e.target as HTMLInputElement).value) || 1)} />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <p class="muted small">
          Scale factor: <strong>{effectiveFactor.toFixed(2)}×</strong>
          {mode === 'pan' && ` (area ratio of the two pans)`}
        </p>

        <div class="field-row scaler__toggles">
          <label class="checkbox-field">
            <input type="checkbox" checked={convertToGrams} onChange={(e) => setConvertToGrams((e.target as HTMLInputElement).checked)} />
            Convert entire recipe to grams
          </label>
          <div class="field field--inline">
            <label for="scaler-cup-size">Cup definition</label>
            <select id="scaler-cup-size" value={cupKey} onChange={(e) => setCupKey((e.target as HTMLSelectElement).value as CupKey)}>
              {(Object.keys(CUP_LABELS) as CupKey[]).map((k) => (
                <option value={k}>{CUP_LABELS[k]}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div class="scaler__output card" aria-live="polite">
        <h2>Scaled recipe</h2>
        {scaled.length === 0 ? (
          <p class="muted">Paste a recipe above to see it scaled here.</p>
        ) : (
          <ul class="scaled-list">
            {scaled.map((s) => (
              <li class={s.uncertain ? 'is-uncertain' : ''}>
                <span class="scaled-list__amount">{lineText(s) || s.line.raw}</span>
                {/* Only mention gram conversion/ingredient recognition when the person actually
                    asked for a gram conversion — otherwise every unmatched or unit-less line (e.g.
                    "2 eggs") showed a notice about a conversion that was never requested (audit
                    gramcup-audit-4, B4). */}
                {convertToGrams && !s.line.ingredient && s.line.unit && (
                  <span class="muted small"> — not converted (ingredient not recognized); scaled by quantity only</span>
                )}
                {convertToGrams && s.line.ingredient && !s.line.unit && <span class="muted small"> — no unit given; scaled by quantity only</span>}
                {s.uncertain && <span class="muted small"> — density is an estimate for this ingredient, treat the gram figure as approximate</span>}
              </li>
            ))}
          </ul>
        )}
        <div class="result__actions">
          <button type="button" class="btn btn--secondary" onClick={copyRecipe} disabled={scaled.length === 0}>
            {copied ? 'Copied ✓' : 'Copy scaled recipe'}
          </button>
          <button type="button" class="btn btn--secondary" onClick={() => window.print()} disabled={scaled.length === 0}>
            Print
          </button>
          <button type="button" class="btn btn--secondary" onClick={copyShareLink}>
            Copy share link
          </button>
        </div>
      </div>
    </div>
  );
}
