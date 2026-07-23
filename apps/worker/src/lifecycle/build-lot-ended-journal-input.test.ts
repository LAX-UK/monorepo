import { describe, expect, it } from "vitest";
import { buildLotEndedJournalInput } from "./build-lot-ended-journal-input.js";

describe("buildLotEndedJournalInput", () => {
  it("maps sold early-close payload to lot.ended journal input", () => {
    const input = buildLotEndedJournalInput({
      lot: {
        id: "lot-1",
        status: "ended",
        saleId: "sale-1",
        sellerLegalEntityId: "le-1",
      },
      payload: {
        outcome: "sold",
        winnerId: "user-1",
        saleId: "sale-1",
        trigger: "early_close",
        hammerPrice: "500.00",
      },
      actorUserId: "user-1",
    });
    expect(input.eventType).toBe("lot.ended");
    expect(input.snapshotPatch.lastSaleOutcome).toBe("sold");
    expect(input.payload.hadWinner).toBe(true);
  });
});
