import { expect, test } from "@playwright/test";

test("runs page asks for a wallet when none is connected", async ({ page }) => {
  await page.goto("/app/runs");
  await expect(page.getByRole("heading", { name: /Connect your wallet/ })).toBeVisible();
});
