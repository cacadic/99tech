import { expect, mockPrices, test } from "./fixtures";

test.describe("swap happy path (production build)", () => {
  test("shows the full form, quotes 3 USD → 1.5 bNEO, swaps, and moves both balances", async ({
    page,
  }) => {
    await mockPrices(page);
    await page.goto("/");

    // The real form, not a placeholder.
    await expect(page.getByRole("heading", { level: 1, name: "Swap" })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Token to send" })).toContainText("USD");
    await expect(page.getByRole("combobox", { name: "Token to receive" })).toContainText("bNEO");
    await expect(page.getByText("Amount to Send")).toBeVisible();
    await expect(page.getByText("Amount to Receive")).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirm Swap" })).toBeDisabled();
    await expect(page.getByText(/scaffold ready/i)).toHaveCount(0);
    await expect(page.getByTestId("price-status")).toContainText("Live prices");

    // Quote.
    await page.getByRole("textbox", { name: "Amount to Send" }).fill("3");
    await expect(page.getByRole("textbox", { name: "Amount to Receive" })).toHaveValue("1.5");
    await expect(page.getByTestId("rate")).toHaveText("1 USD ≈ 0.5 bNEO");
    await expect(page.getByTestId("send-usd")).toHaveText("$6.00");

    // Confirm: pending, then success.
    await page.getByRole("button", { name: "Confirm Swap" }).click();
    await expect(page.getByRole("button", { name: "Swapping…" })).toBeDisabled();
    await expect(page.getByText("Swap successful!")).toBeVisible();
    await expect(page.getByText("3 USD → 1.5 bNEO")).toBeVisible();

    // Both balances changed.
    await page.getByRole("button", { name: /Demo wallet/ }).click();
    await expect(page.getByTestId("balance-USD")).toHaveText("1,797");
    await expect(page.getByTestId("balance-bNEO")).toHaveText("1.5");
  });

  test("MAX spends the exact balance and the token disappears from the sender list", async ({
    page,
  }) => {
    await mockPrices(page);
    await page.goto("/");

    await page.getByRole("button", { name: "Max" }).click();
    await expect(page.getByRole("textbox", { name: "Amount to Send" })).toHaveValue("1800");
    await expect(page.getByRole("textbox", { name: "Amount to Receive" })).toHaveValue("900");
    await page.getByRole("button", { name: "Confirm Swap" }).click();
    await expect(page.getByText("Swap successful!")).toBeVisible();

    await page.getByRole("combobox", { name: "Token to send" }).click();
    await expect(page.getByRole("option", { name: /USD/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await expect(page.getByRole("option", { name: /bNEO/ })).toHaveAttribute(
      "aria-disabled",
      "false",
    );
  });

  test("the switch button flips the pair without submitting anything", async ({ page }) => {
    await mockPrices(page);
    await page.goto("/");
    await page.getByRole("textbox", { name: "Amount to Send" }).fill("3");
    // React re-renders before the browser fires `submit`, and by then the form is empty and refuses to proceed.
    // So "nothing was committed" alone cannot prove the button is not a submit button: count the event itself.
    await page.evaluate(() => {
      (window as unknown as { __submitEvents: number }).__submitEvents = 0;
      document.querySelector("form")?.addEventListener("submit", () => {
        (window as unknown as { __submitEvents: number }).__submitEvents += 1;
      });
    });

    await page.getByRole("button", { name: "Swap sending and receiving tokens" }).click();

    await expect(page.getByRole("combobox", { name: "Token to send" })).toContainText("bNEO");
    await expect(page.getByRole("combobox", { name: "Token to receive" })).toContainText("USD");
    await expect(page.getByRole("textbox", { name: "Amount to Send" })).toHaveValue("");
    await expect(page.getByTestId("send-balance")).toHaveText("Balance: 0 bNEO");
    await expect(
      page.getByRole("button", { name: "Swap sending and receiving tokens" }),
    ).toBeVisible();

    expect(
      await page.evaluate(() => (window as unknown as { __submitEvents: number }).__submitEvents),
      "the form must not be submitted by the switch button",
    ).toBe(0);

    // Belt and braces: even a late commit (simulated server delay 0.4-0.8 s) would show up in the wallet.
    await page.waitForTimeout(1_200);
    await expect(page.getByText("Swap successful!")).toHaveCount(0);
    await page.getByRole("button", { name: /Demo wallet/ }).click();
    await expect(page.getByTestId("balance-USD")).toHaveText("1,800");
    await expect(page.getByTestId("balance-bNEO")).toHaveCount(0);
  });

  test("two tabs share one wallet: a swap in one is seen by the other, which cannot spend the same money again", async ({
    context,
    page: tabA,
  }) => {
    await mockPrices(context);
    const tabB = await context.newPage();
    await tabA.goto("/");
    await tabB.goto("/");
    await expect(tabB.getByTestId("send-balance")).toHaveText("Balance: 1,800 USD");

    await tabA.getByRole("button", { name: "Max" }).click();
    await tabA.getByRole("button", { name: "Confirm Swap" }).click();
    await expect(tabA.getByText("Swap successful!")).toBeVisible();

    // Tab B had not been touched, yet it now knows the USD is gone.
    await expect(tabB.getByTestId("send-balance")).toHaveText("Balance: 0 USD");
    await tabB.getByRole("textbox", { name: "Amount to Send" }).fill("100");
    await expect(tabB.getByRole("alert")).toHaveText("Insufficient balance: 0 USD");
    await expect(tabB.getByRole("button", { name: "Confirm Swap" })).toBeDisabled();
    await tabB.getByRole("button", { name: /Demo wallet/ }).click();
    await expect(tabB.getByTestId("balance-bNEO")).toHaveText("900");
  });

  test("a swap survives a reload (wallet is persisted)", async ({ page }) => {
    await mockPrices(page);
    await page.goto("/");
    await page.getByRole("textbox", { name: "Amount to Send" }).fill("100");
    await page.getByRole("button", { name: "Confirm Swap" }).click();
    await expect(page.getByText("Swap successful!")).toBeVisible();

    await page.reload();
    await page.getByRole("button", { name: /Demo wallet/ }).click();
    await expect(page.getByTestId("balance-USD")).toHaveText("1,700");
    await expect(page.getByTestId("balance-bNEO")).toHaveText("50");
  });

  test("a wallet saved by the original Fancy Form (v0 format) is migrated", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "wallet-storage",
        JSON.stringify({ state: { coins: { USD: "1700.00", bNEO: "14.03" } }, version: 0 }),
      );
    });
    await mockPrices(page);
    await page.goto("/");
    await page.getByRole("button", { name: /Demo wallet/ }).click();
    await expect(page.getByTestId("balance-USD")).toHaveText("1,700");
    await expect(page.getByTestId("balance-bNEO")).toHaveText("14.03");
  });
});

test.describe("swap validation (nothing is committed)", () => {
  test("rejects an amount above the balance, explains why, and leaves the wallet alone", async ({
    page,
  }) => {
    await mockPrices(page);
    await page.goto("/");
    await page.getByRole("textbox", { name: "Amount to Send" }).fill("5000");

    await expect(page.getByRole("alert")).toHaveText("Insufficient balance: 1,800 USD");
    await expect(page.getByRole("textbox", { name: "Amount to Send" })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(page.getByRole("button", { name: "Confirm Swap" })).toBeDisabled();

    await page.getByRole("button", { name: /Demo wallet/ }).click();
    await expect(page.getByTestId("balance-USD")).toHaveText("1,800");
    await expect(page.getByTestId("balance-bNEO")).toHaveCount(0);
  });

  test("rejects the same token on both sides", async ({ page }) => {
    await mockPrices(page);
    await page.goto("/");
    await page.getByRole("textbox", { name: "Amount to Send" }).fill("5");
    await page.getByRole("combobox", { name: "Token to receive" }).click();
    await page.getByRole("option", { name: /^USD/ }).click();

    await expect(page.getByRole("alert")).toHaveText("Choose two different tokens.");
    await expect(page.getByRole("button", { name: "Confirm Swap" })).toBeDisabled();
  });

  for (const [typed, message] of [
    ["0", "Amount must be greater than 0."],
    ["-3", "Amount must be greater than 0."],
    ["abc", "Enter a valid number, for example 12.5."],
    ["1e3", "Enter a valid number, for example 12.5."],
    ["0.123456789", "Use at most 8 decimal places."],
  ] as const) {
    test(`explains ${JSON.stringify(typed)}`, async ({ page }) => {
      await mockPrices(page);
      await page.goto("/");
      await page.getByRole("textbox", { name: "Amount to Send" }).fill(typed);
      await expect(page.getByRole("alert")).toHaveText(message);
      await expect(page.getByRole("button", { name: "Confirm Swap" })).toBeDisabled();
    });
  }

  test("a failed server response keeps the balance and shows an error toast", async ({ page }) => {
    await mockPrices(page);
    await page.goto("/?simulate=failure");
    await expect(page.getByText("Demo mode: swaps will fail on purpose.")).toBeVisible();

    await page.getByRole("textbox", { name: "Amount to Send" }).fill("3");
    await page.getByRole("button", { name: "Confirm Swap" }).click();

    await expect(page.getByText("Swap failed. Your balance was not changed.")).toBeVisible();
    await expect(page.getByText("Swap successful!")).toHaveCount(0);
    await page.getByRole("button", { name: /Demo wallet/ }).click();
    await expect(page.getByTestId("balance-USD")).toHaveText("1,800");
  });
});
