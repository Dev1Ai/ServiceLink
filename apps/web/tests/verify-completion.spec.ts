import { test, expect } from '@playwright/test';

test.describe('Customer verifies completion', () => {
  test.skip(!process.env.E2E_API_BASE, 'E2E_API_BASE not set');

  test('accept then verify completion', async ({ page, request }) => {
    const api = process.env.E2E_API_BASE as string;

    // Login as customer and create a job
    const custLogin = await request.post(`${api}/auth/login`, {
      data: { email: 'customer@example.com', password: 'password123' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(custLogin.ok()).toBeTruthy();
    const custToken = (await custLogin.json()).access_token as string;

    const createJob = await request.post(`${api}/jobs`, {
      data: { title: `e2e-verify-${Date.now()}`, description: 'verify completion flow' },
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${custToken}` },
    });
    expect(createJob.ok()).toBeTruthy();
    const job = await createJob.json();
    expect(job?.id).toBeTruthy();

    // Login as provider and submit a quote
    const provLogin = await request.post(`${api}/auth/login`, {
      data: { email: 'provider@example.com', password: 'password123' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(provLogin.ok()).toBeTruthy();
    const provToken = (await provLogin.json()).access_token as string;

    const totalCents = 33333;
    const createQuote = await request.post(`${api}/jobs/${encodeURIComponent(job.id)}/quotes`, {
      data: { total: totalCents },
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provToken}` },
    });
    expect(createQuote.ok()).toBeTruthy();

    // Use customer token in the app and open quotes page
    await page.addInitScript((t) => {
      try { localStorage.setItem('jwt', t as string); } catch {}
    }, custToken);

    await page.goto(`/jobs/${encodeURIComponent(job.id)}/quotes`);

    // Accept the quote (by amount - displayed as dollars, e.g., $333.33 for 33333 cents)
    const displayedAmount = (totalCents / 100).toFixed(2);
    const card = page.locator('.card').filter({ hasText: `Quote: $${displayedAmount}` }).first();
    await expect(card).toBeVisible({ timeout: 10000 });
    await card.getByRole('button', { name: /Accept/ }).click();
    await expect(card.locator('text=Status: accepted')).toBeVisible({ timeout: 10000 });

    // Verify completion
    const verifyBtn = page.getByRole('button', { name: /Verify completion/ });
    await expect(verifyBtn).toBeVisible();
    await verifyBtn.click();

    // Expect a toast or the "Verified:" text to appear
    const toast = page.getByText('Completion verified');
    await expect(toast.or(page.locator('text=Verified:'))).toBeVisible({ timeout: 10000 });

    // Additionally confirm via API that assignment status is customer_verified
    const jobRes = await request.get(`${api}/jobs/${encodeURIComponent(job.id)}`);
    expect(jobRes.ok()).toBeTruthy();
    const jobData = await jobRes.json();
    expect(jobData?.assignment?.status).toBe('customer_verified');
  });
});
