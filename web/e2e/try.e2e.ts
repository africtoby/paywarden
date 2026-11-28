import { expect, test, type Page } from "@playwright/test";

const EXPLORER_TX = /explorer-test\.qday\.info\/tx\//;

async function toTimesheet(page: Page) {
  await page.goto("/try");
  await page.getByRole("button", { name: "See who you pay" }).click();
  await page.getByRole("button", { name: "Give the assistant a timesheet" }).click();
}

test("honest timesheet is drafted, signed and paid", async ({ page }) => {
  await toTimesheet(page);
  await page.getByRole("button", { name: "Ask the assistant to draft" }).click();
  await expect(page.getByText("Ready for your signature")).toBeVisible();
  await page.getByRole("button", { name: "Review and sign" }).click();
  await page.getByLabel("Name for your signature").fill("Toby");
  await page.getByRole("button", { name: "Sign and pay" }).click();
  await expect(page.getByText(/Paid \$1,450 to 3 people/)).toBeVisible();
  await expect(page.locator("main svg").first()).toBeVisible();
  await expect(page.getByRole("link", { name: /real PayWarden payment/ })).toHaveAttribute("href", EXPLORER_TX);
});

const TRICKS = [
  ["Push one person over the cap", "PerPayeeCapExceeded"],
  ["Make the whole run too big", "PerRunCapExceeded"],
  ["Add someone who never confirmed", "PayeeNotConfirmed"],
  ["Hide an instruction for an attacker", "PayeeNotConfirmed"],
] as const;

for (const [button, error] of TRICKS) {
  test(`"${button}" is refused with ${error}`, async ({ page }) => {
    await toTimesheet(page);
    await page.getByRole("button", { name: button }).click();
    await page.getByRole("button", { name: "Ask the assistant to draft" }).click();
    await expect(page.getByText("Refused by the contract", { exact: true })).toBeVisible();
    await expect(page.getByText(error, { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /See this same refusal on the real chain/ })).toHaveAttribute("href", EXPLORER_TX);
  });
}
