import { describe, expect, it } from 'vitest';
import { decodeConverterState, encodeConverterState, decodeScalerState, encodeScalerState } from '../../src/lib/state';

describe('converter URL state', () => {
  it('round-trips through encode/decode', () => {
    const s = { i: 'granulated-sugar', a: 250, f: 'g' as const, t: 'cup' as const, cup: 'metric' as const };
    const qs = encodeConverterState(s);
    const back = decodeConverterState('?' + qs);
    expect(back).toEqual(s);
  });

  it('omits the cup param when it is the default (us)', () => {
    const qs = encodeConverterState({ i: 'flour', a: 1, f: 'g', t: 'cup', cup: 'us' });
    expect(qs).not.toContain('cup=');
  });

  it('falls back to sane defaults for missing/invalid params', () => {
    const back = decodeConverterState('?i=flour');
    expect(back.a).toBeGreaterThan(0);
    expect(back.f).toBe('g');
    expect(back.cup).toBe('us');
  });

  // Regression test for audit gramcup-audit-1, P1 finding #4: a malformed/unknown unit must fall
  // back to the default instead of reaching the converter and crashing it.
  it('falls back to defaults for junk or unknown f/t/cup values, never passing them through', () => {
    const back = decodeConverterState('?i=flour&f=foo&t=constructor&cup=constructor');
    expect(back.f).toBe('g');
    expect(back.t).toBe('cup');
    expect(back.cup).toBe('us');
  });

  it('is not fooled by "constructor"/"toString", which are `in` an object but not its own keys', () => {
    const back = decodeConverterState('?i=flour&f=toString&t=hasOwnProperty');
    expect(back.f).toBe('g');
    expect(back.t).toBe('cup');
  });

  // Regression test for audit gramcup-audit-3, N5: `a=0` is a real, present amount (the converter
  // accepts and converts 0) and must round-trip as 0, not silently become the 200 default.
  it('"a=0" is a legitimate present amount and round-trips as 0, not the default', () => {
    const back = decodeConverterState('?i=flour&a=0');
    expect(back.a).toBe(0);
    const qs = encodeConverterState(back);
    expect(qs).toContain('a=0');
  });

  it('still falls back to the default when `a` is missing or empty, not 0', () => {
    expect(decodeConverterState('?i=flour').a).toBe(200);
    expect(decodeConverterState('?i=flour&a=').a).toBe(200);
  });

  it('still falls back to the default for a negative amount', () => {
    expect(decodeConverterState('?i=flour&a=-5').a).toBe(200);
  });
});

describe('recipe scaler hash state', () => {
  it('round-trips a recipe through lz-string compression', () => {
    const state = { text: '2 cups flour\n1 cup sugar', mode: 'factor' as const, factor: 2 };
    const hash = encodeScalerState(state);
    const back = decodeScalerState('#' + hash);
    expect(back).toEqual(state);
  });

  it('returns null for an empty or invalid hash', () => {
    expect(decodeScalerState('')).toBeNull();
    expect(decodeScalerState('#not-valid-lz-string!!')).toBeNull();
  });

  // Regression test for audit gramcup-audit-1, P3 finding "crafted scaler hash crashes the
  // island": a crafted hash with the right shape but wrong field types/values (a string where a
  // number belongs, an unknown enum key) must be sanitized instead of trusted verbatim.
  it('sanitizes a crafted hash with wrong-typed or unknown fields instead of passing them through', () => {
    const hash = encodeScalerState({ text: '1 cup flour', mode: 'factor', factor: '2' as unknown as number, cup: 'constructor' as unknown as 'us' });
    const back = decodeScalerState('#' + hash);
    expect(back).not.toBeNull();
    expect(back!.text).toBe('1 cup flour');
    expect(back!.mode).toBe('factor');
    // the bogus string factor must be dropped, not passed through as a non-number
    expect(back!.factor).toBeUndefined();
    expect(back!.cup).toBeUndefined();
  });

  it('falls back to "factor" mode for an unknown mode value', () => {
    const hash = encodeScalerState({ text: 'x', mode: 'bogus' as unknown as 'factor' });
    const back = decodeScalerState('#' + hash);
    expect(back!.mode).toBe('factor');
  });
});
