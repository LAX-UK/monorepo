import type { Lot } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  findLotsOutsideSaleWindow,
  findPersistBlockingLotWindowConflicts,
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
      { deliveryMode: "online", startTime: saleStart, endTime: saleEnd },
    );
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.violation).toContain("Lot start must not be before");
  });

  it("flags lot end after sale end", () => {
    const conflicts = findLotsOutsideSaleWindow(
      [lot({ endTime: new Date("2030-06-08T18:00:00Z") })],
      { deliveryMode: "online", startTime: saleStart, endTime: saleEnd },
    );
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.violation).toContain("Lot end must not be after");
  });

  it("returns empty when lot fits window", () => {
    const conflicts = findLotsOutsideSaleWindow([lot()], {
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
      { deliveryMode: "onsite", startTime: saleStart, endTime: saleEnd },
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
    const conflicts = findPersistBlockingLotWindowConflicts([mismatchedLot], {
      deliveryMode: "online",
      startTime: saleStart,
      endTime: saleEnd,
    });
    expect(conflicts).toHaveLength(1);
  });

  it("does not block onsite sales because saving the schedule syncs draft lots", () => {
    const conflicts = findPersistBlockingLotWindowConflicts([mismatchedLot], {
      deliveryMode: "onsite",
      startTime: saleStart,
      endTime: saleEnd,
    });
    expect(conflicts).toHaveLength(0);
  });

  it("does not block hybrid sales because saving the schedule syncs draft lots", () => {
    const conflicts = findPersistBlockingLotWindowConflicts([mismatchedLot], {
      deliveryMode: "hybrid",
      startTime: saleStart,
      endTime: saleEnd,
    });
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
      { deliveryMode: "online", startTime: saleStart, endTime: saleEnd },
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
      { deliveryMode: "onsite", startTime: saleStart, endTime: saleEnd },
    );
    expect(proposed.startTime).toEqual(saleStart);
    expect(proposed.endTime).toEqual(saleEnd);
  });
});
