import { describe, expect, it } from "vitest";
import { lotShowsBidAction } from "./lot-bid-action";

describe("lotShowsBidAction", () => {
  it("offers a bid on upcoming and live lots", () => {
    expect(lotShowsBidAction("scheduled")).toBe(true);
    expect(lotShowsBidAction("active")).toBe(true);
  });

  it("never offers a bid on an ended, cancelled or withdrawn lot", () => {
    expect(lotShowsBidAction("ended")).toBe(false);
    expect(lotShowsBidAction("cancelled")).toBe(false);
    expect(lotShowsBidAction("voided")).toBe(false);
  });
});
