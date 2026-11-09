import { render } from "@testing-library/react";
import { vi } from "vitest";
import { Toaster } from "sonner";
import type { ReactElement } from "react";
import type { SwapBackend } from "@/shared/api/mockSwapBackend";

export const jsonResponse = (body: unknown, init: ResponseInit = {}): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });

/** Records in the real feed's shape, all at one timestamp. */
export const feed = (...pairs: [symbol: string, price: number][]) =>
  pairs.map(([currency, price]) => ({ currency, price, date: "2023-08-29T07:10:40.000Z" }));

/** USD = 2, bNEO = 4, ETH = 2000: easy numbers (3 USD → 1.5 bNEO). */
export const EASY_FEED = feed(["USD", 2], ["bNEO", 4], ["ETH", 2000]);

export function stubFetch(handler: () => Response | Promise<Response>) {
  const mock = vi.fn<typeof fetch>(() => Promise.resolve(handler()));
  vi.stubGlobal("fetch", mock);
  return mock;
}

/** A backend that answers immediately (or refuses), and counts calls. */
export function instantBackend(outcome: "accept" | "reject" = "accept") {
  const submit = vi.fn<SwapBackend["submit"]>(() =>
    outcome === "accept" ? Promise.resolve() : Promise.reject(new Error("simulated refusal")),
  );
  return { backend: { submit } satisfies SwapBackend, submit };
}

/** A backend whose answer the test controls, to observe the pending state. */
export function manualBackend() {
  let release: () => void = () => undefined;
  const submit = vi.fn<SwapBackend["submit"]>(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  return { backend: { submit } satisfies SwapBackend, submit, release: () => release() };
}

export function renderWithToaster(ui: ReactElement) {
  return render(
    <>
      {ui}
      <Toaster />
    </>,
  );
}
