import { test, expect } from '@playwright/test';

test.describe('Rate limiting on login', () => {
  test.skip(!process.env.E2E_API_BASE, 'E2E_API_BASE not set');

  test('exceeds login limit and gets 429 with Retry-After', async ({ request }) => {
    const api = process.env.E2E_API_BASE as string;
    // With CI-configured AUTH_LOGIN_RATE_LIMIT=1, the second request should 429.
    const creds = { email: 'provider@example.com', password: 'password123' };
    const headers = { 'Content-Type': 'application/json' } as any;
    const r1 = await request.post(`${api}/auth/login`, { data: creds, headers });
    expect(r1.ok()).toBeTruthy();
    const r2 = await request.post(`${api}/auth/login`, { data: creds, headers });
    expect(r2.status()).toBe(429);
    const ra = r2.headers()['retry-after'];
    expect(ra, 'Retry-After header should be present').toBeTruthy();
  });
});

