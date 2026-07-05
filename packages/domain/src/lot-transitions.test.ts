import { describe, expect, it } from "vitest";
import {
  LOT_CANCELLABLE_STATUSES,
  LOT_TRANSITIONS,
  canAdminOverrideLotStatus,
  canTransition,
} from "./lot-transitions.js";

describe("lot-transitions", () => {
  it("LOT_CANCELLABLE_STATUSES matches cancel transition from-set", () => {
    expect([...LOT_CANCELLABLE_STATUSES].sort()).toEqual(["active", "draft", "scheduled"]);
    expect(LOT_CANCELLABLE_STATUSES.has("draft")).toBe(true);
    expect(LOT_CANCELLABLE_STATUSES.has("scheduled")).toBe(true);
    expect(LOT_CANCELLABLE_STATUSES.has("active")).toBe(true);
    expect(LOT_CANCELLABLE_STATUSES.has("ended")).toBe(false);
    expect(LOT_CANCELLABLE_STATUSES.has("cancelled")).toBe(false);
  });

  it("LOT_CANCELLABLE_STATUSES is a defensive copy of cancel transition from-set", () => {
    const cancelFrom = LOT_TRANSITIONS.find((t) => t.kind === "cancel")!.from;
    expect(LOT_CANCELLABLE_STATUSES).not.toBe(cancelFrom);
    expect([...LOT_CANCELLABLE_STATUSES].sort()).toEqual([...cancelFrom].sort());
  });

  it("allows return_to_inventory from ended without winner", () => {
    expect(canTransition("ended", "return_to_inventory")).toBe(true);
    expect(canTransition("cancelled", "return_to_inventory")).toBe(true);
    expect(canTransition("voided", "return_to_inventory")).toBe(true);
    expect(canTransition("draft", "return_to_inventory")).toBe(false);
  });

  it("allows admin override back to draft from terminal states", () => {
    expect(canAdminOverrideLotStatus("ended", "draft")).toBe(true);
    expect(canAdminOverrideLotStatus("cancelled", "draft")).toBe(true);
    expect(canAdminOverrideLotStatus("voided", "draft")).toBe(true);
  });
});
