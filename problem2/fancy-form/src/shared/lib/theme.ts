export type Theme = "light" | "dark";

/** Same key the original Fancy Form used, so an existing choice survives the upgrade. */
export const THEME_STORAGE_KEY = "theme";

const isTheme = (value: unknown): value is Theme => value === "light" || value === "dark";

export function readStoredTheme(): Theme | null {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(stored) ? stored : null;
  } catch {
    return null; // storage can be blocked (privacy mode)
  }
}

export function systemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Stored choice first, then the OS preference. Keep in sync with `public/theme-init.js`. */
export function getInitialTheme(): Theme {
  return readStoredTheme() ?? systemTheme();
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme);
  root.style.colorScheme = theme;
}

export function storeTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Not persisted; the choice still applies for this session.
  }
}
