import { normalizePriceData, type NormalizedPrices } from "@/domain/prices";

/** Public price feed from the challenge brief. Records: `{ currency, date, price }`. */
export const PRICES_URL = "https://interview.switcheo.com/prices.json";

export type PriceFetchErrorKind = "network" | "timeout" | "http" | "invalid";

export class PriceFetchError extends Error {
  readonly kind: PriceFetchErrorKind;
  readonly status: number | undefined;

  constructor(kind: PriceFetchErrorKind, message: string, status?: number) {
    super(message);
    this.name = "PriceFetchError";
    this.kind = kind;
    this.status = status;
  }
}

export interface FetchPriceFeedOptions {
  url?: string;
  /** Caller cancellation (unmount, newer request). Cancellation is re-thrown untouched. */
  signal?: AbortSignal;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export const DEFAULT_TIMEOUT_MS = 8_000;

/** Downloads the raw JSON (untrusted: validate it with `normalizePriceData`). */
export async function fetchPriceFeed(options: FetchPriceFeedOptions = {}): Promise<unknown> {
  const { url = PRICES_URL, signal, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const forwardAbort = (): void => controller.abort();
  if (signal?.aborted === true) controller.abort();
  signal?.addEventListener("abort", forwardAbort, { once: true });

  try {
    const response = await fetchImpl(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new PriceFetchError(
        "http",
        `Price feed answered HTTP ${response.status}`,
        response.status,
      );
    }
    try {
      return (await response.json()) as unknown;
    } catch (error) {
      if (controller.signal.aborted) throw error;
      // Malformed JSON is bad data (not retried). Anything else here means the connection died mid-body.
      if (error instanceof SyntaxError) {
        throw new PriceFetchError("invalid", "Price feed did not return valid JSON");
      }
      throw new PriceFetchError("network", "The connection broke while reading the price feed");
    }
  } catch (error) {
    if (error instanceof PriceFetchError) throw error;
    if (signal?.aborted === true) throw error;
    if (timedOut)
      throw new PriceFetchError("timeout", `Price feed did not answer within ${timeoutMs} ms`);
    throw new PriceFetchError("network", "Could not reach the price feed");
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", forwardAbort);
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

const isRetryable = (error: PriceFetchError): boolean =>
  error.kind === "network" ||
  error.kind === "timeout" ||
  (error.kind === "http" &&
    (error.status === undefined ||
      error.status >= 500 ||
      error.status === 408 ||
      error.status === 429));

function sleep(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted === true) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export interface LoadLivePricesOptions extends FetchPriceFeedOptions {
  /** Extra attempts after the first one, for transient failures only. */
  retries?: number;
  /** First back-off in ms; doubles on each retry. */
  backoffMs?: number;
}

/**
 * Fetches, validates and normalises the live feed. Transient failures (network, timeout, 5xx/429) are retried
 * with exponential back-off; a payload without a single usable price is reported as `invalid`.
 */
export async function loadLivePrices(
  options: LoadLivePricesOptions = {},
): Promise<NormalizedPrices> {
  const { retries = 2, backoffMs = 500, ...fetchOptions } = options;

  for (let attempt = 0; ; attempt += 1) {
    try {
      const prices = normalizePriceData(await fetchPriceFeed(fetchOptions));
      if (prices.entries.length === 0) {
        throw new PriceFetchError("invalid", "Price feed contained no usable prices");
      }
      return prices;
    } catch (error) {
      if (!(error instanceof PriceFetchError) || !isRetryable(error) || attempt >= retries)
        throw error;
      await sleep(backoffMs * 2 ** attempt, fetchOptions.signal);
    }
  }
}
