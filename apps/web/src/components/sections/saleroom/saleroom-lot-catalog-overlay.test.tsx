import { PILL_SURFACE_LIVE } from "@/components/lot-timer/pill-surface";
import { SaleroomLotCatalogOverlay } from "@/components/sections/saleroom/saleroom-lot-catalog-overlay";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const NOW = Date.parse("2026-11-17T12:00:00.000Z");

// Only the clock and the live session are stubbed; the label comes from the real resolver.
vi.mock("@/lib/time/use-clock", () => ({ useClockNow: () => NOW }));
vi.mock("@/lib/context/saleroom-live-provider", () => ({
  useSaleroomLive: () => ({
    isSessionLive: true,
    status: "live",
    isLotOnBlock: () => false,
    isLotUpNext: () => false,
  }),
}));

type LotState = "upNext" | "inSaleroom" | "sold";

const lot = (state: LotState) =>
  ({
    id: `lot-${state}`,
    status: state === "sold" ? "ended" : "active",
    currentBidValue: "100",
    isUpNext: state === "upNext",
    isOnBlock: false,
    winnerId: state === "sold" ? "buyer-1" : null,
    hasWinner: state === "sold",
    startTime: new Date(NOW - 3_600_000),
    endTime: new Date(state === "sold" ? NOW - 60_000 : NOW + 3_600_000),
  }) as never;

const sale = { status: "live", deliveryMode: "hybrid" } as never;
const LABEL: Record<LotState, string> = {
  upNext: "Up next",
  inSaleroom: "In saleroom",
  sold: "Sold",
};

function pillClasses(state: LotState, useOverlayChrome: boolean): string[] {
  const { unmount } = render(
    <SaleroomLotCatalogOverlay
      lot={lot(state)}
      saleForLifecycle={sale}
      layout="overlay"
      useOverlayChrome={useOverlayChrome}
      showTimer={false}
    />,
  );
  const classes = screen.getByLabelText(LABEL[state]).className.split(/\s+/).sort();
  unmount();
  return classes;
}

describe("SaleroomLotCatalogOverlay pills", () => {
  it("resolves the three saleroom labels from lot and session state", () => {
    for (const state of ["upNext", "inSaleroom", "sold"] as const) {
      const { unmount } = render(
        <SaleroomLotCatalogOverlay lot={lot(state)} saleForLifecycle={sale} useOverlayChrome />,
      );
      expect(screen.getByLabelText(LABEL[state])).toBeInTheDocument();
      unmount();
    }
  });

  it("in the catalogue grid, Up next is the same pill as In saleroom and Sold", () => {
    const upNext = pillClasses("upNext", true);
    expect(upNext).toEqual(pillClasses("inSaleroom", true));
    expect(upNext).toEqual(pillClasses("sold", true));
  });

  it("off the image, Up next keeps the solid live surface and never a missing token", () => {
    const upNext = pillClasses("upNext", false);
    for (const token of PILL_SURFACE_LIVE.split(" ")) expect(upNext).toContain(token);
    expect(upNext.some((c) => c.includes("brand-600"))).toBe(false);
  });
});
