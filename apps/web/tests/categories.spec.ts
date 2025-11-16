import { test, expect } from "@playwright/test";

test.describe("Provider categories page", () => {
  test("renders tree and links to search/near", async ({ page }) => {
    await page.goto("/providers/categories");
    // Heading present
    await expect(
      page.getByRole("heading", { name: /Provider Categories/i }),
    ).toBeVisible();
    // Expect at least one category name from seed to be present
    await expect(
      page.getByRole("listitem").filter({ hasText: "Home Services" }).first(),
    ).toBeVisible();

    // Click the first Search link and verify URL contains category param
    const searchLink = page.locator("a", { hasText: "Search" }).first();
    await expect(searchLink).toBeVisible();
    const href1 = await searchLink.getAttribute("href");
    await searchLink.click();
    await expect(page).toHaveURL(/\/providers\/search\?category=/);

    // Go back and try Near link
    await page.goBack();
    const nearLink = page.locator("a", { hasText: "Near" }).first();
    await expect(nearLink).toBeVisible();
    const href2 = await nearLink.getAttribute("href");
    await nearLink.click();
    await expect(page).toHaveURL(/\/providers\/near\?category=/);

    // Basic sanity: the two hrefs should have category query param
    expect(href1).toMatch(/\?category=/);
    expect(href2).toMatch(/\?category=/);
  });
});
