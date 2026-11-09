// Runs before first paint (an external script, so a strict CSP needs no 'unsafe-inline') to avoid a flash of the
// wrong theme. Keep the key and rule in sync with src/shared/lib/theme.ts: stored choice first, then the OS.
(function () {
  var theme = null;
  try {
    var stored = window.localStorage.getItem("theme");
    if (stored === "light" || stored === "dark") theme = stored;
  } catch {
    // Storage can be unavailable (privacy mode); fall back to the system preference.
  }
  if (theme === null) {
    theme =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
  }
  var root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme);
  root.style.colorScheme = theme;
})();
