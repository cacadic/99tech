import { EASY_FEED, expect, mockPrices, PRICES_URL, test } from "./fixtures";

test.describe("price API problems (never a blank page, never a fake 500)", () => {
  test.use({ expectResourceErrors: true });

  test("an error response falls back to clearly labelled sample prices, and Retry restores live prices", async ({
    page,
  }) => {
    let healthy = false;
    await page.route(PRICES_URL, (route) =>
      healthy
        ? route.fulfill({ json: EASY_FEED, headers: { "access-control-allow-origin": "*" } })
        : route.fulfill({
            status: 503,
            body: "unavailable",
            headers: { "access-control-allow-origin": "*" },
          }),
    );
    // 503 is retried (2 retries); keep the test quick by letting the retries run.
    await page.goto("/");

    const status = page.getByTestId("price-status");
    await expect(status).toHaveAttribute("data-source", "sample", { timeout: 15_000 });
    await expect(status).toContainText("Sample prices");
    await expect(status).toContainText("Live prices are unavailable (server error)");
    await expect(page.getByText(/Internal Server Error/i)).toHaveCount(0);

    // Still usable on sample prices.
    await page.getByRole("textbox", { name: "Amount to Send" }).fill("100");
    await expect(page.getByRole("textbox", { name: "Amount to Receive" })).not.toHaveValue("");
    await expect(page.getByRole("button", { name: "Confirm Swap" })).toBeEnabled();

    healthy = true;
    await status.getByRole("button", { name: "Retry" }).click();
    await expect(status).toHaveAttribute("data-source", "live");
    await expect(page.getByRole("textbox", { name: "Amount to Receive" })).toHaveValue("50");
  });

  test("an unreachable API shows the loading state first, then the labelled fallback", async ({
    page,
  }) => {
    await page.route(PRICES_URL, (route) => route.abort("failed"));
    await page.goto("/");

    await expect(page.getByRole("status").first()).toBeVisible();
    await expect(page.getByTestId("price-status")).toHaveAttribute("data-source", "sample", {
      timeout: 15_000,
    });
    await expect(page.getByTestId("price-status")).toContainText("network error");
    await expect(page.getByRole("heading", { name: "Swap" })).toBeVisible();
  });

  test("a malformed payload falls back too", async ({ page }) => {
    await mockPrices(page, { not: "a list" });
    await page.goto("/");
    await expect(page.getByTestId("price-status")).toHaveAttribute("data-source", "sample");
    await expect(page.getByTestId("price-status")).toContainText("unexpected data");
  });
});

test("tokens without a valid price are not offered", async ({ page }) => {
  await mockPrices(page, [
    ...EASY_FEED,
    { currency: "FREE", date: "2023-08-29T07:10:40.000Z", price: 0 },
    { currency: "NEG", date: "2023-08-29T07:10:40.000Z", price: -4 },
  ]);
  await page.goto("/");
  await page.getByRole("combobox", { name: "Token to receive" }).click();

  await expect(page.getByRole("option")).toHaveCount(3);
  await expect(page.getByRole("option", { name: /FREE|NEG/ })).toHaveCount(0);
});
