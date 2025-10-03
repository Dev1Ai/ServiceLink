import { test, expect } from '@playwright/test';

test.describe('Realtime chat flow', () => {
  test.skip(!process.env.E2E_API_BASE, 'E2E_API_BASE not set');

test('connects, joins room, sends message', async ({ page, request }) => {
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

  const token = await login('provider@example.com');

    // Inject token
    await page.addInitScript((t) => {
      try { localStorage.setItem('jwt', t as string); } catch {}
    }, token);

    // Navigate and set room
    await page.goto('/realtime');
    const roomInput = page.getByPlaceholder('room (e.g., job:123)');
    await roomInput.fill('job:demo');

    // Connect and join
    await page.getByRole('button', { name: 'Connect WS' }).click();
    await page.getByRole('button', { name: 'Join' }).click();

    // Wait for connected status (Status: Connected)
    await expect(page.getByText('Status: Connected')).toBeVisible({ timeout: 15000 });

    // Send a unique message
    const msg = `e2e-${Date.now()}`;
    const chatInput = page.getByPlaceholder(/Message as/);
    await chatInput.fill(msg);
    await page.getByRole('button', { name: /Send/ }).click();

    // Expect message to appear in the chat history
    await expect(page.getByText(msg)).toBeVisible({ timeout: 10000 });
  });
});
