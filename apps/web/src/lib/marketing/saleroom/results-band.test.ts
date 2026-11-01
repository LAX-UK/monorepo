import { describe, expect, it } from "vitest";
import { buildResultsBand } from "./results-band";

const lots = [
  { id: "a", title: "Harbour lights", lotNumber: 4 },
  { id: "b", title: "Winter orchard", lotNumber: 9 },
];

const final = (over: Record<string, unknown> = {}) =>
  ({
    state: "final",
    lotCount: 64,
    soldCount: 58,
    currency: "GBP",
    totalWithPremium: "1240000.00",
    topLot: { lotId: "b", priceWithPremium: "182500.00" },
    endedAt: "2026-10-31T18:00:00.000Z",
    ...over,
  }) as never;

describe("buildResultsBand", () => {
  it("shows nothing for a sale with no results phase", () => {
    expect(buildResultsBand(null, lots)).toBeNull();
  });

  it("says the results are being finalised, with no figures", () => {
    const band = buildResultsBand({ state: "finalising", pendingLotCount: 3 }, lots);
    expect(band).toEqual({
      state: "finalising",
      title: "Results are being finalised",
      detail: "Final prices appear here within a day of the close.",
    });
  });

  it("shows sold of total, the total with premium and the top lot", () => {
    const band = buildResultsBand(final(), lots);
    expect(band?.state).toBe("final");
    if (band?.state !== "final") return;
    expect(band.stats.map((s) => [s.label, s.value])).toEqual([
      ["Lots sold", "58 of 64"],
      ["Total with buyer’s premium", "£1,240,000.00"],
      ["Top lot", "£182,500.00"],
    ]);
    expect(band.stats[2]?.detail).toMatchObject({ text: "Lot 9 · Winter orchard" });
    expect(band.stats[2]?.detail?.href).toContain("/lot/");
  });

  it("keeps the top lot's price when its lot is not on the loaded page", () => {
    const band = buildResultsBand(final(), []);
    if (band?.state !== "final") throw new Error("expected final");
    expect(band.stats[2]).toEqual({ label: "Top lot", value: "£182,500.00" });
  });

  it("shows only the count when nothing sold, never a lone zero total", () => {
    const band = buildResultsBand(
      final({ soldCount: 0, totalWithPremium: "0.00", topLot: null }),
      lots,
    );
    if (band?.state !== "final") throw new Error("expected final");
    expect(band.stats).toEqual([{ label: "Lots sold", value: "0 of 64" }]);
  });
});
