import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, beforeEach, vi } from "vitest";
import { DEFAULT_BALANCES } from "@/domain/wallet";
import i18n from "@/shared/config/i18n/i18n";
import { usePriceStore } from "@/shared/hooks/use-price-store";
import { useWalletStore } from "@/shared/hooks/use-wallet-store";

beforeEach(async () => {
  window.localStorage.clear();
  document.documentElement.className = "";
  document.documentElement.removeAttribute("style");

  // jsdom has no matchMedia; default to "no match" (light, motion allowed). Tests can override it.
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string): MediaQueryList => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });

  // Every test starts from the same app state.
  usePriceStore.getState().cancel();
  usePriceStore.setState({
    status: "idle",
    source: null,
    entries: [],
    book: null,
    asOf: null,
    failure: null,
  });
  useWalletStore.setState({ coins: DEFAULT_BALANCES, pendingSwap: false });
  await i18n.changeLanguage("en");
});

// jsdom lacks these browser APIs; cmdk (ResizeObserver, scrollIntoView) and Radix (pointer capture) call them.
class ResizeObserverStub implements ResizeObserver {
  observe = (): void => undefined;
  unobserve = (): void => undefined;
  disconnect = (): void => undefined;
}
globalThis.ResizeObserver = ResizeObserverStub;
Element.prototype.scrollIntoView = () => undefined;
Element.prototype.hasPointerCapture = () => false;
Element.prototype.setPointerCapture = () => undefined;
Element.prototype.releasePointerCapture = () => undefined;

afterEach(() => {
  cleanup();
  toast.dismiss();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
