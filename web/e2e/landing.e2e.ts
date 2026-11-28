import { expect, test } from "@playwright/test";

const NOISE = /reown|walletconnect|web3modal/i;

test("title mentions PayWarden", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/PayWarden/);
});

test("headline words settle into place", async ({ page }) => {
  await page.goto("/");
  const h1 = page.getByRole("heading", { level: 1, name: /Payroll your AI prepares/ });
  await expect(h1).toBeVisible();
  const words = h1.locator("span", { hasText: /^(Payroll|your|AI|prepares\.?)$/ });
  const count = await words.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    await expect(words.nth(i)).toHaveCSS("transform", /^(none|matrix\(1, 0, 0, 1, 0, 0\))$/); // identity = settled
  }
});

test("no console errors on load", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const url = m.location().url;
    if (NOISE.test(url) || NOISE.test(m.text())) return;    errors.push(`${m.text()} (${url})`);
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  expect(errors).toEqual([]);
});

test("try-without-a-wallet button goes to /try", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Try it without a wallet" })).toHaveAttribute("href", "/try");
});
