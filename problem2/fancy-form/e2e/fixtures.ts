import { expect, test as base, type BrowserContext, type Page } from "@playwright/test";

export const PRICES_URL = "https://interview.switcheo.com/prices.json";

const feed = (...pairs: [string, number][]) =>
  pairs.map(([currency, price]) => ({ currency, price, date: "2023-08-29T07:10:40.000Z" }));

/** USD = 2, bNEO = 4, ETH = 2000: 3 USD → exactly 1.5 bNEO. */
export const EASY_FEED = feed(["USD", 2], ["bNEO", 4], ["ETH", 2000]);

/** Serves `records` as the price feed (deterministic; the real endpoint is never hit by these tests). */
export async function mockPrices(
  target: Page | BrowserContext,
  records: unknown = EASY_FEED,
): Promise<void> {
  await target.route(PRICES_URL, (route) =>
    route.fulfill({ json: records, headers: { "access-control-allow-origin": "*" } }),
  );
}

interface Options {
  /** Set for tests that make the price API fail on purpose: the browser then logs the failed request. */
  expectResourceErrors: boolean;
}

/**
 * Every test fails if the page logs a console error/warning or throws, so real problems cannot hide behind
 * passing assertions.
 */
export const test = base.extend<Options>({
  expectResourceErrors: [false, { option: true }],
  page: async ({ page, expectResourceErrors }, use) => {
    const problems: string[] = [];
    page.on("console", (message) => {
      if (message.type() !== "error" && message.type() !== "warning") return;
      if (
        expectResourceErrors &&
        /Failed to load resource|net::ERR|status of 4\d\d/.test(message.text())
      )
        return;
      problems.push(`${message.type()}: ${message.text()}`);
    });
    page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
    await use(page);
    expect(problems, "console errors / uncaught exceptions").toEqual([]);
  },
});

export { expect };
