import { test, expect } from '@playwright/test';

test.describe('Providers Search category/service filters', () => {
  test('category and service selects populate and sync to URL', async ({ page }) => {
    await page.goto('/providers/search');

    const categorySelect = page.locator('select').first();
    await expect(categorySelect).toBeVisible();

    // Wait for categories to populate (seeded includes Plumbing)
    await expect(page.locator('option', { hasText: /Plumbing/ })).toBeVisible({ timeout: 10000 });

    // Select Plumbing and assert URL sync
    await page.selectOption('select', { value: 'plumbing' });
    await expect(page).toHaveURL(/category=plumbing/);

    // Service list should populate (seeded includes Lawn mowing, Leak fix (basic), etc.)
    const serviceSelect = page.locator('select').nth(1);
    await expect(serviceSelect).toBeVisible();

    // Choose a known service (Leak fix (basic))
    await page.selectOption(serviceSelect, { value: 'Leak fix (basic)' });
    await expect(page).toHaveURL(/service=Leak%20fix%20\(basic\)/);

    // Trigger a search and ensure at least one result card
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page.locator('.card').first()).toBeVisible({ timeout: 10000 });
  });
});
