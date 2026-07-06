import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SaleroomLotQuickLookCorner } from "@/components/marketing/lot-quick-look/saleroom-lot-quick-look-corner";
import { SaleroomLotCard } from "@/components/sections/saleroom/saleroom-lot-card";
import { SaleroomLotsGrid } from "@/components/sections/saleroom/saleroom-lots-grid";
import type { SaleLotCardVM } from "@/components/sections/saleroom/view-models";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = join(__dirname, "../../..");

function read(rel: string): string {
  return readFileSync(join(appRoot, rel), "utf8");
}

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
  href: "/lot/test-lot/1",
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

function lotLinks(container: HTMLElement, href: string) {
  return [...container.querySelectorAll(`a[href="${href}"]`)];
}

describe("saleroom catalog SEO contract", () => {
  it("SaleroomLotCard source keeps crawlable lot href bindings", () => {
    const src = read("components/sections/saleroom/saleroom-lot-card.tsx");
    expect(src).toContain("href={lot.href}");
    expect(src).not.toMatch(/onClick=\{[^}]*lot\.href/);
  });

  it("tile SaleroomLotCard renders image and title links to lot.href", () => {
    const { container } = render(
      <SaleroomLotCard lot={lot} saleForLifecycle={hybridSaleForLifecycle} />,
    );

    const links = lotLinks(container, lot.href);
    expect(links.length).toBeGreaterThanOrEqual(2);

    expect(screen.getByRole("link", { name: "Lot 1: Test lot" })).toHaveAttribute("href", lot.href);
    expect(screen.getByRole("link", { name: "Test lot" })).toHaveAttribute("href", lot.href);
  });

  it("row SaleroomLotCard preserves crawlable lot links", () => {
    const { container } = render(
      <SaleroomLotCard lot={lot} saleForLifecycle={hybridSaleForLifecycle} layout="row" />,
    );

    const links = lotLinks(container, lot.href);
    expect(links.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole("link", { name: "Test lot" })).toHaveAttribute("href", lot.href);
  });

  it("SaleroomLotsGrid uses semantic ul/li and keeps lot links with quick-look overlay", () => {
    const { container } = render(
      <SaleroomLotsGrid
        lots={[lot, { ...lot, id: "lot-2", href: "/lot/second/2", title: "Second lot" }]}
        saleForLifecycle={hybridSaleForLifecycle}
        renderCorner={(item) => <SaleroomLotQuickLookCorner lot={item} isAuthenticated={false} />}
      />,
    );

    const grid = container.querySelector("ul");
    expect(grid).toBeInTheDocument();
    expect(container.querySelectorAll("ul > li").length).toBe(2);

    expect(lotLinks(container, lot.href).length).toBeGreaterThanOrEqual(2);
    expect(lotLinks(container, "/lot/second/2").length).toBeGreaterThanOrEqual(2);
  });
});
