/** What the (simulated) server receives. Amounts are plain decimal strings. */
export interface SwapSubmission {
  readonly from: string;
  readonly to: string;
  readonly amount: string;
  readonly receive: string;
}

export interface SwapBackend {
  /** Resolves when the server accepted the swap; rejects when it refused or the signal was aborted. */
  submit(request: SwapSubmission, signal?: AbortSignal): Promise<void>;
}

export class SwapBackendError extends Error {
  constructor(message = "Simulated backend failure") {
    super(message);
    this.name = "SwapBackendError";
  }
}

export interface MockSwapBackendOptions {
  minMs?: number;
  maxMs?: number;
  /** When true every submission is rejected (demo of the failure path). */
  alwaysFail?: boolean;
  random?: () => number;
}

/**
 * A stand-in for a real swap API. It only waits (so the pending state is visible) and then accepts or
 * rejects. It never touches the wallet: balances change only after it resolves, in the caller.
 * DEMO ONLY: nothing is sent anywhere.
 */
export function createMockSwapBackend(options: MockSwapBackendOptions = {}): SwapBackend {
  const { minMs = 400, maxMs = 800, alwaysFail = false, random = Math.random } = options;

  return {
    submit(_request, signal) {
      return new Promise<void>((resolve, reject) => {
        if (signal?.aborted === true) {
          reject(new DOMException("Aborted", "AbortError"));
          return;
        }
        const onAbort = (): void => {
          clearTimeout(timer);
          reject(new DOMException("Aborted", "AbortError"));
        };
        const timer = setTimeout(
          () => {
            signal?.removeEventListener("abort", onAbort);
            if (alwaysFail) reject(new SwapBackendError());
            else resolve();
          },
          minMs + random() * (maxMs - minMs),
        );
        signal?.addEventListener("abort", onAbort, { once: true });
      });
    },
  };
}

/** `?simulate=failure` makes every swap fail on purpose, so the failure path can be demonstrated and tested. */
export function isFailureSimulated(search: string): boolean {
  return new URLSearchParams(search).get("simulate") === "failure";
}
