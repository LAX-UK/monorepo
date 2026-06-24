import { LIVE_CONNECTIVITY_COPY } from "@/lib/connection/live-connectivity-copy";
import { resolveLiveConnectivityBanner } from "@/lib/connection/resolve-live-connectivity-banner";
import { describe, expect, it } from "vitest";

describe("resolveLiveConnectivityBanner", () => {
  it("prefers socket offline over hydrate notices", () => {
    const result = resolveLiveConnectivityBanner({
      scope: "bidding",
      connectionState: "offline",
      notices: [
        {
          id: "lot-hydrate-failed-lot-1",
          message: LIVE_CONNECTIVITY_COPY.lotHydrateFailed,
        },
      ],
    });

    expect(result.message).toContain("live bidding is paused");
    expect(result.state).toBe("offline");
  });

  it("uses saleroom-scoped socket copy", () => {
    const result = resolveLiveConnectivityBanner({
      scope: "saleroom",
      connectionState: "degraded",
      notices: [],
    });

    expect(result.message).toBe("Slow connection — saleroom updates may be delayed.");
  });

  it("shows a scoped hydrate notice when the socket is live", () => {
    const result = resolveLiveConnectivityBanner({
      scope: "saleroom",
      connectionState: "live",
      notices: [
        {
          id: "saleroom-hydrate-failed-sale-1",
          message: LIVE_CONNECTIVITY_COPY.saleroomHydrateFailed,
        },
        {
          id: "lot-hydrate-failed-lot-1",
          message: LIVE_CONNECTIVITY_COPY.lotHydrateFailed,
        },
      ],
    });

    expect(result.state).toBe("degraded");
    expect(result.message).toBe(LIVE_CONNECTIVITY_COPY.saleroomHydrateFailed);
  });

  it("returns live with no message when healthy and no notices", () => {
    const result = resolveLiveConnectivityBanner({
      scope: "bidding",
      connectionState: "live",
      notices: [],
    });

    expect(result).toEqual({ state: "live", message: null });
  });

  describe("hybrid scope", () => {
    it("uses bidding socket copy when the socket is unhealthy", () => {
      const result = resolveLiveConnectivityBanner({
        scope: "hybrid",
        connectionState: "offline",
        notices: [
          {
            id: "saleroom-hydrate-failed-sale-1",
            message: LIVE_CONNECTIVITY_COPY.saleroomHydrateFailed,
          },
        ],
      });

      expect(result.state).toBe("offline");
      expect(result.message).toContain("live bidding is paused");
    });

    it("shows a lot hydrate notice when the socket is live", () => {
      const result = resolveLiveConnectivityBanner({
        scope: "hybrid",
        connectionState: "live",
        notices: [
          {
            id: "lot-hydrate-failed-lot-1",
            message: LIVE_CONNECTIVITY_COPY.lotHydrateFailed,
          },
        ],
      });

      expect(result.state).toBe("degraded");
      expect(result.message).toBe(LIVE_CONNECTIVITY_COPY.lotHydrateFailed);
    });

    it("shows a saleroom hydrate notice when the socket is live and lot hydrate is absent", () => {
      const result = resolveLiveConnectivityBanner({
        scope: "hybrid",
        connectionState: "live",
        notices: [
          {
            id: "saleroom-hydrate-failed-sale-1",
            message: LIVE_CONNECTIVITY_COPY.saleroomHydrateFailed,
          },
        ],
      });

      expect(result.state).toBe("degraded");
      expect(result.message).toBe(LIVE_CONNECTIVITY_COPY.saleroomHydrateFailed);
    });

    it("prefers lot hydrate notice over saleroom when both are present", () => {
      const result = resolveLiveConnectivityBanner({
        scope: "hybrid",
        connectionState: "live",
        notices: [
          {
            id: "saleroom-hydrate-failed-sale-1",
            message: LIVE_CONNECTIVITY_COPY.saleroomHydrateFailed,
          },
          {
            id: "lot-hydrate-failed-lot-1",
            message: LIVE_CONNECTIVITY_COPY.lotHydrateFailed,
          },
        ],
      });

      expect(result.message).toBe(LIVE_CONNECTIVITY_COPY.lotHydrateFailed);
    });
  });
});
