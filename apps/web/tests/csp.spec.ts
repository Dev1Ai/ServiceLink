import { test, expect } from "@playwright/test";

const routes = [
  "/",
  "/jobs",
  "/providers/near",
  "/metrics",
  "/realtime",
  "/jobs/quote",
];

test.describe("CSP headers and no violations", () => {
  test("home has CSP header", async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__violations = [];
      document.addEventListener("securitypolicyviolation", (e: any) => {
        (window as any).__violations.push(e.violatedDirective);
      });
    });
    const resp = await page.goto("/");
    expect(resp).not.toBeNull();
    const csp = resp!.headers()["content-security-policy"];
    expect(csp, "CSP header should be set").toBeTruthy();
    const vios = await page.evaluate(() => (window as any).__violations);
    expect(vios, `No CSP violations expected on /, got: ${vios}`).toEqual([]);
  });

  test("CSP connect-src allows ws/wss", async ({ page }) => {
    const resp = await page.goto("/");
    expect(resp).not.toBeNull();
    const csp = (
      resp!.headers()["content-security-policy"] || ""
    ).toLowerCase();
    expect(csp).toContain("connect-src");
    expect(csp).toContain("ws:");
    expect(csp).toContain("wss:");
  });

  for (const path of routes) {
    test(`no CSP violations on ${path}`, async ({ page }) => {
      await page.addInitScript(() => {
        (window as any).__violations = [];
        document.addEventListener("securitypolicyviolation", (e: any) => {
          (window as any).__violations.push(e.violatedDirective);
        });
      });
      await page.goto(path);
      const vios = await page.evaluate(() => (window as any).__violations);
      expect(
        vios,
        `No CSP violations expected on ${path}, got: ${vios}`,
      ).toEqual([]);
    });
  }
});
