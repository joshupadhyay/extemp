import { test, expect } from "@playwright/test";

test.describe("Practice Flow", () => {
  test("landing page loads with Start Practice button", async ({ page }) => {
    await page.goto("/");
    // Should see the landing page with "Think fast. Speak clearly." heading
    // and a "Start Practice" button
    await expect(page.getByRole("button", { name: /start practice/i })).toBeVisible();
  });

  test("Start Practice navigates to practice page", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /start practice/i }).click();
    // Hash should change to #/practice
    await expect(page).toHaveURL(/#\/practice/);
    // Should see "Ready to practice?" heading
    await expect(page.getByText("Ready to practice?")).toBeVisible();
  });

  test("practice page shows prompt after clicking Start Practice", async ({ page }) => {
    await page.goto("/#/practice");
    // Should see idle state
    await expect(page.getByText("Ready to practice?")).toBeVisible();
    // Click Start Practice button on the practice page
    await page.getByRole("button", { name: /start practice/i }).click();
    // Should see "Your prompt:" label and "Begin Prep" button
    await expect(page.getByText("Your prompt:")).toBeVisible();
    await expect(page.getByRole("button", { name: /begin prep/i })).toBeVisible();
  });

  test("can navigate to history page", async ({ page }) => {
    // Navigate directly to history
    await page.goto("/#/history");
    await expect(page.getByText("Practice History")).toBeVisible();
  });

  test("can navigate to settings page", async ({ page }) => {
    await page.goto("/#/settings");
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    // Should see prep time and speaking time options
    await expect(page.getByText("Prep Time")).toBeVisible();
    await expect(page.getByText("Speaking Time")).toBeVisible();
  });

  test("back navigation works from practice page", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /start practice/i }).click();
    await expect(page).toHaveURL(/#\/practice/);
    await expect(page.getByText("Ready to practice?")).toBeVisible();
    // Click the back button in the nav
    await page.getByRole("button", { name: /back/i }).click();
    // Should be back at landing page
    await expect(page.getByRole("button", { name: /start practice/i })).toBeVisible();
  });
});
