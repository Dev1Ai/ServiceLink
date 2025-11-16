import { test, expect } from '@playwright/test';

test.describe('Rate limiting on login', () => {
  test.skip(!process.env.E2E_API_BASE, 'E2E_API_BASE not set');

  test.skip('exceeds login limit and gets 429 with Retry-After', async ({ request }) => {
    // SKIP: Rate limit is intentionally high (1000/min) in E2E to prevent blocking legitimate tests
    // This test would need to make 1000+ requests which is too slow for E2E
    // Rate limiting is tested in unit tests instead
    const api = process.env.E2E_API_BASE as string;
    const creds = { email: 'provider@example.com', password: 'password123' };
    const headers = { 'Content-Type': 'application/json' } as any;

    let rateLimitHit = false;
    let retryAfter: string | undefined;

    for (let i = 0; i < 1002; i++) {
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

