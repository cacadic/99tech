import type { Page } from "@playwright/test";
import { expect, mockPrices, test } from "./fixtures";

/** Background of the page wrapper (the parent of <main>); waits until the app has rendered. */
async function rootBackground(page: Page): Promise<string> {
  await expect(page.getByRole("heading", { name: /Swap|Chuyển Đổi Coin/ })).toBeVisible();
  return page
    .locator("main")
    .locator("..")
    .evaluate((el) => getComputedStyle(el).backgroundImage);
}

test.describe("theme", () => {
  test("light and dark use their own background image and survive a reload", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await mockPrices(page);
    await page.goto("/");
    await expect(page.locator("html")).toHaveClass(/dark/);
    expect(await rootBackground(page)).toContain("/images/background.jpg");

    await page.getByRole("button", { name: "Light theme" }).click();
    await expect(page.locator("html")).toHaveClass(/light/);
    expect(await rootBackground(page)).toContain("/images/background-light.jpg");
    await expect(page.getByRole("button", { name: "Light theme" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await page.reload();
    await expect(page.locator("html")).toHaveClass(/light/);
    expect(await rootBackground(page)).toContain("/images/background-light.jpg");

    await page.getByRole("button", { name: "Dark theme" }).click();
    await page.reload();
    await expect(page.locator("html")).toHaveClass(/dark/);
  });

  test("follows the OS preference when nothing has been chosen", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await mockPrices(page);
    await page.goto("/");
    await expect(page.locator("html")).toHaveClass(/light/);
  });
});

test.describe("language", () => {
  test("EN → VI → EN changes the whole form, <html lang>, and persists across reloads", async ({
    page,
  }) => {
    await mockPrices(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Swap" })).toBeVisible();

    await page.getByRole("button", { name: "Switch language to Tiếng Việt" }).click();
    await expect(page.getByRole("heading", { name: "Chuyển Đổi Coin" })).toBeVisible();
    await expect(page.getByText("Số lượng Gửi")).toBeVisible();
    await expect(page.getByText("Số lượng Nhận")).toBeVisible();
    await expect(page.getByRole("button", { name: "Xác Nhận Chuyển Đổi" })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "vi");

    await page.reload();
    await expect(page.getByRole("heading", { name: "Chuyển Đổi Coin" })).toBeVisible();

    await page.getByRole("button", { name: "Đổi ngôn ngữ sang English" }).click();
    await expect(page.getByRole("heading", { name: "Swap" })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  test("Vietnamese validation messages and toast", async ({ page }) => {
    await mockPrices(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Switch language to Tiếng Việt" }).click();

    const amount = page.getByRole("textbox", { name: "Số lượng Gửi" });
    await amount.fill("5000");
    await expect(page.getByRole("alert")).toHaveText("Số dư không đủ: 1,800 USD");

    await amount.fill("3");
    await page.getByRole("button", { name: "Xác Nhận Chuyển Đổi" }).click();
    await expect(page.getByText("Chuyển Đổi Thành Công")).toBeVisible();
  });

  test("a stored legacy `vn` selection from the original app opens in Vietnamese and is rewritten to `vi`", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("i18nextLng", "vn");
    });
    await mockPrices(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Chuyển Đổi Coin" })).toBeVisible();
    expect(await page.evaluate(() => window.localStorage.getItem("i18nextLng"))).toBe("vi");
  });
});
