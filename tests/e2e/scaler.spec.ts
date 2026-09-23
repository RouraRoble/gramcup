import { test, expect } from '@playwright/test';

const BASE = ('/' + (process.env.BASE || '').replace(/^[\/]+|[\/]+$/g, '')).replace(/\/$/, '');

test.describe('Recipe scaler', () => {
  test('doubles a 3-line recipe with the 2x preset', async ({ page }) => {
    await page.goto(BASE + '/recipe-scaler/');
    await page.waitForSelector('.scaler[data-hydrated="true"]');
    await page.fill('#recipe-text', '2 cups flour\n1 cup sugar\n1/2 cup butter');
    await page.getByRole('button', { name: '2×' }).click();
    const list = page.locator('.scaled-list li');
    await expect(list).toHaveCount(3);
    await expect(list.nth(0)).toContainText('4');
    await expect(list.nth(1)).toContainText('2');
    await expect(list.nth(2)).toContainText('1');
  });

  test('a share link reproduces the same scaled recipe', async ({ page }) => {
    await page.goto(BASE + '/recipe-scaler/');
    await page.waitForSelector('.scaler[data-hydrated="true"]');
    await page.fill('#recipe-text', '2 cups flour\n1 cup sugar');
    await page.getByRole('button', { name: '3×' }).click();
    await expect(page).toHaveURL(/#.+/);
    const url = page.url();

    await page.goto('about:blank');
    await page.goto(url);
    await page.waitForSelector('.scaler[data-hydrated="true"]');
    await expect(page.locator('#recipe-text')).toHaveValue('2 cups flour\n1 cup sugar');
    const list = page.locator('.scaled-list li');
    await expect(list.nth(0)).toContainText('6');
    await expect(list.nth(1)).toContainText('3');
  });

  test('unmatched ingredients still scale numerically', async ({ page }) => {
    await page.goto(BASE + '/recipe-scaler/');
    await page.waitForSelector('.scaler[data-hydrated="true"]');
    await page.fill('#recipe-text', '3 whole dragonfruit');
    await page.getByRole('button', { name: '2×' }).click();
    const item = page.locator('.scaled-list li').first();
    await expect(item).toContainText('6');
    // With "convert entire recipe to grams" off (the default here), the person never asked for a
    // gram conversion, so a notice about the ingredient not being recognized for one is noise, not
    // help — it used to show regardless of the toggle (audit gramcup-audit-4, B4).
    await expect(item).not.toContainText('not recognized');
  });

  test('unmatched-ingredient notice only appears once gram conversion is requested', async ({ page }) => {
    await page.goto(BASE + '/recipe-scaler/');
    await page.waitForSelector('.scaler[data-hydrated="true"]');
    // Needs a recognized unit (unlike the bare-count "3 whole dragonfruit" case above) — the
    // notice is about a *gram* conversion, which only applies to lines with a unit to convert.
    await page.fill('#recipe-text', '3 cups dragonfruit');
    const item = page.locator('.scaled-list li').first();
    await expect(item).not.toContainText('not recognized');
    await page.getByLabel('Convert entire recipe to grams').check();
    await expect(item).toContainText('not recognized');
  });

  test('convert entire recipe to grams', async ({ page }) => {
    await page.goto(BASE + '/recipe-scaler/');
    await page.waitForSelector('.scaler[data-hydrated="true"]');
    await page.fill('#recipe-text', '1 cup all-purpose flour');
    await page.getByRole('button', { name: '1×' }).click();
    await page.getByLabel('Convert entire recipe to grams').check();
    await expect(page.locator('.scaled-list li').first()).toContainText('120 g');
  });
});
