import { describe, expect, it } from "vitest";
import { atgLotState } from "./atg-lot-state";

const linked = {
  atgLotId: "lot-1",
  lastError: null,
  sold: null as boolean | null,
  numberOfBids: 0,
  remoteStatus: null as string | null,
};

describe("atgLotState", () => {
  it("uses documented GetLots codes before bid counts", () => {
    expect(atgLotState({ ...linked, remoteStatus: "0", numberOfBids: 2 }).label).toBe("Waiting");
    expect(atgLotState({ ...linked, remoteStatus: "1" }).label).toBe("Offered");
    expect(atgLotState({ ...linked, remoteStatus: "2", numberOfBids: 3 }).label).toBe("Not sold");
    expect(atgLotState({ ...linked, remoteStatus: "4", sold: false }).label).toBe("Sold");
  });

  it("falls back when the code is unknown, and never shows the raw digit", () => {
    expect(atgLotState({ ...linked, remoteStatus: "3", numberOfBids: 4 }).label).toBe("4 bids");
    expect(atgLotState({ ...linked, remoteStatus: "7", sold: true }).label).toBe("Sold");
    expect(atgLotState({ ...linked, remoteStatus: "7" }).label).not.toBe("7");
    expect(atgLotState({ ...linked }).label).toBe("On ATG");
  });

  it("keeps sync errors and unpushed lots ahead of status", () => {
    expect(atgLotState({ ...linked, lastError: "nope", remoteStatus: "4" }).label).toBe(
      "Sync error",
    );
    expect(atgLotState({ ...linked, atgLotId: null, remoteStatus: "1" }).label).toBe("Not pushed");
  });
});
