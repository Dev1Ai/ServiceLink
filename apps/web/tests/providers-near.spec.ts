import { test, expect } from '@playwright/test';

test.describe('Providers Near shows nearby provider', () => {
  test.skip(!process.env.E2E_API_BASE, 'E2E_API_BASE not set');

  test('provider location appears in near results', async ({ page, request }) => {
    const api = process.env.E2E_API_BASE as string;
    // Login as provider and set location
    const provLogin = await request.post(`${api}/auth/login`, {
      data: { email: 'provider@example.com', password: 'password123' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(provLogin.ok()).toBeTruthy();
    const provToken = (await provLogin.json()).access_token as string;

    const lat = 37.7749;
    const lng = -122.4194;
    const setLoc = await request.post(`${api}/providers/location`, {
      data: { lat, lng },
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provToken}` },
    });
    expect(setLoc.ok()).toBeTruthy();

    // Open page and search near same location
    await page.goto('/providers/near');
    await page.getByPlaceholder('lat').fill(String(lat));
    await page.getByPlaceholder('lng').fill(String(lng));
    await page.getByPlaceholder('radius km').fill('25');
    await page.getByRole('button', { name: 'Search' }).click();

    // Expect at least one provider card to show
    await expect(page.locator('.card').first()).toBeVisible({ timeout: 10000 });

    // And at least one map marker icon is rendered
    await expect(page.locator('.leaflet-marker-icon').first()).toBeVisible({ timeout: 10000 });
  });
});
