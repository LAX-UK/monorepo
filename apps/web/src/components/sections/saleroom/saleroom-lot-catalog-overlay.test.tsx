import { SaleroomLotCatalogOverlay } from "@/components/sections/saleroom/saleroom-lot-catalog-overlay";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/time/use-clock", () => ({ useClockNow: () => Date.now() }));
vi.mock("@/lib/context/saleroom-live-provider", () => ({
  useSaleroomLive: () => ({
    isSessionLive: true,
    status: "live",
    isLotOnBlock: () => false,
    isLotUpNext: () => false,
  }),
}));

vi.mock("@/lib/lot/catalog-lot-overlay", () => ({
  resolveCatalogLotOverlay: ({ isUpNext }: { isUpNext?: boolean }) =>
    isUpNext
      ? { kind: "saleroom", label: "Up next", tone: "live" }
      : { kind: "saleroom", label: "In saleroom", tone: "muted" },
}));

const lot = (isUpNext: boolean) =>
  ({
    id: "l1",
    status: "active",
    currentBidValue: 100,
    isUpNext,
    isOnBlock: false,
    startTime: new Date(Date.now() - 1000),
    endTime: new Date(Date.now() + 3_600_000),
  }) as never;

const sale = { status: "live", deliveryMode: "saleroom" } as never;

describe("SaleroomLotCatalogOverlay pills", () => {
  it("Up next uses a solid, defined background class with white text", () => {
    render(<SaleroomLotCatalogOverlay lot={lot(true)} saleForLifecycle={sale} />);
    const pill = screen.getByLabelText("Up next");
    expect(pill.className).toContain("bg-brand-900/85");
    expect(pill.className).not.toContain("bg-brand-600");
    expect(pill.className).toContain("text-white");
  });

  it("In saleroom styling is unchanged", () => {
    render(<SaleroomLotCatalogOverlay lot={lot(false)} saleForLifecycle={sale} />);
    expect(screen.getByLabelText("In saleroom").className).toContain("bg-brand-900/70");
  });
});
