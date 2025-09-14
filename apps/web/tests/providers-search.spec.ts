import { test, expect } from '@playwright/test';

test.describe('Providers Search filters and URL sync', () => {
  test('search by service name updates results and URL', async ({ page }) => {
    await page.goto('/providers/search');
    // Enter a seeded service name and search
    const input = page.getByPlaceholder('service contains');
    await input.fill('mowing');
    await page.getByRole('button', { name: 'Search' }).click();
    // URL should include q=mowing (case-insensitive search)
    await expect(page).toHaveURL(/q=mowing/);
    // At least one provider card should render
    await expect(page.locator('.card').first()).toBeVisible({ timeout: 10000 });
    // Service chips include Lawn mowing (seeded)
    await expect(page.getByRole('button', { name: 'Lawn mowing' })).toBeVisible();

    // Toggle online only and ensure URL syncs
    const onlineToggle = page.getByLabel(/online only/i);
    await onlineToggle.check();
    await expect(page).toHaveURL(/onlineOnly=true/);
  });
});
