import { describe, expect, it } from "vitest";
import { consignmentWithdrawalViewModel } from "./consignment-withdrawal-view";

describe("consignmentWithdrawalViewModel", () => {
  it("hides when there is nothing to withdraw", () => {
    expect(
      consignmentWithdrawalViewModel({ path: "unavailable", canAct: false, request: null }),
    ).toEqual({ mode: "hidden" });
  });

  it("offers to withdraw before cataloguing", () => {
    const vm = consignmentWithdrawalViewModel({
      path: "withdraw_now",
      canAct: true,
      request: null,
    });
    expect(vm).toMatchObject({
      mode: "available",
      copy: { action: "Withdraw consignment" },
      blockedReason: null,
    });
  });

  it("asks staff for a catalogued lot and says who may ask", () => {
    const vm = consignmentWithdrawalViewModel({ path: "request", canAct: false, request: null });
    expect(vm).toMatchObject({
      mode: "available",
      copy: { action: "Ask to withdraw" },
      blockedReason: "Only an owner or admin can ask to withdraw a catalogued lot.",
    });
  });

  it("shows a waiting request and a declined one with its reason", () => {
    expect(
      consignmentWithdrawalViewModel({
        path: "requested",
        canAct: true,
        request: {
          status: "pending",
          requestedAt: new Date("2026-10-21T10:00:00Z"),
          decidedAt: null,
          reason: null,
        },
      }),
    ).toMatchObject({ mode: "requested" });
    const declined = consignmentWithdrawalViewModel({
      path: "request",
      canAct: true,
      request: {
        status: "declined",
        requestedAt: new Date("2026-10-21T10:00:00Z"),
        decidedAt: new Date("2026-10-22T10:00:00Z"),
        reason: "The catalogue has been printed.",
      },
    });
    expect(declined).toMatchObject({ mode: "available" });
    if (declined.mode !== "available") throw new Error("expected available");
    expect(declined.declined).toMatch(/was declined: The catalogue has been printed\.$/);
  });
});

describe("consignmentWithdrawalViewModel on a held account", () => {
  it("gives the hold as the reason instead of an action, whoever the member is", () => {
    const vm = consignmentWithdrawalViewModel(
      { path: "request", canAct: true, request: null },
      "Selling is paused.",
    );
    expect(vm).toMatchObject({ mode: "available", blockedReason: "Selling is paused." });
  });
});
