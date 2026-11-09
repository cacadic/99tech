import { afterEach, describe, expect, it, vi } from "vitest";
import { feed, jsonResponse } from "@/test/helpers";
import {
  fetchPriceFeed,
  isAbortError,
  loadLivePrices,
  PRICES_URL,
  PriceFetchError,
} from "./prices";

const kind = async (promise: Promise<unknown>): Promise<string> => {
  try {
    await promise;
  } catch (error) {
    return error instanceof PriceFetchError ? error.kind : `other:${String(error)}`;
  }
  return "resolved";
};

afterEach(() => {
  vi.useRealTimers();
});

describe("fetchPriceFeed", () => {
  it("requests the public price feed and returns the parsed JSON", async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse([{ a: 1 }])));
    await expect(fetchPriceFeed({ fetchImpl })).resolves.toEqual([{ a: 1 }]);
    expect(fetchImpl).toHaveBeenCalledWith(
      PRICES_URL,
      expect.objectContaining({ headers: { Accept: "application/json" } }),
    );
  });

  it.each([
    ["HTTP 500", () => Promise.resolve(new Response("boom", { status: 500 })), "http"],
    ["HTTP 404", () => Promise.resolve(new Response("nope", { status: 404 })), "http"],
    [
      "a body that is not JSON",
      () => Promise.resolve(new Response("<html>", { status: 200 })),
      "invalid",
    ],
    ["a network failure", () => Promise.reject(new TypeError("Failed to fetch")), "network"],
  ])("classifies %s as %s", async (_label, respond, expected) => {
    expect(await kind(fetchPriceFeed({ fetchImpl: vi.fn(respond) }))).toBe(expected);
  });

  it("a connection that dies while the body is being read is a network fault (retryable), not bad data", async () => {
    const dying = () =>
      Promise.resolve(
        new Response(
          new ReadableStream({
            start(controller) {
              controller.error(new TypeError("terminated"));
            },
          }),
          { status: 200 },
        ),
      );
    expect(await kind(fetchPriceFeed({ fetchImpl: dying }))).toBe("network");
  });

  it("reports the HTTP status", async () => {
    const error = await fetchPriceFeed({
      fetchImpl: () => Promise.resolve(new Response("", { status: 503 })),
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(PriceFetchError);
    expect((error as PriceFetchError).status).toBe(503);
  });

  it("times out a request that never answers", async () => {
    vi.useFakeTimers();
    const fetchImpl = (_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      });
    const pending = kind(fetchPriceFeed({ fetchImpl, timeoutMs: 1_000 }));
    await vi.advanceTimersByTimeAsync(1_001);
    expect(await pending).toBe("timeout");
  });

  it("lets caller cancellation through unchanged (it is not an error to report)", async () => {
    const controller = new AbortController();
    const fetchImpl = (_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      });
    const pending = fetchPriceFeed({ fetchImpl, signal: controller.signal }).catch(
      (e: unknown) => e,
    );
    controller.abort();
    expect(isAbortError(await pending)).toBe(true);
  });

  it("does not start when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchImpl = vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
      init?.signal?.aborted === true
        ? Promise.reject(new DOMException("Aborted", "AbortError"))
        : Promise.resolve(jsonResponse([])),
    );
    const result = await fetchPriceFeed({ fetchImpl, signal: controller.signal }).catch(
      (e: unknown) => e,
    );
    expect(isAbortError(result)).toBe(true);
  });
});

describe("loadLivePrices", () => {
  it("normalises the feed", async () => {
    const result = await loadLivePrices({
      fetchImpl: () => Promise.resolve(jsonResponse(feed(["USD", 1], ["ETH", 2000]))),
    });
    expect(result.entries.map((e) => e.currency)).toEqual(["USD", "ETH"]);
  });

  it("retries transient failures with a growing back-off, then succeeds", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError("offline"))
      .mockResolvedValueOnce(new Response("", { status: 503 }))
      .mockResolvedValueOnce(jsonResponse(feed(["USD", 1])));
    const pending = loadLivePrices({ fetchImpl, retries: 2, backoffMs: 100 });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(99);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2); // 100 ms
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(198); // t = 299 ms: second back-off (200 ms after t = 100) not over yet
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(2); // t = 301 ms
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect((await pending).entries).toHaveLength(1);
  });

  it("gives up after the configured retries and reports the last error", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn<typeof fetch>(() => Promise.reject(new TypeError("offline")));
    const pending = kind(loadLivePrices({ fetchImpl, retries: 2, backoffMs: 10 }));
    await vi.advanceTimersByTimeAsync(1_000);
    expect(await pending).toBe("network");
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("does not retry errors that will not fix themselves (404, malformed payload)", async () => {
    const notFound = vi.fn<typeof fetch>(() => Promise.resolve(new Response("", { status: 404 })));
    expect(await kind(loadLivePrices({ fetchImpl: notFound }))).toBe("http");
    expect(notFound).toHaveBeenCalledTimes(1);

    const badJson = vi.fn<typeof fetch>(() => Promise.resolve(new Response("{", { status: 200 })));
    expect(await kind(loadLivePrices({ fetchImpl: badJson }))).toBe("invalid");
    expect(badJson).toHaveBeenCalledTimes(1);
  });

  it("treats a feed without one usable price as invalid", async () => {
    const fetchImpl = () =>
      Promise.resolve(jsonResponse([{ currency: "USD", price: 0, date: "2023-01-01" }]));
    expect(await kind(loadLivePrices({ fetchImpl }))).toBe("invalid");
  });

  it("stops waiting between retries when cancelled", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const fetchImpl = vi.fn<typeof fetch>(() => Promise.reject(new TypeError("offline")));
    const pending = loadLivePrices({
      fetchImpl,
      signal: controller.signal,
      retries: 2,
      backoffMs: 10_000,
    }).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(5);
    controller.abort();
    expect(isAbortError(await pending)).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
