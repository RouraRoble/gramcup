import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const BASE = ('/' + (process.env.BASE || '').replace(/^[\/]+|[\/]+$/g, '')).replace(/\/$/, '');
const HYDRATED = '.converter[data-hydrated="true"]';

test.describe('Converter (home page)', () => {
  test('default state converts 200 g flour to about 1⅔ cups', async ({ page }) => {
    await page.goto(BASE + '/');
    const result = page.locator('.result__value');
    await expect(result).toContainText('cup');
    await expect(result).toContainText('⅔');
  });

  test('URL state updates as the amount changes, and a share link reproduces the same result', async ({ page }) => {
    await page.goto(BASE + '/');
    await page.waitForSelector(HYDRATED);
    await page.fill('#amount-input', '300');
    await expect(page).toHaveURL(/a=300/);
    const firstResult = (await page.locator('.result__value').textContent())?.trim();

    // Open the state-carrying URL fresh (simulating a shared link) and confirm the same result renders.
    const url = page.url();
    await page.goto('about:blank');
    await page.goto(url);
    await page.waitForSelector(HYDRATED);
    await expect(page.locator('.result__value')).toContainText('300');
    const secondResult = (await page.locator('.result__value').textContent())?.trim();
    expect(secondResult).toBe(firstResult);
  });

  test('reverse direction swaps the from/to units', async ({ page }) => {
    await page.goto(BASE + '/?i=all-purpose-flour&a=200&f=g&t=cup');
    await page.waitForSelector(HYDRATED);
    await expect(page.locator('#from-unit')).toHaveValue('g');
    await page.click('.reverse-btn');
    await expect(page.locator('#from-unit')).toHaveValue('cup');
    await expect(page.locator('#to-unit')).toHaveValue('g');
  });

  test('picking an ingredient from the combobox updates the result', async ({ page }) => {
    await page.goto(BASE + '/?i=all-purpose-flour&a=1&f=cup&t=g');
    await page.waitForSelector(HYDRATED);
    await expect(page.locator('.result__value')).toContainText('120');
    await page.fill('#ingredient-input', 'honey');
    await page.locator('#ingredient-listbox li', { hasText: 'Honey' }).first().click();
    await expect(page).toHaveURL(/i=honey/);
    await expect(page.locator('.result__value')).toContainText('336');
  });

  // Regression test for audit gramcup-audit-3, P2: the "No matching ingredient" row was a
  // <li role="status"> inside <ul role="listbox">, which axe's aria-required-children rule flags
  // as critical (a listbox may only contain options). Typing an unmatched query must show the
  // status message with no serious/critical axe violations, and the listbox element (referenced
  // by the input's aria-controls) must still exist in the DOM.
  test('an unmatched ingredient query shows a status message with no aria-required-children violation', async ({ page }) => {
    await page.goto(BASE + '/');
    await page.waitForSelector(HYDRATED);
    await page.fill('#ingredient-input', 'zzz-not-a-real-ingredient');
    await expect(page.getByText('No matching ingredient')).toBeVisible();
    await expect(page.locator('#ingredient-listbox')).toHaveCount(1);
    await expect(page.locator('#ingredient-listbox')).toBeHidden();

    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
  });
});
