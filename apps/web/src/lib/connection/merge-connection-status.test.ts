import {
  canSubmitBid,
  isLiveBiddingAllowed,
  isRealtimeHealthy,
  liveConnectionMessage,
  mergeConnectionStatus,
} from "@/lib/connection/merge-connection-status";
import type { ConnectionStatus } from "@/lib/realtime/contracts";
import { describe, expect, it } from "vitest";

function socket(partial: Partial<ConnectionStatus>): ConnectionStatus {
  return {
    state: "online",
    rttMs: 50,
    lastSampleAt: Date.now(),
    lastBidPropagationMs: null,
    ...partial,
  };
}

describe("mergeConnectionStatus", () => {
  it("returns offline when browser is offline", () => {
    expect(mergeConnectionStatus(false, socket({ state: "online", rttMs: 50 }))).toBe("offline");
  });

  it("returns offline when socket is offline", () => {
    expect(mergeConnectionStatus(true, socket({ state: "offline", rttMs: null }))).toBe("offline");
  });

  it("returns connecting when socket has no RTT yet", () => {
    expect(mergeConnectionStatus(true, socket({ state: "online", rttMs: null }))).toBe(
      "connecting",
    );
  });

  it("returns connecting when socket state is connecting", () => {
    expect(mergeConnectionStatus(true, socket({ state: "connecting", rttMs: null }))).toBe(
      "connecting",
    );
  });

  it("returns degraded when RTT exceeds threshold", () => {
    expect(mergeConnectionStatus(true, socket({ rttMs: 350 }))).toBe("degraded");
  });

  it("returns live for healthy connection", () => {
    expect(mergeConnectionStatus(true, socket({ rttMs: 80 }))).toBe("live");
  });
});

describe("liveConnectionMessage", () => {
  it("returns null for live state", () => {
    expect(liveConnectionMessage("live")).toBeNull();
  });

  it("returns offline copy", () => {
    expect(liveConnectionMessage("offline")).toContain("No connection");
  });

  it("returns degraded copy that allows bidding", () => {
    expect(liveConnectionMessage("degraded")).toContain("still place bids");
  });
});

describe("canSubmitBid", () => {
  it("allows live and degraded states", () => {
    expect(canSubmitBid("live")).toBe(true);
    expect(canSubmitBid("degraded")).toBe(true);
    expect(canSubmitBid("offline")).toBe(false);
    expect(canSubmitBid("connecting")).toBe(false);
  });
});

describe("isRealtimeHealthy", () => {
  it("only treats live as healthy", () => {
    expect(isRealtimeHealthy("live")).toBe(true);
    expect(isRealtimeHealthy("degraded")).toBe(false);
    expect(isRealtimeHealthy("offline")).toBe(false);
    expect(isRealtimeHealthy("connecting")).toBe(false);
  });
});

describe("isLiveBiddingAllowed", () => {
  it("aliases canSubmitBid", () => {
    expect(isLiveBiddingAllowed("live")).toBe(true);
    expect(isLiveBiddingAllowed("degraded")).toBe(true);
    expect(isLiveBiddingAllowed("offline")).toBe(false);
    expect(isLiveBiddingAllowed("connecting")).toBe(false);
  });
});
