import { archiveLotResult } from "@/lib/archive/archive-lot-result";
import { resolveLotStatusPresentation } from "@/lib/presenters/status/resolver";
import { describe, expect, it } from "vitest";

const base = {
  status: "ended" as const,
  currentPrice: "6200.00",
  lotNumber: 7,
  marketingDetails: {},
};

describe("archiveLotResult", () => {
  it("reads a public list lot with hasWinner as sold, with its hammer price in pounds", () => {
    const vm = archiveLotResult({ ...base, winnerId: null, hasWinner: true });
    expect(resolveLotStatusPresentation("ended", vm.statusContext).label).toBe("Sold");
    expect(vm.hammer).toEqual({ label: "Hammer price", value: "£6,200.00" });
  });

  it("reads a lot with a winner id as sold", () => {
    const vm = archiveLotResult({ ...base, winnerId: "buyer-1" });
    expect(resolveLotStatusPresentation("ended", vm.statusContext).label).toBe("Sold");
  });

  it("reads a lot without a winner as unsold and shows no hammer price", () => {
    const vm = archiveLotResult({ ...base, winnerId: null, hasWinner: false });
    expect(resolveLotStatusPresentation("ended", vm.statusContext).label).toBe("Unsold");
    expect(vm.hammer).toBeNull();
  });

  it("labels the catalogue lot number, never an id prefix", () => {
    expect(archiveLotResult({ ...base, winnerId: null }).lotNumberLabel).toBe("Lot 7");
    expect(
      archiveLotResult({ ...base, lotNumber: null, winnerId: null }).lotNumberLabel,
    ).toBeNull();
  });
});
