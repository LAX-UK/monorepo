import { SaleroomLotQuickLookCorner } from "@/components/marketing/lot-quick-look/saleroom-lot-quick-look-corner";
import { SaleroomLotsGrid } from "@/components/sections/saleroom/saleroom-lots-grid";
import type { SaleLotCardVM } from "@/components/sections/saleroom/view-models";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: (props: { alt: string }) => <img alt={props.alt} />,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/components/sections/saleroom/saleroom-lot-catalog-overlay", () => ({
  SaleroomLotCatalogOverlay: () => <span data-testid="saleroom-lot-catalog-overlay" />,
}));

vi.mock("@/components/marketing/lot-quick-look/lot-quick-look-trigger", () => ({
  LotQuickLookTrigger: () => <button type="button">Quick look</button>,
}));

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

const lot: SaleLotCardVM = {
  id: "lot-1",
  href: "/lot/test/1",
  lotLabel: "Lot 1",
  title: "Test lot",
  imageUrl: "https://example.com/lot.jpg",
  imageAlt: "Test",
  estimateValue: "£1,000",
  currentBidLabel: "Current bid",
  currentBidValue: "£500",
  bidsCountLabel: null,
  closingLabel: null,
  isLive: true,
  viewerOwnsLot: false,
  artistOrMedium: "Artist Name",
  viewerIsWatching: false,
  status: "active",
  startTime: "2026-01-01T00:00:00.000Z",
  endTime: "2026-01-02T00:00:00.000Z",
  closingShort: null,
};

const hybridSaleForLifecycle = {
  status: "active" as const,
  deliveryMode: "hybrid" as const,
  allowOnlineBidsBeforeGoLive: true,
};

describe("SaleroomLotsGrid", () => {
  it("uses equal-height grid stretch classes", () => {
    const { container } = render(
      <SaleroomLotsGrid
        lots={[lot, { ...lot, id: "lot-2", title: "Second lot" }]}
        saleForLifecycle={hybridSaleForLifecycle}
      />,
    );

    const grid = container.querySelector("ul");
    expect(grid?.className).toMatch(/auto-rows-fr/);
    expect(grid?.className).toMatch(/items-stretch/);

    const reveal = container.querySelector(".reveal");
    expect(reveal?.className).toMatch(/h-full/);
    expect(container.querySelector(".reveal__inner")?.className).toMatch(/h-full/);
  });

  it("does not warn about missing keys when rendering quick-look corners in a grid", () => {
    const keyErrors: string[] = [];
    const spy = vi.spyOn(console, "error").mockImplementation((message) => {
      if (String(message).includes("key")) keyErrors.push(String(message));
    });

    render(
      <SaleroomLotsGrid
        lots={[lot, { ...lot, id: "lot-2", title: "Second lot" }]}
        saleForLifecycle={hybridSaleForLifecycle}
        renderCorner={(item) => <SaleroomLotQuickLookCorner lot={item} isAuthenticated={true} />}
      />,
    );

    spy.mockRestore();
    expect(keyErrors).toEqual([]);
  });
});
