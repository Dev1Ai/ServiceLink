import { test, expect } from '@playwright/test';

const toLocalInput = (date: Date) => {
  const pad = (n: number) => `${n}`.padStart(2, '0');
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}T${pad(local.getHours())}:${pad(local.getMinutes())}`;
};

test.describe('Scheduling workflow', () => {
  test.skip(!process.env.E2E_API_BASE, 'E2E_API_BASE not set');

  test('customer proposes schedule, provider confirms then rejects', async ({ page, request }) => {
    const api = process.env.E2E_API_BASE as string;

    const login = async (email: string) => {
      const response = await request.post(`${api}/auth/login`, {
        data: { email, password: 'password123' },
        headers: { 'Content-Type': 'application/json' },
      });
      const bodyText = await response.text();
      expect(response.ok(), `Login failed for ${email} (${response.status()}): ${bodyText}`).toBeTruthy();
      try {
        const parsed = JSON.parse(bodyText);
        return parsed.access_token as string;
      } catch (error) {
        throw new Error(`Failed to parse login response for ${email}: ${bodyText}`);
      }
    };

    const custToken = await login('customer@example.com');

    const jobRes = await request.post(`${api}/jobs`, {
      data: { title: `schedule-${Date.now()}`, description: 'schedule flow test' },
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${custToken}` },
    });
    expect(jobRes.ok()).toBeTruthy();
    const job = await jobRes.json();
    expect(job?.id).toBeTruthy();

    const provToken = await login('provider@example.com');

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

    await expect(page.locator('text=Schedule confirmed.')).toBeVisible();
    await expect(page.locator('text=Status: scheduled')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Version: 2')).toBeVisible();

    await page.getByLabel('Reason (optional)').fill('Need to reschedule quickly');
    await page.getByRole('button', { name: 'Reject assignment and reopen job' }).click();

    await expect(page.locator('text=Assignment rejected — job reopened for quotes.')).toBeVisible();
    await expect(page.locator('text=Status: provider_rejected')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Window: Not scheduled yet')).toBeVisible();
  });
});
