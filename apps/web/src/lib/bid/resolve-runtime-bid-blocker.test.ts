import { describe, expect, it } from "vitest";
import { resolveRuntimeBidBlocker } from "./resolve-runtime-bid-blocker";

describe("resolveRuntimeBidBlocker", () => {
  it("preserves policy blockers ahead of runtime locks", () => {
    const policyDecision = {
      kind: "block" as const,
      viewId: "suspended",
      presentation: {
        tone: "danger" as const,
        title: "Account suspended",
        detail: "Blocked",
      },
      render: () => null,
    };

    expect(
      resolveRuntimeBidBlocker({
        policyDecision,
        unsupportedAuctionMode: true,
        connectionBlocked: true,
        connectionState: "offline",
      }),
    ).toBe(policyDecision);
  });

  it("uses the unsupported catalogue blocker before connectivity", () => {
    const result = resolveRuntimeBidBlocker({
      policyDecision: { kind: "allow" },
      unsupportedAuctionMode: true,
      connectionBlocked: true,
      connectionState: "offline",
    });

    expect(result).toMatchObject({
      kind: "block",
      viewId: "unsupported-auction-mode",
      presentation: { action: { kind: "link", label: "Contact the saleroom" } },
    });
  });

  it.each([
    { state: "offline" as const, label: "Offline" },
    { state: "connecting" as const, label: "Reconnecting" },
    { state: "degraded" as const, label: "Reconnecting" },
  ])("turns a $state connection lock into status-only presentation", ({ state, label }) => {
    const result = resolveRuntimeBidBlocker({
      policyDecision: { kind: "allow" },
      unsupportedAuctionMode: false,
      connectionBlocked: true,
      connectionState: state,
      connectionMessage: "Connection message",
    });

    expect(result).toMatchObject({
      kind: "block",
      viewId: "connection-unavailable",
      presentation: {
        detail: "Connection message",
        action: { kind: "status", label },
      },
    });
  });

  it("keeps allow when no runtime lock applies", () => {
    expect(
      resolveRuntimeBidBlocker({
        policyDecision: { kind: "allow" },
        unsupportedAuctionMode: false,
        connectionBlocked: false,
        connectionState: "live",
      }),
    ).toEqual({ kind: "allow" });
  });
});
