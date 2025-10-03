import { test, expect } from '@playwright/test';

test.describe('Rate limiting on login', () => {
  test.skip(!process.env.E2E_API_BASE, 'E2E_API_BASE not set');

  test('exceeds login limit and gets 429 with Retry-After', async ({ request }) => {
    const api = process.env.E2E_API_BASE as string;
    // Rate limit is 1000/5min for login in E2E, so we need to exceed it
    const creds = { email: 'provider@example.com', password: 'password123' };
    const headers = { 'Content-Type': 'application/json' } as any;

    // Make 1001 requests rapidly to exceed the 1000/5min limit
    let rateLimitHit = false;
    let retryAfter: string | undefined;

    for (let i = 0; i < 1001; i++) {
      const response = await request.post(`${api}/auth/login`, { data: creds, headers });
      if (response.status() === 429) {
        rateLimitHit = true;
        retryAfter = response.headers()['retry-after'];
        break;
      }
    }

    expect(rateLimitHit, 'Should hit rate limit after multiple requests').toBeTruthy();
    expect(retryAfter, 'Retry-After header should be present').toBeTruthy();
  });
});

