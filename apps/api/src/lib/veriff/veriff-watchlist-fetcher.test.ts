import { afterEach, describe, expect, it, vi } from "vitest";
import { VeriffWatchlistFetcher } from "./veriff-watchlist-fetcher.js";
import { VERIFF_WATCHLIST_NO_MATCH } from "./veriff-watchlist-fixtures.js";

describe("VeriffWatchlistFetcher", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("retries when screening is still in progress (202)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 202 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify(VERIFF_WATCHLIST_NO_MATCH), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const fetcher = new VeriffWatchlistFetcher(
      "api-key",
      "shared-secret",
      "https://stationapi.veriff.com",
      3,
      1,
    );

    const result = await fetcher.fetchBySessionId("f04bdb47-d3be-4b28-b028-a652feb060b5");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result?.result.matchStatus).toBe("no_match");
  });
});
