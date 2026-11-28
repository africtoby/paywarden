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
  await expect(page.getByRole("heading", { name: "Signed by each worker" })).toBeVisible();
  await expect(page.getByText("Signed", { exact: true })).toHaveCount(3);
  await page.getByRole("button", { name: "Continue to the checks" }).click();
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
  ["Add a line nobody signed", "InvalidWorkerSignature"],
  ["Hide an instruction for an attacker", "PayeeNotConfirmed"],
] as const;

// Errors with a real on-chain refusal linked from web/src/lib/attack-proof.ts.
// InvalidWorkerSignature gets its proof link after the redeploy (Step 15, C4).
const NO_PROOF_YET = new Set<string>(["InvalidWorkerSignature"]);

for (const [button, error] of TRICKS) {
  test(`"${button}" is refused with ${error}`, async ({ page }) => {
    await toTimesheet(page);
    await page.getByRole("button", { name: button }).click();
    await page.getByRole("button", { name: "Ask the assistant to draft" }).click();
    await page.getByRole("button", { name: "Continue to the checks" }).click();
    await expect(page.getByText("Refused by the contract", { exact: true })).toBeVisible();
    await expect(page.getByText(error, { exact: true })).toBeVisible();
    if (!NO_PROOF_YET.has(error)) {
      await expect(page.getByRole("link", { name: /See this same refusal on the real chain/ })).toHaveAttribute("href", EXPLORER_TX);
    }
  });
}

test("the unsigned line is shown as unsigned before the checks", async ({ page }) => {
  await toTimesheet(page);
  await page.getByRole("button", { name: "Add a line nobody signed" }).click();
  await page.getByRole("button", { name: "Ask the assistant to draft" }).click();
  await expect(page.getByText("Nobody signed this line")).toBeVisible();
});

test("/hours says the invite looks incomplete without a link", async ({ page }) => {
  await page.goto("/hours");
  await expect(page.getByRole("heading", { name: /invite link looks incomplete/ })).toBeVisible();
});

test("/hours shows the form for a full invite link", async ({ page }) => {
  const salt = `0x${"ab".repeat(32)}`;
  await page.goto(`/hours#vault=0x98F3C81b754574f08e57bf35bb6BED38e4bD5a36&name=Ada&salt=${salt}`);
  await expect(page.getByRole("heading", { name: "Ada" })).toBeVisible();
  await expect(page.getByLabel("Pay period")).toBeVisible();
  await expect(page.getByText("Enter your hours and rate")).toBeVisible();
});
