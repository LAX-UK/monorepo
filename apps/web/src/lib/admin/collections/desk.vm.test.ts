import { describe, expect, it } from "vitest";
import { DESK_LOT_A, deskLot } from "./desk.fixture";
import {
  deskDayLabel,
  deskRefusalMessage,
  handOverBlock,
  idTypeLabel,
  lotLabel,
  lotReadiness,
  markCollectedLabel,
  nextDay,
  placesLabel,
  previousDay,
  timeRange,
} from "./desk.vm";

describe("the desk view model", () => {
  it("says places taken against capacity", () => {
    expect(placesLabel({ taken: 2, capacity: 2 })).toBe("2 of 2 booked");
    expect(placesLabel({ taken: 0, capacity: 3 })).toBe("0 of 3 booked");
  });

  it("draws a time as a range in London time", () => {
    expect(timeRange({ start: "2026-11-12T14:00:00.000Z", end: "2026-11-12T14:30:00.000Z" })).toBe(
      "14:00–14:30",
    );
    // British Summer Time: 13:00 UTC is 14:00 in London.
    expect(timeRange({ start: "2026-06-12T13:00:00.000Z", end: "2026-06-12T13:30:00.000Z" })).toBe(
      "14:00–14:30",
    );
  });

  it("draws a day in the one date style, and moves by days", () => {
    expect(deskDayLabel("2026-11-12", new Date("2026-11-09T10:00:00Z"))).toBe("Thu 12 Nov");
    expect(nextDay("2026-11-30")).toBe("2026-12-01");
    expect(previousDay("2026-03-01")).toBe("2026-02-28");
  });

  it("reads a lot's readiness", () => {
    expect(lotReadiness(deskLot())).toEqual({ label: "Released", tone: "success" });
    expect(lotReadiness(deskLot({ fulfilmentStatus: "ready_for_collection" }))).toEqual({
      label: "Ready",
      tone: "success",
    });
    expect(
      lotReadiness(deskLot({ released: false, fulfilmentStatus: "awaiting_release" })),
    ).toEqual({
      label: "Release first",
      tone: "warning",
    });
  });

  it("labels lots and the hand-over button", () => {
    expect(lotLabel(deskLot())).toBe("Lot 4 · Coastal Notation");
    expect(lotLabel(deskLot({ lotNumber: null }))).toBe("Coastal Notation");
    expect(markCollectedLabel([{ title: "Coastal Notation" }])).toBe(
      "Mark Coastal Notation collected",
    );
    expect(markCollectedLabel([{ title: "A" }, { title: "B" }])).toBe("Mark 2 lots collected");
  });

  it("says why a hand-over cannot be done yet, in the order staff fix it", () => {
    const waiting = deskLot({ released: false, fulfilmentStatus: "awaiting_release" });
    expect(handOverBlock({ ticked: [], idChecked: true })).toBe("Tick at least one lot.");
    expect(handOverBlock({ ticked: [waiting], idChecked: false })).toBe(
      "Release Coastal Notation first.",
    );
    expect(handOverBlock({ ticked: [waiting, { ...waiting, lotId: "x" }], idChecked: true })).toBe(
      "Release 2 lots first.",
    );
    expect(handOverBlock({ ticked: [deskLot()], idChecked: false })).toBe(
      "Confirm the photo ID check first.",
    );
    expect(handOverBlock({ ticked: [deskLot()], idChecked: true })).toBeNull();
  });

  it("names the ID types and never offers a number", () => {
    expect(idTypeLabel("passport")).toBe("Passport");
    expect(idTypeLabel("national_identity_card")).toBe("National identity card");
  });

  it("gives a sentence for each refusal the API sends", () => {
    for (const code of [
      "not_released",
      "hold_open",
      "undo_window_passed",
      "too_early",
      "booking_changed",
      "fulfilment_failed",
      "slot_full",
      "notice_passed",
    ]) {
      expect(deskRefusalMessage(code, "fallback")).not.toBe("fallback");
    }
    expect(deskRefusalMessage("something_new", "fallback")).toBe("fallback");
    expect(DESK_LOT_A).toBeTruthy();
  });
});
