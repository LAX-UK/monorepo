import type { CollectionAvailability } from "@auction/types";
import { describe, expect, it } from "vitest";
import { collectReducer, initialCollectState } from "./collect-state";

const slot = (start: string, placesLeft = 2) => ({
  start,
  end: start,
  placesLeft,
  state: placesLeft > 0 ? ("open" as const) : ("full" as const),
});

function availability(overrides: Partial<CollectionAvailability> = {}): CollectionAvailability {
  return {
    venueId: "v",
    onlineBookingEnabled: true,
    bookingEmail: null,
    visitMinutes: 30,
    windowDays: 28,
    noticeCutoffLocal: "16:00",
    timeZone: "Europe/London",
    earliest: null,
    days: [
      {
        date: "2026-11-12",
        state: "open",
        openSlots: 1,
        slots: [slot("2026-11-12T10:00:00.000Z")],
      },
      {
        date: "2026-11-13",
        state: "open",
        openSlots: 1,
        slots: [slot("2026-11-13T10:00:00.000Z")],
      },
    ],
    lots: [
      {
        lotId: "a",
        title: "A",
        lotNumber: 1,
        collectable: true,
        blockedReason: null,
        blockedMessage: null,
      },
      {
        lotId: "b",
        title: "B",
        lotNumber: 2,
        collectable: false,
        blockedReason: "refund_open",
        blockedMessage: "Refund",
      },
    ],
    ...overrides,
  };
}

const start = () =>
  initialCollectState({
    availability: availability(),
    lotIds: ["a", "b"],
    visit: null,
    myName: "Ada",
  });

describe("collectReducer", () => {
  it("opens with only the lots that can be booked ticked and the first open day chosen", () => {
    const state = start();
    expect(state.lotIds).toEqual(["a"]);
    expect(state.day).toBe("2026-11-12");
    expect(state.slotStart).toBeNull();
  });

  it("drops a chosen time when the person picks another day", () => {
    let state = collectReducer(start(), { type: "select_slot", start: "2026-11-12T10:00:00.000Z" });
    state = collectReducer(state, { type: "select_day", date: "2026-11-13" });
    expect(state.slotStart).toBeNull();
  });

  it("clears the sentence under a field once it is fixed", () => {
    let state = collectReducer(start(), {
      type: "invalid",
      errors: [{ fieldId: "collect-time", message: "Choose a time." }],
    });
    expect(state.errors).toHaveLength(1);
    expect(state.attempts).toBe(1);
    state = collectReducer(state, { type: "select_slot", start: "2026-11-12T10:00:00.000Z" });
    expect(state.errors).toHaveLength(0);
  });

  it("keeps everything when the time is taken, and drops only the time", () => {
    let state = collectReducer(start(), { type: "select_slot", start: "2026-11-12T10:00:00.000Z" });
    state = collectReducer(state, { type: "set_field", field: "name", value: "Sam" });
    state = collectReducer(state, { type: "submit" });
    state = collectReducer(state, {
      type: "failed",
      failure: { kind: "slot_taken", title: "t", message: "m", refresh: true },
    });
    const fresh = availability({
      days: [
        {
          date: "2026-11-12",
          state: "full",
          openSlots: 0,
          slots: [slot("2026-11-12T10:00:00.000Z", 0)],
        },
      ],
    });
    state = collectReducer(state, { type: "refreshed", availability: fresh });
    expect(state.slotStart).toBeNull();
    expect(state.name).toBe("Sam");
    expect(state.lotIds).toEqual(["a"]);
    expect(state.phase).toBe("idle");
  });

  it("clears the time-taken notice when another time is chosen", () => {
    let state = collectReducer(start(), {
      type: "failed",
      failure: { kind: "slot_taken", title: "t", message: "m", refresh: true },
    });
    state = collectReducer(state, { type: "select_slot", start: "2026-11-13T10:00:00.000Z" });
    expect(state.failure).toBeNull();
  });
});
