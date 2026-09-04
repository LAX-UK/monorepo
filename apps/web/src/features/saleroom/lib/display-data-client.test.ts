import { beforeEach, describe, expect, it, vi } from "vitest";

const browserFetch = vi.fn();
vi.mock("@/lib/data/http/hc-browser", () => ({ browserFetch }));

const { createDisplayDataClient } = await import("./display-data-client");

describe("display data client routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    browserFetch.mockResolvedValue(Response.json({ data: {} }));
  });

  it("routes pairing and bearer-authenticated operations through the dedicated display proxy", async () => {
    const client = createDisplayDataClient();
    const saleId = "5cf0cb93-4ed4-4d9f-bbc3-e53fe77be63e";

    await client.startPairing();
    await client.pollPairing("ABCD-EFGH");
    await client.fetchSnapshot(saleId, "display-secret");
    await client.sendHeartbeat("display-secret");

    expect(browserFetch.mock.calls.map(([url]) => url)).toEqual([
      "/api/display/pair/start",
      "/api/display/pair/poll",
      `/api/display/${saleId}/snapshot`,
      "/api/display/heartbeat",
    ]);
  });
});
