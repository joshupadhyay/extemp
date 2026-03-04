import { chromium, devices } from "playwright";

const iPhone = devices["iPhone 14"];
const phases = ["idle", "prompt", "prep", "speaking", "processing", "results"];
const OUTPUT_DIR = "/private/tmp/claude/mobile-screenshots";

async function mockAuth(page: any) {
  await page.route("**/api/auth/get-session", (route: any) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        session: {
          id: "mock-session",
          userId: "mock-user",
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
        },
        user: {
          id: "mock-user",
          name: "Test User",
          email: "test@example.com",
          createdAt: new Date().toISOString(),
        },
      }),
    });
  });
}

async function capturePhases(contextOptions: any, suffix: string) {
  const browser = await chromium.launch();
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  await mockAuth(page);

  // Navigate to /practice (BrowserRouter, not hash)
  await page.goto("http://localhost:3000/practice", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  for (const phase of phases) {
    // Debug buttons have uppercase text like "idle", "prompt", etc.
    const btn = page.locator("button", { hasText: new RegExp(`^${phase}$`, "i") });
    const count = await btn.count();
    if (count > 0) {
      await btn.first().click();
      await page.waitForTimeout(1000);
    } else {
      console.log(`  Button not found for: ${phase}`);
    }

    await page.screenshot({
      path: `${OUTPUT_DIR}/${phase}-${suffix}.png`,
      fullPage: true,
    });
    console.log(`Captured ${suffix}: ${phase}`);
  }

  await browser.close();
}

async function main() {
  // Mobile - iPhone 14
  await capturePhases({ ...iPhone }, "mobile");

  // Tablet - iPad
  await capturePhases(devices["iPad (gen 7)"], "tablet");

  // Desktop - 1440x900
  await capturePhases({ viewport: { width: 1440, height: 900 } }, "desktop");

  console.log(`\nAll screenshots saved to ${OUTPUT_DIR}`);
}

main().catch(console.error);
