import { useSyncExternalStore } from "react";
import type { Theme } from "@/shared/lib/theme";

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => {
    observer.disconnect();
  };
}

const getSnapshot = (): Theme =>
  document.documentElement.classList.contains("light") ? "light" : "dark";

/** The theme currently applied to <html>, for components that live outside the theme switch (e.g. toasts). */
export function useDocumentTheme(): Theme {
  return useSyncExternalStore(subscribe, getSnapshot, () => "dark");
}
