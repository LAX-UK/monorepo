import type { AdminLotDetailBundle } from "@/lib/admin/load-lot-detail";
import {
  type AtgLotSellingSummary,
  type AtgSaleSellingSummary,
  toAtgSaleSellingSummary,
} from "@auction/types";
import { TooltipProvider } from "@auction/ui/components/tooltip";
import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { LotDetailShell } from "./lot-detail-shell";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/admin/lots/l1",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/admin/catalog", () => ({
  CatalogBreadcrumbs: () => null,
  CatalogDetailMobileMeta: () => null,
  CatalogDetailShell: ({ meta, children }: { meta?: ReactNode; children?: ReactNode }) => (
    <div>
      <div data-testid="meta">{meta}</div>
      {children}
    </div>
  ),
  CatalogDetailStickyMiniBar: () => null,
  CatalogDetailTabNav: () => null,
}));
vi.mock("@/components/admin/catalog/catalog-post-create-session", () => ({
  CatalogPostCreateSessionRoot: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/admin/catalog/catalog-whats-next-banner", () => ({
  CatalogWhatsNextBanner: () => null,
}));
vi.mock("@/components/admin/admin-lot-detail-actions", () => ({
  AdminLotDetailActions: () => null,
}));
vi.mock("@/components/admin/admin-pin-page-button", () => ({ AdminPinPageButton: () => null }));
vi.mock("@/components/admin/detail-rail", () => ({ QuickActionsRail: () => null }));
vi.mock("@/components/admin/editable-titles", () => ({
  AdminLotEditableTitle: ({ value }: { value: string }) => <h1>{value}</h1>,
}));
vi.mock("@/components/admin/lot-actions/return-to-inventory-button", () => ({
  ReturnToInventoryButton: () => null,
}));
vi.mock("@/components/admin/lot-detail-mobile-publish-cancel", () => ({
  LotDetailMobilePublishCancel: () => null,
}));
vi.mock("@/components/admin/lot-detail-queue-nav", () => ({ LotDetailQueueNav: () => null }));
vi.mock("@/components/admin/lot-detail/lot-context-rail", () => ({ LotContextRail: () => null }));
vi.mock("@/components/admin/lot-detail/lot-detail-connect-notice", () => ({
  LotDetailConnectNotice: () => null,
}));
vi.mock("@/components/admin/lot-detail/lot-detail-readiness-context", () => ({
  LotDetailReadinessProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/admin/lot-detail/lot-status-journey", () => ({
  LotStatusJourney: () => null,
}));
vi.mock("@/components/admin/qr-code/admin-qr-code-button", () => ({
  AdminQrCodeButton: () => null,
}));

const bundle = {
  auction: {
    id: "l1",
    saleId: "s1",
    title: "Harbour at dusk",
    status: "draft",
    lotNumber: 4,
    medium: null,
    images: [],
    description: "Oil on board",
    currentPrice: "100",
    startingPrice: "100",
    endTime: new Date("2026-11-01T18:00:00Z"),
    startTime: new Date("2026-10-20T10:00:00Z"),
    updatedAt: new Date("2026-10-01T00:00:00Z"),
  },
  context: { sale: { id: "s1", title: "Autumn sale", status: "draft" } },
} as unknown as AdminLotDetailBundle;

const sale = (input: Partial<Parameters<typeof toAtgSaleSellingSummary>[0]>) =>
  toAtgSaleSellingSummary({
    saleStatus: "draft",
    atgRemoteStatus: "published",
    atgLinked: true,
    atgSoldLotCount: 0,
    atgApprovedAt: null,
    ...input,
  });
const lotLink = { remoteStatus: "1", lastError: null, sold: null, numberOfBids: 2 };

function renderShell(selling: AtgLotSellingSummary | null) {
  render(
    <TooltipProvider>
      <LotDetailShell lotId="l1" bundle={bundle} publishReadiness={null} selling={selling}>
        <p>Tab content</p>
      </LotDetailShell>
    </TooltipProvider>,
  );
  return within(screen.getByTestId("meta"));
}

describe("LotDetailShell selling badge", () => {
  it("shows the ATG lot state and links to the sale's ATG tab", () => {
    const meta = renderShell({ saleId: "s1", sale: sale({}), lot: lotLink });
    const link = meta.getByRole("link", { name: "On ATG · Offered" });
    expect(link).toHaveAttribute("href", "/admin/sales/s1/atg");
    expect(link).toHaveAccessibleDescription(/ATG White Label/);
  });

  it("shows a sync error instead of the status", () => {
    const meta = renderShell({
      saleId: "s1",
      sale: sale({}),
      lot: { ...lotLink, lastError: "ATG rejected the image" },
    });
    expect(meta.getByRole("link", { name: "On ATG · Sync error" })).toBeInTheDocument();
  });

  it("shows lax.bid, without a link, for a lot in a sale selling on lax.bid", () => {
    const laxSale: AtgSaleSellingSummary = sale({ saleStatus: "active", atgLinked: false });
    const meta = renderShell({ saleId: "s1", sale: laxSale, lot: null });
    expect(meta.getByText("lax.bid")).toBeInTheDocument();
    expect(meta.queryByRole("link")).toBeNull();
  });

  it("shows nothing for a lot that is not on ATG, or without a summary", () => {
    renderShell({ saleId: "s1", sale: sale({ atgLinked: false }), lot: null });
    expect(screen.getByTestId("meta").querySelector("[data-selling-platform]")).toBeNull();
  });
});
