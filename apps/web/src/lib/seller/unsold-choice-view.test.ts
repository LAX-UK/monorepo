import type { SellerUnsoldLotView, UnsoldLotChoice } from "@auction/types";
import { describe, expect, it } from "vitest";
import { unsoldChoiceSummary, unsoldChoiceViewModel } from "./unsold-choice-view";

const base: SellerUnsoldLotView = {
  lotId: "lot-1",
  currentReserve: "5000.00",
  reserveFloor: "3000.00",
  currency: "GBP",
  chooseBy: "2026-11-03T18:00:00.000Z",
  choice: null,
  canChoose: true,
  choicePaused: false,
};

function choice(overrides: Partial<UnsoldLotChoice>): UnsoldLotChoice {
  return {
    id: "c1",
    lotId: "lot-1",
    submissionId: "s1",
    legalEntityId: "e1",
    lotEndTime: new Date("2026-10-20T18:00:00Z"),
    status: "requested",
    requestedChoice: "relist",
    requestedReserve: "4000.00",
    requestedByUserId: "u1",
    requestedByName: "Jane Smith",
    requestedAt: new Date("2026-10-21T10:00:00Z"),
    decidedChoice: null,
    decidedReserve: null,
    decidedByUserId: null,
    decidedAt: null,
    staffNote: null,
    currency: "GBP",
    createdAt: new Date("2026-10-21T10:00:00Z"),
    updatedAt: new Date("2026-10-21T10:00:00Z"),
    ...overrides,
  };
}

describe("unsoldChoiceSummary", () => {
  it("names the outcome and any new reserve", () => {
    expect(unsoldChoiceSummary("relist", "4000.00", "GBP")).toBe(
      "Relist it with a reserve of £4,000",
    );
    expect(unsoldChoiceSummary("relist", null, "GBP")).toBe("Relist it with the current reserve");
    expect(unsoldChoiceSummary("collect", null, "GBP")).toBe("Have it returned");
  });
});

describe("unsoldChoiceViewModel", () => {
  it("asks the person to choose, with the current reserve and the floor", () => {
    expect(unsoldChoiceViewModel(base, { organisationName: null })).toEqual({
      mode: "choose",
      reserveHint:
        "Leave it empty to keep the current reserve of £5,000. Your specialist accepts no lower than £3,000.",
    });
  });

  it("tells a consignor who chooses", () => {
    const vm = unsoldChoiceViewModel(
      { ...base, canChoose: false },
      {
        organisationName: "Northbank Gallery",
      },
    );
    expect(vm).toEqual({
      mode: "waiting_on_admin",
      message:
        "An owner or admin of Northbank Gallery chooses what happens next. You'll see their choice here.",
    });
  });

  it("offers no form while the organisation's state pauses choices, only a way to contact us", () => {
    const vm = unsoldChoiceViewModel(
      { ...base, canChoose: false, choicePaused: true },
      { organisationName: "Northbank Gallery" },
    );
    expect(vm).toMatchObject({
      mode: "paused",
      message:
        "Choices for works that did not sell are paused for Northbank Gallery, so we'll decide what happens next with you.",
      contact: { label: "Contact us" },
    });
    expect(vm.mode === "paused" && vm.contact.href.startsWith("mailto:")).toBe(true);
  });

  it("shows a request waiting for the specialist, and who may change it", () => {
    const vm = unsoldChoiceViewModel(
      { ...base, canChoose: false, choice: choice({}) },
      { organisationName: "Northbank Gallery" },
    );
    expect(vm).toMatchObject({
      mode: "requested",
      summary: "Relist it with a reserve of £4,000",
      canChange: false,
    });
    if (vm.mode !== "requested") throw new Error("expected requested");
    expect(vm.history[0]).toMatchObject({ by: "Jane Smith" });
  });

  it("shows the confirmed outcome with the specialist's note", () => {
    const vm = unsoldChoiceViewModel(
      {
        ...base,
        choice: choice({
          status: "confirmed",
          decidedChoice: "private_sale",
          decidedAt: new Date("2026-10-22T10:00:00Z"),
          staffNote: "A private buyer has asked about it.",
        }),
      },
      { organisationName: null },
    );
    expect(vm).toMatchObject({
      mode: "confirmed",
      summary: "Sell it privately",
      adjusted: true,
      note: "A private buyer has asked about it.",
    });
    if (vm.mode !== "confirmed") throw new Error("expected confirmed");
    expect(vm.history.map((h) => h.label)).toEqual([
      "Asked: Relist it with a reserve of £4,000",
      "Confirmed: Sell it privately",
    ]);
  });
});
