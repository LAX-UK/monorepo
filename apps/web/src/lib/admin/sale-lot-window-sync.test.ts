import type { Lot } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  findLotsOutsideSaleWindow,
  findPersistBlockingLotWindowConflicts,
  lotsForPendingWindow,
  parseSaleWindowFromForm,
  proposeLotTimesWithinWindow,
} from "./sale-lot-window-sync";

const saleStart = new Date("2030-06-01T10:00:00Z");
const saleEnd = new Date("2030-06-07T18:00:00Z");

function lot(overrides: Partial<Lot> = {}): Lot {
  return {
    id: "lot-1",
    title: "Blue vase",
    startTime: new Date("2030-06-01T10:00:00Z"),
    endTime: new Date("2030-06-02T18:00:00Z"),
    ...overrides,
  } as Lot;
}

describe("parseSaleWindowFromForm", () => {
  it("parses valid online sale window", () => {
    const window = parseSaleWindowFromForm({
      timeZone: "Europe/London",
      deliveryMode: "online",
      startTime: "2030-06-01T10:00",
      endTime: "2030-06-07T18:00",
    });
    expect(window).not.toBeNull();
    expect(window?.deliveryMode).toBe("online");
  });

  it("returns null when end is before start", () => {
    expect(
      parseSaleWindowFromForm({
        timeZone: "Europe/London",
        deliveryMode: "online",
        startTime: "2030-06-07T18:00",
        endTime: "2030-06-01T10:00",
      }),
    ).toBeNull();
  });
});

describe("findLotsOutsideSaleWindow", () => {
  it("flags lot start before sale start", () => {
    const conflicts = findLotsOutsideSaleWindow(
      [lot({ startTime: new Date("2030-05-31T10:00:00Z") })],
      { timeZone: "Europe/London", deliveryMode: "online", startTime: saleStart, endTime: saleEnd },
    );
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.violation).toContain("Lot start must not be before");
  });

  it("flags lot end after sale end", () => {
    const conflicts = findLotsOutsideSaleWindow(
      [lot({ endTime: new Date("2030-06-08T18:00:00Z") })],
      { timeZone: "Europe/London", deliveryMode: "online", startTime: saleStart, endTime: saleEnd },
    );
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.violation).toContain("Lot end must not be after");
  });

  it("returns empty when lot fits window", () => {
    const conflicts = findLotsOutsideSaleWindow([lot()], {
      timeZone: "Europe/London",
      deliveryMode: "online",
      startTime: saleStart,
      endTime: saleEnd,
    });
    expect(conflicts).toHaveLength(0);
  });

  it("flags onsite lots that drift from the sale window", () => {
    const conflicts = findLotsOutsideSaleWindow(
      [
        lot({
          startTime: new Date("2020-01-01T00:00:00Z"),
          endTime: new Date("2020-01-02T00:00:00Z"),
        }),
      ],
      { timeZone: "Europe/London", deliveryMode: "onsite", startTime: saleStart, endTime: saleEnd },
    );
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.violation).toContain("Onsite lots");
  });
});

describe("findPersistBlockingLotWindowConflicts", () => {
  const mismatchedLot = lot({
    startTime: new Date("2020-01-01T00:00:00Z"),
    endTime: new Date("2020-01-02T00:00:00Z"),
  });

  it("blocks online sales when lots drift from the pending window", () => {
    const conflicts = findPersistBlockingLotWindowConflicts(
      [mismatchedLot],
      {
        timeZone: "Europe/London",
        deliveryMode: "online",
        startTime: saleStart,
        endTime: saleEnd,
      },
      "Europe/London",
    );
    expect(conflicts).toHaveLength(1);
  });

  it("does not block onsite sales because saving the schedule syncs draft lots", () => {
    const conflicts = findPersistBlockingLotWindowConflicts(
      [mismatchedLot],
      {
        timeZone: "Europe/London",
        deliveryMode: "onsite",
        startTime: saleStart,
        endTime: saleEnd,
      },
      "Europe/London",
    );
    expect(conflicts).toHaveLength(0);
  });

  it("does not block hybrid sales because saving the schedule syncs draft lots", () => {
    const conflicts = findPersistBlockingLotWindowConflicts(
      [mismatchedLot],
      {
        timeZone: "Europe/London",
        deliveryMode: "hybrid",
        startTime: saleStart,
        endTime: saleEnd,
      },
      "Europe/London",
    );
    expect(conflicts).toHaveLength(0);
  });
});

describe("proposeLotTimesWithinWindow", () => {
  it("clamps lot start to sale start when lot opens too early", () => {
    const proposed = proposeLotTimesWithinWindow(
      {
        startTime: new Date("2030-05-01T10:00:00Z"),
        endTime: new Date("2030-05-02T18:00:00Z"),
      },
      { timeZone: "Europe/London", deliveryMode: "online", startTime: saleStart, endTime: saleEnd },
    );
    expect(proposed.startTime.getTime()).toBeGreaterThanOrEqual(saleStart.getTime());
    expect(proposed.endTime.getTime()).toBeLessThanOrEqual(saleEnd.getTime());
    expect(proposed.endTime.getTime()).toBeGreaterThan(proposed.startTime.getTime());
  });

  it("uses sale window for onsite sales", () => {
    const proposed = proposeLotTimesWithinWindow(
      {
        startTime: new Date("2020-01-01T00:00:00Z"),
        endTime: new Date("2020-01-02T00:00:00Z"),
      },
      { timeZone: "Europe/London", deliveryMode: "onsite", startTime: saleStart, endTime: saleEnd },
    );
    expect(proposed.startTime).toEqual(saleStart);
    expect(proposed.endTime).toEqual(saleEnd);
  });
});

describe("a draft sale changing zone", () => {
  // Staggered draft lots typed on the London clock, saved in a London sale.
  const london = (n: number) => new Date(Date.UTC(2030, 10, 12, 10, n * 5));
  const lots = Array.from({ length: 6 }, (_, n) => ({
    id: `lot-${n}`,
    title: `Lot ${n}`,
    status: "draft" as const,
    startTime: london(n),
    endTime: new Date(Date.UTC(2030, 10, 15, 18, n * 5)),
  }));
  // The same 10:00 to 18:00 wall-clock window, now read in Paris.
  const parisWindow = {
    timeZone: "Europe/Paris",
    deliveryMode: "online" as const,
    startTime: new Date("2030-11-12T09:00:00Z"),
    endTime: new Date("2030-11-15T17:30:00Z"),
  };

  it("is judged against the draft lots as they will stand after the zone change", () => {
    // Read on the old clock these lots close at 18:00 to 18:25Z, after the window's 17:30Z end,
    // and would block the save; moved to Paris they close at 17:00 to 17:25Z, inside it.
    expect(findPersistBlockingLotWindowConflicts(lots, parisWindow, "Europe/London")).toEqual([]);
    expect(findLotsOutsideSaleWindow(lots, parisWindow).length).toBeGreaterThan(0);
  });

  it("moves each draft lot by its own wall clock, keeping the stagger", () => {
    const moved = lotsForPendingWindow(lots, "Europe/London", parisWindow);
    moved.forEach((lot, n) => {
      expect(lot.startTime.getTime()).toBe(lots[n]?.startTime.getTime() - 3_600_000);
      expect(lot.startTime.getTime() - (moved[0] as typeof lot).startTime.getTime()).toBe(
        n * 5 * 60_000,
      );
    });
  });

  it("leaves lots that are no longer drafts where they are", () => {
    const live = [{ ...(lots[0] as (typeof lots)[number]), status: "active" as const }];
    expect(lotsForPendingWindow(live, "Europe/London", parisWindow)[0]?.startTime).toEqual(
      live[0]?.startTime,
    );
  });
});
