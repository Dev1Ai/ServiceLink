import { test, expect } from '@playwright/test';

test.describe('Customer verifies completion', () => {
  test.skip(!process.env.E2E_API_BASE, 'E2E_API_BASE not set');

  test('accept then verify completion', async ({ page, request }) => {
    const api = process.env.E2E_API_BASE as string;

    const login = async (email: string) => {
      const response = await request.post(`${api}/auth/login`, {
        data: { email, password: 'password123' },
        headers: { 'Content-Type': 'application/json' },
      });
      const bodyText = await response.text();
      if (!response.ok()) {
        console.error(`Login failed for ${email} (${response.status()}): ${bodyText}`);
        throw new Error(`Login failed for ${email}`);
      }
      try {
        const parsed = JSON.parse(bodyText);
        return parsed.access_token as string;
      } catch (error) {
        throw new Error(`Failed to parse login response for ${email}: ${bodyText}`);
      }
    };

    const custToken = await login('customer@example.com');

    const createJob = await request.post(`${api}/jobs`, {
      data: { title: `e2e-verify-${Date.now()}`, description: 'verify completion flow' },
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${custToken}` },
    });
    expect(createJob.ok()).toBeTruthy();
    const job = await createJob.json();
    expect(job?.id).toBeTruthy();

    // Login as provider and submit a quote
    const provToken = await login('provider@example.com');

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

    // Accept the quote (by amount)
    const card = page.locator('div', { hasText: `Quote: $${totalCents}` });
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
