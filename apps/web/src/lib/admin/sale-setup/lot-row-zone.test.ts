import { describe, expect, it } from "vitest";
import { type SaleSetupLotRowContext, saleSetupLotRowToApiPayload } from "./lot-row-schema";

const row = {
  clientRowId: "row-1",
  source: "new" as const,
  title: "Vase",
  sellerLegalEntityId: "7f3ed11b-257a-4fc1-a916-4723c8417c5e",
  categoryIds: ["7f3ed11b-257a-4fc1-a916-4723c8417c5e"],
  auctionType: "english" as const,
  startingPrice: "10.00",
  startTime: "2030-11-12T18:00",
  endTime: "2030-11-15T18:00",
};

function ctx(timeZone: string): SaleSetupLotRowContext {
  return {
    timeZone,
    saleStartTime: new Date("2030-11-12T00:00:00Z"),
    saleEndTime: new Date("2030-11-30T00:00:00Z"),
    deliveryMode: "online",
    englishOnlyAuctionsLocked: false,
  };
}

describe("an unsaved lot row follows the sale's zone", () => {
  it("keeps the typed wall-clock time and reads it in the sale's zone", () => {
    const london = saleSetupLotRowToApiPayload(row, ctx("Europe/London"));
    const newYork = saleSetupLotRowToApiPayload(row, ctx("America/New_York"));
    expect(london.startTime.toISOString()).toBe("2030-11-12T18:00:00.000Z");
    expect(newYork.startTime.toISOString()).toBe("2030-11-12T23:00:00.000Z");
    // The stagger on the wall clock is the same in both zones.
    expect(newYork.endTime.getTime() - newYork.startTime.getTime()).toBe(
      london.endTime.getTime() - london.startTime.getTime(),
    );
  });
});
