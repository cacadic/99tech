import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import i18n from "@/shared/config/i18n/i18n";
import SwitchTheme from "./SwitchTheme";

const prefersDark = (dark: boolean): void => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({ matches: dark && query.includes("dark"), media: query }),
  });
};

describe("theme", () => {
  it("follows the OS preference until the user chooses, then remembers the choice", async () => {
    prefersDark(true);
    const user = userEvent.setup();
    render(<SwitchTheme />);

    expect(document.documentElement).toHaveClass("dark");
    expect(screen.getByRole("button", { name: "Dark theme" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(localStorage.getItem("theme")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Light theme" }));
    expect(document.documentElement).toHaveClass("light");
    expect(document.documentElement).not.toHaveClass("dark");
    expect(document.documentElement.style.colorScheme).toBe("light");
    expect(screen.getByRole("button", { name: "Light theme" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Dark theme" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(localStorage.getItem("theme")).toBe("light");
  });

  it("restores a stored choice after a reload, even against the OS preference", () => {
    prefersDark(true);
    localStorage.setItem("theme", "light");
    render(<SwitchTheme />);
    expect(document.documentElement).toHaveClass("light");
  });

  it("ignores a corrupted stored value", () => {
    prefersDark(false);
    localStorage.setItem("theme", "purple");
    render(<SwitchTheme />);
    expect(document.documentElement).toHaveClass("light");
  });
});

describe("language", () => {
  it("switches EN → VI → EN, updates <html lang> and persists the choice", async () => {
    const user = userEvent.setup();
    render(<SwitchTheme />);
    expect(
      screen.getByRole("button", { name: "EN, switch language to Tiếng Việt" }),
    ).toHaveTextContent("EN");

    await user.click(screen.getByRole("button", { name: "EN, switch language to Tiếng Việt" }));
    expect(i18n.resolvedLanguage).toBe("vi");
    expect(document.documentElement).toHaveAttribute("lang", "vi");
    expect(localStorage.getItem("i18nextLng")).toBe("vi");
    expect(screen.getByRole("button", { name: "VI, đổi ngôn ngữ sang English" })).toHaveTextContent(
      "VI",
    );
    expect(screen.getByRole("button", { name: "Giao diện sáng" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "VI, đổi ngôn ngữ sang English" }));
    expect(i18n.resolvedLanguage).toBe("en");
    expect(document.documentElement).toHaveAttribute("lang", "en");
    expect(localStorage.getItem("i18nextLng")).toBe("en");
  });

  it("migrates the legacy `vn` code to `vi`, and maps regional variants to their base language", () => {
    const detector = i18n.services.languageDetector as {
      detect: () => string | string[] | undefined;
    };
    // The detector returns its candidates in priority order; the stored choice comes first.
    const preferred = (): string | undefined => [detector.detect()].flat()[0];

    localStorage.setItem("i18nextLng", "vn");
    expect(preferred()).toBe("vi");

    localStorage.setItem("i18nextLng", "vi-VN");
    expect(preferred()).toBe("vi");

    localStorage.setItem("i18nextLng", "en-GB");
    expect(preferred()).toBe("en");
  });

  it("keeps every original translation key and has the same keys in both languages", () => {
    const original = [
      "swap",
      "amount_to_send",
      "amount_to_receive",
      "value",
      "confirm_swap",
      "max",
      "swap_success",
      "insufficient_balance",
    ];
    for (const lng of ["en", "vi"]) {
      for (const key of original) expect(i18n.exists(key, { lng })).toBe(true);
    }
    const keys = (lng: string) =>
      Object.keys(i18n.getResourceBundle(lng, "translation") as object).sort();
    expect(keys("vi")).toEqual(keys("en"));
    expect(i18n.t("insufficient_balance", { lng: "vi", amount: "5 USD" })).toBe(
      "Số dư không đủ: 5 USD",
    );
  });
});
