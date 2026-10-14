import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
test.beforeEach(async ({ page }) => { await page.goto('./'); await expect(page.getByRole('heading', { name: 'Choose a crypt' })).toBeVisible(); });
test('renders all crypts and tiles without inferred completion status', async ({ page }, info) => {
  await expect(page.locator('.crypt-card')).toHaveCount(6);
  await expect(page.locator('.bingo-tile')).toHaveCount(54);
  await expect(page.locator('.barrows-link')).toHaveCount(6);
  const image = page.locator('.crypt-identity img').first();
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  expect(new Set(await page.locator('.barrows-link strong').allTextContents()).size).toBe(1);
  await expect(page.locator('.bingo-summary')).toContainText('39,223');
  await expect(page.locator('.bingo-summary')).toContainText('1,056.71');
  await expect(page.getByText('Invalid PrimeUI License', { exact: true })).toHaveCount(0);
  for (const card of await page.locator('.crypt-card').all()) await card.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `/tmp/darkturbo-${info.project.name}.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
test('opens fixed-rate tile details and player drilldown', async ({ page }) => {
  await page.getByRole('button', { name: 'N1 Sarachnis Cudgel (2x), 2 points', exact: true }).click();
  const drawer = page.getByRole('dialog'); await expect(drawer).toBeVisible();
  await expect(drawer).toContainText('1/384'); await expect(drawer).toContainText('Required: 2');
  await expect(drawer.getByRole('columnheader', { name: 'Fixed-rate expected' })).toBeVisible();
  await drawer.locator('.player-link').first().click();
  await expect(page.locator('.player-hero')).toBeVisible(); await expect(drawer).not.toBeVisible();
  await expect(page.locator('.player-ranks')).toContainText('kills');
});
test('unsupported and partial tiles retain meaningful unavailable states', async ({ page }) => {
  await page.getByRole('button', { name: 'A1 Elder Chaos Druid Robes Set, 2 points', exact: true }).click();
  await expect(page.getByRole('dialog').getByText('no data provided for this tile', { exact: true }).first()).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'R3 Primordial Boots, 2 points', exact: true }).click();
  const drawer = page.getByRole('dialog'); await expect(drawer).toContainText('1/520');
  await expect(drawer.getByText('no data provided for this tile', { exact: true })).toBeVisible();
});
test('scenario inputs require assumptions, persist, and reset', async ({ page }) => {
  await page.getByRole('button', { name: 'D1 Noxious Halberd, 3 points', exact: true }).click();
  const drawer = page.getByRole('dialog');
  await expect(drawer.getByLabel('Team rood eligible rolls')).toHaveValue('');
  await drawer.getByLabel('Team rood eligible rolls').fill('200');
  await drawer.getByLabel('Team rood item probability').fill('0.005');
  await drawer.getByLabel('Team rood quantity per drop').click();
  await expect(drawer.locator('.scenario-grid').filter({ hasText: 'Team rood' }).locator('strong')).toHaveText('1.00');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'D1 Noxious Halberd, 3 points', exact: true }).click();
  await expect(drawer.getByLabel('Team rood eligible rolls')).toHaveValue('200');
  await drawer.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(drawer.getByLabel('Team rood eligible rolls')).toHaveValue('');
});
test('navigates analytics views with script-managed data only', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  for (const name of ['Overview', 'Teams', 'Players', 'Bosses']) {
    await page.getByRole('navigation').getByRole('link', { name, exact: true }).click();
    await expect(page.locator('.filters')).toBeVisible();
    await expect(page.locator('canvas').first()).toBeVisible();
  }
  await expect(page.getByRole('button', { name: 'Reload', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Import JSON', exact: true })).toHaveCount(0);
  await expect(page.locator('input[type=file]')).toHaveCount(0);
  await expect(page.locator('.data-strip')).toContainText('77/77');
  expect(errors).toEqual([]);
});
test('applies team and boss filters to both primary metrics', async ({ page }, info) => {
  await page.getByRole('navigation').getByRole('link', { name: 'Overview', exact: true }).click();
  await page.getByLabel('Filter teams', { exact: true }).click();
  await page.getByRole('option', { name: 'Team Groen', exact: true }).click();
  await expect(page.locator('.stat-card').nth(0)).toContainText('9,960');
  await expect(page.locator('.stat-card').nth(1)).toContainText('266.41');
  await page.getByLabel('Filter boss', { exact: true }).click();
  await page.getByRole('option', { name: 'Sarachnis', exact: true }).click();
  const x = JSON.parse(readFileSync('output/competition-160537-bosses.json', 'utf8'));
  const ps = Object.values(x.teams.find((t: any) => t.name === 'Team Groen').players) as any[];
  const kills = ps.reduce((n, p) => n + p.bosses.sarachnis.kills.gained, 0);
  const ehb = ps.reduce((n, p) => n + p.bosses.sarachnis.ehb.gained, 0);
  await expect(page.locator('.stat-card').nth(0).locator('strong')).toHaveText(kills.toLocaleString('en-GB'));
  await expect(page.locator('.stat-card').nth(1).locator('strong')).toHaveText(ehb.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  await expect(page.locator('canvas').first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: `/tmp/darkturbo-overview-${info.project.name}.png`, fullPage: true });
});
test('supports keyboard tile access and team-colored player comparisons', async ({ page }) => {
  const tile = page.getByRole('button', { name: 'A2 Malediction Ward, 2 points', exact: true });
  await tile.focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible(); await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('navigation').getByRole('link', { name: 'Players', exact: true }).click();
  await page.getByText('Choose players to compare', { exact: true }).click();
  await page.getByRole('option', { name: 'Phantom4u · Team rood', exact: true }).click();
  await page.getByRole('option', { name: 'Kleurplonk · Team Groen', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('.player-link').filter({ hasText: 'Phantom4u' }).first()).toHaveCSS('color', 'rgb(248, 113, 113)');
  await expect(page.locator('.player-link').filter({ hasText: 'Kleurplonk' }).first()).toHaveCSS('color', 'rgb(74, 222, 128)');
});
