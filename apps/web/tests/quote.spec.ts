import { test, expect } from '@playwright/test';

test.describe('Static quote page flow', () => {
  test.skip(!process.env.E2E_API_BASE, 'E2E_API_BASE not set');

  test('provider submits a quote via /jobs/quote?id=', async ({ page, request }) => {
    const api = process.env.E2E_API_BASE as string;

    // Login as customer and create a job
    const custLogin = await request.post(`${api}/auth/login`, {
      data: { email: 'customer@example.com', password: 'password123' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(custLogin.ok()).toBeTruthy();
    const custToken = (await custLogin.json()).access_token as string;

    const createJob = await request.post(`${api}/jobs`, {
      data: { title: `e2e-${Date.now()}`, description: 'automated e2e job' },
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${custToken}` },
    });
    expect(createJob.ok()).toBeTruthy();
    const job = await createJob.json();
    expect(job?.id).toBeTruthy();

    // Login as provider
    const provLogin = await request.post(`${api}/auth/login`, {
      data: { email: 'provider@example.com', password: 'password123' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(provLogin.ok()).toBeTruthy();
    const provToken = (await provLogin.json()).access_token as string;

    // Inject provider token and load static quote page
    await page.addInitScript((t) => {
      try { localStorage.setItem('jwt', t as string); } catch {}
    }, provToken);
    await page.goto(`/jobs/quote?id=${encodeURIComponent(job.id)}`);

    // Fill total and submit
    const total = page.getByPlaceholder('total (USD cents)');
    await total.fill('12345');
    await page.getByRole('button', { name: /Submit Quote/ }).click();

    // Wait for success toast or pre content indicating ok:true
    const toast = page.getByText('Quote submitted');
    await expect(toast.or(page.locator('pre').filter({ hasText: '"ok":true' }))).toBeVisible({ timeout: 10000 });
  });
});

