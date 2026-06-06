import {
  isLiveBiddingAllowed,
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
});

describe("isLiveBiddingAllowed", () => {
  it("only allows live state", () => {
    expect(isLiveBiddingAllowed("live")).toBe(true);
    expect(isLiveBiddingAllowed("offline")).toBe(false);
    expect(isLiveBiddingAllowed("connecting")).toBe(false);
    expect(isLiveBiddingAllowed("degraded")).toBe(false);
  });
});
