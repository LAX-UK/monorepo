import { afterEach, describe, expect, it, vi } from "vitest";
import { parseLotCardStates } from "./lot-card-states";

describe("parseLotCardStates", () => {
  it("reads each lot's position and next bid", () => {
    expect(
      parseLotCardStates([
        { lotId: "a", position: "outbid", nextBidAmount: "6250.00" },
        { lotId: "b", position: "leading", nextBidAmount: null },
      ]),
    ).toEqual([
      { lotId: "a", position: "outbid", nextBidAmount: "6250.00" },
      { lotId: "b", position: "leading", nextBidAmount: null },
    ]);
  });

  it("leaves out entries it cannot understand", () => {
    expect(
      parseLotCardStates([{ lotId: "a", position: "none" }, { position: "leading" }, 4]),
    ).toEqual([]);
    expect(parseLotCardStates(null)).toEqual([]);
  });
});

describe("fetchLotCardState", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it("sends the asks of one moment as a single request", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async (_url: string) => ({
      ok: true,
      json: async () => ({ data: [{ lotId: "a", position: "leading", nextBidAmount: null }] }),
    }));
    vi.doMock("@/lib/data/http/hc-browser", () => ({
      browserApiBase: () => "http://api",
      browserFetch: fetchMock,
    }));
    const { fetchLotCardState } = await import("./lot-card-states.client");
    const results = Promise.all([fetchLotCardState("a"), fetchLotCardState("b")]);
    await vi.advanceTimersByTimeAsync(50);
    const [a, b] = await results;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://api/users/me/lot-states?lotIds=a%2Cb");
    expect(a?.position).toBe("leading");
    expect(b).toBeNull();
  });
});
