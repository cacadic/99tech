import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, mockPrices, test } from "./fixtures";

const VIEWPORTS = [
  { name: "360px phone", width: 360, height: 740 },
  { name: "390px phone", width: 390, height: 844 },
  { name: "768px tablet", width: 768, height: 1024 },
  { name: "1280px laptop", width: 1280, height: 800 },
  { name: "1440px desktop", width: 1440, height: 900 },
] as const;

/** Waits for finite animations (popover fade-in) to end: axe would otherwise measure half-transparent text. */
async function settle(page: Page): Promise<void> {
  await page.evaluate(() =>
    Promise.all(document.getAnimations().map((animation) => animation.finished)),
  );
}

async function ready(page: Page): Promise<void> {
  await mockPrices(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Swap" })).toBeVisible();
}

test.describe("responsive layout", () => {
  for (const viewport of VIEWPORTS) {
    for (const scheme of ["light", "dark"] as const) {
      test(`no horizontal overflow, everything reachable: ${viewport.name}, ${scheme}`, async ({
        page,
      }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.emulateMedia({ colorScheme: scheme });
        await ready(page);
        // Worst case for width: a long error, an open wallet list and Vietnamese text.
        await page.getByRole("button", { name: "Switch language to Tiếng Việt" }).click();
        await page.getByRole("textbox", { name: "Số lượng Gửi" }).fill("1e3");
        await expect(page.getByRole("alert")).toBeVisible();

        const overflow = await page.evaluate(() => ({
          page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          body: document.body.scrollWidth - document.documentElement.clientWidth,
        }));
        expect(overflow.page).toBeLessThanOrEqual(0);
        expect(overflow.body).toBeLessThanOrEqual(0);

        for (const control of [
          page.getByRole("button", { name: "Xác Nhận Chuyển Đổi" }),
          page.getByRole("combobox", { name: "Coin gửi" }),
          page.getByRole("combobox", { name: "Coin nhận" }),
          page.getByRole("button", { name: /Ví demo/ }),
        ]) {
          const box = await control.boundingBox();
          expect(box, "control is rendered").not.toBeNull();
          expect((box?.x ?? -1) >= 0 && (box?.x ?? 0) + (box?.width ?? 0) <= viewport.width).toBe(
            true,
          );
        }
      });
    }
  }
});

test.describe("amounts are never clipped", () => {
  for (const width of [360, 390]) {
    test(`a typical quote is fully visible at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await mockPrices(page, [
        { currency: "USD", price: 1, date: "2023-08-29T07:10:40.000Z" },
        { currency: "bNEO", price: 7.1282679, date: "2023-08-29T07:10:40.000Z" },
      ]);
      await page.goto("/");
      await page.getByRole("textbox", { name: "Amount to Send" }).fill("1800");

      const receive = page.getByRole("textbox", { name: "Amount to Receive" });
      await expect(receive).toHaveValue("252.51576192"); // 1800 / 7.1282679, truncated to 8 decimals
      const clipped = await receive.evaluate(
        (el: HTMLInputElement) => el.scrollWidth > el.clientWidth,
      );
      expect(clipped, "receive amount fits inside its field").toBe(false);
    });
  }
});

test.describe("keyboard", () => {
  test("a full swap can be done with the keyboard alone", async ({ page }) => {
    await ready(page);

    // Header controls come first in tab order, then the form.
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: /switch language/i })).toBeFocused();

    await page.getByRole("combobox", { name: "Token to receive" }).focus();
    await page.keyboard.press("Enter");
    const search = page.getByRole("combobox", { name: "Search coin..." });
    await expect(search).toBeFocused();
    await page.keyboard.type("eth");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("combobox", { name: "Token to receive" })).toContainText("ETH");
    await expect(page.getByRole("combobox", { name: "Token to receive" })).toBeFocused();

    await page.getByRole("textbox", { name: "Amount to Send" }).focus();
    await page.keyboard.type("1000");
    await expect(page.getByRole("textbox", { name: "Amount to Receive" })).toHaveValue("1");
    await page.keyboard.press("Enter"); // implicit form submission
    await expect(page.getByText("Swap successful!")).toBeVisible();
  });

  test("Escape closes the token list and returns focus to its trigger", async ({ page }) => {
    await ready(page);
    const trigger = page.getByRole("combobox", { name: "Token to send" });
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("option").first()).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByRole("option")).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  test("the wallet list opens and closes with the keyboard", async ({ page }) => {
    await ready(page);
    const wallet = page.getByRole("button", { name: /Demo wallet/ });
    await wallet.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("balance-USD")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("balance-USD")).toHaveCount(0);
    await expect(wallet).toBeFocused();
  });

  test("keyboard focus is always visible", async ({ page }) => {
    await ready(page);
    await page.getByRole("textbox", { name: "Amount to Send" }).fill("5");
    for (let i = 0; i < 10; i += 1) {
      await page.keyboard.press("Tab");
      const outline = await page.evaluate(() => {
        const el = document.activeElement;
        if (el === null || el === document.body) return "none";
        const style = getComputedStyle(el);
        return `${style.boxShadow}|${style.outlineStyle}`;
      });
      expect(outline, `focus indicator on tab stop ${i + 1}`).not.toMatch(/^none\|none$/);
    }
  });
});

test.describe("accessibility (axe)", () => {
  for (const scheme of ["light", "dark"] as const) {
    test(`no violations on the default screen (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await ready(page);
      await settle(page);
      const results = await new AxeBuilder({ page }).analyze();
      expect(
        results.violations.map(
          (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
        ),
      ).toEqual([]);
    });

    test(`no violations with an error, a quote and an open token list (${scheme})`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await ready(page);
      await page.getByRole("textbox", { name: "Amount to Send" }).fill("5000");
      await expect(page.getByRole("alert")).toBeVisible();
      await page.getByRole("combobox", { name: "Token to receive" }).click();
      await expect(page.getByRole("option").first()).toBeVisible();
      await settle(page);
      const results = await new AxeBuilder({ page }).analyze();
      expect(
        results.violations.map(
          (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
        ),
      ).toEqual([]);
    });
  }

  test("no violations in Vietnamese, with the wallet open", async ({ page }) => {
    await ready(page);
    await page.getByRole("button", { name: "Switch language to Tiếng Việt" }).click();
    await page.getByRole("button", { name: /Ví demo/ }).click();
    await expect(page.getByTestId("balance-USD")).toBeVisible();
    await settle(page);
    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.map(
        (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
      ),
    ).toEqual([]);
  });
});
