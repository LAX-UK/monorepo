import type { LotStatus } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  formatLotCurrentValue,
  formatLotEstimateDisplay,
  formatLotHammerForTable,
} from "./lot-catalog-presenters";

function makeLot(overrides: {
  status?: LotStatus;
  currentPrice?: string;
  startingPrice?: string;
  winnerId?: string | null;
  estimate?: { low: string; high: string; currency: string } | null;
}) {
  return {
    status: overrides.status ?? "draft",
    currentPrice: overrides.currentPrice ?? "100",
    startingPrice: overrides.startingPrice ?? "100",
    winnerId: overrides.winnerId ?? null,
    marketingDetails: {
      estimate: overrides.estimate ?? { low: "500", high: "800", currency: "GBP" },
    },
  };
}

describe("formatLotHammerForTable", () => {
  it("shows from starting price for draft lots", () => {
    const display = formatLotHammerForTable(
      makeLot({ status: "draft", startingPrice: "500", currentPrice: "500" }),
    );
    expect(display.primary).toBe("—");
    expect(display.secondary).toMatch(/From £500/);
  });

  it("shows no bids yet for active lot at starting price", () => {
    const display = formatLotHammerForTable(
      makeLot({ status: "active", startingPrice: "200", currentPrice: "200" }),
    );
    expect(display.primary).toMatch(/£200/);
    expect(display.secondary).toBe("No bids yet");
  });

  it("shows current hammer when active lot has bids", () => {
    const display = formatLotHammerForTable(
      makeLot({ status: "active", startingPrice: "200", currentPrice: "350" }),
    );
    expect(display.primary).toMatch(/£350/);
    expect(display.secondary).toBeUndefined();
  });

  it("shows unsold for ended lot without winner", () => {
    const display = formatLotHammerForTable(
      makeLot({ status: "ended", winnerId: null, currentPrice: "400" }),
    );
    expect(display.primary).toBe("Unsold");
  });

  it("shows hammer for ended sold lot", () => {
    const display = formatLotHammerForTable(
      makeLot({ status: "ended", winnerId: "user-1", currentPrice: "1200" }),
    );
    expect(display.primary).toMatch(/£1,200/);
  });

  it("shows em dash for cancelled lots", () => {
    const display = formatLotHammerForTable(makeLot({ status: "cancelled" }));
    expect(display.primary).toBe("—");
  });
});

describe("formatLotEstimateDisplay", () => {
  it("formats estimate range", () => {
    const display = formatLotEstimateDisplay(
      makeLot({ estimate: { low: "1000", high: "2000", currency: "GBP" } }),
    );
    expect(display.primary).toMatch(/£1,000/);
    expect(display.primary).toMatch(/£2,000/);
  });

  it("returns em dash when estimate missing", () => {
    expect(formatLotEstimateDisplay({ marketingDetails: { estimate: null } }).primary).toBe("—");
  });
});

describe("formatLotCurrentValue", () => {
  it("formats current price for sale lots tab compatibility", () => {
    expect(formatLotCurrentValue({ currentPrice: "250" })).toMatch(/£250/);
  });

  it("returns em dash for empty price", () => {
    expect(formatLotCurrentValue({ currentPrice: "" })).toBe("—");
  });
});
