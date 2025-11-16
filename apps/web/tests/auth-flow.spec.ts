import { test, expect } from "@playwright/test";

test.describe("Auth token wiring (localStorage)", () => {
  test("TokenPanel reflects injected JWT", async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem("jwt", "test-token");
      } catch {}
    });
    await page.goto("/");
    // Expect the TokenPanel status to show "Token set"
    const status = page.locator("text=Token set");
    await expect(status).toBeVisible();
  });
});

test.describe("Optional API login (skipped if no API)", () => {
  test.skip(!process.env.E2E_API_BASE, "E2E_API_BASE not set");

  test("Login to API and reflect token in UI", async ({ page, request }) => {
    const api = process.env.E2E_API_BASE as string;
    const res = await request.post(`${api}/auth/login`, {
      data: { email: "provider@example.com", password: "password123" },
      headers: { "Content-Type": "application/json" },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body?.access_token).toBeTruthy();

    const token = body.access_token as string;
    await page.addInitScript((t) => {
      try {
        localStorage.setItem("jwt", t as string);
      } catch {}
    }, token);
    await page.goto("/");
    await expect(page.getByText("Token set")).toBeVisible();
  });
});
