import { test, expect } from '@playwright/test';

const toLocalInput = (date: Date) => {
  const pad = (n: number) => `${n}`.padStart(2, '0');
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}T${pad(local.getHours())}:${pad(local.getMinutes())}`;
};

test.describe('Scheduling workflow', () => {
  test.skip(!process.env.E2E_API_BASE, 'E2E_API_BASE not set');

  test('customer proposes schedule, provider confirms then rejects', async ({ page, request }) => {
    test.setTimeout(60000); // Increase timeout to 60s for this complex workflow
    const api = process.env.E2E_API_BASE as string;

    const custLogin = await request.post(`${api}/auth/login`, {
      data: { email: 'customer@example.com', password: 'password123' },
      headers: { 'Content-Type': 'application/json' },
    });
    if (!custLogin.ok()) {
      const errorBody = await custLogin.text();
      console.error(`Login failed with status ${custLogin.status()}: ${errorBody}`);
    }
    expect(custLogin.ok()).toBeTruthy();
    const custToken = (await custLogin.json()).access_token as string;

    const jobRes = await request.post(`${api}/jobs`, {
      data: { title: `schedule-${Date.now()}`, description: 'schedule flow test' },
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${custToken}` },
    });
    expect(jobRes.ok()).toBeTruthy();
    const job = await jobRes.json();
    expect(job?.id).toBeTruthy();

    const provLogin = await request.post(`${api}/auth/login`, {
      data: { email: 'provider@example.com', password: 'password123' },
      headers: { 'Content-Type': 'application/json' },
    });
    if (!provLogin.ok()) {
      const errorBody = await provLogin.text();
      console.error(`Provider login failed with status ${provLogin.status()}: ${errorBody}`);
    }
    expect(provLogin.ok()).toBeTruthy();
    const provToken = (await provLogin.json()).access_token as string;

    const quoteRes = await request.post(`${api}/jobs/${encodeURIComponent(job.id)}/quotes`, {
      data: { total: 33300 },
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provToken}` },
    });
    expect(quoteRes.ok()).toBeTruthy();
    const quote = await quoteRes.json();
    expect(quote?.id).toBeTruthy();

    const acceptRes = await request.post(`${api}/jobs/${encodeURIComponent(job.id)}/quotes/${encodeURIComponent(quote.id)}/accept`, {
      headers: { Authorization: `Bearer ${custToken}` },
    });
    expect(acceptRes.ok()).toBeTruthy();

    await page.addInitScript((t) => {
      try { localStorage.setItem('jwt', t as string); } catch {}
    }, custToken);

    await page.goto(`/jobs/${encodeURIComponent(job.id)}/quotes`);

    const start = toLocalInput(new Date(Date.now() + 60 * 60 * 1000));
    const end = toLocalInput(new Date(Date.now() + 2 * 60 * 60 * 1000));

    await page.getByLabel('Start').first().fill(start);
    await page.getByLabel('End').first().fill(end);
    await page.getByLabel('Notes (optional)').first().fill('Customer prefers mid-day window');
    await page.getByRole('button', { name: 'Submit schedule proposal' }).click();

    await expect(page.locator('text=Schedule proposed successfully.')).toBeVisible();
    await expect(page.locator('text=Version: 1')).toBeVisible();

    await page.evaluate((token: string) => {
      try { localStorage.setItem('jwt', token); } catch {}
    }, provToken);
    await page.reload();

    await expect(page.locator('text=Version: 1')).toBeVisible({ timeout: 10000 });
    await page.getByLabel('Confirmation notes (optional)').fill('Provider confirms arrival');
    await page.getByRole('button', { name: 'Confirm schedule' }).click();

    await expect(page.locator('text=Schedule confirmed.')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=Status: scheduled')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=Version: 2')).toBeVisible({ timeout: 15000 });

    // Wait a moment for React to re-render the reject assignment section after confirmation
    await page.waitForTimeout(1000);

    // Wait for the reject assignment section to be visible (provider role required)
    await expect(page.locator('text=Reject assignment')).toBeVisible({ timeout: 15000 });
    // Wait for the textarea to be visible and editable
    const reasonField = page.getByLabel('Reason (optional)');
    await expect(reasonField).toBeVisible({ timeout: 15000 });
    await reasonField.fill('Need to reschedule quickly');
    await page.getByRole('button', { name: 'Reject assignment and reopen job' }).click();

    await expect(page.locator('text=Assignment rejected — job reopened for quotes.')).toBeVisible();
    await expect(page.locator('text=Status: provider_rejected')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Window: Not scheduled yet')).toBeVisible();
  });
});
