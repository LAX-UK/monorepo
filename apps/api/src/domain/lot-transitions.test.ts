import { describe, expect, it } from "vitest";
import { canAdminOverrideLotStatus, canTransition } from "./lot-transitions.js";

describe("lot-transitions", () => {
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
