import { test, expect } from '@playwright/test';

test.describe('Quotes accept/revoke flow', () => {
  test.skip(!process.env.E2E_API_BASE, 'E2E_API_BASE not set');

  test('customer accepts and revokes a quote', async ({ page, request }) => {
    const api = process.env.E2E_API_BASE as string;

    // Login as customer and create a job
    const custLogin = await request.post(`${api}/auth/login`, {
      data: { email: 'customer@example.com', password: 'password123' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(custLogin.ok()).toBeTruthy();
    const custToken = (await custLogin.json()).access_token as string;

    const createJob = await request.post(`${api}/jobs`, {
      data: { title: `e2e-quotes-${Date.now()}`, description: 'quotes flow test' },
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${custToken}` },
    });
    expect(createJob.ok()).toBeTruthy();
    const job = await createJob.json();
    expect(job?.id).toBeTruthy();

    // Login as provider and submit a quote via API
    const provLogin = await request.post(`${api}/auth/login`, {
      data: { email: 'provider@example.com', password: 'password123' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(provLogin.ok()).toBeTruthy();
    const provToken = (await provLogin.json()).access_token as string;

    const totalCents = 22222;
    const createQuote = await request.post(`${api}/jobs/${encodeURIComponent(job.id)}/quotes`, {
      data: { total: totalCents },
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provToken}` },
    });
    expect(createQuote.ok()).toBeTruthy();
    const quote = await createQuote.json();
    expect(quote?.id).toBeTruthy();

    // Use customer token in the app and open quotes page
    await page.addInitScript((t) => {
      try { localStorage.setItem('jwt', t as string); } catch {}
    }, custToken);

    await page.goto(`/jobs/${encodeURIComponent(job.id)}/quotes`);

    // Wait for page to load and quotes to render
    await page.waitForLoadState('networkidle');

    // Accept the quote: locate the card by the total amount (in dollars)
    const totalDollars = (totalCents / 100).toFixed(2);
    const card = page.locator('[class*="card"]').filter({ hasText: totalDollars });
    await expect(card.first()).toBeVisible({ timeout: 10000 });
    const acceptBtn = card.first().getByRole('button', { name: /Accept/i });
    await expect(acceptBtn).toBeVisible();
    await acceptBtn.click();

    // Verify accepted status appears
    await expect(card.locator('text=Status: accepted')).toBeVisible({ timeout: 10000 });

    // Revoke acceptance (button is at top section when assignment exists)
    const revokeBtn = page.getByRole('button', { name: /Revoke acceptance/ });
    await expect(revokeBtn).toBeVisible();
    await revokeBtn.click();

    // After revoke, the quote status should no longer be accepted (back to pending)
    await expect(card.locator('text=Status: accepted')).toHaveCount(0, { timeout: 10000 });
    await expect(card.locator('text=Status: pending')).toBeVisible();
  });
});

