import { test, expect } from "@playwright/test";

test.describe("Providers Search pagination UI", () => {
  test("shows page/total and Next disabled when single page", async ({
    page,
  }) => {
    await page.goto("/providers/search");
    // Ensure some filters default, then search
    await page.getByRole("button", { name: "Search" }).click();
    // Status shows Page and Total
    await expect(page.getByText(/Page \d+ • Total \d+/)).toBeVisible({
      timeout: 10000,
    });
    // Next button is disabled when no next page
    const nextBtn = page.getByRole("button", { name: "Next" });
    await expect(nextBtn).toBeDisabled();
  });
});
