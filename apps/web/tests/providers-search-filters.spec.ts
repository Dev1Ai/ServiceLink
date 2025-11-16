import { test, expect } from "@playwright/test";

test.describe("Providers Search category/service filters", () => {
  test("category and service selects populate and sync to URL", async ({
    page,
  }) => {
    await page.goto("/providers/search");

    const categorySelect = page.locator("select").first();
    await expect(categorySelect).toBeVisible();

    // Wait for categories to populate (seeded includes Plumbing)
    await expect(categorySelect).toContainText("Home Services › Plumbing");

    // Select Plumbing category and assert URL sync
    await categorySelect.selectOption({ value: "plumbing" });
    await expect(page).toHaveURL(/category=plumbing/);

    // Service list should populate (seeded includes Lawn mowing, Leak fix (basic), etc.)
    const serviceSelect = page.locator("select").nth(1);
    await expect(serviceSelect).toContainText("Leak fix (basic)");

    // Choose a known service (Leak fix (basic))
    await serviceSelect.selectOption({ value: "Leak fix (basic)" });
    await expect(page).toHaveURL(/service=Leak\+fix\+%28basic%29/);

    // Trigger a search and ensure at least one result card
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page.locator(".card").first()).toBeVisible({ timeout: 10000 });
  });
});
