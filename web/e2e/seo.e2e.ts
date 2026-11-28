import { expect, test } from "@playwright/test";

test("sitemap lists /try and /app", async ({ request }) => {
  const res = await request.get("/sitemap.xml");
  expect(res.ok()).toBe(true);
  const xml = await res.text();
  expect(xml).toContain("/try</loc>");
  expect(xml).toContain("/app</loc>");
});

test("robots.txt hides /confirm and points to the sitemap", async ({ request }) => {
  const txt = await (await request.get("/robots.txt")).text();
  expect(txt).toContain("Disallow: /confirm");
  expect(txt).toMatch(/Sitemap: .*\/sitemap\.xml/);
});

test("/confirm is noindex", async ({ page }) => {
  await page.goto("/confirm");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});
